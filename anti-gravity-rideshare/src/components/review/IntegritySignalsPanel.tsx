'use client';

import { useState } from 'react';
import { VerificationSignal, SignalSeverity } from '@/lib/types';

// ── Severity config ───────────────────────────────────────────────────────────
const SEVERITY_STYLE: Record<SignalSeverity, {
    chip: string; dot: string; border: string; bg: string; text: string;
}> = {
    INFO: {
        chip: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
        dot: 'bg-sky-400',
        border: 'border-sky-500/20',
        bg: 'bg-sky-950/20',
        text: 'text-sky-300',
    },
    WARN: {
        chip: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
        dot: 'bg-amber-400',
        border: 'border-amber-500/20',
        bg: 'bg-amber-950/20',
        text: 'text-amber-300',
    },
    BLOCK: {
        chip: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
        dot: 'bg-rose-400 animate-pulse',
        border: 'border-rose-500/30',
        bg: 'bg-rose-950/25',
        text: 'text-rose-300',
    },
};

// ── Single signal row ─────────────────────────────────────────────────────────
function SignalRow({
    signal,
    onConfirm,
    onExpand,
}: {
    signal: VerificationSignal;
    onConfirm: (id: string, checked: boolean) => void;
    onExpand: (code: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const s = SEVERITY_STYLE[signal.severity];

    const handleExpand = () => {
        if (!open) onExpand(signal.code);
        setOpen(o => !o);
    };

    return (
        <div className={`rounded-xl border ${s.border} ${s.bg} p-4 space-y-3`}>
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                    <span className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${s.dot}`} />
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.chip}`}>
                                {signal.severity}
                            </span>
                            <span className="text-sm font-medium text-white">{signal.label}</span>
                        </div>
                        <p className={`text-xs mt-1 leading-relaxed ${s.text}`}>
                            {signal.explanation}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleExpand}
                    className="flex-shrink-0 text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-2"
                >
                    {open ? 'Hide' : 'What triggered this?'}
                </button>
            </div>

            {/* Evidence panel */}
            {open && (
                <div className="rounded-lg bg-zinc-900 border border-zinc-700 p-3">
                    <p className="text-xs font-mono text-zinc-400 mb-1.5">Evidence</p>
                    <pre className="text-xs text-zinc-300 overflow-auto whitespace-pre-wrap leading-relaxed">
                        {JSON.stringify(signal.evidence, null, 2)}
                    </pre>
                </div>
            )}

            {/* BLOCK — required confirmation checkbox */}
            {signal.severity === 'BLOCK' && (
                <label className="flex items-center gap-2.5 cursor-pointer pt-1 border-t border-rose-500/20">
                    <input
                        type="checkbox"
                        checked={signal.confirmed}
                        onChange={e => onConfirm(signal.id, e.target.checked)}
                        className="w-4 h-4 rounded border-rose-500 bg-zinc-800 text-rose-500 focus:ring-rose-500/30 cursor-pointer"
                    />
                    <span className="text-xs text-rose-300 font-medium">
                        I have reviewed this signal and understand its implications before taking action
                    </span>
                </label>
            )}
        </div>
    );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface IntegritySignalsPanelProps {
    signals: VerificationSignal[];
    loading?: boolean;
    onConfirm: (signalId: string, checked: boolean) => void;
    onExpand: (signalCode: string) => void;
}

export default function IntegritySignalsPanel({
    signals,
    loading,
    onConfirm,
    onExpand,
}: IntegritySignalsPanelProps) {
    const [panelOpen, setPanelOpen] = useState(true);

    const blockCount = signals.filter(s => s.severity === 'BLOCK').length;
    const warnCount = signals.filter(s => s.severity === 'WARN').length;

    return (
        <div className="rounded-xl border border-zinc-700 overflow-hidden">
            {/* Collapsible header */}
            <button
                type="button"
                onClick={() => setPanelOpen(o => !o)}
                className="w-full flex items-center justify-between p-4 bg-zinc-800/60 hover:bg-zinc-800 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="text-sm font-semibold text-white">
                        Integrity Signals <span className="text-zinc-500 font-normal">(Explainable)</span>
                    </span>
                    {/* Summary badges */}
                    <div className="flex items-center gap-1.5">
                        {blockCount > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                {blockCount} BLOCK
                            </span>
                        )}
                        {warnCount > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                {warnCount} WARN
                            </span>
                        )}
                        {signals.length === 0 && !loading && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Clean
                            </span>
                        )}
                    </div>
                </div>
                <svg
                    className={`w-4 h-4 text-zinc-500 transition-transform ${panelOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Body */}
            {panelOpen && (
                <div className="p-4 space-y-3 bg-zinc-900/40">
                    {loading && (
                        <div className="flex items-center gap-2 text-sm text-zinc-500">
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            Evaluating submission integrity…
                        </div>
                    )}

                    {!loading && signals.length === 0 && (
                        <div className="flex items-center gap-2 text-sm text-emerald-400">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            No integrity concerns detected for this submission.
                        </div>
                    )}

                    {signals.map(signal => (
                        <SignalRow
                            key={signal.id}
                            signal={signal}
                            onConfirm={onConfirm}
                            onExpand={onExpand}
                        />
                    ))}

                    {signals.length > 0 && (
                        <p className="text-xs text-zinc-600 pt-1">
                            Signals describe this submission only — not the applicant. Signals do not produce a risk score.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
