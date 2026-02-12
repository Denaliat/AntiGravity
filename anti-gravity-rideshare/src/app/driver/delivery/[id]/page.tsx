'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function DriverDeliveryPage() {
    const { id } = useParams();
    const router = useRouter();


    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);

    // Mock Proof Submission
    const handleCompleteDelivery = async () => {
        setLoading(true);
        try {
            // Create a dummy base64 image string simulating a signature
            const mockSignature = "data:image/png;base64,simulated_encrypted_signature_content_123456789";

            const res = await fetch(`/api/delivery/${id}/proof`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    signatureBase64: mockSignature,
                    location: { latitude: 40.7128, longitude: -74.0060 }
                })
            });

            if (res.ok) {
                setStatus('Delivered Successfully!');
                setTimeout(() => router.push(`/track/${id}`), 1000);
            } else {
                setStatus('Failed to submit proof');
            }
        } catch (e) {
            console.error(e);
            setStatus('Error submitting proof');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 p-4 text-white">
            <div className="max-w-md mx-auto">
                <h1 className="text-2xl font-bold mb-6">Driver Actions</h1>
                <p className="mb-4 text-gray-400">Delivery ID: {id}</p>

                <div className="space-y-4">
                    <button className="w-full bg-slate-700 p-4 rounded-lg text-left hover:bg-slate-600">
                        Mark as Picked Up
                    </button>
                    <button className="w-full bg-slate-700 p-4 rounded-lg text-left hover:bg-slate-600">
                        Mark as Out for Delivery
                    </button>

                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 mt-8">
                        <h2 className="font-semibold mb-2">Proof of Delivery</h2>
                        <div className="h-32 bg-white rounded mb-4 flex items-center justify-center text-slate-400">
                            [Signature Pad Placeholder]
                        </div>
                        <button
                            onClick={handleCompleteDelivery}
                            disabled={loading}
                            className="w-full bg-green-600 py-3 rounded font-bold hover:bg-green-500 disabled:opacity-50"
                        >
                            {loading ? 'Submitting & Encrypting...' : 'Confirm Delivery'}
                        </button>
                        {status && <p className="mt-2 text-center text-sm">{status}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
