const ANSWER_TIMEOUT = 1500;
const HOUSEKEEP_INTERVAL = 30000;
const REQUEST_TTL = 10;

const p2p = require('p2p');
const fs = require('fs');
const EventEmitter = require('events');
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

function PeerServer(address, port) {
    this.store_con = new store();
    var well_known_peers = this.store_con.loadJSON(WELL_KNOWN_PEERS_PATH);
    this.peer = p2p.peer({ host: address, port: port, wellKnownPeers: well_known_peers });
    this.peer.handle.search = search.bind(this);
    this.peer.handle.exchangePeer = exchangePeer.bind(this);
    this.peer.handle.answer = answer.bind(this);
    this.peer.handle.exchangeTrust = exchangeTrust.bind(this);
    this.peer_list = well_known_peers;

    this.rsa = new rsa();

    setInterval(this.houseKeep(), HOUSEKEEP_INTERVAL);
    console.log("P2P peer running at " + address + ':' + port);
}

PeerServer.prototype.houseKeep = function() {
    this.store_con.saveJSON(WELL_KNOWN_PEERS_PATH, this.peer.wellknownpeers.get());
    this.store_con.saveRecords();
}

PeerServer.prototype.requestDomain = function(request, callback) {
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

//Handler functions for Peer

function search(payload, done) {
    //check local cache
    //forward to neighbors
    var request = payload['request'];
    var respondTo = payload['respondTo'];
    var ttl = payload['TTL'];

    var answer = this.store_con.getCache(request);
    if (answer.length > 0)
        this.replyRequest(request, answer, respondTo);

    ttl -= 1;
    if (ttl>0)
        this.searchNeighbor(request, respondTo, ttl);
    done('success');
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
    this.store_con.setCache(request, answer, pubkey);
    RespondEvent.emit('answer', request, answer);
    done('success')
}

function exchangeTrust(payload, done) {
    done(this.store_con.trust_list);
}
module.exports = PeerServer;
