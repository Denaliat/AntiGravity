'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './verify.module.css';

const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Child Verification Page
 *
 * After a child logs in via Magic Link, they see this page until
 * their parent confirms the session. The page:
 *
 *   1. Sends a verification request to the parent (notification)
 *   2. Polls the server every 5 seconds for parent approval
 *   3. Redirects to the child dashboard once verified
 */
export default function ChildVerifyPage() {
    const [status, setStatus] = useState<'requesting' | 'waiting' | 'verified' | 'error' | 'timeout'>('requesting');
    const [errorText, setErrorText] = useState('');

    const checkVerification = useCallback(async () => {
        const res = await fetch('/api/auth/verify-child');
        if (!res.ok) return;
        const data = await res.json();
        if (data.verified) {
            setStatus('verified');
            // Redirect to child dashboard after brief delay
            setTimeout(() => {
                window.location.href = '/child/dashboard';
            }, 1500);
        }
    }, []);

    // Request verification on mount
    useEffect(() => {
        const requestVerification = async () => {
            try {
                const res = await fetch('/api/auth/verify-child', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                });

                if (res.ok) {
                    setStatus('waiting');
                } else {
                    const data = await res.json();
                    setStatus('error');
                    setErrorText(data.error || 'Failed to request verification');
                }
            } catch {
                setStatus('error');
                setErrorText('Network error — please try again');
            }
        };

        requestVerification();
    }, []);

    // Poll for parent approval every 5 seconds, timeout after 10 minutes
    useEffect(() => {
        if (status !== 'waiting') return;

        const interval = setInterval(checkVerification, 5000);
        const timeout = setTimeout(() => {
            clearInterval(interval);
            setStatus('timeout');
        }, POLL_TIMEOUT_MS);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [status, checkVerification]);

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <div className={styles.icon}>
                        {status === 'verified' ? '✅' : status === 'error' ? '❌' : '⏳'}
                    </div>
                    <h1 className={styles.title}>
                        {status === 'verified'
                            ? 'Verified!'
                            : status === 'error'
                            ? 'Verification Failed'
                            : 'Waiting for Parent'}
                    </h1>
                </div>

                {status === 'requesting' && (
                    <p className={styles.message}>Notifying your parent…</p>
                )}

                {status === 'waiting' && (
                    <>
                        <p className={styles.message}>
                            Your parent has been notified. Once they confirm,
                            you'll be taken to your dashboard automatically.
                        </p>
                        <div className={styles.pulse} />
                    </>
                )}

                {status === 'verified' && (
                    <p className={styles.message}>
                        Your parent has approved your session. Redirecting…
                    </p>
                )}

                {status === 'error' && (
                    <div className={styles.errorBlock}>
                        <p className={styles.message}>{errorText}</p>
                        <button
                            className={styles.retryButton}
                            onClick={() => window.location.reload()}
                        >
                            Try again
                        </button>
                    </div>
                )}

                {status === 'timeout' && (
                    <div className={styles.errorBlock}>
                        <p className={styles.message}>
                            Verification timed out. Please ask your parent to confirm, then sign in again.
                        </p>
                        <button
                            className={styles.retryButton}
                            onClick={() => { window.location.href = '/login'; }}
                        >
                            Back to login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
