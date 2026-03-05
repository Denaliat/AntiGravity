import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireLeadAdminAuth } from '@/lib/api-auth';

/**
 * PATCH /api/admin/users/[id]/permissions
 * Updates the permissions array for a SUPPORT-role user.
 * Requires: LEAD_ADMIN role.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // ── Auth guard — Lead Admin only ───────────────────────────────────────
    const authResult = await requireLeadAdminAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const body = await request.json();
        const { permissions } = body;

        // Fetch and validate the target user
        const targetUser = await db.users.findById(id);
        if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Only allow updating Support staff permissions
        if (targetUser.role !== 'SUPPORT') {
            return NextResponse.json({ error: 'Can only modify Support Staff permissions' }, { status: 400 });
        }

        if (Array.isArray(permissions)) {
            await db.users.update(id, { permissions });
            return NextResponse.json({ success: true, permissions });
        }

        return NextResponse.json({ error: 'Invalid permissions format' }, { status: 400 });

    } catch (error) {
        console.error('Permission update error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
