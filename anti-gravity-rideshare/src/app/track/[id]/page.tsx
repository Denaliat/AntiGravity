'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ParcelDelivery } from '@/lib/types';
import MapView from '@/components/maps/MapView';

export default function TrackingPage() {
    const { id } = useParams();

    const [delivery, setDelivery] = useState<ParcelDelivery | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        fetch(`/api/tracking/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('Delivery not found');
                return res.json();
            })
            .then(data => setDelivery(data.delivery))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="p-8 text-center">Loading tracking info...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
    if (!delivery) return null;

    // Get the latest coordinates from tracking events (driver location)
    const latestEvent = delivery.trackingEvents.length > 0 
        ? delivery.trackingEvents[delivery.trackingEvents.length - 1] 
        : null;

    return (
        <div className="min-h-screen bg-slate-50 p-4">
            <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Timeline */}
                <div className="lg:col-span-1 bg-white rounded-xl shadow-lg overflow-hidden flex flex-col">
                    <div className="bg-blue-600 p-6 text-white">
                        <h1 className="text-xl font-bold">Tracking: {delivery.parcelId}</h1>
                        <p className="mt-2 text-sm opacity-90">Status: <span className="font-mono font-bold bg-white/20 px-2 py-1 rounded">{delivery.status}</span></p>
                    </div>

                    <div className="p-6 flex-grow">
                        <h2 className="text-lg font-semibold mb-4 text-slate-800">Timeline</h2>
                        <div className="space-y-6 relative border-l-2 border-slate-200 ml-3 pl-6 pb-2">
                            {delivery.trackingEvents.map((event) => (
                                <div key={event.eventId} className="relative">
                                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white ring-2 ring-slate-100"></div>
                                    <div className="flex flex-col">
                                        <span className="text-sm text-slate-500">{new Date(event.timestamp).toLocaleString()}</span>
                                        <span className="font-medium text-slate-800">{event.status}</span>
                                        {event.notes && <span className="text-sm text-slate-600 mt-1">{event.notes}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Proof of Delivery Section */}
                        {delivery.proofOfDelivery && (
                            <div className="mt-8 border-t pt-6">
                                <h2 className="text-lg font-semibold mb-4 text-slate-800">Proof of Delivery</h2>
                                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                                    <p className="text-green-800 font-medium">Delivered to: {delivery.proofOfDelivery.recipientName}</p>
                                    <p className="text-sm text-green-700 mt-1">{new Date(delivery.proofOfDelivery.timestamp).toLocaleString()}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Live Map */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden min-h-[500px]">
                    <MapView 
                        driverCoords={latestEvent?.location ? { lat: latestEvent.location.latitude, lng: latestEvent.location.longitude } : undefined}
                        dropoffCoords={delivery.proofOfDelivery?.location ? { lat: delivery.proofOfDelivery.location.latitude, lng: delivery.proofOfDelivery.location.longitude } : undefined}
                        height="100%"
                    />
                </div>
            </div>
        </div>
    );
}
