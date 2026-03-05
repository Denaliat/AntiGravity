import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Ride } from '@/lib/types';
import { randomUUID } from 'crypto';
import { requireAuth } from '@/lib/api-auth';

/**
 * POST /api/rides
 * Books a ride for the authenticated RIDER or PARENT.
 * Parents should use POST /api/parent/rides to book on behalf of a child.
 */
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { user: rider } = authResult;

    // CHILD accounts must never book rides directly — they go via their parent
    if (rider.role === 'CHILD') {
        return NextResponse.json(
            { error: 'Forbidden — children cannot book rides directly. Ask your parent to book on your behalf.' },
            { status: 403 }
        );
    }

    // Only RIDER and PARENT roles may book through this endpoint
    if (!['RIDER', 'PARENT'].includes(rider.role)) {
        return NextResponse.json(
            { error: 'Forbidden — only riders may book rides directly' },
            { status: 403 }
        );
    }

    try {
        const body = await request.json();
        const { pickup, dropoff } = body;

        if (!pickup || !dropoff) {
            return NextResponse.json({ error: 'pickup and dropoff are required' }, { status: 400 });
        }

        const newRide: Ride = {
            rideId: randomUUID(),
            riderId: rider.id,
            pickupLocation: pickup,
            dropoffLocation: dropoff,
            status: 'REQUESTED',
            fare: 15.00,
            timestamp: new Date().toISOString(),
        };

        await db.rides.create(newRide);
        return NextResponse.json({ success: true, ride: newRide });

    } catch (error) {
        console.error('Ride booking error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * GET /api/rides
 * Returns rides visible to the authenticated user.
 * Drivers see all rides; riders see only their own.
 */
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { user } = authResult;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    try {
        const rides = await db.rides.findAll(status);

        // Drivers see all rides; riders and parents only see their own (or their child's)
        if (['RIDER', 'PARENT', 'CHILD'].includes(user.role)) {
            const ownRides = rides.filter(
                r => r.riderId === user.id || r.requestedByParentId === user.id
            );
            return NextResponse.json({ rides: ownRides });
        }

        return NextResponse.json({ rides });
    } catch (error) {
        console.error('Ride fetch error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
