import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const delivery = await db.bookings.findByTrackingId(id);

        if (!delivery) {
            return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
        }

        // In a real app, we might filter sensitive data (e.g., hidden coordinates) based on who is asking
        return NextResponse.json({ delivery });
    } catch (error) {
        console.error('Tracking error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
