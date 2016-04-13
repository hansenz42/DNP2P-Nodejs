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
const compute = require('./trust_compute.js');

function StoreControl(rsa) {
    this.rsa = rsa;
    this.local_trust = this.loadJSON(TRUST_PATH);
    this.recommend = {};
    this.cache = this.loadJSON(CACHE_PATH);
    console.log('[P2P STORE] import trust list',this.local_trust);
    console.log('[P2P STORE] import cache',this.cache);
}

StoreControl.prototype.generateRecommend = function(foreigns){
    for (var i in foreigns){
        if (_.isEmpty(foreigns[i]))
            delete foreigns[i]
    }
    _.compact(foreigns);
    this.recommend = compute.recommend(this.local_trust,foreigns);
}

StoreControl.prototype.updateTrustLocal = function(id,incre){
    var trust = this.getTrustLocalRaw(id);
    var new_trust = compute.increment(trust,incre);
    this.setTrust(id,new_trust);
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
    this.saveJSON(TRUST_PATH, this.local_trust);
    this.saveJSON(CACHE_PATH, this.cache);
}

StoreControl.prototype.delCache = function(request, answer){
    assert(typeof(request) == 'string');
    assert(typeof(answer) == 'string');
    if (this.cache[request][answer])
        delete this.cache[request][answer];
}

StoreControl.prototype.setCache = function(request, answer, from) {
    assert(typeof(request) == 'string');
    assert(typeof(answer) == 'string');
    if (!from) {
        from = this.rsa.getPubKey();
    }
    if (this.cache[request]) {
        if (this.cache[request][answer]) {
            if (this.cache[request][answer].indexOf(from)==-1)
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
        for (var ind in pub_ids) {
            var trust = this.getTrust(pub_ids[ind]);
            if (res.length < GET_CACHE_NUM) {
                res.push({answer:address, trust:trust});
            } else {
                res = _.sortBy(res, 'trust');
                var min_rec = _.last(res);
                if (trust > min_rec.trust) {
                    res.pop();
                    res.push({answer:address, trust:trust});
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

StoreControl.prototype.getTrustLocalRaw = function(id) {
	//return raw fractions of trust
    assert(typeof(id) == 'string');
    if (id == this.rsa.getPubKey()) {
        return [1,1];
    } else {
        if (this.local_trust[id])
            return this.local_trust[id];
        else
            return [0,0];
    }
}

StoreControl.prototype.getTrust = function(id){ 
	//return the value of trust
   if (id == this.rsa.getPubKey()) {
        return 1;
    } //
	var fraction = this.getTrustLocalRaw(id);
    return compute.lookup(id,this.local_trust,this.recommend);
}

StoreControl.prototype.getTrustLocal = function(id){
    var fraction = this.getTrustLocalRaw(id);
    if (fraction)
        if (fraction[1]==0)
            return 0;
        else
            return fraction[0]/fraction[1];
    else
        return 0;
}

StoreControl.prototype.setTrust = function(id, trust) {
    assert(typeof(id) == 'string');
    if (id == this.rsa.getPubKey())
        return;
    this.local_trust[id] = trust;
}

module.exports = StoreControl;