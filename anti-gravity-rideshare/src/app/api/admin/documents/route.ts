import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/admin/documents?status=PENDING
 * Returns all UserVerificationDocument rows matching the given status,
 * grouped by userId for the reviewer queue display.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? 'PENDING';

    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: docs, error: docsError } = await supabase
            .from('UserVerificationDocument')
            .select('*, User:userId(id, name, email)')
            .eq('status', status)
            .order('uploadedAt', { ascending: true });

        if (docsError) throw docsError;

        return NextResponse.json({ documents: docs ?? [] });
    } catch (err: any) {
        console.error('[admin/documents] GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
