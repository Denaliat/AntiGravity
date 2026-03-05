import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';
import { AuthService } from '@/lib/auth';
import { randomUUID } from 'crypto';

/**
 * POST /api/child/emergency
 *
 * Activated when a child presses the SOS button.
 *
 * Security:
 *  1. requireAuth()                       — must be authenticated
 *  2. role === 'CHILD'                    — only children can trigger SOS
 *  3. canChildAccessSafetyFeatures()      — hard-blocks (403) if parent has not
 *                                           configured a primary + secondary contact
 *
 * Flow:
 *  1. Create EmergencyRecording row (status: RECORDING, incidentId: null)
 *  2. Create Incident row (SAFETY_CONCERN, CRITICAL)
 *  3. Attach incidentId to the recording
 *  4. Write RideNotification to the parent
 *
 * Response:
 *  { incidentId, recordingId, contacts: [{ name, phone, isPrimary }] }
 *  — client uses contactsto display on screen, and recordingId to upload media chunks.
 *
 * Recording upload:
 *  Client starts MediaRecorder, uploads chunks to Supabase Storage under
 *  emergency-recordings/<recordingId>/<timestamp>.webm, then calls
 *  PATCH /api/child/emergency/[recordingId]/complete to finalize.
 */
export async function POST(req: NextRequest) {
    // ── 1. Auth ───────────────────────────────────────────────────────────────
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { user: child } = authResult;

    // ── 2. Role check ─────────────────────────────────────────────────────────
    if (child.role !== 'CHILD') {
        return NextResponse.json(
            { error: 'Forbidden — only child accounts may trigger SOS' },
            { status: 403 }
        );
    }

    // ── 3. Safety features gate (hard block if contacts missing) ──────────────
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

    // ── 4. Optional location context from body ────────────────────────────────
    let latitude: number | undefined;
    let longitude: number | undefined;
    let rideId: string | undefined;
    try {
        const body = await req.json().catch(() => ({}));
        latitude = typeof body.latitude === 'number' ? body.latitude : undefined;
        longitude = typeof body.longitude === 'number' ? body.longitude : undefined;
        rideId = typeof body.rideId === 'string' ? body.rideId : undefined;
    } catch {
        // Body is optional — proceed without it
    }

    try {
        // ── 5. Create recording first (incidentId null) ───────────────────────
        const recording = await db.emergencyRecordings.create(child.id);

        // ── 6. Create incident ────────────────────────────────────────────────
        const incident = await db.incidents.create({
            id: randomUUID(),
            reporterId: child.id,
            rideId: rideId ?? null as any,
            type: 'SAFETY_CONCERN',
            status: 'OPEN',
            priority: 'CRITICAL',
            description: `SOS triggered by child account ${child.id}${latitude !== undefined ? ` at [${latitude}, ${longitude}]` : ''}`,
            timestamp: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        // ── 7. Link recording → incident ──────────────────────────────────────
        await db.emergencyRecordings.attachIncident(recording.id, incident.id);

        // ── 8. Notify parent ──────────────────────────────────────────────────
        await db.rideNotifications.create({
            parentId: safety.parent!.id,
            rideId: rideId,
            message: `🚨 EMERGENCY: ${child.name} has triggered an SOS alert. Recording has started. Check the app immediately.`,
        });

        // ── 9. Return data for client to display + start recording ────────────
        const contacts = (safety.contacts ?? []).map(c => ({
            name: c.name,
            phone: c.phone,
            relationship: c.relationship,
            isPrimary: c.isPrimary,
        }));

        return NextResponse.json({
            success: true,
            incidentId: incident.id,
            recordingId: recording.id,
            contacts,
            message: 'SOS activated. Recording has started. Your parent has been notified.',
        }, { status: 201 });

    } catch (error) {
        console.error('[child/emergency] POST error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
