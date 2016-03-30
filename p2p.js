const ANSWER_TIMEOUT = 1500;
const HOUSEKEEP_INTERVAL = 30000;
const REQUEST_TTL = 10;
const IGNORE_TIMEOUT = 10000;
const WELL_KNOWN_PEERS_PATH = "store/wellknownpeers.json";

const p2p = require('p2p');
const fs = require('fs');
const EventEmitter = require('events');
const _ = require('underscore');
const ping = require('ping');
const rsa = require('./rsa.js');
const store = require('./store.js');

var RespondEvent = new EventEmitter();

/*
Protocol Define:
Command: Search
Payload: request, respondTo, ttl

Command: AskNewPeerServer
Payload: respondTo
Return: {address, port}

Command: pushAnswer
Payload: request, answer, public_key
 */

function PeerServer(address, port, seeds) {
    assert(Array.isArray(seeds));
    this.store_con = new store();
    this.peer = p2p.peer({ host: address, port: port, wellKnownPeers: seeds});
    this.peer.handle.search = search.bind(this);
    this.peer.handle.exchangePeer = exchangePeer.bind(this);
    this.peer.handle.answer = answer.bind(this);
    this.peer.handle.exchangeTrust = exchangeTrust.bind(this);
    this.peer_list = well_known_peers;
    this.ignore_list = {};
    this.rsa = new rsa();

    setInterval(function(){this.maintain();}.bind(this), HOUSEKEEP_INTERVAL);
    console.log("P2P peer running at " + address + ':' + port);
}

PeerServer.prototype.addPeer = function(peer){
    this.peer_list.push(peer);
}

PeerServer.prototype.removePeer = function(peer){
    for (var e in this.peer_list){
        if(_isEqual(peer,e)){
            delete e;
        }
    }
    _.compact(this.peer_list);
}

PeerServer.prototype.maintain = function() {
    console.log('P2P: doing housekeeping');
    this.cleanPeer();
    this.store_con.saveRecords();
}

PeerServer.prototype.cleanPeer = function(){
    this.peer_list.forEach(function(ele,i){
        ping.sys.probe(ele['address'],function(isAlive){
            if(!isAlive){
                this.removePeer(ele['address']);
            }
        }.bind(this))
    });
}

PeerServer.prototype.requestDomain = function(request, callback) {
    assert(type(request) == 'string');
    var success = false;
    this.searchNeighbor(request, { address: this.peer.self.address, port: this.peer.self.port }, REQUEST_TTL);

    RespondEvent.on('answer', function(request, answer){callback(request, answer); success = true;});
    setTimeout(() => {
        RespondEvent.removeListener('answer', resolve);
        if (!success) {
            callback(request, null);
        }
    }, ANSWER_TIMEOUT);
}


PeerServer.prototype.searchNeighbor = function(request, respondTo, ttl) {
    for (var ele_peer in this.peer_list) {
        this.peer.remote(ele_peer).run('handle/search', {
            request: request,
            respondTo: respondTo,
            TTL: ttl
        }, (err, result) => {
            if (err) { console.log(err); }
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

PeerServer.prototype.testVaild = function(request, answer) {

}

PeerServer.prototype.testFail = function(request, answer) {

}

PeerServer.prototype.checkIgnore = function(request,from_peer){
    if (this.ignore_list[request]){
        if (this.ignore_list[request].indexOf(from_peer['address']) != -1){
            return true;
        }
    }
    return false;
}

PeerServer.prototype.setIgnore = function(request,from_peer){
    if (this.ignore_list[request]){
        if (this.ignore_list[request].indexOf(from_peer['address']) == -1){
            this.ignore_list[request].push(from_peer['address']);
        }
    } else {
        this.ignore_list[request] = [from_peer['address']];
    }
}

PeerServer.prototype.delIgnore = function(request,from_peer){
    if (this.ignore_list[request]){
        this.ignore_list[request] = _.without(this.ignore_list[request],from_peer['address']);
    }
    if (this.ignore_list[request].length == 0){
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

    if (this.checkIgnore(request,respondTo)){
        done('ignored');
        return;
    } else {
        this.setIgnore(request,respondTo);
        setTimeout(function(){
            this.delIgnore(request,respondTo);
        },IGNORE_TIMEOUT);
    }

    var answer = this.store_con.getCache(request);
    if (answer.length > 0)
        this.replyRequest(request, answer, respondTo);

    ttl -= 1;
    if (ttl>0)
        this.searchNeighbor(request, respondTo, ttl);
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
