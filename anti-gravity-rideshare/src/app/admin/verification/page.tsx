'use client';

import { useEffect, useState, useCallback } from 'react';
import { UserVerificationDocument } from '@/lib/types';
import DocumentReviewCard from '@/components/review/DocumentReviewCard';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PendingDoc extends UserVerificationDocument {
    User?: { id: string; name: string; email: string };
}

interface DriverGroup {
    userId: string;
    name: string;
    email: string;
    docs: PendingDoc[];
}

// Mock reviewer ID — in production, derive from auth session
const REVIEWER_ID = 'admin-reviewer';

// ── Page ──────────────────────────────────────────────────────────────────────
export default function VerificationQueuePage() {
    const [drivers, setDrivers] = useState<DriverGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

    // Load pending documents grouped by driver
    const loadQueue = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/documents?status=PENDING');
            const json = await res.json();
            const docs: PendingDoc[] = json.documents ?? [];

            // Group by userId
            const map = new Map<string, DriverGroup>();
            for (const doc of docs) {
                const uid = doc.userId;
                if (!map.has(uid)) {
                    map.set(uid, {
                        userId: uid,
                        name: doc.User?.name ?? 'Unknown Driver',
                        email: doc.User?.email ?? uid,
                        docs: [],
                    });
                }
                map.get(uid)!.docs.push(doc);
            }
            setDrivers(Array.from(map.values()));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadQueue(); }, [loadQueue]);

    const handleDecision = async (
        docId: string,
        action: 'APPROVED' | 'REJECTED' | 'ESCALATED',
        reason?: string
    ) => {
        await fetch(`/api/admin/documents/${docId}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                reviewerId: REVIEWER_ID,
                rejectionReason: reason,
                secondaryReviewRequired: action === 'ESCALATED',
            }),
        });
        // Reload queue after decision
        await loadQueue();
    };

    const selectedDriver = drivers.find(d => d.userId === selectedDriverId);

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            <div className="max-w-6xl mx-auto px-4 py-8">

                {/* Page header */}
                <div className="mb-8">
                    <div className="inline-flex items-center gap-2 bg-amber-950/40 border border-amber-500/20 rounded-full px-3 py-1 mb-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-xs font-medium text-amber-400 uppercase tracking-widest">Admin</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white">Driver Verification Queue</h1>
                    <p className="text-zinc-500 text-sm mt-1">
                        Review submitted documents. Each document must be viewed before actions unlock.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* ── Left: Driver queue list ───────────────────────────── */}
                    <div className="md:col-span-1 space-y-2">
                        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                            Pending Drivers ({drivers.length})
                        </h2>

                        {loading && (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="rounded-xl bg-zinc-800/40 border border-zinc-700 p-4 animate-pulse">
                                        <div className="h-3 w-32 bg-zinc-700 rounded mb-2" />
                                        <div className="h-2 w-48 bg-zinc-800 rounded" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {!loading && drivers.length === 0 && (
                            <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-6 text-center">
                                <svg className="w-8 h-8 text-emerald-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm text-zinc-400">No pending documents</p>
                            </div>
                        )}

                        {drivers.map(driver => (
                            <button
                                key={driver.userId}
                                type="button"
                                onClick={() => setSelectedDriverId(
                                    selectedDriverId === driver.userId ? null : driver.userId
                                )}
                                className={`w-full text-left rounded-xl border p-4 transition-all ${selectedDriverId === driver.userId
                                        ? 'border-sky-500/50 bg-sky-950/20'
                                        : 'border-zinc-700 bg-zinc-900/40 hover:border-zinc-600 hover:bg-zinc-900/60'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{driver.name}</p>
                                        <p className="text-xs text-zinc-500 truncate">{driver.email}</p>
                                    </div>
                                    <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                        {driver.docs.length} doc{driver.docs.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* ── Right: Document review cards ─────────────────────── */}
                    <div className="md:col-span-2 space-y-4">
                        {!selectedDriver && (
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
                                <svg className="w-10 h-10 text-zinc-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <p className="text-zinc-500 text-sm">Select a driver from the queue to begin review</p>
                            </div>
                        )}

                        {selectedDriver && (
                            <>
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <h2 className="text-base font-semibold text-white">{selectedDriver.name}</h2>
                                        <p className="text-xs text-zinc-500">{selectedDriver.email}</p>
                                    </div>
                                    <span className="text-xs text-zinc-600">
                                        {selectedDriver.docs.length} document{selectedDriver.docs.length !== 1 ? 's' : ''} to review
                                    </span>
                                </div>

                                {selectedDriver.docs.map(doc => (
                                    <DocumentReviewCard
                                        key={doc.id}
                                        doc={doc}
                                        reviewerId={REVIEWER_ID}
                                        onDecision={handleDecision}
                                    />
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
