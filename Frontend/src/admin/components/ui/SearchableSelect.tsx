import { useState, useMemo } from 'react';
import { Combobox } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid';

export interface Option {
  id: string;
  name: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SearchableSelect({ options, value, onChange, placeholder = 'Select...', disabled = false }: SearchableSelectProps) {
  const [query, setQuery] = useState('');

  const filteredOptions = useMemo(() => {
    return query === ''
      ? options
      : options.filter((option) =>
          option.name.toLowerCase().includes(query.toLowerCase())
        );
  }, [options, query]);

  const selectedOption = options.find(o => o.id === value) || null;

  return (
    <Combobox value={selectedOption} onChange={(opt: Option | null) => onChange(opt?.id || '')} disabled={disabled}>
      <div className="relative">
        <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-[var(--panel-bg)] shadow-[var(--neu-inner)] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--neu-bg)] sm:text-sm">
          <Combobox.Input
            className="w-full border-none py-2.5 pl-4 pr-10 text-sm leading-5 text-white focus:ring-0 bg-transparent outline-none placeholder:text-[var(--neu-text)]"
            displayValue={(option: Option) => option?.name || ''}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
          />
          <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon
              className="h-5 w-5 text-[var(--neu-text)] hover:text-white transition-colors"
              aria-hidden="true"
            />
          </Combobox.Button>
        </div>

        <Combobox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-[var(--panel-bg)] py-1 text-base shadow-[var(--neu-outer)] focus:outline-none sm:text-sm custom-scrollbar animate-in fade-in slide-in-from-top-2">
          <div className="sticky top-0 bg-[var(--panel-bg)] px-3 py-2 shadow-[var(--neu-outer-sm)] z-10 flex items-center gap-2 mb-1">
             <MagnifyingGlassIcon className="w-4 h-4 text-[var(--neu-text)]" />
             <input 
               type="text" 
               className="bg-transparent border-none outline-none text-sm text-white w-full"
               placeholder="Search..."
               value={query}
               onChange={(e) => setQuery(e.target.value)}
               onClick={(e) => e.stopPropagation()}
             />
          </div>
          {filteredOptions.length === 0 && query !== '' ? (
            <div className="relative cursor-default select-none px-4 py-2 text-[var(--neu-text)]">
              Nothing found.
            </div>
          ) : (
            filteredOptions.map((option) => (
              <Combobox.Option
                key={option.id}
                className={({ active }) =>
                  `relative cursor-pointer select-none py-2 pl-10 pr-4 transition-colors ${
                    active ? 'bg-nova-500 text-white' : 'text-gray-300 hover:text-white'
                  }`
                }
                value={option}
              >
                {({ selected, active }) => (
                  <>
                    <span className={`block truncate ${selected ? 'font-medium text-white' : 'font-normal'}`}>
                      {option.name}
                    </span>
                    {selected ? (
                      <span
                        className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                          active ? 'text-white' : 'text-nova-500'
                        }`}
                      >
                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    ) : null}
                  </>
                )}
              </Combobox.Option>
            ))
          )}
        </Combobox.Options>
      </div>
    </Combobox>
  );
}
