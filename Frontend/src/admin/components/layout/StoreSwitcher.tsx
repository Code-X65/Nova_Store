import { BuildingStorefrontIcon } from '@heroicons/react/24/outline';

const STORE_NAME = 'Nova Store';

export function StoreSwitcher() {
  return (
    <div className="flex items-center gap-2 bg-[var(--neu-bg)] border border-[var(--panel-border)] px-3 py-1.5 rounded-lg">
      <BuildingStorefrontIcon className="w-4 h-4 text-[var(--neu-text)]" />
      <span className="text-xs font-bold text-[var(--neu-text)] tracking-wider">
        STORE: <span className="text-white ml-1">{STORE_NAME}</span>
      </span>
    </div>
  );
}
