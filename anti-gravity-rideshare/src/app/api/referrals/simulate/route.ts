import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { referralCode } = body;

        if (!referralCode) {
            return NextResponse.json({ error: 'Referral code required' }, { status: 400 });
        }

        // 1. Find Driver by Code
        const driver = await db.users.findByReferralCode(referralCode);
        if (!driver) {
            return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });
        }

        // 2. Credit Driver
        const REFERRAL_BONUS = 1.00;
        const currentBalance = driver.walletBalance || 0;
        const newBalance = currentBalance + REFERRAL_BONUS;

        await db.users.update(driver.id, { walletBalance: newBalance });

        return NextResponse.json({
            success: true,
            message: `Simulated signup! Driver ${driver.name} credited $${REFERRAL_BONUS.toFixed(2)}`,
            newDriverBalance: newBalance
        });

    } catch (error) {
        console.error('Referral simulation error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
