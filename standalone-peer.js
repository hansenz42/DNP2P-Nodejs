const SETTING_PATH = 'settings.json';
const p2p = require('./p2p.js');
const fs = require('fs');
const os = require('os');

const REQUEST_INTERVAL = -1;

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

var peer = new p2p(local_address, settings['peer_port'], settings['seed_peers']);

if (REQUEST_INTERVAL > 0) {
    setInterval(function() {
        peer.requestDomain('google.com', function(hostname, answer) {
            console.log("requesting name", hostname, "answer", answer);
        })
    }, REQUEST_INTERVAL);
}
