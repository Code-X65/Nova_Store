import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { CircleStackIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';

export default function MigrationsPage() {
 const { data: response, isLoading } = useQuery({
 queryKey: ['admin-migrations'],
 queryFn: async () => {
 const { data } = await api.get('/admin/migrations/status');
 return data.data; // { applied_migrations: [], pending_migrations: [] }
 }
 });

 const applied = response?.applied_migrations || [];
 // const pending = response?.pending_migrations || [];

 return (
 <div className="max-w-4xl space-y-6">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-nova-500/20 rounded-lg">
 <CircleStackIcon className="w-6 h-6 text-nova-400" />
 </div>
 <div>
 <h1 className="text-2xl font-bold text-white">Database Migrations</h1>
 <p className="text-sm text-muted-foreground mt-1">Audit log of all schema changes applied to the database.</p>
 </div>
 </div>

 <div className="glass-card p-4 rounded-xl border space-y-4">
 {isLoading ? (
 <p className="p-4 text-muted-foreground">Loading migration status...</p>
 ) : (
 <div className="space-y-2">
 <div className="flex items-center justify-between px-4 py-2 bg-surface border-b">
 <span className="font-semibold text-white">Migration Name</span>
 <span className="font-semibold text-white">Applied At</span>
 </div>
 {applied.map((migration: any) => (
 <div key={migration.id} className="flex items-center justify-between px-4 py-2 hover:bg-white/5 rounded">
 <span className="text-sm text-gray-300 font-mono">{migration.name}</span>
 <span className="text-xs text-muted-foreground">
 {format(new Date(migration.executed_at), 'yyyy-MM-dd HH:mm:ss')}
 </span>
 </div>
 ))}
 {applied.length === 0 && (
 <p className="p-4 text-muted-foreground text-center">No migrations recorded in history table.</p>
 )}
 </div>
 )}
 </div>
 </div>
 );
}