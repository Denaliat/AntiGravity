'use client';

import { useEffect, useState } from 'react';
import { Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

interface Coordinates {
    lat: number;
    lng: number;
}

interface MapViewProps {
    pickupCoords?: Coordinates;
    dropoffCoords?: Coordinates;
    driverCoords?: Coordinates; // For live tracking
    height?: string;
}

export default function MapView({ pickupCoords, dropoffCoords, driverCoords, height = '300px' }: MapViewProps) {
    const [mapInitialized, setMapInitialized] = useState(false);

    // Default center to a major city (e.g., Toronto) if no coords
    const defaultCenter = pickupCoords || dropoffCoords || driverCoords || { lat: 43.65107, lng: -79.347015 };

    return (
        <div style={{ height, width: '100%', borderRadius: '0.75rem', overflow: 'hidden' }}>
            <Map
                defaultZoom={pickupCoords || dropoffCoords ? 13 : 11}
                defaultCenter={defaultCenter}
                mapId="ANTI_GRAVITY_MAP_ID" // Must use a mapId for AdvancedMarkers
                disableDefaultUI={true}
                gestureHandling="cooperative"
                onIdle={() => setMapInitialized(true)}
            >
                {pickupCoords && (
                    <AdvancedMarker position={pickupCoords}>
                        <div className="w-5 h-5 bg-green-500 rounded-full border-2 border-white shadow-md z-10" />
                    </AdvancedMarker>
                )}

                {dropoffCoords && (
                    <AdvancedMarker position={dropoffCoords}>
                        <div className="w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow-md z-10" />
                    </AdvancedMarker>
                )}

                {driverCoords && (
                    <AdvancedMarker position={driverCoords}>
                        <div className="w-6 h-6 bg-slate-800 rounded-full border-2 border-white shadow-lg flex items-center justify-center z-20">
                            <i className="fas fa-car text-white text-xs"></i>
                        </div>
                    </AdvancedMarker>
                )}

                {/* Draw Route Polyline only when map is ready and we have both coords */}
                {pickupCoords && dropoffCoords && mapInitialized && (
                    <DirectionsRenderer pickup={pickupCoords} dropoff={dropoffCoords} />
                )}
            </Map>
        </div>
    );
}

// Helper component to render the polyline using the Directions API
function DirectionsRenderer({ pickup, dropoff }: { pickup: Coordinates; dropoff: Coordinates }) {
    const map = useMap();
    const routesLibrary = useMapsLibrary('routes');
    const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);

    useEffect(() => {
        if (!routesLibrary || !map) return;

        // Initialize DirectionsRenderer only once
        if (!directionsRenderer) {
            const renderer = new routesLibrary.DirectionsRenderer({
                map,
                suppressMarkers: true, // We draw our own AdvancedMarkers above
                polylineOptions: {
                    strokeColor: '#4f46e5', // Indigo-600
                    strokeWeight: 4,
                    strokeOpacity: 0.8
                }
            });
            setDirectionsRenderer(renderer);
            return;
        }

        const directionsService = new routesLibrary.DirectionsService();

        directionsService.route(
            {
                origin: pickup,
                destination: dropoff,
                travelMode: google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
                if (status === google.maps.DirectionsStatus.OK && result) {
                    directionsRenderer.setDirections(result);
                } else {
                    console.error(`error fetching directions ${result}`);
                }
            }
        );

        return () => {
            if (directionsRenderer) {
                directionsRenderer.setMap(null);
            }
        };
    }, [routesLibrary, map, pickup, dropoff, directionsRenderer]);

    return null;
}
