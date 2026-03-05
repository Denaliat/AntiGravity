import { NextRequest, NextResponse } from 'next/server';
import { createServerClientFromRequest } from './supabase-server';
import type { User } from './types';

/**
 * Admin roles that are allowed to access /api/admin/* endpoints.
 */
const ADMIN_ROLES = ['ADMIN', 'LEAD_ADMIN', 'SUPPORT'] as const;
type AdminRole = (typeof ADMIN_ROLES)[number];

export interface AuthResult {
    user: User;
    supabase: ReturnType<typeof createServerClientFromRequest>;
}

/**
 * Verifies that the incoming request carries a valid Supabase session.
 *
 * Returns `{ user, supabase }` on success.
 * Returns a NextResponse with status 401 if no session is found.
 *
 * Usage:
 *   const authResult = await requireAuth(req);
 *   if (authResult instanceof NextResponse) return authResult; // 401 guard
 *   const { user, supabase } = authResult;
 */
export async function requireAuth(
    req: NextRequest
): Promise<AuthResult | NextResponse> {
    const supabase = createServerClientFromRequest(req);

    const {
        data: { user: authUser },
        error,
    } = await supabase.auth.getUser();

    if (error || !authUser) {
        return NextResponse.json(
            { error: 'Unauthorized — please sign in' },
            { status: 401 }
        );
    }

    // Fetch the full User row from our public schema (includes role, etc.)
    const { data: user, error: userErr } = await supabase
        .from('User')
        .select('*')
        .eq('id', authUser.id)
        .single();

    if (userErr || !user) {
        return NextResponse.json(
            { error: 'Unauthorized — user record not found' },
            { status: 401 }
        );
    }

    return { user: user as User, supabase };
}

/**
 * Verifies the request carries a valid Supabase session AND that the
 * authenticated user has an admin-level role (ADMIN | LEAD_ADMIN | SUPPORT).
 *
 * Returns `{ user, supabase }` on success.
 * Returns a NextResponse with status 401 (no session) or 403 (wrong role).
 *
 * Usage:
 *   const authResult = await requireAdminAuth(req);
 *   if (authResult instanceof NextResponse) return authResult;
 *   const { user, supabase } = authResult;
 */
export async function requireAdminAuth(
    req: NextRequest
): Promise<AuthResult | NextResponse> {
    const authResult = await requireAuth(req);

    // Propagate 401 if unauthenticated
    if (authResult instanceof NextResponse) return authResult;

    const { user } = authResult;

    if (!ADMIN_ROLES.includes(user.role as AdminRole)) {
        return NextResponse.json(
            { error: 'Forbidden — insufficient permissions' },
            { status: 403 }
        );
    }

    return authResult;
}

/**
 * Verifies the request carries a valid Supabase session AND that the
 * authenticated user has the LEAD_ADMIN role specifically.
 */
export async function requireLeadAdminAuth(
    req: NextRequest
): Promise<AuthResult | NextResponse> {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const { user } = authResult;
    if (user.role !== 'LEAD_ADMIN') {
        return NextResponse.json(
            { error: 'Forbidden — Lead Admin role required' },
            { status: 403 }
        );
    }

    return authResult;
}
