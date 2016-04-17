const SETTING_PATH = 'settings.json';
var PEER_PORT = 5555;
var DNS_PORT = 53;
var TRUST_THRESHOLD = 0.3;

const dnsd = require('dnsd');
const dns = require('dns');
const fs = require('fs');
const ping = require('ping');
const p2p = require('./p2p.js');
const assert = require('assert');
const EventEmitter = require('events');
const _ = require('underscore');
var os = require('os');

var Event = new EventEmitter;

var interfaces = os.networkInterfaces();
var local_addresses = [];
for (var k in interfaces) {
    for (var k2 in interfaces[k]) {
        var addr = interfaces[k][k2];
        if (addr.family === 'IPv4' && !addr.internal) {
            local_addresses.push(addr.address);
        }
    }
}

var local_address = local_addresses[0];

var settings = JSON.parse(fs.readFileSync(SETTING_PATH));
var servers = settings['system_dns'].concat(settings['backup_dns']);
TRUST_THRESHOLD = settings['trust_threshold'];
PEER_PORT = settings['peer_port'];
DNS_PORT = settings['dns_port'];
var peer = new p2p(local_address, PEER_PORT, settings['seed_peers'], TRUST_THRESHOLD);
dns.setServers(servers);

var server = dnsd.createServer(resolve);
server.listen(DNS_PORT, 'localhost');
console.log("DNS Server running at " + "localhost" + ":" + DNS_PORT);

function resolve(req, res) {
    var question = req.question[0];
    var hostname = question.name;
    var length = hostname.length;
    var ttl = Math.floor(Math.random() * 3600);
    console.log("[DNS] question got:", hostname);

    Event.on('finish', function() { res.end(); });

    peer.requestDomain(hostname, function(ret_hostname, ans) {
        assert(ret_hostname == hostname);
        assert(Array.isArray(ans));
        console.log("[DNS] question resolved", ret_hostname, ans);
        if (ans.length > 0) {
            for (var i in ans) {
                res.answer.push({ name: hostname, type: 'A', data: ans[i]['answer'], 'ttl': ttl });
                peer.test(ans[i]['answer'], function(addr, isAlive) { peer.feedback(hostname, addr, isAlive) });
            }
            Event.emit('finish');
        } else {
            dns.resolve(hostname, (err, reply) => {
                if (err) {
                    consonle.log(err);
                    return;
                }
                console.log('[DNS] answer from legacy DNS: ', reply);
                for (var i in reply) {
                    var address = reply[i];
                    res.answer.push({ name: hostname, type: 'A', data: address, 'ttl': ttl });
                    peer.test(address, function(addr, isAlive) {
                        if (isAlive) { peer.store_con.setCache(hostname, addr); }
                    });
                }
                Event.emit('finish');
            });
        }
    });

}

function filterAns(ans) {
    for (var i in ans) {
        if (ans[i]['trust'] < TRUST_THRESHOLD) {
            delete ans[i];
        }
    }
    ans = _.compact(ans);
    return ans;
}
