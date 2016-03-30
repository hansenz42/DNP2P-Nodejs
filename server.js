const p2p = require('./p2p.js');

const PEER_PORT = 5555;
const DNS_PORT = 53;
const SETTING_PATH = 'settings.json';

const dnsd = require('dnsd');
const dns = require('dns');
const fs = require('fs');
const ping = require('ping');

var raw_servers = JSON.parse(fs.readFileSync(path, options));
var servers = raw_servers['system_dns'].concat(raw_servers['backup_dns']);
dns.setServers(servers);

dnsd.createServer(resolve).listen(DNS_PORT, 'localhost');
console.log("DNS Server running at " + "localhost" + ":" + DNS_PORT);

var peer = p2p('localhost', PEER_PORT);


function resolve(req, res) {
    var question = res.question[0];
    var hostname = url.parse(question.name)[hostname];
    var length = hostname.length;
    var ttl = Math.floor(Math.random() * 3600);

    peer.requestDomain(question, function(req, ans) {
            if (ans) {
            	for(var e in ans){
            		res.answer.push({ name: hostname, type: 'A', data: e, 'ttl': ttl });
            		test_res = test(question,ans,peer.testVaild,peer.testFail);
            	}
            } else {
                dns.lookup(hostname, (err, reply, family) => {
                	if (err) {consonle.log(err); return;}
                    var address = reply['address'] || reply;
                    res.answer.push({ name: hostname, type: 'A', data: address, 'ttl': ttl });
                    test_res = test(question,address,peer.store_con.setCache,null);
                });
            }
            res.end();
        }
    });

}



function test(question,address,vaild,fail) {
	ping.sys.probe(address,function(isAlive){
		if (isAlive){
			if(valid) valid(question,address);
		}
		else{
			if(fail) fail(question,address);
		}
	});
}
