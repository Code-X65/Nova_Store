import React, { useState, useEffect } from 'react';
import usePlacesAutocomplete, {
  getGeocode,
} from 'use-places-autocomplete';

// Utility to parse address components
export const parseAddressComponents = (addressComponents: google.maps.GeocoderAddressComponent[]) => {
  let country = '';
  let state = '';
  let city = '';
  let route = '';
  let streetNumber = '';

  addressComponents.forEach((component) => {
    const types = component.types;
    if (types.includes('country')) {
      country = component.long_name;
    }
    if (types.includes('administrative_area_level_1')) {
      state = component.long_name;
    }
    if (types.includes('locality') || types.includes('postal_town')) {
      city = component.long_name;
    }
    if (types.includes('route')) {
      route = component.long_name;
    }
    if (types.includes('street_number')) {
      streetNumber = component.long_name;
    }
  });

  const street_address = streetNumber ? `${streetNumber} ${route}` : route;

  return { country, state, city, street_address };
};

interface Props {
  value?: string;
  onChangeAddress: (data: { country: string; state: string; city: string; street_address: string; full_address: string }) => void;
  placeholder?: string;
  className?: string;
}

export default function GoogleAddressAutocomplete({ value, onChangeAddress, placeholder, className }: Props) {
  const {
    ready,
    value: inputValue,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      // You can scope this to a specific country if needed
      // componentRestrictions: { country: 'ng' }
    },
    debounce: 300,
  });

  const [isOpen, setIsOpen] = useState(false);

  // Sync external value with internal input value if it changes externally
  useEffect(() => {
    if (value && value !== inputValue) {
      setValue(value, false);
    }
  }, [value, setValue, inputValue]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setIsOpen(true);
  };

  const handleSelect = ({ description }: { description: string }) => {
    setValue(description, false);
    clearSuggestions();
    setIsOpen(false);

    // Get geocode to extract country, state, city, street
    getGeocode({ address: description })
      .then((results) => {
        if (results && results.length > 0) {
          const parsed = parseAddressComponents(results[0].address_components);
          onChangeAddress({
            ...parsed,
            full_address: description,
          });
        }
      })
      .catch((error) => {
        console.error('Error: ', error);
      });
  };

  return (
    <div className="relative w-full">
      <input
        value={inputValue}
        onChange={handleInput}
        disabled={!ready}
        placeholder={placeholder || "Start typing an address..."}
        className={className || "input text-sm py-2 px-3 rounded-lg w-full"}
      />
      
      {isOpen && status === 'OK' && (
        <ul className="absolute z-50 mt-1 w-full bg-[#1a1a1a] border border-[var(--panel-border)] rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {data.map(({ place_id, description }) => (
            <li
              key={place_id}
              onClick={() => handleSelect({ description })}
              className="px-3 py-2 text-sm text-[var(--neu-text)] hover:bg-[var(--primary)] hover:text-white cursor-pointer transition-colors"
            >
              {description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
