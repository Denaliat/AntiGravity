
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAnon() {
    console.log('--- Testing Anon Access (Should be 0 records) ---');
    
    const { data: users, error: userError } = await supabase.from('User').select('id').limit(1);
    console.log('Anon User access:', users?.length === 0 ? 'SUCCESS (Isolated)' : 'FAILURE (Leaked!)');
    if (userError) console.log('Error (expected if RLS blocks):', userError.message);

    const { data: rides, error: rideError } = await supabase.from('Ride').select('id').limit(1);
    console.log('Anon Ride access:', rides?.length === 0 ? 'SUCCESS (Isolated)' : 'FAILURE (Leaked!)');
    
    console.log('\n--- Testing Admin Access via Service Role ---');
    const adminClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: adminUsers } = await adminClient.from('User').select('id').limit(1);
    console.log('Admin User access:', adminUsers?.length === 1 ? 'SUCCESS (Admin can see)' : 'FAILURE (Admin blocked?)');
}

testAnon();
