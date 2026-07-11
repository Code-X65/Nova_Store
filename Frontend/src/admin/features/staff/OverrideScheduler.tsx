import { useState, useEffect } from 'react';

interface OverrideSchedulerProps {
 value: string | null; // ISO timestamp or null = permanent
 onChange: (iso: string | null) => void;
}

function toLocalInput(iso: string | null): string {
 if (!iso) return '';
 const d = new Date(iso);
 const off = d.getTimezoneOffset();
 const local = new Date(d.getTime() - off * 60_000);
 return local.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
}

function fromLocalInput(local: string): string {
 return new Date(local).toISOString();
}

/**
 * Drives the TTL for a granular override: a permanent grant or a
 * time-bound (temporary) grant that auto-expires via the backend cron job.
 */
export function OverrideScheduler({ value, onChange }: OverrideSchedulerProps) {
 const [mode, setMode] = useState<'permanent' | 'temporary'>(value ? 'temporary' : 'permanent');
 const [local, setLocal] = useState(toLocalInput(value));

 useEffect(() => {
 setMode(value ? 'temporary' : 'permanent');
 setLocal(toLocalInput(value));
 }, [value]);

 return (
 <div className="space-y-2">
 <div className="flex gap-2">
 {(['permanent', 'temporary'] as const).map((m) => (
 <button
 key={m}
 type="button"
 onClick={() => {
 setMode(m);
 onChange(m === 'permanent' ? null : fromLocalInput(local || new Date(Date.now() + 60 * 60 * 1000).toISOString()));
 }}
 className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
 mode === m
 ? 'bg-nova-500/15 border-nova-500 text-white'
 : 'bg-white/[0.02] text-white/60 hover:'
 }`}
 >
 {m === 'permanent' ? 'Permanent' : 'Time-bound'}
 </button>
 ))}
 </div>

 {mode === 'temporary' && (
 <input
 type="datetime-local"
 value={local}
 onChange={(e) => {
 setLocal(e.target.value);
 onChange(e.target.value ? fromLocalInput(e.target.value) : null);
 }}
 className="w-full bg-white/[0.03] border rounded-lg px-3 py-2 text-white text-sm focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
 />
 )}
 </div>
 );
}
