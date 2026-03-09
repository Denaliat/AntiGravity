import { NextResponse } from 'next/server';
import type { AuthResult } from './api-auth';

/**
 * Privileged roles that require AAL2 (MFA) to access sensitive endpoints.
 */
const MFA_REQUIRED_ROLES = ['ADMIN', 'LEAD_ADMIN', 'SUPPORT', 'DRIVER', 'PARENT'] as const;
type MfaRole = (typeof MFA_REQUIRED_ROLES)[number];

/**
 * Checks whether the authenticated user needs MFA but hasn't completed it.
 *
 * Call this AFTER requireAuth() succeeds. It inspects the Supabase session's
 * AAL (Authenticator Assurance Level):
 *  - aal1 = password / magic-link only
 *  - aal2 = MFA (TOTP) verified
 *
 * If the user's role is in MFA_REQUIRED_ROLES and their current AAL is aal1,
 * this returns a 403 response prompting them to complete MFA.
 *
 * Usage:
 *   const mfaCheck = await requireMfa(authResult);
 *   if (mfaCheck) return mfaCheck; // 403
 */
export async function requireMfa(
    authResult: AuthResult
): Promise<NextResponse | null> {
    const { user, supabase } = authResult;

    // Only enforce MFA for privileged roles
    if (!MFA_REQUIRED_ROLES.includes(user.role as MfaRole)) {
        return null; // No MFA needed for this role
    }

    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (error) {
        return NextResponse.json(
            { error: 'Failed to verify MFA status' },
            { status: 500 }
        );
    }

    // currentLevel is what the session has; nextLevel is what's required
    // If they have an enrolled factor but haven't verified it this session → aal1
    if (data.currentLevel === 'aal1' && data.nextLevel === 'aal2') {
        return NextResponse.json(
            {
                error: 'MFA verification required',
                code: 'MFA_REQUIRED',
                message: 'Your role requires multi-factor authentication. Please complete MFA verification.',
            },
            { status: 403 }
        );
    }

    // No factors enrolled yet — they need to enroll first
    if (data.currentLevel === 'aal1' && data.nextLevel === 'aal1') {
        // Check if any TOTP factors exist
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const hasTotpFactor = factors?.totp && factors.totp.length > 0;

        if (!hasTotpFactor) {
            return NextResponse.json(
                {
                    error: 'MFA enrollment required',
                    code: 'MFA_ENROLL_REQUIRED',
                    message: 'Your role requires multi-factor authentication. Please enroll an authenticator app.',
                },
                { status: 403 }
            );
        }
    }

    // aal2 achieved — MFA verified ✓
    return null;
}
