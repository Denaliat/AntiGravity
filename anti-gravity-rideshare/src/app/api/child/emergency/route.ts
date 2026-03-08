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
 *  4. Deduplication                       — if child already has an active recording,
 *                                           return it instead of creating a duplicate
 *  5. Rate limit                          — max 3 SOS activations per hour
 *
 * Flow:
 *  1. Create EmergencyRecording row (status: RECORDING, incidentId: null)
 *  2. Create Incident row (SAFETY_CONCERN, CRITICAL)
 *  3. Attach incidentId to the recording
 *  4. Write RideNotification to the parent
 *  5. Write audit log entry
 *
 * Response:
 *  { incidentId, recordingId, contacts: [{ name, phone, isPrimary }] }
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

    // ── 4. Deduplication — return existing active session if one exists ───────
    const activeRecording = await db.emergencyRecordings.findActiveByChild(child.id);
    if (activeRecording) {
        const contacts = (safety.contacts ?? []).map(c => ({
            name: c.name,
            phone: c.phone,
            relationship: c.relationship,
            isPrimary: c.isPrimary,
        }));

        return NextResponse.json({
            success: true,
            incidentId: activeRecording.incidentId,
            recordingId: activeRecording.id,
            contacts,
            message: 'SOS already active. Returning existing session.',
            deduplicated: true,
        });
    }

    // ── 5. Rate limit — max 3 SOS activations per hour ───────────────────────
    const SOS_WINDOW_MINUTES = 60;
    const MAX_SOS_PER_HOUR = 3;
    const recentSOS = await db.emergencyRecordings.countRecentByChild(child.id, SOS_WINDOW_MINUTES);
    if (recentSOS >= MAX_SOS_PER_HOUR) {
        return NextResponse.json(
            {
                error: `SOS rate limit reached. Maximum ${MAX_SOS_PER_HOUR} activations per hour. If you are in danger, call emergency services directly.`,
                code: 'SOS_RATE_LIMITED',
            },
            { status: 429 }
        );
    }

    // ── 6. Optional location context from body ────────────────────────────────
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

    // Round lat/long to 3 decimal places (~111m) to avoid leaking excess precision
    const roundedLat = latitude !== undefined ? Math.round(latitude * 1000) / 1000 : undefined;
    const roundedLng = longitude !== undefined ? Math.round(longitude * 1000) / 1000 : undefined;

    try {
        // ── 7. Create recording first (incidentId null) ───────────────────────
        const recording = await db.emergencyRecordings.create(child.id);

        // ── 8. Create incident ────────────────────────────────────────────────
        const incident = await db.incidents.create({
            id: randomUUID(),
            reporterId: child.id,
            rideId: rideId ?? null as any,
            type: 'SAFETY_CONCERN',
            status: 'OPEN',
            priority: 'CRITICAL',
            description: `SOS triggered by child account ${child.id}${roundedLat !== undefined ? ` near [${roundedLat}, ${roundedLng}]` : ''}`,
            timestamp: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        // ── 9. Link recording → incident ──────────────────────────────────────
        await db.emergencyRecordings.attachIncident(recording.id, incident.id);

        // ── 10. Notify parent ─────────────────────────────────────────────────
        await db.rideNotifications.create({
            parentId: safety.parent!.id,
            rideId: rideId,
            message: `🚨 EMERGENCY: ${child.name} has triggered an SOS alert. Recording has started. Check the app immediately.`,
        });

        // ── 11. Audit log ─────────────────────────────────────────────────────
        await db.parentChildAudit.log({
            action: 'SOS_ACTIVATED',
            actorId: child.id,
            childId: child.id,
            parentId: safety.parent!.id,
            targetId: recording.id,
            metadata: { incidentId: incident.id, rideId: rideId ?? null },
        });

        // ── 12. Return data for client ────────────────────────────────────────
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
