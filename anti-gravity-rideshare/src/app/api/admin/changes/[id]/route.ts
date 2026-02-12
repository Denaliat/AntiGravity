import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        // Simulate Lead Admin Auth
        const admin = await db.users.findByEmail('lead@example.com');
        if (!admin || admin.role !== 'LEAD_ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const { status } = await request.json();
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        const updated = await db.changeRequests.updateStatus(id, status, admin.id);
        return NextResponse.json({ success: true, request: updated });

    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
