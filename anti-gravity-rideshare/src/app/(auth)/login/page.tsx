'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import styles from './login.module.css';

const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function LoginForm() {
    const searchParams = useSearchParams();
    const errorMessage = searchParams.get('error');

    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
    const [errorText, setErrorText] = useState(errorMessage ?? '');

    const handleMagicLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;

        setStatus('sending');
        setErrorText('');

        const { error } = await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: {
                emailRedirectTo: `${window.location.origin}/api/auth/callback`,
            },
        });

        if (error) {
            setStatus('error');
            setErrorText(error.message);
        } else {
            setStatus('sent');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                {/* Brand */}
                <div className={styles.brand}>
                    <div className={styles.logoIcon}>AG</div>
                    <h1 className={styles.title}>AntiGravity</h1>
                    <p className={styles.subtitle}>Rideshare that moves you forward</p>
                </div>

                {/* Error Banner */}
                {errorText && status !== 'sent' && (
                    <div className={styles.errorBanner}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M8 4.5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        <span>{errorText}</span>
                    </div>
                )}

                {/* Success State */}
                {status === 'sent' ? (
                    <div className={styles.successState}>
                        <div className={styles.successIcon}>✉️</div>
                        <h2 className={styles.successTitle}>Check your email</h2>
                        <p className={styles.successText}>
                            We sent a sign-in link to <strong>{email}</strong>.
                            Click the link in the email to sign in.
                        </p>
                        <button
                            className={styles.resetButton}
                            onClick={() => { setStatus('idle'); setEmail(''); }}
                        >
                            Use a different email
                        </button>
                    </div>
                ) : (
                    /* Email Form */
                    <form onSubmit={handleMagicLink} className={styles.form}>
                        <label htmlFor="email-input" className={styles.label}>
                            Email address
                        </label>
                        <input
                            id="email-input"
                            type="email"
                            required
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={styles.input}
                            disabled={status === 'sending'}
                        />
                        <button
                            id="btn-magic-link"
                            type="submit"
                            className={styles.submitButton}
                            disabled={status === 'sending' || !email.trim()}
                        >
                            {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
                        </button>
                    </form>
                )}

                <p className={styles.terms}>
                    By continuing, you agree to our Terms of Service and Privacy Policy.
                </p>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.brand}>
                        <div className={styles.logoIcon}>AG</div>
                        <h1 className={styles.title}>AntiGravity</h1>
                    </div>
                </div>
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
