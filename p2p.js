const ANSWER_TIMEOUT = 1500;
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

PeerServer.prototype.updatePeerList = function(){
    if (this.peer_list.length == 0)
        return;
    this.searchNeighbor('handle/exchangePeer',function (foreign_peers){
        for (var e in foreign_peers){
            if (this.peer_list.length <= MAX_PEERS){
                this.peer_list.push(e);
            }
        }
    }.bind(this));
}

PeerServer.prototype.addPeer = function(peer) {
    this.peer_list.push(peer);
}

PeerServer.prototype.removePeer = function(peer) {
    for (var e in this.peer_list) {
        if (_isEqual(peer, e)) {
            delete e;
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
        ping.sys.probe(ele['address'], function(isAlive) {
            if (!isAlive) {
                this.removePeer(ele['address']);
            }
        }.bind(this))
    });
}

PeerServer.prototype.requestDomain = function(request, callback) {
    assert(typeof(request) == 'string');
    var local_answer = this.store_con.findGoodCache(request);
    if (local_answer) {
        process.nextTick(function() { callback(request, local_answer); });
    } else {
        var success = false;
        this.searchNeighbor('handle/search', request, { address: this.peer.self.address, port: this.peer.self.port }, REQUEST_TTL);

        RespondEvent.on('answer', function(request, answer) {
            callback(request, answer);
            success = true;
        });
        setTimeout(() => {
            RespondEvent.removeListener('answer', resolve);
            if (!success) {
                callback(request, null);
            }
        }, ANSWER_TIMEOUT);
    }
}


PeerServer.prototype.searchNeighbor = function(remote_cmd, request, respondTo, ttl, callback) {
    for (var ele_peer in this.peer_list) {
        this.peer.remote(ele_peer).run('handle/search', {
            request: request,
            respondTo: respondTo,
            TTL: ttl
        }, (err, result) => {
            if (err) console.log(err);
            if (callback) callback(result);
        });
    }
}


PeerServer.prototype.replyRequest = function(request, answer, to_peer) {
    this.peer.remote(to_peer).run('handle/getAnswer', {
        request: request,
        answer: answer,
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
    var peers = this.store_con.getPeer(request,answer);
    for (var p in peers){
        var p_trust = this.store_con.getTrustRaw(p);
        var p_trust = compute_trust.increment(p_trust,incre);
        this.store_con.setTrust(p,p_trust);
    }
}

PeerServer.prototype.checkIgnore = function(request, from_peer) {
    if (this.ignore_list[request]) {
        if (this.ignore_list[request].indexOf(from_peer['address']) != -1) {
            return true;
        }
    }
    return false;
}


PeerServer.prototype.setIgnore = function(request, from_peer) {
    if (this.ignore_list[request]) {
        if (this.ignore_list[request].indexOf(from_peer['address']) == -1) {
            this.ignore_list[request].push(from_peer['address']);
        }
    } else {
        this.ignore_list[request] = [from_peer['address']];
    }
}

PeerServer.prototype.delIgnore = function(request, from_peer) {
    if (this.ignore_list[request]) {
        this.ignore_list[request] = _.without(this.ignore_list[request], from_peer['address']);
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
        done('ignored');
        return;
    } else {
        this.setIgnore(request, respondTo);
        setTimeout(function() {
            this.delIgnore(request, respondTo);
        }, IGNORE_TIMEOUT);
    }

    var answer = this.store_con.findGoodCache(request);
    if (answer.length > 0)
        this.replyRequest(request, answer, respondTo);

    ttl -= 1;
    if (ttl > 0)
        this.searchNeighbor('handle/search', request, respondTo, ttl);
    done('search checked');
}

function exchangePeer(payload, done) {
    //return new neighbor to sender
    done(this.store_con.peer_list);
}

function answer(payload, done) {
    //get answer and public key
    //put answer into cache
    var request = payload['request'];
    var answer = payload['answer'];
    var pubkey = payload['public_key'];
    assert(request);
    assert(answer);
    assert(pubkey);

    this.store_con.setCache(request, answer, pubkey);
    RespondEvent.emit('answer', request, answer);
    done('answer got');
}

function exchangeTrust(payload, done) {
    done(this.store_con.trust_list);
}

module.exports = PeerServer;
