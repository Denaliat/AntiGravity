import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

/**
 * GET  /api/parent/notifications         — returns parent's ride notifications
 * PATCH /api/parent/notifications?id=X   — marks a notification as read
 */
export async function GET(req: NextRequest) {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { user: parent } = authResult;

    if (parent.role !== 'PARENT') {
        return NextResponse.json({ error: 'Forbidden — parent access only' }, { status: 403 });
    }

    const unreadOnly = req.nextUrl.searchParams.get('unreadOnly') === 'true';
    try {
        const notifications = await db.rideNotifications.findByParent(parent.id, unreadOnly);
        return NextResponse.json({ notifications });
    } catch (error) {
        console.error('[parent/notifications] GET error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { user: parent } = authResult;

    if (parent.role !== 'PARENT') {
        return NextResponse.json({ error: 'Forbidden — parent access only' }, { status: 403 });
    }

    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
        return NextResponse.json({ error: 'id query param required' }, { status: 400 });
    }

    try {
        await db.rideNotifications.markRead(id, parent.id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[parent/notifications] PATCH error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
