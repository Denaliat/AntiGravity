'use client';

import { APIProvider } from '@vis.gl/react-google-maps';

export default function GoogleMapsProvider({ children }: { children: React.ReactNode }) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    
    // Debug log to verify the env var is loaded on the client side
    if (!apiKey) {
        console.error("Google Maps API key is missing! GoogleMapsProvider cannot load the API.");
    }

    return (
        <APIProvider apiKey={apiKey}>
            {children}
        </APIProvider>
    );
}
