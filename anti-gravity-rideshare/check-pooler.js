const dns = require('dns');

const host = 'aws-1-ca-central-1.pooler.supabase.com';

console.log(`Checking DNS resolution for: ${host}`);

dns.resolve6(host, (err, addresses) => {
    if (err) {
        if (err.code === 'ENODATA') {
            console.log('IPv6 (AAAA) resolution: OK (No records)');
        } else {
            console.log('IPv6 (AAAA) resolution failed:', err.code);
        }
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
