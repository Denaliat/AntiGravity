import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Ride } from '@/lib/types';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
    try {
        // 1. Simulate Rider Auth
        const rider = await db.users.findByEmail('rider@example.com');
        if (!rider) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { pickup, dropoff } = body;

        // 2. Create Ride
        const newRide: Ride = {
            rideId: randomUUID(),
            riderId: rider.id,
            pickupLocation: pickup,
            dropoffLocation: dropoff,
            status: 'REQUESTED',
            fare: 15.00, // Mock fare calculation
            timestamp: new Date().toISOString()
        };

        await db.rides.create(newRide);

        return NextResponse.json({ success: true, ride: newRide });

    } catch (error) {
        console.error('Ride booking error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // 1. Simulate Driver Auth (simplified)
    // In real app we check session

    // 2. Fetch rides
    const rides = await db.rides.findAll(status || undefined);

    return NextResponse.json({ rides });
}
