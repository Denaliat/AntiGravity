import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

/**
 * POST /api/auth/verify-child
 *
 * Parental verification gate for child sessions.
 *
 * After a child logs in (email Magic Link), they cannot access the app
 * until their parent confirms by entering the parent's email. The system
 * sends a verification notification to the parent, and the parent must
 * confirm via their own authenticated session.
 *
 * Flow:
 *   1. Child logs in → sees "Waiting for parent verification" screen
 *   2. Child's device calls POST /api/auth/verify-child with parent's email
 *   3. Server looks up the parent, verifies ownership, and marks the child
 *      session as parent-verified by setting `parentVerifiedAt` on the User row
 *   4. Parent receives a notification and must confirm from their own session
 *
 * GET /api/auth/verify-child
 *   Returns the current verification status for the child.
 */

// GET — check if this child's session has been verified by parent
export async function GET(req: NextRequest) {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const { user } = authResult;

    if (user.role !== 'CHILD') {
        return NextResponse.json({ error: 'Only child accounts need parent verification' }, { status: 400 });
    }

    // Check if parent has verified this child's session
    const child = await db.users.findById(user.id);
    if (!child) {
        return NextResponse.json({ error: 'Child account not found' }, { status: 404 });
    }

    return NextResponse.json({
        verified: !!child.parentVerifiedAt,
        parentId: child.parentId ?? null,
        verifiedAt: child.parentVerifiedAt ?? null,
    });
}

// POST — parent confirms the child's session from the parent's own session
export async function POST(req: NextRequest) {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const { user } = authResult;

    // This endpoint accepts requests from BOTH parent (confirming) and child (requesting)
    const body = await req.json();

    if (user.role === 'CHILD') {
        // Child is requesting verification — send notification to parent
        if (!user.parentId) {
            return NextResponse.json({ error: 'Child account is not linked to a parent' }, { status: 400 });
        }

        const parent = await db.users.findById(user.parentId);
        if (!parent) {
            return NextResponse.json({ error: 'Parent account not found' }, { status: 404 });
        }

        // Create a notification for the parent
        await db.rideNotifications.create({
            parentId: parent.id,
            message: `Your child ${user.name} has logged in and is waiting for your verification.`,
        });

        // Audit log
        await db.parentChildAudit.log({
            action: 'CHILD_VERIFICATION_REQUESTED',
            actorId: user.id,
            childId: user.id,
            parentId: parent.id,
        });

        return NextResponse.json({
            status: 'pending',
            message: 'Verification request sent to your parent.',
        });
    }

    if (user.role === 'PARENT') {
        // Parent is confirming the child's session
        const { childId } = body;
        if (!childId) {
            return NextResponse.json({ error: 'childId is required' }, { status: 400 });
        }

        const child = await db.users.findById(childId);
        if (!child) {
            return NextResponse.json({ error: 'Child account not found' }, { status: 404 });
        }

        // Ownership check
        if (child.parentId !== user.id) {
            return NextResponse.json({ error: 'This child does not belong to your account' }, { status: 403 });
        }

        // Mark the child as parent-verified
        await db.users.update(childId, {
            parentVerifiedAt: new Date().toISOString(),
        });

        // Audit log
        await db.parentChildAudit.log({
            action: 'CHILD_SESSION_VERIFIED',
            actorId: user.id,
            childId: childId,
            parentId: user.id,
        });

        return NextResponse.json({
            status: 'verified',
            childId,
            verifiedAt: new Date().toISOString(),
        });
    }

    return NextResponse.json({ error: 'Only PARENT or CHILD roles can use this endpoint' }, { status: 403 });
}
