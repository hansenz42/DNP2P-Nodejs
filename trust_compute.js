const RECOMMEND_CONFIDENCE = 0.2;
const DECAY = 0.7;

const _ = require('underscore');
const assert = require('assert');

function increment(local_trust, incre) {
    assert(incre == 1 || incre == 0);
    assert(Array.isArray(local_trust));
    assert(local_trust.length == 3);

    var numer = local_trust[0];
    var denom = local_trust[1];
    return [numer * DECAY + incre, denom * DECAY + 1, local_trust[2] + 1];
}

function getSimilarity(local_list, foreign_list) {
    // console.log('local_list',local_list);
    // console.log('foreign_list',foreign_list);
    var local_keys = _.keys(local_list);
    var foreign_keys = _.keys(foreign_list);
    var common_keys = _.intersection(local_keys, foreign_keys);
    // console.log('common_keys',common_keys);
    var num_common = common_keys.length;
    var common_pairs = _.zip(_.values(_.pick(local_list, common_keys)), _.values(_.pick(foreign_list, common_keys)));
    // console.log('common_pairs',common_pairs);
    var sum = 0;
    for (var i in common_pairs) {
        var c = common_pairs[i];
        var add = ((c[0][0] / c[0][1])-(c[1][0]/c[1][1])) * ((c[0][0] / c[0][1])-(c[1][0]/c[1][1]));
        sum = sum + add;
        // console.log('sum',sum);
    }
    sum = sum / num_common;
    var sim = 1 - Math.sqrt(sum);
    return sim;
}

function recommend(local, foreigns) {
    // console.log("local trust:");
    // console.log(local);
    // console.log("foreign trusts:");
    // console.log(foreigns);
    var sims = [];
    for (var i in foreigns) {
            sims.push(getSimilarity(local, foreigns[i]));
        }
    }
    // console.log("sims");
    // console.log(sims);
    var rec_trust = {};
    for (var table_i in foreigns) {
        var sim = sims[table_i];
        for (var ele_i in foreigns[table_i]) {
            var peer_trust = foreigns[table_i][ele_i];
            var to_add = rec_trust[ele_i];
            if (to_add) {
                rec_trust[ele_i][0] = to_add[0] + sim * peer_trust[0]/peer_trust[1];
                rec_trust[ele_i][1] = to_add[1] + sim;
                rec_trust[ele_i][2] += peer_trust[2] * sim;
            } else {
                rec_trust[ele_i] = [sim * peer_trust[0] / peer_trust[1], sim, peer_trust[2] * sim];
            }
        }

    }
    // console.log("recommend",rec_trust);
    return rec_trust;
}

function lookup(id, local, recommend) {
	var local_trust = 0;
	var rec_trust = 0;
    var local_conf_value = 0;
    var rec_conf_value = 0;
    if(local[id]){
    	if (local[id][1]==0)
    		local_trust = 0;
    	else
    		local_trust = (local[id][0]/local[id][1]);
        if (local[id][2])
            local_conf_value = local[id][2];
    }
    if(recommend[id]){
    	if (recommend[id][1] == 0)
    		rec_trust = 0;
    	else
    		rec_trust = (recommend[id][0]/recommend[id][1]);
        if (recommend[id][2])
            rec_conf_value = recommend[id][2];
        rec_conf_value = rec_conf_value * RECOMMEND_CONFIDENCE;
    }
    var rec_conf = rec_conf_value / (rec_conf_value + local_conf_value);
    if (isNaN(rec_conf))
        var ret = 0;
    else
        var ret = (1 - rec_conf) * local_trust + rec_conf * rec_trust;
    console.log("[TRUST] ID:",id.replace('\n','').replace('\n','').replace('\n','')," Trust:",ret, "Time:", new Date().getTime());
    return ret;
}

exports.increment = increment;
exports.recommend = recommend;
exports.lookup = lookup;
