// src/lib/maps.ts
// Secure server-side Maps API helpers using the hidden GOOGLE_MAPS_SERVER_KEY

interface Coordinates {
    lat: number;
    lng: number;
}

interface DirectionsResult {
    distanceMeters: number;
    durationSeconds: number;
    polyline: string;
}

/**
 * Calculates distance, duration, and route polyline securely on the server.
 * Requires GOOGLE_MAPS_SERVER_KEY in environment.
 */
export async function getDirections(origin: Coordinates, destination: Coordinates): Promise<DirectionsResult> {
    const serverKey = process.env.GOOGLE_MAPS_SERVER_KEY;
    
    if (!serverKey) {
        throw new Error("Missing GOOGLE_MAPS_SERVER_KEY for backend routing.");
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=driving&key=${serverKey}`;

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Directions API err: ${res.statusText}`);
    }

    const data = await res.json();
    
    if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
        throw new Error(`Directions API failed: ${data.status} - ${data.error_message || 'No routes found'}`);
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    return {
        distanceMeters: leg.distance.value,
        durationSeconds: leg.duration.value,
        polyline: route.overview_polyline.points
    };
}

/**
 * Simple Fare Calculation Logic (Server-Side)
 * Base fare: $5.00
 * Per Kilometer: $1.20
 * Per Minute: $0.30
 */
export function calculateFare(distanceMeters: number, durationSeconds: number): number {
    const baseFare = 5.00;
    const distanceKm = distanceMeters / 1000;
    const durationMinutes = durationSeconds / 60;

    const total = baseFare + (distanceKm * 1.20) + (durationMinutes * 0.30);
    
    // Minimum fare $8.00, round to 2 decimals
    return Math.max(8.00, Math.round(total * 100) / 100);
}
