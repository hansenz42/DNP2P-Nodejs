const PEER_PORT = 5555;
const DNS_PORT = 53;
const SETTING_PATH = 'settings.json';

const dnsd = require('dnsd');
const dns = require('dns');
const fs = require('fs');
const ping = require('ping');
const p2p = require('./p2p.js');
const assert = require('assert');
const EventEmitter = require('events');

var Event = new EventEmitter;

var settings = JSON.parse(fs.readFileSync(SETTING_PATH));
var servers = settings['system_dns'].concat(settings['backup_dns']);
var peer = new p2p('localhost', PEER_PORT,settings['seed_peers']);
dns.setServers(servers);

var server = dnsd.createServer(resolve);
server.listen(DNS_PORT, 'localhost');
console.log("DNS Server running at " + "localhost" + ":" + DNS_PORT);

function resolve(req, res) {
    var question = req.question[0];   
    var hostname = question.name;
    var length = hostname.length;
    var ttl = Math.floor(Math.random() * 3600);

    Event.on('finish',function(){res.end();});

    peer.requestDomain(hostname, function(ret_hostname, ans) {
        console.log("question resolved");
        console.log(ret_hostname,ans);
        assert(ret_hostname == hostname);
        assert(Array.isArray(ans));
        if (ans.length > 0) {
            for (var i in ans) {
                res.answer.push({ name: hostname, type: 'A', data: ans[i], 'ttl': ttl });
                Event.emit('finish');
                test(ans[i],function(isAilve){peer.feedback(hostname,ans[i],isAilve)});
            }
        } else {
            dns.lookup(hostname, (err, reply, family) => {
                if (err) { 
                    consonle.log(err);
                    return; 
                }
                var address = reply['address'] || reply;
                console.log('legacy dns: '+address);
                res.answer.push({ name: hostname, type: 'A', data: address, 'ttl': ttl });
                Event.emit('finish');
                test(address, function(isAilve){peer.store_con.setCache(hostname,address)});
            });
        }
    });

}

function test(address,callback) {
    ping.sys.probe(address, function(isAlive) {
        callback(isAlive);
    });
}