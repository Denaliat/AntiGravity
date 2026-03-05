import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { EncryptionService } from '@/lib/encryption';
import { ProofOfDelivery, TrackingEvent, AuditEvent } from '@/lib/types';
import { randomUUID } from 'crypto';
import { requireAuth } from '@/lib/api-auth';

/**
 * POST /api/delivery/[id]/proof
 * Submits proof of delivery (signature + photo) for a completed delivery.
 * Requires: authenticated session (DRIVER role recommended).
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // ── Auth guard ─────────────────────────────────────────────────────────
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { user: driver } = authResult;
    const { id } = await params;

    try {
        const body = await request.json();
        const { signatureBase64, photoBase64, location } = body;

        // Verify Delivery exists
        const delivery = await db.bookings.findById(id);
        if (!delivery) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });

        // Encrypt Proofs
        const encryptedSignature = signatureBase64 ? EncryptionService.encrypt(signatureBase64) : undefined;
        const encryptedPhoto = photoBase64 ? EncryptionService.encrypt(photoBase64) : undefined;

        // Create Proof Record
        const proof: ProofOfDelivery = {
            proofId: randomUUID(),
            deliveryId: id,
            timestamp: new Date().toISOString(),
            location: location || { latitude: 0, longitude: 0 },
            signatureImageUrl: encryptedSignature,
            photoImageUrl: encryptedPhoto,
            recipientName: 'Recipient (Confirmed)',
            isEncrypted: true,
        };

        await db.proofs.create(proof);

        // Update Delivery Status
        await db.bookings.updateStatus(id, 'DELIVERED', undefined);
        delivery.proofOfDelivery = proof;

        // Tracking Event
        const trackingEvent: TrackingEvent = {
            eventId: randomUUID(),
            deliveryId: id,
            timestamp: new Date().toISOString(),
            location: location || { latitude: 0, longitude: 0 },
            status: 'DELIVERED',
            notes: 'Delivered to recipient',
        };
        delivery.trackingEvents.push(trackingEvent);

        // Audit Log — uses real driver id from session
        const audit: AuditEvent = {
            auditId: randomUUID(),
            entityType: 'ProofOfDelivery',
            entityId: proof.proofId,
            action: 'CREATED',
            userId: driver.id,
            timestamp: new Date().toISOString(),
            details: 'Proof of Delivery submitted and encrypted',
        };
        delivery.auditLog.push(audit);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Proof submission error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
