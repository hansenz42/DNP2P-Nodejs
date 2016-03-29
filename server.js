const p2p = require('./p2p.js');

const PEER_PORT = 5555;
const DNS_PORT = 53;
const SETTING_PATH = 'settings.json';

const dnsd = require('dnsd');
const dns = require('dns');
const fs = require('fs');

var raw_servers = JSON.parse(fs.readFileSync(path, options));
var servers = raw_servers['system_dns'].concat(raw_servers['backup_dns']);
dns.setServers(servers);

dnsd.createServer(resolve).listen(DNS_PORT, 'localhost');
console.log("DNS Server running at " + "localhost" + ":" + DNS_PORT);

var peer = p2p('localhost', PEER_PORT);


function resolve(req, res) {
    var question = res.question[0];
    var hostname = question.name;
    var length = hostname.length;
    var ttl = Math.floor(Math.random() * 3600);

    peer.requestDomain(question, function(req, ans) {
            if (ans) {
                res.answer.push({ name: hostname, type: 'A', data: ans, 'ttl': ttl });
                res.end();
                test_res = test(ans);
                if (test_res)
                    peer.answerVaild(question, ans);
                else
                    peer.answerFail(question, ans);
            } else {
                dns.lookup(hostname, (err, address, family) => {
                        if (err) { consonle.log(err); }
                        test_res = test(address);
                        if (test_res) {
                        	peer.setCache(hostname,address);
                        }
                    }
                });
        }
    }
});

}

function test(address) {

}
