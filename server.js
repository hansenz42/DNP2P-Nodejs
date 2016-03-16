var dnsd = require('dnsd')
dnsd.createServer(function(req,res){
	res.end('1.1.1.1')
}).listen(5555,'127.0.0.1')

console.log('Server running at 127.0.0.1:5555')