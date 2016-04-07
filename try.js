var NodeRSA = require('node-rsa');

var key1 = new NodeRSA();
var key2 = new NodeRSA();

key1.importKey("-----BEGIN RSA PRIVATE KEY-----\nMIIBPAIBAAJBAKN/qzdj6LClRREyFX/ZhTVXgSp43eNSy222X+W55+87Ig+1AGRF\nHQJ3YyDpc9iBYPheCEeAZRrOmNG6zXk5Fr0CAwEAAQJBAKIb79OXyBt9gqGuGwsM\nzbs56+QEu1yttu4tKaBJV+ImE8G0mJamxhe866OdVu5CP0psvQG192qfGetJWAro\nRYECIQDiEmMaVDPGQ+QDYXZkytbcs81cZoyjnMmxktgjOEitpQIhALkkqwFL+BMh\nNpbamQsBRm1WFrOLJm5tBXfuvVXZXyk5AiEAjg03sGeQUNiAAY/QMO0zrWJde94E\nKRpvseCvZxIKuPECIQCEFij6T9y4qSVtEp/FPi+kqZqglVHhzl3sZqMlsGM34QIg\nVGS7llHHThuI0+xpNC1Hd9BGXZoOiEY5xmB56IR1WbU=\n-----END RSA PRIVATE KEY-----");

key2.importKey("-----BEGIN RSA PUBLIC KEY-----\nMEgCQQCjf6s3Y+iwpUURMhV/2YU1V4EqeN3jUstttl/luefvOyIPtQBkRR0Cd2Mg\n6XPYgWD4XghHgGUazpjRus15ORa9AgMBAAE=\n-----END RSA PUBLIC KEY-----");

var mess = {"hello":"hey"};

var sign = key1.sign(mess);

console.log(key2.verify({"hello":"hey"},sign));