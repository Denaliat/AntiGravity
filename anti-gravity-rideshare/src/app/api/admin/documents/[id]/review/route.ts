import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdminAuth } from '@/lib/api-auth';

/**
 * POST /api/admin/documents/[id]/review
 * Submits an approve / reject / escalate decision for a document.
 * Writes a ReviewAuditEvent and calls db.verificationDocuments.review().
 * Requires: ADMIN | LEAD_ADMIN | SUPPORT role.
 *
 * Body: {
 *   action:                 'APPROVED' | 'REJECTED' | 'ESCALATED'
 *   rejectionReason?:       string  (required when action = REJECTED)
 *   secondaryReviewRequired?: boolean
 * }
 * Note: reviewerId is taken from the authenticated session, not the body.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // ── Auth guard ────────────────────────────────────────────────────────
    const authResult = await requireAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult; // 401 or 403

    const { user } = authResult;
    const { id } = await params;

    try {
        const body = await req.json();
        const { action, rejectionReason, secondaryReviewRequired } = body;

        // reviewerId comes from the session — not trusted from client body
        const reviewerId = user.id;

        // Validate
        if (!action) {
            return NextResponse.json({ error: 'action is required' }, { status: 400 });
        }
        if (!['APPROVED', 'REJECTED', 'ESCALATED'].includes(action)) {
            return NextResponse.json({ error: 'action must be APPROVED, REJECTED, or ESCALATED' }, { status: 400 });
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
