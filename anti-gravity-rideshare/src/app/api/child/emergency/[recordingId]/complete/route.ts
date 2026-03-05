import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

/**
 * PATCH /api/child/emergency/[recordingId]/complete
 *
 * Called by the client after the MediaRecorder has finished uploading the
 * emergency recording to Supabase Storage. Marks the recording as COMPLETE
 * and stores the storage path URL.
 *
 * Security: child must own the recording (childId ownership enforced in DB).
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ recordingId: string }> }
) {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { user: child } = authResult;

    if (child.role !== 'CHILD') {
        return NextResponse.json(
            { error: 'Forbidden — child access only' },
            { status: 403 }
        );
    }

    const { recordingId } = await params;

    let body: { recordingUrl?: string; failed?: boolean };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    try {
        if (body.failed) {
            // Client signals the recording failed (e.g. permission denied, MediaRecorder error)
            await db.emergencyRecordings.markFailed(recordingId, child.id);
            return NextResponse.json({ success: true, status: 'FAILED' });
        }

        if (!body.recordingUrl || typeof body.recordingUrl !== 'string') {
            return NextResponse.json({ error: 'recordingUrl is required' }, { status: 400 });
        }

        const recording = await db.emergencyRecordings.markComplete(
            recordingId,
            body.recordingUrl,
            child.id
        );

        return NextResponse.json({ success: true, recording });

    } catch (error) {
        console.error('[child/emergency/complete] PATCH error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
