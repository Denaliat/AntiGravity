import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { evaluateDocument } from '@/lib/signals';

/**
 * GET /api/admin/documents/[id]/signals
 * Runs the bias-safe signal evaluator for a document, persists results,
 * and returns all signals for display in the IntegritySignalsPanel.
 *
 * POST /api/admin/documents/[id]/signals
 * Logs a SIGNAL_EXPANDED audit event when a reviewer opens a signal's
 * "What triggered this?" evidence panel.
 */

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        // Fetch the target document
        const { data: doc, error: docErr } = await (await import('@supabase/supabase-js'))
            .createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            )
            .from('UserVerificationDocument')
            .select('*')
            .eq('id', id)
            .single();

        if (docErr || !doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // Fetch all docs globally for submission-integrity checks
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
    const { id } = await params;
    const body = await req.json();
    const { reviewerId, signalCode } = body;

    if (!reviewerId || !signalCode) {
        return NextResponse.json({ error: 'reviewerId and signalCode required' }, { status: 400 });
    }

    await db.reviewAudit.log({
        documentId: id,
        reviewerId,
        action: 'SIGNAL_EXPANDED',
        signalCode,
        secondaryReviewRequired: false,
    });

    return NextResponse.json({ ok: true });
}
