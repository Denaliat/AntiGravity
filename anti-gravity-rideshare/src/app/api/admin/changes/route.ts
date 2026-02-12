import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ChangeRequest } from '@/lib/types';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
    try {
        // Simulate Developer Auth
        const dev = await db.users.findByEmail('dev@example.com');
        if (!dev || dev.role !== 'DEVELOPER') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const { description } = await request.json();

        const newRequest: ChangeRequest = {
            id: randomUUID(),
            developerId: dev.id,
            description,
            status: 'PENDING',
            timestamp: new Date().toISOString()
        };

        await db.changeRequests.create(newRequest);
        return NextResponse.json({ success: true, request: newRequest });

    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    // Simulate Admin/Lead Auth
    return NextResponse.json({ requests: await db.changeRequests.findAll() });
}
