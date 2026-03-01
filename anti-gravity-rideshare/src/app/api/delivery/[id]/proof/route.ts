import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { EncryptionService } from '@/lib/encryption';
import { ProofOfDelivery, TrackingEvent, AuditEvent } from '@/lib/types';
import { randomUUID } from 'crypto';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        // 1. Simulate Driver Auth
        const driver = await db.users.findByEmail('driver@example.com');
        if (!driver) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { signatureBase64, photoBase64, location } = body;

        // 2. Verify Delivery exists
        const delivery = await db.bookings.findById(id);
        if (!delivery) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });

        // 3. Encrypt Proofs
        // In a real app, we'd upload to Cloud Storage and only store the URL + Encryption Key ID
        // or store the encrypted blob if small enough. Here we mock encrypting the string.
        const encryptedSignature = signatureBase64 ? EncryptionService.encrypt(signatureBase64) : undefined;
        const encryptedPhoto = photoBase64 ? EncryptionService.encrypt(photoBase64) : undefined;

        // 4. Create Proof Record
        const proof: ProofOfDelivery = {
            proofId: randomUUID(),
            deliveryId: id,
            timestamp: new Date().toISOString(),
            location: location || { latitude: 0, longitude: 0 },
            signatureImageUrl: encryptedSignature,
            photoImageUrl: encryptedPhoto,
            recipientName: 'Recipient (Confirmed)', // simplified
            isEncrypted: true
        };

        await db.proofs.create(proof);

        // 5. Update Delivery Status
        await db.bookings.updateStatus(id, 'DELIVERED', undefined);
        delivery.proofOfDelivery = proof; // Update in-memory reference directly for simplicity

        // 6. Tracking Event
        const trackingEvent: TrackingEvent = {
            eventId: randomUUID(),
            deliveryId: id,
            timestamp: new Date().toISOString(),
            location: location || { latitude: 0, longitude: 0 },
            status: 'DELIVERED',
            notes: 'Delivered to recipient'
        };
        delivery.trackingEvents.push(trackingEvent);

        // 7. Audit Log
        const audit: AuditEvent = {
            auditId: randomUUID(),
            entityType: 'ProofOfDelivery',
            entityId: proof.proofId,
            action: 'CREATED',
            userId: driver.id,
            timestamp: new Date().toISOString(),
            details: 'Proof of Delivery submitted and encrypted'
        };
        delivery.auditLog.push(audit);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Proof submission error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
