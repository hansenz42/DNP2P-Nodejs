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

// Timeout Settings
const ANSWER_TIMEOUT = 40;
const CHECK_REPLY_INTERVAL = 20;
const IGNORE_TIMEOUT = 10000;
const WAIT_TIMEOUT = 2000;

// Other Settings
const HOUSEKEEP_INTERVAL = 20000;
const REQUEST_TTL = 10;
const MIN_PEERS = 4;
const MAX_PEERS = 10;
const WELL_KNOWN_PEERS_PATH = "store/wellknownpeers.json";
const SHRINK_CACHE_NUM = 3;

const p2p = require('p2p');
const fs = require('fs');
const EventEmitter = require('events');
const _ = require('underscore');
const rsa = require('./rsa.js');
const store = require('./store.js');
const compute_trust = require('./trust_compute.js');
const assert = require('assert');
const ping = require('ping');

var RespondEvent = new EventEmitter();

function PeerServer(address, port, seeds, trust_threshold) {
    if (!trust_threshold) {
        trust_threshold = 0.3;
    }
    this.trust_threshold = trust_threshold;
    assert(Array.isArray(seeds));
    this.rsa = new rsa();
    this.store_con = new store(this.rsa);
    this.peer = p2p.peer({ host: address, port: port });
    this.peer.handle.search = search.bind(this);
    this.peer.handle.exchangePeer = exchangePeer.bind(this);
    this.peer.handle.answer = answer.bind(this);
    this.peer.handle.exchangeTrust = exchangeTrust.bind(this);
    this.peer.handle.alive = alive.bind(this);
    this.ignore_list = {};
    this.peer_list = [];
    for (var i in seeds) {
        this.addPeer(seeds[i]);
    }

    this.maintain();
    setInterval(function() { this.maintain(); }.bind(this), HOUSEKEEP_INTERVAL);
    console.log("[P2P] P2P peer running at " + address + ':' + port);
}

PeerServer.prototype.test = function(addr, callback) {
    ping.sys.probe(addr, function(isAlive) {
        callback(addr, isAlive);
    });
}

PeerServer.prototype.updatePeerList = function() {
    if (this.peer_list.length == 0)
        return;
    this.searchNeighbor('handle/exchangePeer', {}, function(foreign_peers) {
        for (var i in foreign_peers) {
            if (this.peer_list.length <= MAX_PEERS) {
                this.addPeer(foreign_peers[i]);
            }
        }
    }.bind(this));
}

PeerServer.prototype.getReputation = function() {
    if (this.peer_list.length == 0)
        return;
    var foreigns = [];
    this.searchNeighbor('handle/exchangeTrust', {}, function(foreign_trust) {
        foreigns.push(foreign_trust);
    }.bind(this));
    setTimeout(function() {
        this.store_con.generateRecommend(foreigns);
    }.bind(this), WAIT_TIMEOUT);
}

PeerServer.prototype.addPeer = function(peer) {
    if (!peer)
        return
    if (peer['host'] == "localhost" || peer['host'] == '127.0.0.1') {
        peer['host'] = this.peer.self.host;
    }
    if (peer['host'] == this.peer.self.host && peer['port'] == this.peer.self.port)
        return;
    for (var ind in this.peer_list) {
        if (this.peer_list[ind]['host'] == peer['host'] && this.peer_list[ind]['port'] == peer['port'])
            return;
    }
    this.peer.remote(peer).run('handle/alive', {host: this.peer.self.host, port: this.peer.self.port}, function(err, result) {
        if (!err){
            this.peer_list.push(peer);
        }
    }.bind(this));
}

PeerServer.prototype.removePeer = function(ind) {
    delete this.peer_list[ind];
}

PeerServer.prototype.maintain = function() {
    console.log('[P2P] housekeeping');
    this.cleanPeer();
    console.log('[P2P] alive connected peers ' + this.peer_list.length);
    if (this.peer_list.length == 0)
        console.log('[P2P] WARNING this peer is lonely, you need to start over with new seed peers');
    else
        console.log(this.peer_list);
    if (this.peer_list.length < MIN_PEERS)
        this.updatePeerList();
    this.cleanPeer();
    this.store_con.saveRecords();
    this.getReputation();
}

PeerServer.prototype.cleanPeer = function() {
    this.peer_list.forEach(function(ele, i) {
        this.peer.remote(ele).run('handle/alive', { host: this.peer.self.host, port: this.peer.self.port }, function(err, result) {
            if (err) {
                this.removePeer(i);
            }
        }.bind(this))
    }.bind(this));
    this.peer_list = _.compact(this.peer_list);
}

PeerServer.prototype.requestDomain = function(request, callback) {
    assert(typeof(request) == 'string');
    console.log("[P2P] searching for " + request);
    var local_answer = this.store_con.findGoodCache(request);
    console.log("[P2P] local answer: ", local_answer);
    var remote_answer = [];
    var last_received_time = new Date().getTime();
    var message = {
        request: request,
        respondTo: { host: this.peer.self.host, port: this.peer.self.port },
        TTL: REQUEST_TTL
    }

    this.searchNeighbor('handle/search', message);

    var resolveAnswer = function(request, answer_li, from_peer) {
        var trust = this.store_con.getTrust(from_peer);
        for (var ind in answer_li) {
            remote_answer.push({ answer: answer_li[ind]['answer'], trust: trust });
        }
        last_received_time = new Date().getTime();
    }.bind(this);

    RespondEvent.on('answer', resolveAnswer);

    var intervalid = setInterval(function(){
        var now = new Date().getTime();
        if (now - last_received_time > ANSWER_TIMEOUT){
            if (intervalid){
                clearInterval(intervalid);
            }
            RespondEvent.removeListener('answer', resolveAnswer);
            console.log("[P2P] remote answer: ", remote_answer);
            var answers = local_answer.concat(remote_answer);
            callback(request, shrinkAnswer(answers));
        }
    },CHECK_REPLY_INTERVAL);

}

function shrinkAnswer(answers) {
    var temp = _.sortBy(answers, 'trust');
    temp = temp.slice(0, SHRINK_CACHE_NUM);
    var ret = temp.slice(); //copy
    for (var i in temp) {
        for (var j = Number(i) + 1; j < temp.length; j++) {
            if (j >= temp.length)
                continue;
            if (temp[i]['answer'] == temp[j]['answer']) {
                if (temp[i]['trust'] > temp[j]['trust'])
                    delete ret[j];
                else
                    delete ret[i];
            }
        }
    }
    return _.compact(ret);
}

PeerServer.prototype.searchNeighbor = function(remote_cmd, message, callback) {
    for (var i in this.peer_list) {
        if (!i)
            continue;
        this.peer.remote(this.peer_list[i]).run(remote_cmd, message, function(err, result) {
            if (err) {
                this.removePeer(i);
            }
            if (callback) callback(result);
        }.bind(this));
    }
}

PeerServer.prototype.replyRequest = function(request, answer, to_peer) {
    if (_.isEqual(to_peer, { host: this.peer.self.host, port: this.peer.self.port }))
        return;
    if (answer['trust'] <= this.trust_threshold)
        return;

    for (var i in answer) {
        this.test(answer[i]['answer'], function(addr, isAlive) {
            console.log(addr);
            this.feedback(request, addr, isAlive);
        }.bind(this));
    }


    var message = { request: request, answer: answer };
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
    assert(typeof(request) == 'string');
    assert(typeof(answer) == 'string');
    console.log('[P2P] feedback:', request, answer, 'good?', is_good);
    //get feedback from server and set trust values.
    if (is_good)
        var incre = 1;
    else {
        var incre = 0;
        this.store_con.delCache(request, answer);
    }
    var peers = this.store_con.getPeer(request, answer);
    if (!peers)
        return false;
    for (var i in peers) {
        this.store_con.updateTrustLocal(peers[i], incre);
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
        done(null, 'ignored');
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
            respondTo: respondTo,
            TTL: REQUEST_TTL
        }
        this.searchNeighbor('handle/search', message, null);
    }
    done(null, 'search checked');
}

function exchangePeer(payload, done) {
    //return new neighbor to sender
    done(null, this.peer_list);
}

function answer(payload, done) {
    //get answer and public key
    //put answer into cache
    var mess = payload['message'];
    var signature = payload['signature'];
    var pubkey = payload['public_key'];
    var vaild = this.rsa.verifyExternal(mess, signature, pubkey);
    console.log("[P2P] got answer: ", mess);
    console.log("[STAT] Size:,", JSON.stringify(payload).length, " Time:", new Date().getTime());
    if (!vaild) {
        done(null, "You LIAR!!!");
        return;
    }
    var request = mess['request'];
    var answer_li = mess['answer'];
    for (var i in answer_li)
        this.store_con.setCache(request, answer_li[i]['answer'], pubkey);
    RespondEvent.emit('answer', request, answer_li, pubkey);
    done(null, 'answer got');
}

function exchangeTrust(payload, done) {
    done(null, this.store_con.local_trust);
}

function alive(payload, done) {
    this.addPeer(payload);
    done(null, 'I am alive');
}

module.exports = PeerServer;


