'use client';

import { useState, useCallback } from 'react';
import { UserVerificationDocument, VerificationSignal, VerificationDocumentType } from '@/lib/types';
import IntegritySignalsPanel from './IntegritySignalsPanel';

const DOC_LABELS: Record<VerificationDocumentType, string> = {
    DRIVERS_LICENSE: "Driver's License",
    INSURANCE: 'Insurance',
    VEHICLE_REGISTRATION: 'Vehicle Registration',
    VULNERABLE_SECTOR_CHECK: 'Vulnerable Sector Check',
    SELFIE_MATCH: 'Selfie / Identity Match',
};

const STATUS_STYLE: Record<string, string> = {
    UNSUBMITTED: 'bg-zinc-700/40 text-zinc-400',
    PENDING: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    VERIFIED: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    REJECTED: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
};

interface DocumentReviewCardProps {
    doc: UserVerificationDocument;
    reviewerId: string;
    onDecision: (docId: string, action: 'APPROVED' | 'REJECTED' | 'ESCALATED', reason?: string) => Promise<void>;
}

export default function DocumentReviewCard({ doc, reviewerId, onDecision }: DocumentReviewCardProps) {
    const [viewed, setViewed] = useState(false);
    const [signals, setSignals] = useState<VerificationSignal[] | null>(null);
    const [loadingSignals, setLoadingSignals] = useState(false);
    const [showRejectInput, setShowRejectInput] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    // Load signals on first preview open
    const handlePreviewClick = useCallback(async () => {
        if (!viewed) {
            setViewed(true);
            // Log VIEWED audit event
            await fetch(`/api/admin/documents/${doc.id}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'VIEWED', reviewerId, secondaryReviewRequired: false }),
            });
            // Fetch signals
            setLoadingSignals(true);
            try {
                const res = await fetch(`/api/admin/documents/${doc.id}/signals`);
                const json = await res.json();
                setSignals(json.signals ?? []);
            } finally {
                setLoadingSignals(false);
            }
        }
    }, [doc.id, viewed, reviewerId]);

    const handleSignalExpand = useCallback(async (code: string) => {
        await fetch(`/api/admin/documents/${doc.id}/signals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewerId, signalCode: code }),
        });
    }, [doc.id, reviewerId]);

    const handleConfirm = useCallback((signalId: string, checked: boolean) => {
        setSignals(prev => prev?.map(s => s.id === signalId ? { ...s, confirmed: checked } : s) ?? null);
    }, []);

    // Actions are locked until: preview viewed + all BLOCK signals confirmed
    const blockUnconfirmed = (signals ?? []).filter(s => s.severity === 'BLOCK' && !s.confirmed);
    const hasSecondaryRequired = (signals ?? []).some(s => s.severity === 'BLOCK');
    const actionsEnabled = viewed && blockUnconfirmed.length === 0;

    const handleDecision = async (action: 'APPROVED' | 'REJECTED' | 'ESCALATED') => {
        if (action === 'REJECTED' && !showRejectInput) {
            setShowRejectInput(true);
            return;
        }
        if (action === 'REJECTED' && !rejectReason.trim()) return;
        setSubmitting(true);
        try {
            await onDecision(doc.id, action, rejectReason || undefined);
            setDone(true);
        } finally {
            setSubmitting(false);
        }
    };

    if (done) {
        return (
            <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-5 flex items-center gap-3 text-sm">
                <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-zinc-400">Review submitted for <span className="text-white font-medium">{DOC_LABELS[doc.documentType]}</span></span>
            </div>
        );
    }

    const isImage = doc.fileUrl && /\.(jpg|jpeg|png|webp|heic)$/i.test(doc.fileUrl);

    return (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 overflow-hidden space-y-0">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white">{DOC_LABELS[doc.documentType]}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[doc.status]}`}>
                        {doc.status}
                    </span>
                </div>
                {doc.uploadedAt && (
                    <span className="text-xs text-zinc-500">
                        Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                    </span>
                )}
            </div>

            {/* Preview */}
            <div className="px-5 pt-4 pb-2">
                {doc.fileUrl ? (
                    <div
                        className={`relative rounded-xl overflow-hidden border transition-all ${viewed ? 'border-zinc-600' : 'border-amber-500/40 cursor-pointer'
                            }`}
                        onClick={handlePreviewClick}
                    >
                        {isImage ? (
                            <img
                                src={doc.fileUrl}
                                alt={DOC_LABELS[doc.documentType]}
                                className="w-full max-h-52 object-contain bg-zinc-800"
                            />
                        ) : (
                            <div className="flex items-center gap-3 p-4 bg-zinc-800">
                                <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                <div>
                                    <p className="text-sm text-white font-medium">Document file</p>
                                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-xs text-sky-400 hover:underline" onClick={handlePreviewClick}>
                                        Open in new tab ↗
                                    </a>
                                </div>
                            </div>
                        )}
                        {/* Preview gate overlay */}
                        {!viewed && (
                            <div className="absolute inset-0 bg-zinc-900/80 flex flex-col items-center justify-center gap-2">
                                <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <p className="text-sm font-medium text-white">Click to view document</p>
                                <p className="text-xs text-zinc-400">Review is required before taking action</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-4 text-sm text-zinc-500 text-center">
                        No file uploaded yet
                    </div>
                )}

                {/* Expiry info */}
                {doc.expiresAt && (
                    <p className="text-xs text-zinc-500 mt-2">
                        Expires: <span className={new Date(doc.expiresAt) < new Date() ? 'text-rose-400' : 'text-zinc-300'}>
                            {new Date(doc.expiresAt).toLocaleDateString()}
                        </span>
                    </p>
                )}
            </div>

            {/* Integrity Signals (loaded after preview is viewed) */}
            {viewed && (
                <div className="px-5 pb-4">
                    <IntegritySignalsPanel
                        signals={signals ?? []}
                        loading={loadingSignals}
                        onConfirm={handleConfirm}
                        onExpand={handleSignalExpand}
                    />
                </div>
            )}

            {/* Action area */}
            <div className="px-5 pb-5 space-y-3">
                {!viewed && (
                    <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        View the document above to unlock review actions
                    </p>
                )}
                {viewed && blockUnconfirmed.length > 0 && (
                    <p className="text-xs text-rose-400/80 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                        Confirm all BLOCK signals above before taking action
                    </p>
                )}

                {/* Rejection reason input */}
                {showRejectInput && (
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-400">
                            Reason for rejection <span className="text-rose-400">*</span>
                        </label>
                        <textarea
                            rows={2}
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Describe why this document is being rejected…"
                            className="w-full rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 px-4 py-2.5 text-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30 transition-all resize-none"
                        />
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        disabled={!actionsEnabled || submitting}
                        onClick={() => handleDecision('APPROVED')}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        Approve
                    </button>
                    <button
                        type="button"
                        disabled={!actionsEnabled || submitting}
                        onClick={() => handleDecision('REJECTED')}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold bg-rose-700 text-white hover:bg-rose-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        {showRejectInput ? 'Confirm Reject' : 'Reject'}
                    </button>
                    {hasSecondaryRequired && (
                        <button
                            type="button"
                            disabled={!viewed || submitting}
                            onClick={() => handleDecision('ESCALATED')}
                            className="py-2 px-3 rounded-xl text-sm font-semibold border border-amber-500/40 text-amber-300 hover:bg-amber-950/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            title="Escalate to second reviewer"
                        >
                            Escalate
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
