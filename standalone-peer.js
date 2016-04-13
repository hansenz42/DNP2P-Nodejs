const p2p = require('./p2p.js');
const fs = require('fs');
var os = require('os');

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

var peer = new p2p(local_address, settings['peer_port'],settings['seed_peers']);