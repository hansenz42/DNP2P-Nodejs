var dnsd = require('dnsd');

dnsd.createServer(resolve).listen(53, 'localhost');

function resolve(req,res){
	console.log(req);
}