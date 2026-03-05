import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/api-auth';

/**
 * GET /api/admin/documents?status=PENDING
 * Returns all UserVerificationDocument rows matching the given status,
 * grouped by userId for the reviewer queue display.
 * Requires: ADMIN | LEAD_ADMIN | SUPPORT role.
 */
export async function GET(req: NextRequest) {
    // ── Auth guard — must be an admin ──────────────────────────────────────
    const authResult = await requireAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult; // 401 or 403

    const { supabase } = authResult;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? 'PENDING';

    try {
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
