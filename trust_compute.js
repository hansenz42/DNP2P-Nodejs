const ALPHA = 0.2;
const DECAY = 0.5;

const _ = require('underscore');
const assert = require('assert');

function increment(local_trust, incre) {
    assert(incre == 1 || incre == 0);
    assert(Array.isArray(local_trust));
    assert(local_trust.length == 2);

    var numer = local_trust[0];
    var denom = local_trust[1];
    return [numer * DECAY + incre, denom * DECAY + 1];
}

function calculatepair(local_list, foreign_list) {
    var local_keys = _.keys(local_list);
    var foreign_keys = _.keys(foreign_list);
    var common_keys = _.intersection(local_keys, foreign_keys);
    var num_common = common_keys.length;
    var common_pairs = _.zip(_.pick(local_list, common_keys), _.pick(foreign_list, common_keys));
    var sum = 0;
    for (var c in common_pairs) {
        sum = (c[0] + c[1]) * (c[0] + c[1]) + sum;
    }
    sum = sum / num_common;
    var sim = 1 - Math.sqrt(sum);
    return sim;
}

function recommend(local, foreigns) {
    console.log("local trust:");
    console.log(local);
    console.log("foreign trusts:");
    console.log(foreigns);
    var sims = [];
    for (var i in foreigns) {
        sims.push(calculatepair(local, foreigns[i]));
    }
    console.log("sims");
    console.log(sims);
    var rec_trust = {};
    for (var table_i in foreigns) {
        var sim = sims[table_i];
        for (var ele_i in foreigns[table_i]) {
            var peer_trust = foreigns[table_i][ele_i];
            console.log("peer_trust",peer_trust);
            var to_add = rec_trust[ele_i];
            console.log("to_add",to_add);
            if (to_add) {
                rec_trust[ele_i][0] = to_add[0] + sim * peer_trust[0]/peer_trust[1];
                rec_trust[ele_i][1] = to_add[1] + sim;
            } else {
                rec_trust[ele_i] = [sim * peer_trust[0]/peer_trust[1], sim];
            }
        }

    }
    console.log("recommend",rec_trust);
    return rec_trust;
}

function lookup(id, local, recommend) {
	var local_trust = 0;
	var rec_trust = 0;
    if(local[id]){
    	if (local[id][1]==0)
    		local_trust = 0;
    	else
    		local_trust = (local[id][0]/local[id][1]);
    }
    if(recommend[id]){
    	if (recommend[id][1] == 0)
    		rec_trust = 0;
    	else
    		rec_trust = (recommend[id][0]/recommend[id][1]);
    }
    var ret = (1 - ALPHA) * local_trust + ALPHA * rec_trust;
    return ret;
}

exports.increment = increment;
exports.recommend = recommend;
exports.lookup = lookup;
