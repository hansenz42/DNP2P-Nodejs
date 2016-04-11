const compute = require('./trust_compute.js');

var local = {"1":[40,50],"2":[50,60],"3":[70,80]};
var foreign = [{"1":[40,50],"2":[50,60],"3":[70,80],"4":[80,90]},{"1":[2,30],"2":[50,60],"4":[20,50]}]

var rec_trust = compute.recommend(local,foreign);
console.log(compute.lookup('4',local,rec_trust));