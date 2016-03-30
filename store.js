const CACHE_PATH = "store/cache.json";
const TRUST_PATH = "store/trust.json";
const GET_CACHE_NUM = 3;

const fs = require('fs');
const _ = require('underscore');

function StoreControl() {
    this.trust_list = this.loadJSON(TRUST_PATH);
    this.cache = this.loadJSON(CACHE_PATH);
}

StoreControl.prototype.saveJSON = function(path, data) {
    var raw = JSON.stringify(data);
    fs.writeFileSync(path, raw);
}

StoreControl.prototype.loadJSON = function(path) {
    var raw = fs.readFileSync(path);
    return JSON.parse(raw);
}

StoreControl.prototype.saveRecords = function() {
    this.saveJSON(TRUST_PATH, this.trust_list);
    this.saveJSON(CACHE_PATH, this.cache);
}

StoreControl.prototype.setCache = function(request, answer, from) {
	assert(typeof(request) == 'string');
	assert(typeof(answer) == 'string');
	
    if (!from) {
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

StoreControl.prototype.getCache = function(request) {
	assert(typeof(request) == 'string');
    var res = [];
    for (var address in this.cache['request']) {
        var pub_ids = this.cache['request'][address];
        for (var ele_id in pub_ids) {
            var trust = this.getTrust(ele_id);
            if (res.length < GET_CACHE_NUM) {
                res.push({ address: address, trust: trust });
            } else {
                res = _.sortBy(res,'trust');
                var min_rec = _.last(res);
                if (trust > min_rec.trust) {
                	res.pop();
                	res.push({address: address, trust: trust});
                }
            }
        }
    }
    return res;
}

StoreControl.prototype.getTrust = function(id) {
	assert(typeof(id) == 'string');
    if (id == this.rsa.getPubKey()) {
        return 99999999;
    } else {
        return this.trust_list[id];
    }
}

StoreControl.prototype.setTrust = function(id,trust) {
	assert(typeof(id) == 'string');
	this.trust_list[id] = trust;
}

module.exports = StoreControl;
