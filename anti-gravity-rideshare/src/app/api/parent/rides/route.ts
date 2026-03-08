import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Ride } from '@/lib/types';
import { randomUUID } from 'crypto';
import { requireAuth } from '@/lib/api-auth';
import { AuthService } from '@/lib/auth';
import { normalizeText } from '@/lib/sanitize';

/**
 * POST /api/parent/rides
 * Allows an authenticated PARENT to request a ride on behalf of one of their children.
 *
 * Security checks (in order):
 *  1. requireAuth()              — caller must have a valid session
 *  2. role === 'PARENT'          — caller must be a parent
 *  3. Input validation           — childId, pickup, dropoff required
 *  4. canChildRequestRide()      — child must exist, belong to this parent,
 *                                  and not have rides restricted
 *     └─ contactsWarning         — SOFT GATE: if emergency contacts not set up,
 *                                  returns 200 with warning instead of blocking.
 *                                  The SOS endpoint still hard-blocks.
 *  5. Rate limit                 — max 3 parent-booked rides per child per 10 min
 *  6. allowedPickupLocations     — if set, pickup must be in the approved list
 *
 * Body: { childId: string, pickup: string, dropoff: string, acknowledgedNoContacts?: boolean }
 * Response: { success: true, ride } or { success: false, warning: 'NO_EMERGENCY_CONTACTS' }
 */
export async function POST(req: NextRequest) {
    // ── 1. Session check ───────────────────────────────────────────────────────
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const { user: parent } = authResult;

    // ── 2. Role check ──────────────────────────────────────────────────────────
    if (parent.role !== 'PARENT') {
        return NextResponse.json(
            { error: 'Forbidden — only parents may use this endpoint' },
            { status: 403 }
        );
    }

    let body: {
        childId?: string;
        pickup?: string;
        dropoff?: string;
        acknowledgedNoContacts?: boolean;
    };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { childId, acknowledgedNoContacts } = body;
    const pickup = body.pickup ? normalizeText(body.pickup) : body.pickup;
    const dropoff = body.dropoff ? normalizeText(body.dropoff) : body.dropoff;

    // ── 3. Input validation ────────────────────────────────────────────────────
    if (!childId) {
        return NextResponse.json({ error: 'childId is required' }, { status: 400 });
    }
    if (!pickup || !dropoff) {
        return NextResponse.json({ error: 'pickup and dropoff are required' }, { status: 400 });
    }

    // ── 4. Parent-child ownership + restriction check (soft gate for contacts) ─
    const eligibility = await AuthService.canChildRequestRide(childId, parent.id);

    if (!eligibility.allowed) {
        return NextResponse.json(
            { error: `Ride not permitted: ${eligibility.reason}` },
            { status: 403 }
        );
    }

    // Soft gate: contacts missing → return warning unless parent has acknowledged
    if (eligibility.contactsWarning && !acknowledgedNoContacts) {
        return NextResponse.json({
            success: false,
            warning: 'NO_EMERGENCY_CONTACTS',
            message: 'You have not set up emergency contacts. Please add a primary and secondary contact, or tick "I acknowledge" to proceed anyway.',
        });
    }

    // ── 5. Rate limit — max 3 parent rides per child per 10 min ───────────────
    const WINDOW_MINUTES = 10;
    const MAX_RIDES = 3;
    const recentCount = await db.rideRequests.countRecent(childId, WINDOW_MINUTES);
    if (recentCount >= MAX_RIDES) {
        return NextResponse.json(
            {
                error: `Too many rides booked. Maximum ${MAX_RIDES} rides per child every ${WINDOW_MINUTES} minutes.`,
                code: 'RATE_LIMITED',
            },
            { status: 429 }
        );
    }

    // ── 6. Allowed pickup location check ──────────────────────────────────────
    const child = await db.users.findById(childId);
    if (
        child?.allowedPickupLocations &&
        child.allowedPickupLocations.length > 0
    ) {
        const pickupNorm = pickup.trim().toLowerCase();
        const isAllowed = child.allowedPickupLocations.some(
            loc => loc.trim().toLowerCase() === pickupNorm
        );
        if (!isAllowed) {
            return NextResponse.json(
                {
                    error: 'Pickup location not in the approved list for this child',
                    allowedLocations: child.allowedPickupLocations,
                },
                { status: 403 }
            );
        }
    }

    // ── 7. Create the ride ─────────────────────────────────────────────────────
    try {
        const ride: Ride = {
            rideId: randomUUID(),
            riderId: childId,
            requestedByParentId: parent.id,
            pickupLocation: pickup,
            dropoffLocation: dropoff,
            status: 'REQUESTED',
            fare: 15.00,
            timestamp: new Date().toISOString(),
        };

        await db.rides.create(ride);

        // Audit log — parent booked a ride for their child
        await db.parentChildAudit.log({
            action: 'RIDE_CREATED',
            actorId: parent.id,
            childId: childId,
            parentId: parent.id,
            targetId: ride.rideId,
            metadata: { pickup, dropoff, acknowledgedNoContacts: !!acknowledgedNoContacts },
        });

        return NextResponse.json({ success: true, ride }, { status: 201 });

    } catch (error) {
        console.error('[parent/rides] POST error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
