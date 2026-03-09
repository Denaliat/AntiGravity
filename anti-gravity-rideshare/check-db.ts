
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

async function checkConn() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
        await client.connect();
        console.log('Connected!');
        const res = await client.query('SELECT current_user, current_database()');
        console.log('User/DB:', res.rows[0]);
        await client.end();
    } catch (err) {
        console.error('Conn Error:', err);
    }
}
checkConn();
