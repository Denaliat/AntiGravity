'use client';

import { useState } from 'react';
import { Ride } from '@/lib/types';

export default function RideBookingPage() {
    const [formData, setFormData] = useState({ pickup: '', dropoff: '' });
    const [currentRide, setCurrentRide] = useState<Ride | null>(null);
    const [loading, setLoading] = useState(false);

    const handleBook = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/rides', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                const data = await res.json();
                setCurrentRide(data.ride);
            }
        } catch (e) {
            console.error(e);
            alert('Booking failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-indigo-50 p-6 flex flex-col items-center justify-center">
            <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8">
                <h1 className="text-3xl font-bold text-indigo-900 mb-8 text-center">Request a Ride</h1>

                {!currentRide ? (
                    <form onSubmit={handleBook} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Pickup Location</label>
                            <input
                                required
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                placeholder="Current Location"
                                value={formData.pickup}
                                onChange={e => setFormData({ ...formData, pickup: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Destination</label>
                            <input
                                required
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                placeholder="Where to?"
                                value={formData.dropoff}
                                onChange={e => setFormData({ ...formData, dropoff: e.target.value })}
                            />
                        </div>
                        <button
                            disabled={loading}
                            className="w-full bg-indigo-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-indigo-700 transition transform hover:scale-[1.02] disabled:opacity-50"
                        >
                            {loading ? 'Requesting...' : 'Find Driver'}
                        </button>
                    </form>
                ) : (
                    <div className="text-center space-y-4">
                        <div className="bg-green-100 text-green-800 p-4 rounded-lg font-bold">
                            Ride Requested!
                        </div>
                        <p className="text-slate-600">ID: <span className="font-mono">{currentRide.rideId}</span></p>
                        <div className="p-4 bg-slate-50 rounded border">
                            <p className="text-lg font-semibold">{currentRide.status}</p>
                            <p className="text-sm text-slate-500 mt-2">Waiting for driver...</p>
                        </div>
                        <button
                            onClick={() => { setCurrentRide(null); setFormData({ pickup: '', dropoff: '' }); }}
                            className="text-indigo-600 hover:underline mt-4"
                        >
                            Book another ride
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
