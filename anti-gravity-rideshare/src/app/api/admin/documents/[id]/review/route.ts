import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/admin/documents/[id]/review
 * Submits an approve / reject / escalate decision for a document.
 * Writes a ReviewAuditEvent and calls db.verificationDocuments.review().
 *
 * Body: {
 *   action:                 'APPROVED' | 'REJECTED' | 'ESCALATED'
 *   reviewerId:             string
 *   rejectionReason?:       string  (required when action = REJECTED)
 *   secondaryReviewRequired?: boolean
 * }
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const body = await req.json();
        const { action, reviewerId, rejectionReason, secondaryReviewRequired } = body;

        // Validate
        if (!action || !reviewerId) {
            return NextResponse.json({ error: 'action and reviewerId are required' }, { status: 400 });
        }
        if (action === 'REJECTED' && !rejectionReason) {
            return NextResponse.json(
                { error: 'rejectionReason is required when action is REJECTED' },
                { status: 400 }
            );
        }

        // 1. Log the review audit event first (before any DB mutation)
        await db.reviewAudit.log({
            documentId: id,
            reviewerId,
            action,
            rejectionReason: rejectionReason ?? undefined,
            secondaryReviewRequired: secondaryReviewRequired ?? false,
        });

        // 2. Apply the review decision to the document
        if (action === 'APPROVED') {
            await db.verificationDocuments.review(id, {
                status: 'VERIFIED',
                reviewedBy: reviewerId,
            });
        } else if (action === 'REJECTED') {
            await db.verificationDocuments.review(id, {
                status: 'REJECTED',
                reviewedBy: reviewerId,
                rejectionReason,
            });
        }
        // ESCALATED: logged but document stays PENDING — routed to second reviewer

        return NextResponse.json({ ok: true, action });
    } catch (err: any) {
        console.error('[admin/documents/review] POST error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
