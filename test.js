const p2p = require('./p2p.js');

var peer = new p2p('127.0.0.1', 5555,[{host:'127.0.0.1',port:5553}]);

peer.requestDomain('google.com',function(req,ans){
	console.log(req);
	console.log(ans);
});

peer.feedback('google.com','1.1.1.1',true);