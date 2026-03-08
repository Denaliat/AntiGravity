'use client';

import { useState } from 'react';
import { Ride } from '@/lib/types';
import PlacesAutocomplete from '@/components/maps/PlacesAutocomplete';
import MapView from '@/components/maps/MapView';

interface Coords { lat: number; lng: number }

export default function RideBookingPage() {
    const [pickup, setPickup] = useState('');
    const [pickupCoords, setPickupCoords] = useState<Coords | undefined>();
    const [dropoff, setDropoff] = useState('');
    const [dropoffCoords, setDropoffCoords] = useState<Coords | undefined>();
    const [currentRide, setCurrentRide] = useState<Ride | null>(null);
    const [loading, setLoading] = useState(false);

    const handleBook = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/rides', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pickup,
                    pickupCoords,
                    dropoff,
                    dropoffCoords
                })
            });
            if (res.ok) {
                const data = await res.json();
                setCurrentRide(data.ride);
            } else {
                alert('Booking failed. Please try again.');
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
            <div className="max-w-2xl w-full bg-white rounded-xl shadow-xl p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Left Col: Form */}
                <div>
                    <h1 className="text-3xl font-bold text-indigo-900 mb-8">Request a Ride</h1>

                    {!currentRide ? (
                        <form onSubmit={handleBook} className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Pickup Location</label>
                                <PlacesAutocomplete
                                    placeholder="Enter pickup location"
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                    onPlaceSelect={(place) => {
                                        if (place?.formatted_address) setPickup(place.formatted_address);
                                        if (place?.geometry?.location) {
                                            setPickupCoords({
                                                lat: place.geometry.location.lat(),
                                                lng: place.geometry.location.lng()
                                            });
                                        }
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Destination</label>
                                <PlacesAutocomplete
                                    placeholder="Where to?"
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                    onPlaceSelect={(place) => {
                                        if (place?.formatted_address) setDropoff(place.formatted_address);
                                        if (place?.geometry?.location) {
                                            setDropoffCoords({
                                                lat: place.geometry.location.lat(),
                                                lng: place.geometry.location.lng()
                                            });
                                        }
                                    }}
                                />
                            </div>
                            <button
                                disabled={loading || !pickupCoords || !dropoffCoords}
                                className="w-full bg-indigo-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-indigo-700 transition transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
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
                            
                            {currentRide.estimatedFare && (
                                <p className="text-lg font-bold text-indigo-700">Estimated Fare: ${currentRide.estimatedFare}</p>
                            )}

                            <div className="p-4 bg-slate-50 rounded border">
                                <p className="text-lg font-semibold">{currentRide.status}</p>
                                <p className="text-sm text-slate-500 mt-2">Waiting for driver...</p>
                            </div>
                            <button
                                onClick={() => { 
                                    setCurrentRide(null); 
                                    setPickup(''); setDropoff(''); 
                                    setPickupCoords(undefined); setDropoffCoords(undefined); 
                                }}
                                className="text-indigo-600 hover:underline mt-4"
                            >
                                Book another ride
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Col: Map View */}
                <div className="bg-slate-100 rounded-xl overflow-hidden border border-slate-200 min-h-[400px]">
                    <MapView 
                        pickupCoords={pickupCoords} 
                        dropoffCoords={dropoffCoords} 
                        height="100%"
                    />
                </div>
            </div>
        </div>
    );
}
