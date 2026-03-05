import { NextRequest, NextResponse } from 'next/server';
import { createServerClientFromRequest } from '@/lib/supabase-server';

/**
 * Next.js Edge Middleware
 *
 * Runs before every request to /api/admin/*, /api/driver/*, /api/delivery/*,
 * /api/parent/*, and /api/child/* routes.
 * Validates the Supabase session cookie at the edge — returns 401 immediately
 * if no valid session is found, before the route handler even executes.
 *
 * This is a fast, low-cost outer defence layer and does NOT replace the
 * per-route requireAuth() / requireAdminAuth() checks, which enforce role-based
 * access control within each handler.
 *
 * It also refreshes the Supabase session token if it is close to expiring,
 * keeping the user logged in across long sessions.
 */
export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Only guard API routes that require authentication
    const isProtectedRoute =
        pathname.startsWith('/api/admin/') ||
        pathname.startsWith('/api/driver/') ||
        pathname.startsWith('/api/delivery/') ||
        pathname.startsWith('/api/parent/') ||
        pathname.startsWith('/api/child/');

    if (!isProtectedRoute) {
        return NextResponse.next();
    }

    const supabase = createServerClientFromRequest(req);

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        return NextResponse.json(
            { error: 'Unauthorized — please sign in' },
            { status: 401 }
        );
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
    ],
};
