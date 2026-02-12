'use client';

import { useEffect, useState } from 'react';
import { Ride } from '@/lib/types';

export default function DriverRidesPage() {
    const [rides, setRides] = useState<Ride[]>([]);

    const fetchRides = async () => {
        const res = await fetch('/api/rides?status=REQUESTED');
        if (res.ok) {
            const data = await res.json();
            setRides(data.rides);
        }
    };

    useEffect(() => {
        fetchRides();
        const interval = setInterval(fetchRides, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    const acceptRide = async (id: string) => {
        const res = await fetch(`/api/rides/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ACCEPTED' })
        });
        if (res.ok) {
            alert('Ride Accepted!');
            fetchRides();
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 p-6 text-white">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl font-bold mb-6">Available Rides</h1>

                {rides.length === 0 ? (
                    <p className="text-slate-500 text-center mt-10">No ride requests nearby...</p>
                ) : (
                    <div className="space-y-4">
                        {rides.map(ride => (
                            <div key={ride.rideId} className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex justify-between items-center">
                                <div>
                                    <div className="flex items-center space-x-2 mb-2">
                                        <span className="bg-green-500 w-2 h-2 rounded-full"></span>
                                        <p className="font-semibold">{ride.pickupLocation}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="bg-red-500 w-2 h-2 rounded-full"></span>
                                        <p className="font-semibold">{ride.dropoffLocation}</p>
                                    </div>
                                    <p className="text-sm text-slate-400 mt-2">Fare estimate: ${ride.fare}</p>
                                </div>
                                <button
                                    onClick={() => acceptRide(ride.rideId)}
                                    className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg font-bold transition"
                                >
                                    Accept
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
