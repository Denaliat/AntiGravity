import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
    try {
        // 1. Simulate Driver Auth
        const driver = await db.users.findByEmail('driver@example.com');
        if (!driver || driver.role !== 'DRIVER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Calculate Next Payout Date (Next Friday)
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
        const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7; // If today is Friday, next Friday is 7 days away
        const nextPayoutDate = new Date(today);
        nextPayoutDate.setDate(today.getDate() + daysUntilFriday);

        // 3. Return Earnings Info
        return NextResponse.json({
            balance: driver.walletBalance || 0.00,
            nextPayoutDate: nextPayoutDate.toISOString().split('T')[0], // YYYY-MM-DD
            referralCode: driver.referralCode
        });

    } catch (error) {
        console.error('Earnings fetch error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
