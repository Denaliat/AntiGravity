'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../mfa.module.css';

const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * MFA Enrollment Page
 *
 * Shown to privileged users who haven't yet enrolled a TOTP factor.
 * Walks them through:
 *   1. Enroll a new TOTP factor (displays QR code)
 *   2. Verify their first code to activate it
 */
export default function MfaEnrollPage() {
    const router = useRouter();
    const [step, setStep] = useState<'enrolling' | 'verify' | 'error'>('enrolling');
    const [qrUri, setQrUri] = useState('');
    const [factorId, setFactorId] = useState('');
    const [code, setCode] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading'>('idle');
    const [errorText, setErrorText] = useState('');

    // Step 1: Enroll — generate QR code
    const handleEnroll = async () => {
        setStatus('loading');
        setErrorText('');

        const { data, error } = await supabase.auth.mfa.enroll({
            factorType: 'totp',
            friendlyName: 'AntiGravity Authenticator',
        });

        if (error || !data) {
            setStep('error');
            setErrorText(error?.message ?? 'Failed to enroll MFA');
            setStatus('idle');
            return;
        }

        setQrUri(data.totp.qr_code);
        setFactorId(data.id);
        setStep('verify');
        setStatus('idle');
    };

    // Step 2: Verify the first TOTP code to activate the factor
    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length !== 6) return;

        setStatus('loading');
        setErrorText('');

        const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
            factorId,
        });

        if (challengeErr || !challenge) {
            setErrorText(challengeErr?.message ?? 'Failed to create challenge');
            setStatus('idle');
            return;
        }

        const { error: verifyErr } = await supabase.auth.mfa.verify({
            factorId,
            challengeId: challenge.id,
            code,
        });

        if (verifyErr) {
            setErrorText('Invalid code. Please try again.');
            setCode('');
            setStatus('idle');
            return;
        }

        // MFA enrolled and verified — redirect to dashboard
        router.push('/');
        router.refresh();
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <div className={styles.shieldIcon}>🛡️</div>
                    <h1 className={styles.title}>Set Up Two-Factor Auth</h1>
                    <p className={styles.subtitle}>
                        Your role requires an extra layer of security
                    </p>
                </div>

                {errorText && (
                    <div className={styles.errorBanner}>{errorText}</div>
                )}

                {step === 'enrolling' && (
                    <div className={styles.enrollStart}>
                        <p className={styles.instructions}>
                            You'll need an authenticator app like <strong>Google Authenticator</strong> or <strong>Authy</strong>.
                        </p>
                        <button
                            id="btn-start-enroll"
                            className={styles.submitButton}
                            onClick={handleEnroll}
                            disabled={status === 'loading'}
                        >
                            {status === 'loading' ? 'Generating…' : 'Generate QR Code'}
                        </button>
                    </div>
                )}

                {step === 'verify' && (
                    <div className={styles.enrollVerify}>
                        <p className={styles.instructions}>
                            Scan this QR code with your authenticator app, then enter the 6-digit code below.
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={qrUri}
                            alt="Scan this QR code with your authenticator app"
                            className={styles.qrCode}
                        />
                        <form onSubmit={handleVerify} className={styles.form}>
                            <input
                                id="mfa-enroll-code"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                autoComplete="one-time-code"
                                placeholder="000000"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                className={styles.codeInput}
                                disabled={status === 'loading'}
                                autoFocus
                            />
                            <button
                                id="btn-verify-enroll"
                                type="submit"
                                className={styles.submitButton}
                                disabled={status === 'loading' || code.length !== 6}
                            >
                                {status === 'loading' ? 'Verifying…' : 'Activate'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
