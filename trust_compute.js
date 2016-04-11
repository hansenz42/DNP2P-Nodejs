const ALPHA = 0.8;
const DECAY = 0.5;

const _ = require('underscore');

function increment(local_trust,incre){
	var numer = local_trust[0];
	var denom = local_trust[1];
	return [numer*DECAY+incre,denom*DECAY+1];
}

function calculatepair(local_list,foreign_lists){
	var local_keys = _.keys(local_list);
	var foreign_keys = _.keys(foreign_list);
	var common_keys = _.intersection(local_keys,foreign_keys);
	var num_common = common_keys.length;
	var common_pairs = _.zip(_.pick(local_list,common_keys),_.pick(foreign_list,common_keys));
	var sum = 0;
	for (var c in common_pairs){
		sum = (c[0]+c[1])*(c[0]+c[1]) + sum;
	}
	sum = sum / num_common;
	var sim = 1-Math.sqrt(sum);
	return sim;
}

function recommend(local,foreigns){
	var sims = [];
	for (var i in foreigns){
		sims.push(calculatepair(local,foreigns[i]));
	}
	var rec_trust = {};
	for (var table_i in foreigns){
		var sim = sims[table_i];
		for (var ele_i in foreigns[table_i]){
			var peer_trust = foreigns[table_i][ele_i];
			var to_add = rec_trust[ele_i];
			if (to_add){
				rec_trust[ele_i][0] = to_add[0]+sim*peer_trust;
				rec_trust[ele_i][1] = to_add[1]+sim;
			} else {
				rec_trust[ele_i] = [sim*peer_trust,sim];
			}
		}
	}
	return combine(local,rec_trust);
}

function combine(local,recommend){
	for(var ele_i in recommend){
		if(local[ele_i]){
			local[ele_i] = (1-ALPHA)*local[ele_i] + ALPHA*recommend[ele_i];
		} else {
			local[ele_i] = ALPHA*recommend[ele_i];
		}
	}
	return local;
}

exports.increment = increment;
exports.recommend = recommend;