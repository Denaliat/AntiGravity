import { prisma } from './src/lib/prisma';

async function main() {
    try {
        console.log('Connecting to database...');
        // Try to count users to verify connection
        const count = await prisma.user.count();
        console.log(`Successfully connected! Found ${count} users.`);
        process.exit(0);
    } catch (e) {
        console.error('Connection failed:', e);
        process.exit(1);
    }
}

main();
