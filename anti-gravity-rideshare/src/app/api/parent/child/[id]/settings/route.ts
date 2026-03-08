import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';
import { normalizeStringArray } from '@/lib/sanitize';

/**
 * PATCH /api/parent/child/[id]/settings
 * Updates settings for a child account (e.g. location sharing).
 * Requires: PARENT role + the target child must belong to this parent.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { user: parent } = authResult;

    if (parent.role !== 'PARENT') {
        return NextResponse.json(
            { error: 'Forbidden — parent access only' },
            { status: 403 }
        );
    }

    const { id: childId } = await params;

    try {
        // Verify the child belongs to this parent
        const child = await db.users.findById(childId);
        if (!child || child.role !== 'CHILD') {
            return NextResponse.json({ error: 'Child not found' }, { status: 404 });
        }
        if (child.parentId !== parent.id) {
            return NextResponse.json(
                { error: 'Forbidden — this child does not belong to your account' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { isLocationHidden, rideRestrictionsEnabled, allowedPickupLocations } = body;

        // Build the update payload with only the permitted fields
        const updates: Partial<typeof child> = {};
        if (typeof isLocationHidden === 'boolean') updates.isLocationHidden = isLocationHidden;
        if (typeof rideRestrictionsEnabled === 'boolean') updates.rideRestrictionsEnabled = rideRestrictionsEnabled;
        if (Array.isArray(allowedPickupLocations)) updates.allowedPickupLocations = normalizeStringArray(allowedPickupLocations);

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid settings provided' }, { status: 400 });
        }

        // Persist to DB (previously this was only updating the in-memory object)
        const updatedChild = await db.users.update(childId, updates);
        return NextResponse.json({ success: true, child: updatedChild });

    } catch (error) {
        console.error('Settings update error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
