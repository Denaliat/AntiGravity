import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuthService } from '@/lib/auth';
import { ParcelDelivery, TrackingEvent, AuditEvent } from '@/lib/types';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
    try {
        // 1. Simulate Auth (In real app, parse cookies/headers)
        // For prototype, we'll assume a "sender" is logged in if we receive a user ID header, 
        // or just default to the first sender in our mock DB.
        const user = await db.users.findByEmail('parent@example.com'); // acting as sender
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { recipientName, recipientAddress, parcelDescription } = body;

        // 2. Create ParcelDelivery
        const deliveryId = randomUUID();
        const newDelivery: ParcelDelivery = {
            deliveryId,
            parcelId: randomUUID(),
            senderId: user.id || 'unknown',
            recipientId: 'recipient-placeholder', // In real app, look up or create recipient
            status: 'BOOKED',
            trackingEvents: [],
            auditLog: []
        };

        // 3. Create Initial Tracking Event
        const initialEvent: TrackingEvent = {
            eventId: randomUUID(),
            deliveryId,
            timestamp: new Date().toISOString(),
            location: { latitude: 0, longitude: 0 }, // Origin
            status: 'BOOKED',
            notes: `Parcel booked: ${parcelDescription}`
        };
        newDelivery.trackingEvents.push(initialEvent);

        // 4. Audit Log
        const audit: AuditEvent = {
            auditId: randomUUID(),
            entityType: 'ParcelDelivery',
            entityId: deliveryId,
            action: 'CREATED',
            userId: user.id,
            timestamp: new Date().toISOString(),
            details: 'Booking created'
        };
        newDelivery.auditLog.push(audit);

        // 5. Save to DB
        await db.deliveries.create(newDelivery);

        return NextResponse.json({ success: true, delivery: newDelivery });

    } catch (error) {
        console.error('Booking error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
