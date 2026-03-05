'use client';

import { useState, useEffect, useRef } from 'react';

type Contact = { name: string; phone: string; relationship: string; isPrimary: boolean };
type RideRequest = { id: string; childId: string; requestedPickup: string; requestedDropoff: string; status: string; createdAt: string };
type Notification = { id: string; message: string; read: boolean; createdAt: string };
type Child = { id: string; name: string; isLocationHidden: boolean; rideRestrictionsEnabled?: boolean };

export default function ParentDashboard() {
    const [children, setChildren] = useState<Child[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [setupComplete, setSetupComplete] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [rideRequests, setRideRequests] = useState<RideRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'overview' | 'contacts' | 'requests'>('overview');

    // Book ride form state
    const [selectedChild, setSelectedChild] = useState('');
    const [pickup, setPickup] = useState('');
    const [dropoff, setDropoff] = useState('');
    const [acknowledged, setAcknowledged] = useState(false);
    const [bookingStatus, setBookingStatus] = useState<string | null>(null);

    // Contact form state
    const [contactForm, setContactForm] = useState({ name: '', phone: '', relationship: '', email: '', isPrimary: true });
    const [contactStatus, setContactStatus] = useState<string | null>(null);

    useEffect(() => {
        fetchAll();
    }, []);

    async function fetchAll() {
        setLoading(true);
        try {
            const [contactsRes, notifRes] = await Promise.all([
                fetch('/api/parent/emergency-contacts'),
                fetch('/api/rides'),
            ]);
            if (contactsRes.ok) {
                const d = await contactsRes.json();
                setContacts(d.contacts ?? []);
                setSetupComplete(d.setupComplete ?? false);
            }
            if (notifRes.ok) {
                // Notifications would come from a dedicated endpoint in prod
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function bookRide(e: React.FormEvent) {
        e.preventDefault();
        setBookingStatus(null);
        const res = await fetch('/api/parent/rides', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ childId: selectedChild, pickup, dropoff, acknowledgedNoContacts: acknowledged }),
        });
        const data = await res.json();
        if (data.warning === 'NO_EMERGENCY_CONTACTS') {
            setBookingStatus('warning');
        } else if (data.success) {
            setBookingStatus('success');
            setPickup(''); setDropoff('');
        } else {
            setBookingStatus(data.error ?? 'error');
        }
    }

    async function saveContact(e: React.FormEvent) {
        e.preventDefault();
        setContactStatus(null);
        try {
            const res = await fetch('/api/parent/emergency-contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(contactForm),
            });
            const data = await res.json();
            if (data.success) {
                setContactStatus('saved');
                setSetupComplete(data.setupComplete);
                setContacts(prev => {
                    const filtered = prev.filter(c => c.isPrimary !== contactForm.isPrimary);
                    return [...filtered, data.contact];
                });
                setContactForm({ name: '', phone: '', relationship: '', email: '', isPrimary: !contactForm.isPrimary });
            } else {
                setContactStatus(data.error ?? 'error');
            }
        } catch {
            setContactStatus('Network error');
        }
    }

    const primaryContact = contacts.find(c => c.isPrimary);
    const secondaryContact = contacts.find(c => !c.isPrimary);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white">
            {/* Header */}
            <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Parent Dashboard</h1>
                    <p className="text-slate-400 text-sm mt-0.5">Manage your children's rides safely</p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${setupComplete ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                    <span className={`w-2 h-2 rounded-full ${setupComplete ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`} />
                    {setupComplete ? 'Contacts configured' : 'Contacts required'}
                </div>
            </div>

            {/* Emergency contacts banner */}
            {!setupComplete && (
                <div className="mx-6 mt-4 bg-red-950/60 border border-red-700 rounded-xl p-4 flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                        <p className="font-semibold text-red-300">Emergency contacts required</p>
                        <p className="text-red-400 text-sm mt-1">
                            You must add a primary and secondary emergency contact before the SOS feature is active.
                            Ride booking is still available but SOS will be disabled.
                        </p>
                        <button
                            onClick={() => setTab('contacts')}
                            className="mt-2 text-xs font-semibold text-red-300 underline underline-offset-2"
                        >
                            Set up contacts →
                        </button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mx-6 mt-4 bg-slate-800 rounded-xl p-1">
                {(['overview', 'contacts', 'requests'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`flex-1 py-2 text-sm font-semibold rounded-lg capitalize transition ${tab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        {t === 'requests' ? 'Ride Requests' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                ))}
            </div>

            <div className="px-6 py-4 space-y-4">

                {/* ── Overview Tab ── */}
                {tab === 'overview' && (
                    <>
                        {/* Book a ride */}
                        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                            <h2 className="font-bold text-lg mb-4">Book a Ride for your Child</h2>
                            <form onSubmit={bookRide} className="space-y-3">
                                <select
                                    value={selectedChild}
                                    onChange={e => setSelectedChild(e.target.value)}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                    required
                                >
                                    <option value="">Select a child…</option>
                                    {children.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <input
                                    value={pickup}
                                    onChange={e => setPickup(e.target.value)}
                                    placeholder="Pickup location"
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                    required
                                />
                                <input
                                    value={dropoff}
                                    onChange={e => setDropoff(e.target.value)}
                                    placeholder="Drop-off location"
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                    required
                                />

                                {/* Soft gate acknowledgment */}
                                {(bookingStatus === 'warning' || (!setupComplete)) && (
                                    <label className="flex items-start gap-2 cursor-pointer mt-1">
                                        <input
                                            type="checkbox"
                                            checked={acknowledged}
                                            onChange={e => setAcknowledged(e.target.checked)}
                                            className="mt-0.5 accent-indigo-500"
                                        />
                                        <span className="text-xs text-amber-400">
                                            I acknowledge that emergency contacts are not configured. SOS will be unavailable for this ride.
                                        </span>
                                    </label>
                                )}

                                <button
                                    type="submit"
                                    disabled={!setupComplete && !acknowledged}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition"
                                >
                                    Book Ride
                                </button>
                            </form>

                            {bookingStatus === 'success' && (
                                <p className="mt-3 text-green-400 text-sm text-center">✅ Ride booked successfully!</p>
                            )}
                            {bookingStatus && bookingStatus !== 'warning' && bookingStatus !== 'success' && (
                                <p className="mt-3 text-red-400 text-sm text-center">❌ {bookingStatus}</p>
                            )}
                        </div>

                        {/* Contacts summary */}
                        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                            <h2 className="font-semibold text-slate-300 mb-3">Emergency Contacts</h2>
                            <div className="space-y-2">
                                <ContactPill label="Primary" contact={primaryContact} />
                                <ContactPill label="Secondary" contact={secondaryContact} />
                            </div>
                        </div>
                    </>
                )}

                {/* ── Contacts Tab ── */}
                {tab === 'contacts' && (
                    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                        <h2 className="font-bold text-lg mb-1">Emergency Contacts</h2>
                        <p className="text-slate-400 text-sm mb-4">
                            Add one primary and one secondary contact. SOS alerts will display both on your child's screen.
                        </p>

                        <div className="mb-4 space-y-2">
                            <ContactPill label="Primary" contact={primaryContact} />
                            <ContactPill label="Secondary" contact={secondaryContact} />
                        </div>

                        <form onSubmit={saveContact} className="space-y-3 border-t border-slate-700 pt-4">
                            <p className="text-sm font-semibold text-slate-300">Add / replace a contact</p>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setContactForm(f => ({ ...f, isPrimary: true }))}
                                    className={`flex-1 py-1.5 text-sm rounded-lg font-semibold transition ${contactForm.isPrimary ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                    Primary
                                </button>
                                <button type="button" onClick={() => setContactForm(f => ({ ...f, isPrimary: false }))}
                                    className={`flex-1 py-1.5 text-sm rounded-lg font-semibold transition ${!contactForm.isPrimary ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                    Secondary
                                </button>
                            </div>
                            <input placeholder="Full name" value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" required />
                            <input placeholder="Phone (E.164 e.g. +14165550100)" value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" required />
                            <input placeholder="Relationship (e.g. Spouse, Grandparent)" value={contactForm.relationship} onChange={e => setContactForm(f => ({ ...f, relationship: e.target.value }))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" required />
                            <input placeholder="Email (optional)" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition">
                                Save {contactForm.isPrimary ? 'Primary' : 'Secondary'} Contact
                            </button>
                            {contactStatus === 'saved' && <p className="text-green-400 text-sm text-center">✅ Contact saved</p>}
                            {contactStatus && contactStatus !== 'saved' && <p className="text-red-400 text-sm text-center">❌ {contactStatus}</p>}
                        </form>
                    </div>
                )}

                {/* ── Ride Requests Tab ── */}
                {tab === 'requests' && (
                    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                        <h2 className="font-bold text-lg mb-3">Pending Ride Requests</h2>
                        {rideRequests.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-6">No pending ride requests</p>
                        ) : (
                            <div className="space-y-3">
                                {rideRequests.map(r => (
                                    <div key={r.id} className="bg-slate-700 rounded-lg p-4">
                                        <p className="text-sm font-semibold">{r.requestedPickup} → {r.requestedDropoff}</p>
                                        <p className="text-xs text-slate-400 mt-1">{new Date(r.createdAt).toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function ContactPill({ label, contact }: { label: string; contact?: Contact }) {
    return (
        <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${contact ? 'bg-green-900/30 border border-green-700/40' : 'bg-slate-700/50 border border-slate-600'}`}>
            <div>
                <span className={`text-xs font-bold uppercase tracking-wider ${contact ? 'text-green-400' : 'text-slate-500'}`}>{label}</span>
                {contact ? (
                    <p className="text-sm text-white">{contact.name} · {contact.relationship} · {contact.phone}</p>
                ) : (
                    <p className="text-sm text-slate-500">Not set</p>
                )}
            </div>
            {contact && <span className="text-green-400 text-lg">✓</span>}
        </div>
    );
}
