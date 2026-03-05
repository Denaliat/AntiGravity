import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { evaluateDocument } from '@/lib/signals';
import { requireAdminAuth } from '@/lib/api-auth';

/**
 * GET /api/admin/documents/[id]/signals
 * Runs the bias-safe signal evaluator for a document, persists results,
 * and returns all signals for display in the IntegritySignalsPanel.
 * Requires: ADMIN | LEAD_ADMIN | SUPPORT role.
 *
 * POST /api/admin/documents/[id]/signals
 * Logs a SIGNAL_EXPANDED audit event when a reviewer opens a signal's
 * "What triggered this?" evidence panel.
 * Requires: ADMIN | LEAD_ADMIN | SUPPORT role.
 */

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const { supabase } = authResult;
    const { id } = await params;

    try {
        // Fetch the target document using the session-aware client (activates RLS)
        const { data: doc, error: docErr } = await supabase
            .from('UserVerificationDocument')
            .select('*')
            .eq('id', id)
            .single();

        if (docErr || !doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // Fetch all docs for this user for submission-integrity checks
        const allDocs = await db.verificationDocuments.findByUser(doc.userId);

        // Run evaluator
        const signals = evaluateDocument(doc, { allDocumentsGlobal: allDocs });

        // Persist signals (idempotent — deduplicate by signalCode on client)
        await db.signals.persist(id, signals);

        return NextResponse.json({ signals });
    } catch (err: any) {
        console.error('[admin/documents/signals] GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const { user } = authResult;
    const { id } = await params;

    const body = await req.json();
    const { signalCode } = body;

    if (!signalCode) {
        return NextResponse.json({ error: 'signalCode is required' }, { status: 400 });
    }

    // reviewerId comes from session, not client body
    await db.reviewAudit.log({
        documentId: id,
        reviewerId: user.id,
        action: 'SIGNAL_EXPANDED',
        signalCode,
        secondaryReviewRequired: false,
    });

    return NextResponse.json({ ok: true });
}
