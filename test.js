const p2p = require('./p2p.js');

var peer = new p2p('localhost', 5553,[{host:'127.0.0.1',port:5555}]);

peer.requestDomain('google.com',function(req,ans){
	console.log(req);
	console.log(ans);
})