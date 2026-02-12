'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BookingPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        recipientName: '',
        recipientAddress: '',
        parcelDescription: ''
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                const data = await res.json();
                router.push(`/track/${data.delivery.deliveryId}`);
            } else {
                alert('Booking failed');
            }
        } catch (err) {
            console.error(err);
            alert('Error submitting booking');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 flex flex-col items-center">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6">
                <h1 className="text-2xl font-bold mb-6 text-slate-800">Book a Delivery</h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Recipient Name</label>
                        <input
                            type="text"
                            required
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.recipientName}
                            onChange={e => setFormData({ ...formData, recipientName: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Recipient Address</label>
                        <input
                            type="text"
                            required
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.recipientAddress}
                            onChange={e => setFormData({ ...formData, recipientAddress: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Parcel Description</label>
                        <textarea
                            required
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            rows={3}
                            value={formData.parcelDescription}
                            onChange={e => setFormData({ ...formData, parcelDescription: e.target.value })}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                    >
                        {loading ? 'Booking...' : 'Confirm Booking'}
                    </button>
                </form>
            </div>
        </div>
    );
}
