import dns from 'dns';
dns.resolveSrv('_mongodb._tcp.cluster0.qyqyaxh.mongodb.net', (err, addresses) => {
    if (err) console.error("DNS ERROR:", err);
    else console.log("DNS SUCCESS:", addresses);
});
