const dns = require('dns');

const host = 'db.ojcmocyrbzguxwwshqyk.supabase.co';

console.log(`Checking DNS resolution for: ${host}`);

dns.resolve6(host, (err, addresses) => {
    if (err) {
        console.log('IPv6 (AAAA) resolution failed:', err.code);
    } else {
        console.log('IPv6 (AAAA) addresses:', addresses);
    }
});

dns.resolve4(host, (err, addresses) => {
    if (err) {
        console.log('IPv4 (A) resolution failed:', err.code);
    } else {
        console.log('IPv4 (A) addresses:', addresses);
    }
});
