import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params; // Child ID

    try {
        // 1. Simulate Parent Auth
        const parent = await db.users.findByEmail('parent@example.com');
        if (!parent || parent.role !== 'PARENT') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { isLocationHidden } = body;

        // 2. Verify Child
        const child = await db.users.findById(id);
        if (!child || child.parentId !== parent.id) {
            return NextResponse.json({ error: 'Child not found or unauthorized' }, { status: 404 });
        }

        // 3. Update Settings
        if (typeof isLocationHidden === 'boolean') {
            child.isLocationHidden = isLocationHidden;
            // In real app update DB: await db.users.update(id, { isLocationHidden });
        }

        return NextResponse.json({ success: true, child });

    } catch (error) {
        console.error('Settings update error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
