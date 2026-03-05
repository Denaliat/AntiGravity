import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client that carries the *user's* session cookie so that
 * RLS policies activate correctly.  Always use this (not the shared anon client
 * in supabase.ts) inside API route handlers and Server Components.
 *
 * Usage in API routes (has access to NextRequest):
 *   const supabase = createServerClientFromRequest(req);
 *
 * Usage in Server Components / Server Actions (cookies() is available):
 *   const supabase = await createServerClientFromCookies();
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * For use inside Next.js API Route handlers.
 * Reads the Supabase auth cookie from the incoming NextRequest.
 */
export function createServerClientFromRequest(req: NextRequest) {
    return createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return req.cookies.getAll();
            },
            setAll() {
                // API routes are stateless — cookie writes are handled by
                // the middleware refresh loop, not here.
            },
        },
    });
}

/**
 * For use in Server Components and Server Actions.
 * Reads cookies from the Next.js async cookie store.
 */
export async function createServerClientFromCookies() {
    const cookieStore = await cookies();
    return createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                } catch {
                    // Server Components cannot set cookies — safe to ignore.
                }
            },
        },
    });
}
