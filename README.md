# DNP2P-Nodejs
A Nodejs Implementation of P2P DNS Cacheing System
Use reputation management to prevent DNS cache poisoning attack.
This is system is a backup plan for legacy DNS service. No single-point failure and more robust than legacy one.

##Setting Before Running
Before running it, you can set initialization peers (seed peers) and legacy DNS server in "settings.json".
Please follow the format of "{"host":(peer host),"port":(peer port)}" when you adding new seed peers.
Because you may want DNP2P to take over your system's DNS setting, after changing system setting, you could put system original DNS server address into "system_dns" section in settings.json. "backup_dns" are alternative public DNS servers, you could change it as well.

#How To RUN!
To run DNP2P. fire

> node server.js

#Trouble Shooting
* Sometimes you may need to run as admin to use port 53 (DNS port) on Linux or Unix based system. If it tells you it does have right to open a port/read file/write file, please use "sudo".
* If it says WARNING, THIS PEER IS LONELY FOREVER, you should wait for other peer to connect you or put new seed peers into settings.json.

##Author Info
Hancheng Zheng, Master of Science, Computer Science and Engineering, Michigan State University
Email: zhengh11@msu.edu
