/*
Data structures
Cache: [{request, answer, public_key},....]
Trust list: [{public_key, [what,over what]]},...]
 */

const CACHE_PATH = "store/cache.json";
const TRUST_PATH = "store/trust.json";
const GET_CACHE_NUM = 3;

const fs = require('fs');
const _ = require('underscore');
const assert = require('assert');

function StoreControl(rsa) {
    this.rsa = rsa;
    this.trust = this.loadJSON(TRUST_PATH);
    this.cache = this.loadJSON(CACHE_PATH);
    console.log('P2P STORE: import trust list');
    console.log(this.trust);
    console.log('P2P STORE: import cache');
    console.log(this.cache);
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
    this.saveJSON(TRUST_PATH, this.trust);
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

StoreControl.prototype.findGoodCache = function(request) {
    assert(typeof(request) == 'string');
    var res = [];
    for (var address in this.cache[request]) {
        var pub_ids = this.cache[request][address];
        for (var ele_id in pub_ids) {
            var trust = this.getTrust(ele_id);
            if (res.length < GET_CACHE_NUM) {
                res.push({ address: address, trust: trust });
            } else {
                res = _.sortBy(res, 'trust');
                var min_rec = _.last(res);
                if (trust > min_rec.trust) {
                    res.pop();
                    res.push({ address: address, trust: trust });
                }
            }
        }
    }
    return res;
}

StoreControl.prototype.getPeer = function(request,answer){
	assert(typeof(request) == 'string');
	assert(typeof(answer) == 'string');
	return this.cache[request][answer];
}

StoreControl.prototype.getTrustRaw = function(id) {
	//return raw fractions of trust
    assert(typeof(id) == 'string');
    if (id == this.rsa.getPubKey()) {
        return [99999999,1];
    } else {
        return this.trust[id];
    }
}

StoreControl.prototype.getTrust = function(id){ 
	//return the value of trust
	var fraction = this.getTrustRaw(id);
    if (fraction)
        return fraction[0]/fraction[1];
    else
        return 0
}

StoreControl.prototype.setTrust = function(id, trust) {
    assert(typeof(id) == 'string');
    this.trust[id] = trust;
}

module.exports = StoreControl;