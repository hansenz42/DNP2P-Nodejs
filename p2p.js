const ANSWER_TIMEOUT = 500;
const HOUSEKEEP_INTERVAL = 30000;
const REQUEST_TTL = 10;
const IGNORE_TIMEOUT = 10000;
const MIN_PEERS = 4;
const MAX_PEERS = 10;
const WELL_KNOWN_PEERS_PATH = "store/wellknownpeers.json";

const p2p = require('p2p');
const fs = require('fs');
const EventEmitter = require('events');
const _ = require('underscore');
const ping = require('ping');
const rsa = require('./rsa.js');

/*
Protocol Define:
Command: Search
Payload: request, respondTo, ttl

Command: exchangePeer
Return: Peer list [{address, port}]

Command: pushAnswer
Payload: request, answer, public_key

Command: exchangeTrust
Return: Trust list
*/

const store = require('./store.js');
const compute_trust = require('./trust_compute.js');
const assert = require('assert');

var RespondEvent = new EventEmitter();

function PeerServer(address, port, seeds) {
    assert(Array.isArray(seeds));
    this.rsa = new rsa();
    this.store_con = new store(this.rsa);
    this.peer = p2p.peer({ host: address, port: port, wellKnownPeers: seeds });
    this.peer.handle.search = search.bind(this);
    this.peer.handle.exchangePeer = exchangePeer.bind(this);
    this.peer.handle.answer = answer.bind(this);
    this.peer.handle.exchangeTrust = exchangeTrust.bind(this);
    this.peer_list = seeds;
    this.ignore_list = {};

    setInterval(function() { this.maintain(); }.bind(this), HOUSEKEEP_INTERVAL);
    console.log("P2P peer running at " + address + ':' + port);
}

PeerServer.prototype.updatePeerList = function() {
    if (this.peer_list.length == 0)
        return;
    this.searchNeighbor('handle/exchangePeer', null, function(foreign_peers) {
        for (var i in foreign_peers) {
            if (this.peer_list.length <= MAX_PEERS) {
                this.peer_list.push(foreign_peers[i]);
            }
        }
    }.bind(this));
}

PeerServer.prototype.addPeer = function(peer) {
    this.peer_list.push(peer);
}

PeerServer.prototype.removePeer = function(peer) {
    for (var i in this.peer_list) {
        if (_isEqual(peer, this.peer_list[i])) {
            delete this.peer_list[i];
        }
    }
    _.compact(this.peer_list);
}

PeerServer.prototype.maintain = function() {
    console.log('P2P: doing housekeeping');
    this.cleanPeer();
    if (this.peer_list.length < MIN_PEERS)
        this.updatePeerList();
    this.store_con.saveRecords();
}

PeerServer.prototype.cleanPeer = function() {
    this.peer_list.forEach(function(ele, i) {
        ping.sys.probe(ele['host'], function(isAlive) {
            if (!isAlive) {
                this.removePeer(ele['host']);
            }
        }.bind(this))
    });
}

PeerServer.prototype.requestDomain = function(request, callback) {
    assert(typeof(request) == 'string');
    var local_answer = this.store_con.findGoodCache(request);
    if (local_answer.length != 0) {
        process.nextTick(function() { callback(request, local_answer); });
    } else {
        var remote_answer = [];
        var message = {
            request: request,
            respondTo: { host: this.peer.self.host, port: this.peer.self.port },
            TTL: REQUEST_TTL
        }

        this.searchNeighbor('handle/search', message, null);

        var resolve = function(request, answer_li) {
            remote_answer = remote_answer.concat(answer_li);
        }

        RespondEvent.on('answer', resolve);
        setTimeout(() => {
            RespondEvent.removeListener('answer', resolve);
            callback(request, remote_answer);
        }, ANSWER_TIMEOUT);
    }
}

PeerServer.prototype.searchNeighbor = function(remote_cmd, message, callback) {
    for (var i in this.peer_list) {
        console.log(this.peer_list[i]);
        this.peer.remote(this.peer_list[i]).run(remote_cmd, message, (err, result) => {
            if (err) console.log(err);
            if (callback) callback(result);
        });
    }
}

PeerServer.prototype.replyRequest = function(request, answer, to_peer) {
    var message = {request:request,answer:answer};
    var sig = this.rsa.sign(message);
    this.peer.remote(to_peer).run('handle/answer', {
        message: message,
        signature: sig,
        public_key: this.rsa.getPubKey()
    }, (err, result) => {
        if (err) { console.log(err); }
    });
}

PeerServer.prototype.feedback = function(request, answer, is_good) {
    //get feedback from server and set trust values.
    if (is_good)
        var incre = 1;
    else
        var incre = 0;
    var peers = this.store_con.getPeer(request, answer);
    for (var i in peers) {
        var p_trust = this.store_con.getTrustRaw(peers[i]);
        var p_trust = compute_trust.increment(p_trust, incre);
        this.store_con.setTrust(peers[i], p_trust);
    }
}

PeerServer.prototype.checkIgnore = function(request, from_peer) {
    if (this.ignore_list[request]) {
        if (this.ignore_list[request].indexOf(from_peer['host']) != -1) {
            return true;
        }
    }
    return false;
}

PeerServer.prototype.setIgnore = function(request, from_peer) {
    if (this.ignore_list[request]) {
        if (this.ignore_list[request].indexOf(from_peer['host']) == -1) {
            this.ignore_list[request].push(from_peer['host']);
        }
    } else {
        this.ignore_list[request] = [from_peer['host']];
    }
}

PeerServer.prototype.delIgnore = function(request, from_peer) {
    if (this.ignore_list[request]) {
        this.ignore_list[request] = _.without(this.ignore_list[request], from_peer['host']);
    }
    if (this.ignore_list[request].length == 0) {
        delete this.ignore_list[request];
    }

}

//Handler functions for Peer

function search(payload, done) {
    //check if the request is in the ignore list.
    //check local cache
    //forward to neighbors
    var request = payload['request'];
    var respondTo = payload['respondTo'];
    var ttl = payload['TTL'];
    assert(request);
    assert(respondTo);
    assert(ttl);

    if (this.checkIgnore(request, respondTo)) {
        done(null,'ignored');
        return;
    } else {
        this.setIgnore(request, respondTo);
        setTimeout(function() {
            this.delIgnore(request, respondTo);
        }.bind(this), IGNORE_TIMEOUT);
    }

    var answer = this.store_con.findGoodCache(request);
    if (answer.length > 0)
        this.replyRequest(request, answer, respondTo);

    ttl = ttl - 1;
    if (ttl > 0) {
        var message = {
            request: request,
            respondTo: { host: this.peer.self.host, port: this.peer.self.port },
            TTL: REQUEST_TTL
        }
        this.searchNeighbor('handle/search', message, null);
    }
    done(null,'search checked');
}

function exchangePeer(payload, done) {
    //return new neighbor to sender
    done(null,this.store_con.peer_list);
}

function answer(payload, done) {
    //get answer and public key
    //put answer into cache
    var mess = payload['message'];
    var signature = payload['signature'];
    var pubkey = payload['public_key'];
    console.log(signature);
    console.log(mess);
    var vaild = this.rsa.verifyExternal(mess,signature,pubkey);
    if (!vaild){
        done(null,"You LIAR!!!");
        return;
    }
    var request = mess['request'];
    var answer_li = mess['answer'];

    for (var i in answer_li)
        this.store_con.setCache(request, answer_li[i]['address'], pubkey);
    RespondEvent.emit('answer', request, answer_li);
    done(null,'answer got');
}

function exchangeTrust(payload, done) {
    done(null,this.store_con.trust_list);
}

module.exports = PeerServer;