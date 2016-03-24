const p2p = require('./p2p');
const rsa = require('./rsa.js');

const PEER_PORT = 5353;
const DNS_PORT = 5555;

var dnsd = require('dnsd');
dnsd.createServer(resolve).listen(DNS_PORT,'localhost');
console.log("DNS Server running at "+"localhost"+":"+DNS_PORT);

var peer = p2p('localhost',PEER_PORT);


function resolve(req,res){

}