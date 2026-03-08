'use client';

import { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

interface PlacesAutocompleteProps {
    onPlaceSelect: (place: google.maps.places.PlaceResult | null) => void;
    placeholder?: string;
    className?: string;
    defaultValue?: string;
}

export default function PlacesAutocomplete({
    onPlaceSelect,
    placeholder = 'Enter an address...',
    className = '',
    defaultValue = ''
}: PlacesAutocompleteProps) {
    const [inputValue, setInputValue] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);
    const placesLib = useMapsLibrary('places');

    useEffect(() => {
        if (!placesLib || !inputRef.current) return;

        const options = {
            fields: ['formatted_address', 'geometry', 'name'],
            // Optional: restrict to a specific country
            // componentRestrictions: { country: 'us' }
        };

        const autocomplete = new placesLib.Autocomplete(inputRef.current, options);

        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (place.formatted_address) {
                setInputValue(place.formatted_address);
            }
            onPlaceSelect(place);
        });

        // Prevent form submission on enter key inside the autocomplete dropdown
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        };
        inputRef.current.addEventListener('keydown', handleKeyDown);

        return () => {
            if (inputRef.current) {
                google.maps.event.clearInstanceListeners(inputRef.current);
                inputRef.current.removeEventListener('keydown', handleKeyDown);
            }
        };
    }, [placesLib, onPlaceSelect]);

    return (
        <input
            ref={inputRef}
            type="text"
            className={className}
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
        />
    );
}
