import { NextRequest, NextResponse } from 'next/server';
import { createCallbackClient } from '@/lib/supabase-server';

/**
 * POST /api/auth/logout
 *
 * Signs out the current user, clears session cookies, and redirects to /login.
 * Accepts POST to prevent CSRF via link prefetching (GET logout is an anti-pattern).
 */
export async function POST(req: NextRequest) {
    const redirectUrl = new URL('/login', req.url);
    const response = NextResponse.redirect(redirectUrl, { status: 303 });

    const supabase = createCallbackClient(req, response);
    await supabase.auth.signOut();

    return response;
}
