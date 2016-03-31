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
	var sim = Math.sqrt(sum);
}

function recommend(local,foreigns){
	for (var one in foreigns){
		var fraction = calculatepair(local,one);
	}
}

exports.local = local;
exports.recommend = recommend;