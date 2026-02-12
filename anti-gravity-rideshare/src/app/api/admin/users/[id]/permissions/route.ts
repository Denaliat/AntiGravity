import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        // 1. Simulate Lead Admin Auth
        const admin = await db.users.findByEmail('lead@example.com');
        if (!admin || admin.role !== 'LEAD_ADMIN') {
            return NextResponse.json({ error: 'Unauthorized: Requires Lead Admin' }, { status: 403 });
        }

        const body = await request.json();
        const { permissions } = body;

        // 2. Update Target User
        const targetUser = await db.users.findById(id);
        if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Only allow updating Support staff permissions for now
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
