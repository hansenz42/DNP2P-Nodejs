function c(){
	var that = this;
	setInterval(function(){this.do();}.bind(this),2000);
}

c.prototype.do = function(){console.log(1);}

var a = new c();