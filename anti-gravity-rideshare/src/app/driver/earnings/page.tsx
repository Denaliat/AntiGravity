'use client';

import { useEffect, useState } from 'react';

export default function DriverEarningsPage() {
    const [earnings, setEarnings] = useState<{ balance: number; nextPayoutDate: string, referralCode: string } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchEarnings = async () => {
        try {
            const res = await fetch('/api/driver/earnings');
            if (res.ok) {
                const data = await res.json();
                setEarnings(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEarnings();
    }, []);

    const simulateReferral = async () => {
        if (!earnings?.referralCode) return;
        try {
            const res = await fetch('/api/referrals/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ referralCode: earnings.referralCode })
            });
            if (res.ok) {
                alert('Referral Simulated! +$1.00');
                fetchEarnings(); // Refresh balance
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (e) {
            console.error(e);
            alert('Simulation failed');
        }
    };

    if (loading) return <div className="p-8 text-center text-white">Loading earnings...</div>;
    if (!earnings) return <div className="p-8 text-center text-red-500">Failed to load earnings.</div>;

    return (
        <div className="min-h-screen bg-slate-900 p-6 text-white">
            <div className="max-w-md mx-auto">
                <h1 className="text-2xl font-bold mb-8">My Earnings</h1>

                {/* Balance Card */}
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 rounded-2xl shadow-lg mb-6">
                    <p className="text-green-100 text-sm font-medium mb-1">Current Balance</p>
                    <h2 className="text-4xl font-bold">${earnings.balance.toFixed(2)}</h2>
                    <div className="mt-4 pt-4 border-t border-white/20 flex justify-between items-center">
                        <span className="text-sm opacity-90">Next Payout</span>
                        <span className="font-mono font-bold">{earnings.nextPayoutDate}</span>
                    </div>
                </div>

                {/* Referral Section */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-lg font-semibold mb-2">Referral Program</h3>
                    <p className="text-slate-400 text-sm mb-4">Share your code to earn $1.00 per new user!</p>

                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-600 flex justify-between items-center mb-6">
                        <span className="font-mono text-xl tracking-wider text-blue-400">{earnings.referralCode}</span>
                        <button
                            onClick={() => navigator.clipboard.writeText(earnings.referralCode)}
                            className="text-xs text-slate-500 hover:text-white"
                        >
                            Copy
                        </button>
                    </div>

                    {/* Simulation Tool for Prototype */}
                    <div className="bg-slate-700/50 p-4 rounded-lg border border-yellow-500/30">
                        <p className="text-xs text-yellow-500 mb-2 font-bold uppercase tracking-wide">Testing Tool</p>
                        <p className="text-xs text-slate-300 mb-3">Simulate a new user signing up with your code:</p>
                        <button
                            onClick={simulateReferral}
                            className="w-full bg-slate-600 hover:bg-slate-500 py-2 rounded text-sm font-semibold transition"
                        >
                            Simulate Referral Signup (+$1.00)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
