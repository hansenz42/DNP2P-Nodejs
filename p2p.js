const p2p = require('p2p');

function Peer(address,port){
	this.peer = p2p.peer({host: address,port: port});
	this.peer.handle.foo = (payload, done)=>{};

	console.log("P2P peer running at "+address+':'+port);
}

module.exports = Peer;