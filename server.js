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
var peer = new p2p(local_address, PEER_PORT, settings['seed_peers']);
dns.setServers(servers);

var server = dnsd.createServer(resolve);
server.listen(DNS_PORT, 'localhost');
console.log("DNS Server running at " + "localhost" + ":" + DNS_PORT);

function resolve(req, res) {
    var question = req.question[0];
    var hostname = question.name;
    var length = hostname.length;
    var ttl = Math.floor(Math.random() * 3600);

    Event.on('finish', function() { res.end(); });

    peer.requestDomain(hostname, function(ret_hostname, ans) {
        assert(ret_hostname == hostname);
        assert(Array.isArray(ans));
        console.log("[DNS] question resolved", ret_hostname, ans);
        ans = filterAns(ans);
        if (ans.length > 0) {
            for (var i in ans) {
                res.answer.push({ name: hostname, type: 'A', data: ans[i]['answer'], 'ttl': ttl });
                test(ans[i]['answer'], function(isAlive) { peer.feedback(hostname, ans[i]['answer'], isAlive) });
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
                    test(address, function(isAlive) {
                        if (isAlive) { peer.store_con.setCache(hostname, address); } });
                }
                Event.emit('finish');
            });
        }
    });

}

function test(address, callback) {
    ping.sys.probe(address, function(isAlive) {
        callback(isAlive);
    });
}

function filterAns(ans) {
    for (var i in ans) {
        if (ans[i]['trust'] < TRUST_THRESHOLD) {
            delete ans[i];
        }
    }
    _.compact(ans);
    return ans;
}
