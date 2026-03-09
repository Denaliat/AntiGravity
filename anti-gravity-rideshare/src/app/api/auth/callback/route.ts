import { NextRequest, NextResponse } from 'next/server';
import { createCallbackClient } from '@/lib/supabase-server';
import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * GET /api/auth/callback
 *
 * Email auth confirmation — Supabase redirects here after a user clicks
 * a Magic Link or email OTP verification link.
 *
 * 1. Extract `token_hash` and `type` from the URL (PKCE email flow).
 * 2. Call `verifyOtp()` to establish the session.
 * 3. Persist session cookies onto the redirect response.
 * 4. Redirect to the correct dashboard based on the user's role.
 */
export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const tokenHash = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type') as EmailOtpType | null;
    const next = url.searchParams.get('next') ?? '/parent/dashboard';

    // Build the redirect response first so we can attach cookies to it
    const redirectUrl = new URL(next, req.url);
    const response = NextResponse.redirect(redirectUrl);

    if (!tokenHash || !type) {
        // Missing params — can also handle legacy `code` param for backward compat
        const code = url.searchParams.get('code');
        if (code) {
            const supabase = createCallbackClient(req, response);
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
                return NextResponse.redirect(
                    new URL(`/login?error=${encodeURIComponent(error.message)}`, req.url)
                );
            }
            return await redirectByRole(req, response, supabase, next);
        }

        return NextResponse.redirect(new URL('/login', req.url));
    }

    // Create a Supabase client that writes cookies onto `response`
    const supabase = createCallbackClient(req, response);

    // Verify the OTP token hash (email Magic Link / OTP confirmation)
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (error) {
        return NextResponse.redirect(
            new URL(`/login?error=${encodeURIComponent(error.message)}`, req.url)
        );
    }

    return await redirectByRole(req, response, supabase, next);
}

/**
 * Look up the user's role and redirect to the appropriate dashboard.
 * Keeps session cookies on the response intact.
 */
async function redirectByRole(
    req: NextRequest,
    response: NextResponse,
    supabase: ReturnType<typeof createCallbackClient>,
    fallback: string
) {
    const {
        data: { user: authUser },
    } = await supabase.auth.getUser();

    if (authUser) {
        const { data: appUser } = await supabase
            .from('User')
            .select('role')
            .eq('id', authUser.id)
            .single();

        if (appUser?.role) {
            const destination =
                appUser.role === 'CHILD' ? '/verify-child' :
                appUser.role === 'DRIVER' ? '/driver/rides' :
                appUser.role === 'ADMIN' || appUser.role === 'LEAD_ADMIN' ? '/admin/dashboard' :
                appUser.role === 'SUPPORT' ? '/admin/dashboard' :
                fallback;

            // Redirect with cookies preserved
            const roleRedirect = new URL(destination, req.url);
            return NextResponse.redirect(roleRedirect, { headers: response.headers });
        }
    }

    return response;
}
