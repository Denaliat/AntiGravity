'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './mfa.module.css';

const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * MFA Verification Page
 *
 * Shown to privileged users (ADMIN, DRIVER, etc.) who have enrolled
 * a TOTP factor but need to verify it for this session (aal1 → aal2).
 */
export default function MfaVerifyPage() {
    const router = useRouter();
    const [code, setCode] = useState('');
    const [status, setStatus] = useState<'idle' | 'verifying' | 'error'>('idle');
    const [errorText, setErrorText] = useState('');

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length !== 6) return;

        setStatus('verifying');
        setErrorText('');

        try {
            // Get the enrolled TOTP factors
            const { data: factors } = await supabase.auth.mfa.listFactors();
            const totp = factors?.totp?.[0];

            if (!totp) {
                // No factor enrolled — redirect to enrollment
                router.push('/mfa/enroll');
                return;
            }

            // Create a challenge for the factor
            const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
                factorId: totp.id,
            });

            if (challengeErr || !challenge) {
                setStatus('error');
                setErrorText(challengeErr?.message ?? 'Failed to create MFA challenge');
                return;
            }

            // Verify the TOTP code
            const { error: verifyErr } = await supabase.auth.mfa.verify({
                factorId: totp.id,
                challengeId: challenge.id,
                code,
            });

            if (verifyErr) {
                setStatus('error');
                setErrorText('Invalid code. Please try again.');
                setCode('');
                return;
            }

            // MFA verified — redirect to dashboard
            router.push('/');
            router.refresh();
        } catch {
            setStatus('error');
            setErrorText('An unexpected error occurred');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <div className={styles.shieldIcon}>🔐</div>
                    <h1 className={styles.title}>Two-Factor Authentication</h1>
                    <p className={styles.subtitle}>
                        Enter the 6-digit code from your authenticator app
                    </p>
                </div>

                {errorText && (
                    <div className={styles.errorBanner}>{errorText}</div>
                )}

                <form onSubmit={handleVerify} className={styles.form}>
                    <input
                        id="mfa-code-input"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        autoComplete="one-time-code"
                        placeholder="000000"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        className={styles.codeInput}
                        disabled={status === 'verifying'}
                        autoFocus
                    />
                    <button
                        id="btn-verify-mfa"
                        type="submit"
                        className={styles.submitButton}
                        disabled={status === 'verifying' || code.length !== 6}
                    >
                        {status === 'verifying' ? 'Verifying…' : 'Verify'}
                    </button>
                </form>
            </div>
        </div>
    );
}
