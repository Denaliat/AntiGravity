'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type UserInfo = { id: string; name: string; isLocationHidden: boolean };
type Contact = { name: string; phone: string; relationship: string; isPrimary: boolean };

export default function ChildDashboard() {
    const [user, setUser] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(true);

    // Ride request form
    const [pickup, setPickup] = useState('');
    const [dropoff, setDropoff] = useState('');
    const [rideStatus, setRideStatus] = useState<string | null>(null);

    // SOS / emergency state
    const [sosActive, setSosActive] = useState(false);
    const [sosContacts, setSosContacts] = useState<Contact[]>([]);
    const [recordingId, setRecordingId] = useState<string | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [recordingError, setRecordingError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        fetchUser();
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

    async function fetchUser() {
        try {
            // In a real app, fetch from /api/user/me (server component would be cleaner)
            const res = await fetch('/api/rides'); // uses auth cookie to identify user
            // For now seed from localStorage-like approach until /api/user/me endpoint exists
        } catch {/* ignore */ }
        setLoading(false);
    }

    async function requestRide(e: React.FormEvent) {
        e.preventDefault();
        setRideStatus(null);
        try {
            const res = await fetch('/api/child/ride-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestedPickup: pickup, requestedDropoff: dropoff }),
            });
            const data = await res.json();
            if (res.status === 429) {
                setRideStatus('rate_limited');
            } else if (data.success) {
                setRideStatus('sent');
                setPickup(''); setDropoff('');
            } else {
                setRideStatus(data.error ?? 'error');
            }
        } catch {
            setRideStatus('Network error');
        }
    }

    const activateSOS = useCallback(async () => {
        setSosActive(true);
        setElapsedSeconds(0);
        setRecordingError(null);

        // ── 1. Get current location ───────────────────────────────────────────
        let latitude: number | undefined;
        let longitude: number | undefined;
        if (navigator.geolocation) {
            await new Promise<void>(resolve => {
                navigator.geolocation.getCurrentPosition(
                    pos => { latitude = pos.coords.latitude; longitude = pos.coords.longitude; resolve(); },
                    () => resolve(),
                    { timeout: 3000 }
                );
            });
        }

        // ── 2. Hit SOS endpoint ───────────────────────────────────────────────
        let recId: string | null = null;
        let contacts: Contact[] = [];
        try {
            const res = await fetch('/api/child/emergency', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latitude, longitude }),
            });
            const data = await res.json();
            if (!res.ok) {
                setRecordingError(data.error ?? 'SOS activation failed');
                setSosActive(false);
                return;
            }
            recId = data.recordingId;
            contacts = data.contacts ?? [];
            setRecordingId(recId);
            setSosContacts(contacts);
        } catch {
            setRecordingError('Could not reach server. Try calling emergency services directly.');
            setSosActive(false);
            return;
        }

        // ── 3. Start elapsed timer ────────────────────────────────────────────
        timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);

        // ── 4. Start MediaRecorder ────────────────────────────────────────────
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = e => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                if (!recId) return;

                // Upload blob to a temporary object URL (in prod: upload to Supabase Storage)
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);

                // Notify backend recording is complete
                await fetch(`/api/child/emergency/${recId}/complete`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recordingUrl: url }),
                }).catch(console.error);
            };

            recorder.onerror = async () => {
                if (recId) {
                    await fetch(`/api/child/emergency/${recId}/complete`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ failed: true }),
                    }).catch(console.error);
                }
            };

            recorder.start(5000); // collect data every 5s
        } catch (err: any) {
            setRecordingError('Microphone access denied. Audio recording unavailable, but your parent has been notified.');
            if (recId) {
                await fetch(`/api/child/emergency/${recId}/complete`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ failed: true }),
                }).catch(console.error);
            }
        }
    }, []);

    function stopSOS() {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        if (timerRef.current) clearInterval(timerRef.current);
        setSosActive(false);
        setElapsedSeconds(0);
        setRecordingId(null);
    }

    const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    // ── SOS Active Screen ─────────────────────────────────────────────────────
    if (sosActive) {
        return (
            <div className="min-h-screen bg-red-950 flex flex-col items-center justify-center p-6 text-white">
                {/* Pulsing recording indicator */}
                <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-full bg-red-600 animate-ping absolute inset-0 opacity-40" />
                    <div className="w-24 h-24 rounded-full bg-red-600 flex items-center justify-center relative z-10">
                        <span className="text-4xl">🚨</span>
                    </div>
                </div>

                <h1 className="text-2xl font-bold mb-1">SOS ACTIVATED</h1>
                <p className="text-red-300 text-sm mb-2">Recording in progress</p>
                <p className="text-3xl font-mono font-bold mb-2">{formatTime(elapsedSeconds)}</p>

                {/* Consent / disclosure banner */}
                <div className="bg-red-900/60 border border-red-700 rounded-xl px-4 py-3 mb-6 max-w-sm w-full text-center">
                    <p className="text-xs text-red-300">
                        🎙️ <strong>Recording has started.</strong> Audio is being captured on this device.
                        Your parent has been notified immediately.
                    </p>
                </div>

                {/* Emergency contacts */}
                {sosContacts.length > 0 && (
                    <div className="w-full max-w-sm space-y-2 mb-6">
                        <p className="text-sm font-semibold text-red-300 mb-2">📞 Emergency Contacts</p>
                        {sosContacts.map((c, i) => (
                            <a
                                key={i}
                                href={`tel:${c.phone}`}
                                className="flex items-center justify-between bg-red-900/50 border border-red-700 rounded-xl px-4 py-3 hover:bg-red-900 transition"
                            >
                                <div>
                                    <p className="font-bold">{c.name}</p>
                                    <p className="text-xs text-red-300">{c.relationship} · {c.isPrimary ? 'Primary' : 'Secondary'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-mono text-white">{c.phone}</p>
                                    <p className="text-xs text-red-400 mt-0.5">Tap to call</p>
                                </div>
                            </a>
                        ))}
                    </div>
                )}

                {recordingError && (
                    <div className="bg-yellow-900/40 border border-yellow-700 rounded-xl px-4 py-3 mb-4 max-w-sm w-full text-center">
                        <p className="text-xs text-yellow-300">⚠️ {recordingError}</p>
                    </div>
                )}

                <button
                    onClick={stopSOS}
                    className="mt-2 px-8 py-3 bg-white text-red-900 font-bold rounded-full hover:bg-red-100 transition"
                >
                    I'm Safe — Stop Recording
                </button>
            </div>
        );
    }

    // ── Normal Dashboard ──────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-900 text-white">
            <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
                <h1 className="text-2xl font-bold">Hi, {user?.name ?? 'there'}! 👋</h1>
                <p className="text-slate-400 text-sm">What would you like to do today?</p>
            </div>

            <div className="px-6 py-4 space-y-4">
                {/* Location sharing status */}
                <div className="bg-slate-800 rounded-xl p-4 flex items-center justify-between border border-slate-700">
                    <span className="text-slate-300 font-medium">Location Sharing</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${user?.isLocationHidden ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                        {user?.isLocationHidden ? 'OFF' : 'ON'}
                    </span>
                </div>

                {/* Request a ride (submits RideRequest, not Ride) */}
                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                    <h2 className="font-bold text-lg mb-1">Request a Ride</h2>
                    <p className="text-slate-400 text-xs mb-4">This sends a request to your parent. They must approve it before the ride is booked.</p>
                    <form onSubmit={requestRide} className="space-y-3">
                        <input
                            value={pickup}
                            onChange={e => setPickup(e.target.value)}
                            placeholder="Where are you? (pickup)"
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                            required
                        />
                        <input
                            value={dropoff}
                            onChange={e => setDropoff(e.target.value)}
                            placeholder="Where are you going? (drop-off)"
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                            required
                        />
                        <button
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition"
                        >
                            Send Request to Parent 🚗
                        </button>
                    </form>
                    {rideStatus === 'sent' && <p className="mt-3 text-green-400 text-sm text-center">✅ Request sent! Waiting for your parent to approve.</p>}
                    {rideStatus === 'rate_limited' && <p className="mt-3 text-amber-400 text-sm text-center">⏳ Too many requests. Please wait a few minutes.</p>}
                    {rideStatus && rideStatus !== 'sent' && rideStatus !== 'rate_limited' && (
                        <p className="mt-3 text-red-400 text-sm text-center">❌ {rideStatus}</p>
                    )}
                </div>

                {/* Emergency SOS */}
                <div className="bg-red-950/40 border border-red-800 rounded-xl p-5">
                    <h2 className="font-bold text-lg text-red-300 mb-1">🆘 Emergency</h2>
                    <p className="text-red-400 text-xs mb-4">
                        Press only in a real emergency. This will immediately alert your parent, start audio recording, and show you their contact details.
                    </p>
                    <button
                        onClick={activateSOS}
                        className="w-full bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold py-4 rounded-xl text-lg transition-all shadow-lg shadow-red-900/50"
                    >
                        🚨 SEND SOS ALERT
                    </button>
                </div>
            </div>
        </div>
    );
}
