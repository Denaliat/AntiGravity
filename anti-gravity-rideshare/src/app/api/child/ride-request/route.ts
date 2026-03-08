import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';
import { AuthService } from '@/lib/auth';
import { normalizeText } from '@/lib/sanitize';

/**
 * POST /api/child/ride-request
 *
 * Allows a CHILD to request a ride from their parent.
 *
 * IMPORTANT: This does NOT create a Ride row. It creates a RideRequest row
 * (status: PENDING) and notifies the parent. The parent must approve it via
 * their dashboard before any Ride is created. This prevents child-initiated
 * ride spam and keeps the parent in full control.
 *
 * Security:
 *  1. requireAuth()                    — must be authenticated
 *  2. role === 'CHILD'                 — only children can use this endpoint
 *  3. canChildAccessSafetyFeatures()   — parent must have contacts set up
 *  4. Rate limit: max 2 requests per child per 15 minutes
 *
 * Body: { requestedPickup: string, requestedDropoff: string }
 * Response: { success: true, rideRequest }
 */
export async function POST(req: NextRequest) {
    // ── 1. Auth ───────────────────────────────────────────────────────────────
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { user: child } = authResult;

    // ── 2. Role check ─────────────────────────────────────────────────────────
    if (child.role !== 'CHILD') {
        return NextResponse.json(
            { error: 'Forbidden — only child accounts may submit ride requests' },
            { status: 403 }
        );
    }

    // ── 3. Safety features gate ───────────────────────────────────────────────
    const safety = await AuthService.canChildAccessSafetyFeatures(child.id);
    if (!safety.allowed) {
        return NextResponse.json(
            {
                error: safety.reason,
                code: safety.missingContacts ? 'MISSING_EMERGENCY_CONTACTS' : 'SAFETY_GATE_FAILED',
            },
            { status: 403 }
        );
    }

    // ── 4. Rate limit — max 2 ride requests per child per 15 minutes ──────────
    const WINDOW_MINUTES = 15;
    const MAX_REQUESTS = 2;
    const recentCount = await db.rideRequests.countRecent(child.id, WINDOW_MINUTES);
    if (recentCount >= MAX_REQUESTS) {
        return NextResponse.json(
            {
                error: `Too many ride requests. You can submit at most ${MAX_REQUESTS} requests every ${WINDOW_MINUTES} minutes.`,
                code: 'RATE_LIMITED',
            },
            { status: 429 }
        );
    }

    // ── 5. Input validation ───────────────────────────────────────────────────
    let body: { requestedPickup?: string; requestedDropoff?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const requestedPickup = body.requestedPickup ? normalizeText(body.requestedPickup) : body.requestedPickup;
    const requestedDropoff = body.requestedDropoff ? normalizeText(body.requestedDropoff) : body.requestedDropoff;
    if (!requestedPickup || typeof requestedPickup !== 'string' || requestedPickup.trim().length === 0) {
        return NextResponse.json({ error: 'requestedPickup is required' }, { status: 400 });
    }
    if (!requestedDropoff || typeof requestedDropoff !== 'string' || requestedDropoff.trim().length === 0) {
        return NextResponse.json({ error: 'requestedDropoff is required' }, { status: 400 });
    }

    try {
        // ── 6. Create RideRequest row (NOT a Ride) ────────────────────────────
        const rideRequest = await db.rideRequests.create({
            childId: child.id,
            parentId: safety.parent!.id,
            requestedPickup: requestedPickup.trim(),
            requestedDropoff: requestedDropoff.trim(),
        });

        // ── 7. Notify parent ──────────────────────────────────────────────────
        await db.rideNotifications.create({
            parentId: safety.parent!.id,
            rideRequestId: rideRequest.id,
            message: `${child.name} is requesting a ride from "${requestedPickup.trim()}" to "${requestedDropoff.trim()}". Please approve or reject in the app.`,
        });

        return NextResponse.json({
            success: true,
            rideRequest,
            message: 'Your ride request has been sent to your parent for approval.',
        }, { status: 201 });

    } catch (error) {
        console.error('[child/ride-request] POST error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
