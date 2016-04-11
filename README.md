# DNP2P-Nodejs
A Nodejs Implementation of P2P DNS Cacheing System
Use reputation management to prevent DNS cache poisoning attack.
This is system is a backup plan for legacy DNS service. No single-point failure and more robust than legacy one.

##HOW TO RUN
Before running it, you can set initialization peers (seed peers) and legacy DNS server in "settings.json".
Please follow the format of "{"host":(peer host),"port":(peer port)}" when you adding new seed peers.
Because you may want DNP2P to take over your system's DNS setting, after changing system setting, you could put system original DNS server address into "system_dns" section in settings.json. "backup_dns" are alternative public DNS servers, you could change it as well.

After all done!
To run DNP2P. use "node server.js".

##Author Info
Hancheng Zheng, Master of Science, Computer Science and Engineering, Michigan State University
