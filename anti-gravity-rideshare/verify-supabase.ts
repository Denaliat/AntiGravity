
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // Or service role key for admin tasks
// const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Uncomment to test admin access

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log(`Connecting to Supabase at ${supabaseUrl}...`);

    // Try to fetch a single user (even if empty, it tests connection)
    const { data, error } = await supabase.from('User').select('count', { count: 'exact', head: true });

    if (error) {
        console.error('Connection failed:', error.message);
        console.error('Details:', error);
        process.exit(1);
    } else {
        console.log('Successfully connected to Supabase!');
        console.log('User count:', data); // data is null for head: true, count is in 'count' property
    }
}

main();
