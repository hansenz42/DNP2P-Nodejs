const WELL_KNOWN_PEERS_PATH = "store/wellknownpeers.json";
const CACHE_PATH = "store/cache.json";
const TRUST_PATH = "store/trust.json";
const ANSWER_TIMEOUT = 10000;
const REQUEST_TTL = 10;

const parser = require('csv-parse/lib/sync');
const stringify = require('csv-stringify');
const p2p = require('p2p');
const fs = require('fs');
const EventEmitter = require('events');
const rsa = require('rsa');

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

function PeerServer(address,port){
	var well_known_peers = loadWellKnownPeer(WELL_KNOWN_PEERS_PATH);
	this.peer = p2p.peer({host: address,port: port, wellKnowPeer: well_known_peers});
	this.peer.handle.search = search.bind(this);
	this.peer.handle.askNewPeer = askNewPeer.bind(this);
	this.peer.handle.getAnswer = getAnswer.bind(this);
	this.peer_list = well_known_peers;
	this.trust_list = this.loadcsv(TRUST_PATH);
	this.cache = this.loadcsv(CACHE_PATH);
	this.rsa = new rsa();

	console.log("P2P peer running at "+address+':'+port);
}

PeerServer.prototype.requestDomain = function (request, callback){
	for (var ele_peer in this.peer_list){
		this.peer.remote(ele_peer).run('handle/search',
			{
				request:request,
				respondTo:{
					address:this.peer.self.address,
					port:this.peer.self.port
				},
				TTL:REQUEST_TTL
			},(err,result)=>{if (err){console.log(err);}});
	}

	var resolver = function(request,answer){callback(request,answer);};

	RespondEvent.on('answer',resolve);
	setTimeout(()=>{RespondEvent.removeListener('answer',resolve);},ANSWER_TIMEOUT);
}

PeerServer.prototype.answerVaild = function(request, answer){

}

PeerServer.prototype.answerFail = function(request, answer){

}

PeerServer.prototype.loadcsv = loadcsv;

function loadcsv(path){
	try{
		var raw = fs.readFileSync(path);
		var records = parse(raw);
	}catch(e){
		return [];
	}
	return records;
}

PeerServer.prototype.savecsv = savecsv;

function savecsv(path,data){
	stringify(data,function (err,output){
		fs.writeFileSync(this.path, output);
	});
}

function loadWellKnownPeer(path) {
	var res = []
	var data = loadcsv(WELL_KNOWN_PEERS_PATH);
	for (var ele in data) {
		res.push({address:ele[0],port:ele[1]});
	}
	return res;
}

function search(payload, done) {
	//check local cache
	//forward to neighbors
}

function askNewPeer(payload, done){
	//return new neighbor to sender
}

function getAnswer(payload, done){
	//get answer and public key
	//put answer into cache
	var request = payload['request'];
	var answer = payload['answer'];
	var pubkey = payload['public_key'];
	if (this.cache.request){

	}else{

	}
	RespondEvent.emit('answer',request,answer);
}

module.exports = PeerServer;