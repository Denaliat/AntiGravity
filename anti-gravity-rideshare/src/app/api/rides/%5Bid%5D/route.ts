import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        // 1. Simulate Driver Auth
        const driver = await db.users.findByEmail('driver@example.com');
        if (!driver || driver.role !== 'DRIVER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { status } = body;

        // 2. Update Ride
        const updatedRide = await db.rides.updateStatus(id, status, driver.id);

        return NextResponse.json({ success: true, ride: updatedRide });

    } catch (error) {
        console.error('Ride update error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
