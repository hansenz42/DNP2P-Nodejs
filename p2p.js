const WELL_KNOWN_PEERS_PATH = "store/wellknownpeers.json";
const CACHE_PATH = "store/cache.json";
const TRUST_PATH = "store/trust.json";
const ANSWER_TIMEOUT = 1500;
const SAVE_RECORDS_INTERVAL = 30000;
const REQUEST_TTL = 10;

const p2p = require('p2p');
const fs = require('fs');
const EventEmitter = require('events');
const rsa = require('./rsa.js');

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
    var well_known_peers = this.loadJSON(WELL_KNOWN_PEERS_PATH);
    this.peer = p2p.peer({ host: address, port: port, wellKnownPeers: well_known_peers });
    this.peer.handle.search = search.bind(this);
    this.peer.handle.exchangePeer = exchangePeer.bind(this);
    this.peer.handle.answer = answer.bind(this);
    this.peer.handle.exchangeTrust = exchangeTrust.bind(this);
    this.peer_list = well_known_peers;
    this.trust_list = this.loadJSON(TRUST_PATH);
    this.cache = this.loadJSON(CACHE_PATH);
    this.rsa = new rsa();

    setInterval(this.saveRecords(), SAVE_RECORDS_INTERVAL);
    console.log("P2P peer running at " + address + ':' + port);
}

PeerServer.prototype.setCache = function (request,answer,from){
	if (!from){
		from = this.rsa.getPubKey();
	}
	if (this.cache[request]) {
		if (this.cache[request][answer]) {
			this.cache[request][answer].push(from);
		} else {
			this.cache[request][answer] = [from];
		}
    } else {
        this.cache[request] = {};
        this.cache[request][answer] = [from];
    }
}

PeerServer.prototype.saveRecords = function() {
    this.saveJSON(TRUST_PATH, this.trust_list);
    this.saveJSON(CACHE_PATH, this.cache);
    this.saveJSON(WELL_KNOWN_PEERS_PATH, this.peer.wellknownpeers.get());
}

PeerServer.prototype.saveJSON = function(path, data) {
    var raw = JSON.stringify(data);
    fs.writeFileSync(path, raw);
}

PeerServer.prototype.loadJSON = function(path) {
    var raw = fs.readFileSync(path);
    return JSON.parse(raw);
}

PeerServer.prototype.requestDomain = function(request, callback) {
    var success = false;
    this.searchNeighbor(request, { address: this.peer.self.address, port: this.peer.self.port }, REQUEST_TTL);

    var resolver = function(request, answer) {
        callback(request, answer);
        success = true
    };

    RespondEvent.on('answer', resolver);
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
            respondTo: {
                address: this.peer.self.address,
                port: this.peer.self.port
            },
            TTL: ttl
        }, (err, result) => {
            if (err) { console.log(err); } });
    }
}

PeerServer.prototype.replyRequest = function(request, answer, to_peer) {
    this.peer.remote(to_peer).run('handle/getAnswer', {
        request: request,
        answer: answer,
        public_key: this.rsa.getPubKey()
    }, (err, result) => {
        if (err) { console.log(err); } });
}

PeerServer.prototype.testVaild = function(request, answer) {

}

PeerServer.prototype.testFail = function(request, answer) {

}

function search(payload, done) {
    //check local cache
    //forward to neighbors
    var request = payload['request'];
    var respondTo = payload['respondTo'];
    var ttl = payload['TTL'];

    if (this.cache['request']) {
        var answer = this.cache['request'][0]['answer']; //TODO
        this.replyRequest(request, answer, respondTo);
    }

    ttl -= 1;
    this.searchNeighbor(request, respondTo, ttl);
}

function exchangePeer(payload, done) {
    //return new neighbor to sender
}

function answer(payload, done) {
    //get answer and public key
    //put answer into cache
    var request = payload['request'];
    var answer = payload['answer'];
    var pubkey = payload['public_key'];
    this.setCache(request,answer,pubkey);
    RespondEvent.emit('answer', request, answer);
}

function exchangeTrust(payload, done){

}
module.exports = PeerServer;
