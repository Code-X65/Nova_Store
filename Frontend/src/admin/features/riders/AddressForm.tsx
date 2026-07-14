import { useState, useEffect, useRef } from 'react';

const COUNTRY_LIST = [
  'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Uganda',
  'Tanzania', 'Rwanda', 'Ethiopia', 'Egypt', 'Morocco',
  'Ivory Coast', 'Cameroon', 'Senegal', 'Zambia', 'Zimbabwe'
];

const STATE_MAP: Record<string, string[]> = {
  'Nigeria': ['Lagos', 'Kano', 'Rivers', 'Oyo', 'Enugu', 'Delta', 'Kaduna', 'Ogun'],
  'Ghana': ['Greater Accra', 'Ashanti', 'Western', 'Eastern', 'Central', 'Northern'],
  'Kenya': ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Nyeri'],
  'South Africa': ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State']
};

const CITY_MAP: Record<string, Record<string, string[]>> = {
  'Nigeria': {
    'Lagos': ['Ikeja', 'Surulere', 'Lagos Island', 'Victoria Island', ' Lekki'],
    'Kano': ['Kano Municipal', 'Nassarawa', 'Fagge'],
    'Rivers': ['Port Harcourt', 'Obio-Akpor', 'Eleme']
  },
  'Ghana': {
    'Greater Accra': ['Accra', 'Tema', 'Madina', 'Adenta'],
    'Ashanti': ['Kumasi', 'Obuasi', 'Mampong']
  },
  'Kenya': {
    'Nairobi': ['Westlands', 'Karen', 'Embakassi', 'Kasarani'],
    'Mombasa': ['Mvita', 'Kisauni', 'Nyali']
  },
  'South Africa': {
    'Gauteng': ['Johannesburg', 'Pretoria', 'Sandton', 'Midrand'],
    'Western Cape': ['Cape Town', 'Stellenbosch', 'Paarl']
  }
};

interface AddressFormData {
  country?: string;
  state?: string;
  city?: string;
  street_address?: string;
}

interface Props {
  value: AddressFormData;
  onChange: (value: AddressFormData) => void;
}

export default function AddressForm({ value, onChange }: Props) {
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  const set = (key: keyof AddressFormData, val: string) => {
    onChange({ ...value, [key]: val });
  };

  const states = STATE_MAP[value.country || ''] || [];
  const cities = (value.country && value.state && CITY_MAP[value.country])?.[value.state] || [];

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">Country *</label>
        <select
          value={value.country || ''}
          onChange={(e) => {
            set('country', e.target.value);
            set('state', '');
            set('city', '');
          }}
          className="input text-sm py-2 px-3 rounded-lg w-full bg-transparent"
        >
          <option value="">Select country</option>
          {COUNTRY_LIST.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">State / Province</label>
        <select
          value={value.state || ''}
          onChange={(e) => {
            set('state', e.target.value);
            set('city', '');
          }}
          disabled={!value.country || states.length === 0}
          className="input text-sm py-2 px-3 rounded-lg w-full bg-transparent"
        >
          <option value="">Select state</option>
          {states.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {value.country && states.length === 0 && !loadingStates && (
          <p className="text-[10px] text-[var(--neu-text)]">No predefined states for this country. Enter city manually below.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">City</label>
        <select
          value={value.city || ''}
          onChange={(e) => set('city', e.target.value)}
          disabled={!value.state || cities.length === 0}
          className="input text-sm py-2 px-3 rounded-lg w-full bg-transparent"
        >
          <option value="">Select city</option>
          {cities.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {value.state && cities.length === 0 && !loadingCities && (
          <p className="text-[10px] text-[var(--neu-text)]">No predefined city list. You can type directly in the street field below.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">Street Address / Block *</label>
        <input
          type="text"
          value={value.street_address || ''}
          onChange={(e) => set('street_address', e.target.value)}
          className="input text-sm py-2 px-3 rounded-lg w-full"
          placeholder="e.g. 15 Bode Thomas St, Lekki Phase 1"
        />
      </div>

      <p className="text-[10px] text-[var(--neu-text)]">
        Calibrated for Nigerian addresses. Other countries use searchable dropdowns for state and city where available.
      </p>
    </div>
  );
}
