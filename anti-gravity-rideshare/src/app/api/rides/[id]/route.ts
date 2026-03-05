import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';
import { emitRideEvent } from '@/lib/ride-events';

/**
 * PATCH /api/rides/[id]
 * Updates the status of a ride (e.g. ACCEPTED, IN_PROGRESS, COMPLETED).
 * Requires: DRIVER role.
 *
 * Calls emitRideEvent() after every status change — this is a no-op for
 * non-parent-booked rides, and notifies the parent for child rides.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { user: driver } = authResult;

    if (driver.role !== 'DRIVER') {
        return NextResponse.json(
            { error: 'Forbidden — only drivers may update ride status' },
            { status: 403 }
        );
    }

    const { id } = await params;

    try {
        const body = await request.json();
        const { status } = body;

        if (!status) {
            return NextResponse.json({ error: 'status is required' }, { status: 400 });
        }

        const updatedRide = await db.rides.updateStatus(id, status, driver.id);

        // Emit in-app notification to parent if this is a parent-booked child ride
        await emitRideEvent(status, updatedRide);

        return NextResponse.json({ success: true, ride: updatedRide });

    } catch (error) {
        console.error('Ride update error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

