import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

/**
 * GET /api/driver/earnings
 * Returns the authenticated driver's wallet balance, next payout date,
 * and referral code. Requires: DRIVER role.
 */
export async function GET(request: NextRequest) {
    // ── Auth guard ─────────────────────────────────────────────────────────
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { user: driver } = authResult;

    if (driver.role !== 'DRIVER') {
        return NextResponse.json({ error: 'Forbidden — driver access only' }, { status: 403 });
    }

    try {
        // Calculate Next Payout Date (Next Friday)
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
        const nextPayoutDate = new Date(today);
        nextPayoutDate.setDate(today.getDate() + daysUntilFriday);

        return NextResponse.json({
            balance: driver.walletBalance ?? 0.00,
            nextPayoutDate: nextPayoutDate.toISOString().split('T')[0],
            referralCode: driver.referralCode,
        });

    } catch (error) {
        console.error('Earnings fetch error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
