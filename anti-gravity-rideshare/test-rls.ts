
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
}

async function testRLS() {
    const client = new Client({
        connectionString: databaseUrl,
    });

    try {
        await client.connect();
        console.log('Connected to DB');

        // 1. Get a sample user and ride
        const usersRes = await client.query('SELECT id, role FROM "User" LIMIT 2');
        if (usersRes.rows.length < 2) {
            console.log('Not enough users to test isolation. Please ensure at least 2 users exist.');
            return;
        }

        const userA = usersRes.rows[0];
        const userB = usersRes.rows[1];

        console.log(`Testing with User A: ${userA.id} (${userA.role}) and User B: ${userB.id} (${userB.role})`);

        const ridesRes = await client.query('SELECT id, "riderId" FROM "Ride" LIMIT 1');
        const ride = ridesRes.rows[0];
        if (ride) {
            console.log(`Sample Ride: ${ride.id} for Rider: ${ride.riderId}`);
        }

        // ─── Test 1: User A cannot see User B's profile ───
        console.log('\n--- Test 1: Isolation on "User" table ---');
        await client.query('BEGIN');
        await client.query(`SET LOCAL "request.jwt.claims" TO '{"sub": "${userA.id}", "role": "authenticated", "app_role": "${userA.role}"}'`);
        
        const ownProfile = await client.query(`SELECT id FROM "User" WHERE id = '${userA.id}'`);
        console.log(`User A selects own profile: ${ownProfile.rows.length === 1 ? 'SUCCESS' : 'FAILURE'}`);

        const otherProfile = await client.query(`SELECT id FROM "User" WHERE id = '${userB.id}'`);
        console.log(`User A selects User B profile: ${otherProfile.rows.length === 0 ? 'SUCCESS (Isolated)' : 'FAILURE (Leaked!)'}`);
        await client.query('ROLLBACK');

        // ─── Test 2: Rider cannot see other's rides ───
        if (ride) {
            console.log('\n--- Test 2: Isolation on "Ride" table ---');
            const otherRiderId = userA.id === ride.riderId ? userB.id : userA.id;
            const otherRiderRole = userA.id === ride.riderId ? userB.role : userA.role;

            await client.query('BEGIN');
            await client.query(`SET LOCAL "request.jwt.claims" TO '{"sub": "${otherRiderId}", "role": "authenticated", "app_role": "${otherRiderRole}"}'`);
            
            const forbiddenRide = await client.query(`SELECT id FROM "Ride" WHERE id = '${ride.id}'`);
            console.log(`Unauthorized user selects Ride: ${forbiddenRide.rows.length === 0 ? 'SUCCESS (Isolated)' : 'FAILURE (Leaked!)'}`);
            await client.query('ROLLBACK');
        }

        // ─── Test 3: Admin can see everything ───
        console.log('\n--- Test 3: Admin Access ---');
        await client.query('BEGIN');
        await client.query(`SET LOCAL "request.jwt.claims" TO '{"sub": "admin-id", "role": "authenticated", "app_role": "ADMIN"}'`);
        
        const allUsers = await client.query('SELECT count(*) FROM "User"');
        console.log(`Admin selects all users: SUCCESS (Count: ${allUsers.rows[0].count})`);
        await client.query('ROLLBACK');

    } catch (err) {
        console.error('Test failed with error:', err);
    } finally {
        await client.end();
    }
}

testRLS();
