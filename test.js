const EventEmitter = require('events');

var em = new EventEmitter();

function caller(callback){
	em.on('event',(a)=>{callback(a);});
}

function a(){console.log(a);}
caller(a);
caller((b)=>{console.log(b+1)});


em.removeListener('event',a);

em.emit('event',5);