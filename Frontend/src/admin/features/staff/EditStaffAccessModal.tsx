import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchRoles } from './api/roles';
import { fetchStaffAccess, updateStaffRoles } from './api/staff';
import toast from 'react-hot-toast';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Modal } from '@/admin/components/ui/Modal';

interface EditStaffAccessModalProps {
 isOpen: boolean;
 onClose: () => void;
 staffId: string | null;
 staffName: string;
}
export function EditStaffAccessModal({ isOpen, onClose, staffId, staffName }: EditStaffAccessModalProps) {
 const qc = useQueryClient();
 const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

 // Fetch available roles
 const { data: rolesData } = useQuery({
 queryKey: ['roles'],
 queryFn: async () => (await fetchRoles()) || [],
 enabled: isOpen
 });

 // Fetch current staff permissions and roles
 const { data: currentAccess, isLoading: isLoadingAccess } = useQuery({
 queryKey: ['admin-permissions', staffId],
 queryFn: async () => fetchStaffAccess(staffId!),
 enabled: isOpen && !!staffId
 });

 useEffect(() => {
 if (currentAccess) {
 setSelectedRoleIds(currentAccess.roles?.map((r: any) => r.id) || []);
 }
 }, [currentAccess]);

 const updateRolesMutation = useMutation({
 mutationFn: async (roleIds: string[]) => updateStaffRoles(staffId!, roleIds)
 });

 const handleSave = async () => {
 const toastId = toast.loading('Updating access...');
 try {
 await updateRolesMutation.mutateAsync(selectedRoleIds);
 toast.success('Roles updated successfully', { id: toastId });
 qc.invalidateQueries({ queryKey: ['admin-staff'] });
 qc.invalidateQueries({ queryKey: ['admin-permissions', staffId] });
 onClose();
 } catch (err: any) {
 const errorData = err.response?.data?.error;
 const errorMsg = typeof errorData === 'object' ? errorData?.message : errorData;
 toast.error(err.response?.data?.message || errorMsg || 'Failed to update access', { id: toastId });
 }
 };

 const toggleRole = (roleId: string) => {
 setSelectedRoleIds(prev =>
 prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
 );
 };

 const roles = (Array.isArray(rolesData) ? rolesData : (rolesData?.roles || [])).filter((r: any) => r.name !== 'STORE_OWNER');

 const hasChanges = () => {
 if (!currentAccess) return false;
 const initialRoleIds = currentAccess.roles?.map((r: any) => r.id) || [];
 if (initialRoleIds.length !== selectedRoleIds.length) return true;
 return initialRoleIds.some((id: string) => !selectedRoleIds.includes(id));
 };

 const isSaveDisabled = isLoadingAccess || updateRolesMutation.isPending || !hasChanges();

 return (
 <Modal
 isOpen={isOpen}
 onClose={onClose}
 variant="panel"
 size="xl"
 wrapperClassName="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
 backdropClassName="bg-black/75 backdrop-blur-md"
 panelClassName="bg-zinc-950/90 border backdrop-blur-2xl"
 headerClassName="bg-white/[0.02]"
 footerClassName="bg-white/[0.02]"
 bodyClassName="space-y-6"
 titleClassName="text-xl font-bold text-white flex items-center gap-2.5"
 title={
 <>
 <ShieldCheckIcon className="w-6 h-6 text-nova-500" />
 Edit Access: {staffName}
 </>
 }
 description="Manage this administrator's assigned roles."
 footer={
 <>
 <button
 onClick={onClose}
 className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border rounded-xl transition-all"
 >
 Cancel
 </button>
 <button
 onClick={handleSave}
 disabled={isSaveDisabled}
 className="px-5 py-2 text-sm font-semibold text-white bg-nova-600 hover:bg-nova-500 rounded-xl transition-all duration-300 disabled:bg-white/10 disabled:text-white/30 shadow-lg shadow-nova-600/10 hover:shadow-nova-500/20 hover:-translate-y-0.5"
 >
 {updateRolesMutation.isPending ? 'Saving...' : 'Save Changes'}
 </button>
 </>
 }
 >
 {isLoadingAccess ? (
 <div className="flex justify-center items-center py-20 text-white/50">
 <div className="animate-pulse">Loading access details...</div>
 </div>
 ) : (
 <>
 {/* Roles Section */}
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Primary Roles</label>
 {!hasChanges() && (
 <span className="text-[10px] text-amber-400/80 uppercase tracking-wider font-semibold">
 Must select different roles to save
 </span>
 )}
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 {roles.map((role: any) => {
 const isSelected = selectedRoleIds.includes(role.id);
 const color = role.color_code || '#ffffff';
 return (
 <div 
 key={role.id}
 onClick={() => toggleRole(role.id)}
 className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 relative overflow-hidden group ${
 isSelected 
 ? 'bg-nova-500/10 border-nova-500 text-white shadow-[0_0_15px_rgba(14,165,233,0.1)]' 
 : 'bg-white/[0.02] text-white/70 hover: hover:bg-white/[0.04]'
 }`}
 style={{
 borderLeftWidth: isSelected ? '4px' : '1px',
 borderLeftColor: color
 }}
 >
 <div className="font-semibold text-sm group-hover:text-white transition-colors">{role.display_name}</div>
 <div className="text-xs text-white/40 mt-1 line-clamp-2">{role.description}</div>
 {isSelected && (
 <div className="absolute inset-0 bg-gradient-to-r from-nova-500/5 to-transparent pointer-events-none" />
 )}
 </div>
 );
 })}
 </div>
 </div>


 </>
 )}
 </Modal>
 );
}
