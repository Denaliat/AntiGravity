import { NextRequest, NextResponse } from 'next/server';
import { createServerClientFromRequest } from '@/lib/supabase-server';

/**
 * Next.js Edge Middleware
 *
 * Runs before every matched request.
 *
 * — API routes (/api/admin/*, /api/driver/*, etc.): returns 401 JSON if no session.
 * — Page routes (/parent/*, /driver/*, /admin/*):   redirects to /login if no session.
 * — Auth routes (/api/auth/*):                      always allowed through (callback needs no session).
 *
 * This is a fast, low-cost outer defence layer and does NOT replace the
 * per-route requireAuth() / requireAdminAuth() checks, which enforce role-based
 * access control within each handler.
 */
export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Auth routes must always be accessible (OAuth callback, logout, etc.)
    if (pathname.startsWith('/api/auth/')) {
        return NextResponse.next();
    }

    // Determine if this is a protected API route
    const isProtectedApi =
        pathname.startsWith('/api/admin/') ||
        pathname.startsWith('/api/driver/') ||
        pathname.startsWith('/api/delivery/') ||
        pathname.startsWith('/api/parent/') ||
        pathname.startsWith('/api/child/');

    // Determine if this is a protected page route
    const isProtectedPage =
        pathname.startsWith('/parent/') ||
        pathname.startsWith('/driver/') ||
        pathname.startsWith('/admin/');

    if (!isProtectedApi && !isProtectedPage) {
        return NextResponse.next();
    }

    const supabase = createServerClientFromRequest(req);

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        // API routes → 401 JSON
        if (isProtectedApi) {
            return NextResponse.json(
                { error: 'Unauthorized — please sign in' },
                { status: 401 }
            );
        }
        // Page routes → redirect to login
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('next', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Session is valid — continue to the route handler
    return NextResponse.next();
}

export const config = {
    matcher: [
        '/api/admin/:path*',
        '/api/driver/:path*',
        '/api/delivery/:path*',
        '/api/parent/:path*',
        '/api/child/:path*',
        '/api/auth/:path*',
        '/parent/:path*',
        '/driver/:path*',
        '/admin/:path*',
    ],
};

