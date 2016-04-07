const PEER_PORT = 5555;
const DNS_PORT = 53;
const SETTING_PATH = 'settings.json';

const dnsd = require('dnsd');
const dns = require('dns');
const fs = require('fs');
const ping = require('ping');
const p2p = require('./p2p.js');
const assert = require('assert');

var settings = JSON.parse(fs.readFileSync(SETTING_PATH));
var servers = settings['system_dns'].concat(settings['backup_dns']);
var peer = new p2p('localhost', PEER_PORT,settings['seed_peers']);
dns.setServers(servers);

dnsd.createServer(resolve).listen(DNS_PORT, 'localhost');
console.log("DNS Server running at " + "localhost" + ":" + DNS_PORT);

function resolve(req, res) {
    var question = res.question[0];
    var hostname = url.parse(question.name)[hostname];
    var length = hostname.length;
    var ttl = Math.floor(Math.random() * 3600);

    peer.requestDomain(question, function(ret_hostname, ans) {
        assert(ret_hostname == hostname);
        assert(Array.isArray(ans));
        if (ans) {
            for (var i in ans) {
                res.answer.push({ name: hostname, type: 'A', data: ans[i], 'ttl': ttl });
                test(ans[i],function(isAilve){peer.feedback(question,ans[i],isAilve)});
            }
        } else {
            dns.lookup(hostname, (err, reply, family) => {
                if (err) { 
                    consonle.log(err);
                    return; 
                }
                var address = reply['address'] || reply;
                res.answer.push({ name: hostname, type: 'A', data: address, 'ttl': ttl });
                test(address, function(isAilve){peer.store_con.setCache(question,address)});
            });
        }
        res.end();
    });

}

function test(address,callback) {
    ping.sys.probe(address, function(isAlive) {
        callback(isAlive);
        }
    });
}
