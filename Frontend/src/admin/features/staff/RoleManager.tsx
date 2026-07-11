import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';

export default function RoleManager() {
 const qc = useQueryClient();
 const [editingId, setEditingId] = useState<string | null>(null);
 const [name, setName] = useState('');
 const [displayName, setDisplayName] = useState('');
 const [description, setDescription] = useState('');
 const [colorCode, setColorCode] = useState('#ffffff');

 const { data: rolesData, isLoading } = useQuery({
 queryKey: ['roles'],
 queryFn: async () => {
 const { data } = await api.get('/roles');
 return data.data; // array
 }
 });

 const saveMutation = useMutation({
 mutationFn: async () => {
 const payload = { name: name.toUpperCase(), display_name: displayName, description, color_code: colorCode };
 if (editingId) {
 return api.patch(`/roles/${editingId}`, payload);
 } else {
 return api.post('/roles', payload);
 }
 },
 onSuccess: () => {
 toast.success(editingId ? 'Role updated' : 'Role created');
 qc.invalidateQueries({ queryKey: ['roles'] });
 resetForm();
 },
 onError: () => toast.error('Failed to save role')
 });

 const deleteMutation = useMutation({
 mutationFn: async (id: string) => {
 return api.delete(`/roles/${id}`);
 },
 onSuccess: () => {
 toast.success('Role deleted');
 qc.invalidateQueries({ queryKey: ['roles'] });
 },
 onError: () => toast.error('Failed to delete role')
 });

 const resetForm = () => {
 setEditingId(null);
 setName('');
 setDisplayName('');
 setDescription('');
 setColorCode('#ffffff');
 };

 const handleEdit = (role: any) => {
 if (role.is_system) {
 toast.error('System roles cannot be edited');
 return;
 }
 setEditingId(role.id);
 setName(role.name);
 setDisplayName(role.display_name);
 setDescription(role.description || '');
 setColorCode(role.color_code || '#ffffff');
 };

 const roles = (Array.isArray(rolesData) ? rolesData : (rolesData?.roles || [])).filter((r: any) => r.name !== 'STORE_OWNER');

 return (
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
 {/* Roles List */}
 <div className="lg:col-span-7 space-y-6">
 <div>
 <h1 className="text-2xl font-bold text-white">Role Manager</h1>
 <p className="text-sm text-muted-foreground mt-1">Define roles and permission structures to manage staff access.</p>
 </div>

 <div className="glass-card p-6 rounded-2xl border bg-white/[0.03] backdrop-blur-xl shadow-2xl space-y-4">
 {isLoading ? (
 <div className="py-20 text-center text-white/50">
 <div className="animate-pulse">Loading roles...</div>
 </div>
 ) : (
 <div className="space-y-4">
 {roles.map((role: any) => {
 const color = role.color_code || '#ffffff';
 return (
 <div 
 key={role.id} 
 className="p-5 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl border hover: flex items-start justify-between transition-all duration-300 group hover:shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
 >
 <div className="flex items-start gap-4">
 <div 
 className="w-3.5 h-3.5 rounded-full mt-1.5 flex-shrink-0" 
 style={{ 
 backgroundColor: color,
 boxShadow: `0 0 10px ${color}`
 }} 
 />
 <div>
 <h3 className="font-semibold text-white flex items-center gap-2 group-hover:text-nova-400 transition-colors">
 {role.display_name}
 {role.is_system && (
 <span className="text-[9px] uppercase bg-white/10 px-2 py-0.5 rounded-full text-white/60 tracking-wider">
 System
 </span>
 )}
 </h3>
 <p className="text-xs text-white/50 mt-1.5 leading-relaxed">{role.description}</p>
 </div>
 </div>
 <div className="flex items-center gap-2 ml-4 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
 {!role.is_system && (
 <>
 <button 
 onClick={() => handleEdit(role)} 
 className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-lg text-xs font-semibold border transition-all"
 >
 Edit
 </button>
 <button 
 onClick={() => { if(confirm('Delete this role?')) deleteMutation.mutate(role.id); }} 
 className="px-3 py-1.5 bg-danger/10 hover:bg-danger/20 text-danger rounded-lg text-xs font-semibold transition-all border border-danger/10"
 >
 Delete
 </button>
 </>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>

 {/* Form Panel */}
 <div className="lg:col-span-5 space-y-6">
 <div className="glass-card p-6 rounded-2xl border bg-white/[0.03] backdrop-blur-xl shadow-2xl sticky top-24">
 <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
 <span className="w-2.5 h-2.5 rounded-full bg-nova-500 animate-pulse" />
 {editingId ? 'Edit Role' : 'Create Custom Role'}
 </h2>
 
 <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-5">
 <div className="space-y-2">
 <label className="text-sm font-medium text-white/90">Internal Name</label>
 <input
 type="text"
 required
 value={name}
 onChange={(e) => setName(e.target.value.replace(/\s+/g, '_').toUpperCase())}
 className="w-full bg-white/[0.05] border rounded-xl px-4 py-3 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500 transition-all placeholder:text-white/20"
 placeholder="e.g. MARKETING_LEAD"
 />
 <p className="text-[10px] text-white/35">Will be automatically formatted to UPPERCASE_NO_SPACES.</p>
 </div>
 
 <div className="space-y-2">
 <label className="text-sm font-medium text-white/90">Display Name</label>
 <input
 type="text"
 required
 value={displayName}
 onChange={(e) => setDisplayName(e.target.value)}
 className="w-full bg-white/[0.05] border rounded-xl px-4 py-3 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500 transition-all placeholder:text-white/20"
 placeholder="e.g. Marketing Lead"
 />
 </div>

 <div className="space-y-2">
 <label className="text-sm font-medium text-white/90">Description</label>
 <textarea
 rows={3}
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 className="w-full bg-white/[0.05] border rounded-xl px-4 py-3 text-white focus:border-nova-500 focus:ring-1 focus:ring-nova-500 transition-all"
 placeholder="Describe role responsibilities..."
 />
 </div>

 <div className="space-y-2">
 <label className="text-sm font-medium text-white/90 flex items-center justify-between">
 <span>Color Indicator</span>
 <span className="text-xs text-white/40 font-mono">{colorCode}</span>
 </label>
 <div className="flex gap-3">
 <input
 type="color"
 value={/^#[0-9A-Fa-f]{6}$/.test(colorCode || '') ? colorCode : '#000000'}
 onChange={(e) => setColorCode(e.target.value)}
 className="w-14 h-12 bg-white/[0.05] border rounded-xl p-1.5 cursor-pointer flex-shrink-0"
 />
 <div className="flex-1 bg-white/[0.02] border rounded-xl px-4 flex items-center text-xs text-white/40">
 Used for badges and dots in dashboard panels.
 </div>
 </div>
 </div>

 <div className="pt-3 flex gap-3">
 {editingId && (
 <button 
 type="button" 
 onClick={resetForm} 
 className="flex-1 py-3 px-4 text-sm font-semibold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border rounded-xl transition-all"
 >
 Cancel
 </button>
 )}
 <button 
 type="submit" 
 disabled={saveMutation.isPending || !name || !displayName} 
 className="flex-1 py-3 px-4 bg-nova-600 hover:bg-nova-500 disabled:bg-white/10 disabled:text-white/30 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-nova-600/20 hover:shadow-nova-500/30 flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 disabled:transform-none"
 >
 {saveMutation.isPending ? 'Saving...' : editingId ? 'Update Role' : 'Create Role'}
 </button>
 </div>
 </form>
 </div>
 </div>
 </div>
 );
}