import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { createRider, updateRider, approveRider, listGuarantors, createGuarantor, deleteGuarantor, fetchRider } from './api/riders';
import { hasPermission } from '@/admin/lib/permissions';
import { useMyPermissions } from '@/admin/hooks/useMyPermissions';
import { api } from '@/admin/lib/api';
import { useLoadScript } from '@react-google-maps/api';
import GoogleAddressAutocomplete from '@/admin/components/ui/GoogleAddressAutocomplete';
import type { Rider } from './api/riders';

const LIBRARIES: ("places")[] = ["places"];

type FormMode = { type: 'create' } | { type: 'edit'; rider: Rider };

interface RiderFormProps {
  mode: FormMode;
  onClose: () => void;
}

interface FormState {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  phone_secondary: string;
  vehicle_type: string;
  vehicle_registration: string;
  id_type: string;
  id_number: string;
  is_active: boolean;
  photo_frontal: string;
  photo_left_profile: string;
  photo_right_profile: string;
  id_doc_url: string;
  vehicle_doc_url: string;
  country: string;
  state: string;
  city: string;
  street_address: string;
}

const empty: FormState = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  phone_secondary: '',
  vehicle_type: 'none',
  vehicle_registration: '',
  id_type: 'none',
  id_number: '',
  is_active: true,
  photo_frontal: '',
  photo_left_profile: '',
  photo_right_profile: '',
  id_doc_url: '',
  vehicle_doc_url: '',
  country: '',
  state: '',
  city: '',
  street_address: '',
};

const TABS = [
  { key: 'profile', label: 'Profile' },
  { key: 'photos', label: 'Photos' },
  { key: 'address', label: 'Address' },
  { key: 'documents', label: 'Documents' },
  { key: 'guarantors', label: 'Guarantors' }
] as const;

type TabKey = typeof TABS[number]['key'];

export default function RiderForm({ mode, onClose }: RiderFormProps) {
  const qc = useQueryClient();
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: LIBRARIES,
  });
  const perms = useMyPermissions();
  const canApprove = hasPermission(perms, 'rider:approve');
  const isEditing = mode.type === 'edit';
  const editId = isEditing ? mode.rider.id : undefined;
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [guarantorDraft, setGuarantorDraft] = useState({
    full_name: '',
    relationship: '',
    phone: '',
    address: '',
    id_type: '',
    id_number: ''
  });

  const [form, setForm] = useState<FormState>(empty);
  const set = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
  }, []);

  const { data: riderData, refetch: refetchRider } = useQuery({
    queryKey: ['rider', mode.rider?.id],
    queryFn: () => fetchRider(mode.rider!.id),
    enabled: isEditing && !!mode.rider?.id,
    staleTime: 0
  });

  const currentRider = riderData?.data || mode.rider;

  useEffect(() => {
    if (mode.type === 'edit' && currentRider) {
      setForm({
        first_name: currentRider.first_name,
        last_name: currentRider.last_name,
        phone: currentRider.phone,
        email: currentRider.email || '',
        phone_secondary: currentRider.phone_secondary || '',
        vehicle_type: currentRider.vehicle_type || 'none',
        vehicle_registration: currentRider.vehicle_registration || '',
        id_type: currentRider.id_type || 'none',
        id_number: currentRider.id_number || '',
        is_active: currentRider.is_active,
        photo_frontal: currentRider.photo_frontal || '',
        photo_left_profile: currentRider.photo_left_profile || '',
        photo_right_profile: currentRider.photo_right_profile || '',
        id_doc_url: currentRider.id_doc_url || '',
        vehicle_doc_url: currentRider.vehicle_doc_url || '',
        country: currentRider.country || '',
        state: currentRider.state || '',
        city: currentRider.city || '',
        street_address: currentRider.street_address || ''
      });
    } else {
      setForm(empty);
    }
  }, [mode, currentRider]);

  const { data: guarantorsData } = useQuery({
    queryKey: ['guarantors', currentRider?.id],
    queryFn: () => listGuarantors(currentRider!.id),
    enabled: isEditing && !!currentRider?.id && activeTab === 'guarantors'
  });

  const addGuarantorMutation = useMutation({
    mutationFn: () => {
      const payload: any = { ...guarantorDraft };
      if (!payload.id_type) delete payload.id_type;
      return createGuarantor(currentRider!.id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guarantors', currentRider?.id] });
      qc.invalidateQueries({ queryKey: ['rider', currentRider?.id] });
      toast.success('Guarantor added');
      setGuarantorDraft({ full_name: '', relationship: '', phone: '', address: '', id_type: '', id_number: '' });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to add guarantor'),
  });

  const removeGuarantorMutation = useMutation({
    mutationFn: (guarantorId: string) => deleteGuarantor(currentRider!.id, guarantorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guarantors', currentRider?.id] });
      toast.success('Guarantor removed');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to remove guarantor'),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-riders'] });
    qc.invalidateQueries({ queryKey: ['admin-riders-active'] });
    qc.invalidateQueries({ queryKey: ['pending-riders'] });
    if (currentRider?.id) {
      qc.invalidateQueries({ queryKey: ['rider', currentRider.id] });
      qc.invalidateQueries({ queryKey: ['guarantors', currentRider.id] });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        phone_secondary: form.phone_secondary.trim() || undefined,
        id_type: form.id_type,
        id_number: form.id_number.trim() || undefined,
        vehicle_type: form.vehicle_type,
        vehicle_registration: form.vehicle_registration.trim() || undefined,
        is_active: form.is_active,
        photo_frontal: form.photo_frontal || undefined,
        photo_left_profile: form.photo_left_profile || undefined,
        photo_right_profile: form.photo_right_profile || undefined,
        id_doc_url: form.id_doc_url || undefined,
        vehicle_doc_url: form.vehicle_doc_url || undefined,
        country: form.country || undefined,
        state: form.state || undefined,
        city: form.city || undefined,
        street_address: form.street_address || undefined,
        address_jsonb: {
          country: form.country || 'Nigeria',
          state: form.state,
          city: form.city,
          street_address: form.street_address
        }
      };
      if (isEditing && editId) {
        return updateRider(editId, payload);
      }
      return createRider(payload);
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['admin-riders'] });
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Rider updated successfully' : 'Rider enrolled successfully. Awaiting approval.');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to save rider');
    },
    onSettled: () => {
      invalidate();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim()) {
      toast.error('First name, last name, and phone are required');
      return;
    }
    if (!isEditing && (!form.photo_frontal || !form.photo_left_profile || !form.photo_right_profile)) {
      toast.error('All three biometric photos are required');
      setActiveTab('photos');
      return;
    }
    if (!isEditing && !form.country || !form.city || !form.street_address) {
      toast.error('Country, city, and street address are required');
      setActiveTab('address');
      return;
    }
    saveMutation.mutate();
  };

  const handleApprove = async () => {
    if (!editId) return;
    await approveRider(editId);
    invalidate();
    refetchRider();
    toast.success('Rider approved and now live');
  };

  const title = isEditing ? 'Edit Rider' : 'Enroll New Rider';
  const currentIndex = TABS.findIndex(t => t.key === activeTab);
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < TABS.length - 1;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg h-full bg-[var(--panel-bg)] border-l border-[var(--panel-border)] flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--panel-border)]">
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            {isEditing && currentRider && (
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-[var(--neu-text)] font-mono">
                  {currentRider.first_name} {currentRider.last_name}
                </p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                  currentRider.status === 'live'
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : currentRider.status === 'suspended'
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {(currentRider.status || 'pending_approval').replace('_', ' ').toUpperCase()}
                </span>
                {canApprove && currentRider.status === 'pending_approval' && (
                  <button onClick={handleApprove} className="text-[10px] px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20">
                    Approve
                  </button>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-[var(--neu-text)] hover:text-white transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-6 py-3 border-b border-[var(--panel-border)] overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-[var(--neu-accent)]/10 text-[var(--neu-accent)]'
                  : 'text-[var(--neu-text)] hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} id="rider-form" className="flex-1 overflow-auto p-6 space-y-5">
          {activeTab === 'profile' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">First Name *</label>
                  <input type="text" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} className="input text-sm py-2 px-3 rounded-lg w-full" placeholder="John" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">Last Name *</label>
                  <input type="text" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} className="input text-sm py-2 px-3 rounded-lg w-full" placeholder="Doe" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">Phone Number *</label>
                <input type="tel" required value={form.phone} onChange={(e) => set('phone', e.target.value)} className="input text-sm py-2 px-3 rounded-lg w-full" placeholder="+234 801 234 5678" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">Email</label>
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="input text-sm py-2 px-3 rounded-lg w-full" placeholder="john@example.com" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">Secondary Phone</label>
                <input type="tel" value={form.phone_secondary} onChange={(e) => set('phone_secondary', e.target.value)} className="input text-sm py-2 px-3 rounded-lg w-full" placeholder="+234 801 234 5678" />
              </div>
            </>
          )}

          {activeTab === 'photos' && (
            <div className="space-y-5">
              {isEditing && currentRider && (
                <p className="text-xs text-[var(--neu-text)]">Photos are optional to update for existing riders.</p>
              )}
              <PhotoZone label="Frontal View" value={form.photo_frontal} onChange={(url) => set('photo_frontal', url)} required={!isEditing} view="frontal" />
              <PhotoZone label="Left Profile" value={form.photo_left_profile} onChange={(url) => set('photo_left_profile', url)} required={!isEditing} view="left" />
              <PhotoZone label="Right Profile" value={form.photo_right_profile} onChange={(url) => set('photo_right_profile', url)} required={!isEditing} view="right" />
            </div>
          )}

          {activeTab === 'address' && (
            <AddressSection form={form} set={set} isLoaded={isLoaded} />
          )}

          {activeTab === 'documents' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">ID Type</label>
                  <select value={form.id_type} onChange={(e) => set('id_type', e.target.value)} className="input text-sm py-2 px-3 rounded-lg w-full bg-transparent">
                    <option value="none">None</option>
                    <option value="national_id">National ID</option>
                    <option value="drivers_license">Driver's License</option>
                    <option value="passport">Passport</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">ID Number</label>
                  <input type="text" value={form.id_number} onChange={(e) => set('id_number', e.target.value)} className="input text-sm py-2 px-3 rounded-lg w-full" placeholder="ID-123456" />
                </div>
              </div>
              <DocUploadZone label="ID Document (optional)" value={form.id_doc_url} onChange={(url) => set('id_doc_url', url)} />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">Vehicle Type</label>
                  <select value={form.vehicle_type} onChange={(e) => set('vehicle_type', e.target.value)} className="input text-sm py-2 px-3 rounded-lg w-full bg-transparent">
                    <option value="none">None</option>
                    <option value="motorcycle">Motorcycle</option>
                    <option value="bicycle">Bicycle</option>
                    <option value="car">Car</option>
                    <option value="van">Van</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">Vehicle Registration</label>
                  <input type="text" value={form.vehicle_registration} onChange={(e) => set('vehicle_registration', e.target.value)} className="input text-sm py-2 px-3 rounded-lg w-full" placeholder="ABC-123XY" />
                </div>
              </div>
              <DocUploadZone label="Vehicle Document (optional)" value={form.vehicle_doc_url} onChange={(url) => set('vehicle_doc_url', url)} />
            </>
          )}

          {activeTab === 'guarantors' && (
            <div className="space-y-4">
              {!isEditing ? (
                <p className="text-xs text-[var(--neu-text)]">Save the rider first to add guarantors.</p>
              ) : (
                <>
                  {(guarantorsData?.data || []).length > 0 && (
                    <div className="space-y-3">
                      {guarantorsData?.data?.map(g => (
                        <div key={g.id} className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-bold text-white">{g.full_name}</p>
                              <p className="text-xs text-[var(--neu-text)]">{g.relationship} • {g.phone}</p>
                            </div>
                            <button onClick={() => removeGuarantorMutation.mutate(g.id)} disabled={removeGuarantorMutation.isPending} className="text-red-400 hover:text-red-300 disabled:opacity-40">
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-xs text-[var(--neu-text)] space-y-0.5">
                            <p>Address: {g.address}</p>
                            <p>ID: {g.id_type === 'none' ? 'None' : `${g.id_type} - ${g.id_number || 'N/A'}`}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(guarantorsData?.data?.length || 0) < 2 && (
                    <div className="rounded-xl border border-dashed border-white/20 p-4 space-y-3">
                      <p className="text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">Add Guarantor</p>
                      <input
                        type="text"
                        value={guarantorDraft.full_name}
                        onChange={(e) => setGuarantorDraft(prev => ({ ...prev, full_name: e.target.value }))}
                        className="input text-sm py-2 px-3 rounded-lg w-full"
                        placeholder="Full Name"
                      />
                      <input
                        type="text"
                        value={guarantorDraft.relationship}
                        onChange={(e) => setGuarantorDraft(prev => ({ ...prev, relationship: e.target.value }))}
                        className="input text-sm py-2 px-3 rounded-lg w-full"
                        placeholder="Relationship"
                      />
                      <input
                        type="text"
                        value={guarantorDraft.phone}
                        onChange={(e) => setGuarantorDraft(prev => ({ ...prev, phone: e.target.value }))}
                        className="input text-sm py-2 px-3 rounded-lg w-full"
                        placeholder="Phone"
                      />
                      {isLoaded ? (
                        <GoogleAddressAutocomplete
                          value={guarantorDraft.address}
                          onChangeAddress={(data) => setGuarantorDraft(prev => ({ ...prev, address: data.full_address }))}
                          placeholder="Address"
                          className="input text-sm py-2 px-3 rounded-lg w-full"
                        />
                      ) : (
                        <input
                          type="text"
                          value={guarantorDraft.address}
                          onChange={(e) => setGuarantorDraft(prev => ({ ...prev, address: e.target.value }))}
                          className="input text-sm py-2 px-3 rounded-lg w-full"
                          placeholder="Address"
                        />
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={guarantorDraft.id_type}
                          onChange={(e) => setGuarantorDraft(prev => ({ ...prev, id_type: e.target.value }))}
                          className="input text-sm py-2 px-3 rounded-lg w-full bg-transparent"
                        >
                          <option value="">None</option>
                          <option value="national_id">National ID</option>
                          <option value="drivers_license">Driver's License</option>
                          <option value="passport">Passport</option>
                          <option value="other">Other</option>
                        </select>
                        <input
                          type="text"
                          value={guarantorDraft.id_number}
                          onChange={(e) => setGuarantorDraft(prev => ({ ...prev, id_number: e.target.value }))}
                          className="input text-sm py-2 px-3 rounded-lg w-full"
                          placeholder="ID Number"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!guarantorDraft.full_name || !guarantorDraft.relationship || !guarantorDraft.phone || !guarantorDraft.address) {
                            toast.error('Please fill all required guarantor fields');
                            return;
                          }
                          addGuarantorMutation.mutate();
                        }}
                        disabled={addGuarantorMutation.isPending}
                        className="btn-primary text-sm px-4 py-2 disabled:opacity-40"
                      >
                        {addGuarantorMutation.isPending ? 'Adding...' : 'Add Guarantor'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <>
              <p className="text-xs text-[var(--neu-text)]">Upload clear images of ID and vehicle documents for verification.</p>
              <DocUploadZone label="ID Document" value={form.id_doc_url} onChange={(url) => set('id_doc_url', url)} />
              <DocUploadZone label="Vehicle Registration / Document" value={form.vehicle_doc_url} onChange={(url) => set('vehicle_doc_url', url)} />
            </>
          )}
        </form>

        <div className="px-6 py-4 border-t border-[var(--panel-border)] flex items-center justify-between">
          <div>
            {canPrev && (
              <button type="button" onClick={() => setActiveTab(TABS[currentIndex - 1].key)} className="btn-secondary px-3 py-2 text-xs flex items-center gap-1">
                <ChevronLeftIcon className="w-4 h-4" /> Prev
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="btn-secondary px-5 py-2 text-sm">Cancel</button>
            {canNext && (
              <button type="button" onClick={() => setActiveTab(TABS[currentIndex + 1].key)} className="btn-primary px-5 py-2 text-sm">
                Next <ChevronRightIcon className="w-4 h-4 inline ml-1" />
              </button>
            )}
            <button
              type="submit"
              form="rider-form"
              disabled={saveMutation.isPending}
              className="btn-primary px-5 py-2 disabled:opacity-40"
            >
              {saveMutation.isPending ? 'Saving...' : isEditing ? 'Update Rider' : 'Enroll Rider'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoZone({
  label,
  value,
  onChange,
  required,
  view
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  required?: boolean;
  view: 'frontal' | 'left' | 'right';
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setIsUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post('/admin/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = res.data;
      if (data.success && data.data?.url) {
        onChange(data.data.url);
        toast.success(`${label} uploaded`);
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
        {value && (
          <button type="button" onClick={() => onChange('')} className="text-[10px] text-red-400 hover:text-red-300">Remove</button>
        )}
      </div>
      {value ? (
        <div className="relative group rounded-xl overflow-hidden bg-black max-h-56 flex justify-center">
          <img src={value} alt={label} className="max-h-56 object-contain" />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="px-4 py-2 bg-[var(--neu-accent)] text-white rounded-lg text-sm font-bold shadow-lg">
              Change
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={isUploading} className="w-full flex flex-col items-center justify-center gap-2 px-4 py-6 bg-surface-2 hover:bg-white/5 border border-dashed border-white/20 rounded-xl text-sm font-medium text-[var(--neu-text)] transition-colors disabled:opacity-50">
          {isUploading ? (
            <>
              <div className="w-6 h-6 rounded-full border-2 border-nova-500 border-t-transparent animate-spin" />
              Uploading...
            </>
          ) : (
            <>Click to upload {label.toLowerCase()} image</>
          )}
        </button>
      )}
      <input type="file" accept="image/*" ref={fileRef} onChange={handleFile} className="hidden" />
    </div>
  );
}function AddressSection({ form, set, isLoaded }: { form: FormState; set: (k: keyof FormState, v: string) => void; isLoaded: boolean }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">Address Search</label>
        {isLoaded ? (
          <GoogleAddressAutocomplete
            value={form.street_address}
            onChangeAddress={(data) => {
              set('country', data.country);
              set('state', data.state);
              set('city', data.city);
              set('street_address', data.street_address);
            }}
            placeholder="Search your address..."
            className="input text-sm py-2 px-3 rounded-lg w-full"
          />
        ) : (
          <p className="text-xs text-[var(--neu-text)]">Loading address search...</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">Country *</label>
          <input
            type="text"
            required
            value={form.country}
            onChange={(e) => set('country', e.target.value)}
            className="input text-sm py-2 px-3 rounded-lg w-full"
            placeholder="Country"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">State / Province</label>
          <input
            type="text"
            value={form.state}
            onChange={(e) => set('state', e.target.value)}
            className="input text-sm py-2 px-3 rounded-lg w-full"
            placeholder="State"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">City</label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => set('city', e.target.value)}
            className="input text-sm py-2 px-3 rounded-lg w-full"
            placeholder="City"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">Street Address / Block *</label>
          <input
            type="text"
            required
            value={form.street_address}
            onChange={(e) => set('street_address', e.target.value)}
            className="input text-sm py-2 px-3 rounded-lg w-full"
            placeholder="Street Address"
          />
        </div>
      </div>

      <p className="text-[10px] text-[var(--neu-text)]">
        Address data powers dispatch and contact flows. Use the search field above to automatically fill the structured address fields.
      </p>
    </div>
  );
}

function DocUploadZone({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File exceeds 10MB limit');
      return;
    }
    setIsUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post('/admin/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = res.data;
      if (data.success && data.data?.url) {
        onChange(data.data.url);
        toast.success(`${label} uploaded`);
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">{label}</label>
        {value && (
          <button type="button" onClick={() => onChange('')} className="text-[10px] text-red-400 hover:text-red-300">Remove</button>
        )}
      </div>
      {value ? (
        <div className="relative group rounded-xl overflow-hidden bg-black max-h-48 flex justify-center">
          <img src={value} alt={label} className="max-h-48 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="px-4 py-2 bg-[var(--neu-accent)] text-white rounded-lg text-sm font-bold shadow-lg">
              Change
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={isUploading} className="w-full flex flex-col items-center justify-center gap-2 px-4 py-6 bg-surface-2 hover:bg-white/5 border border-dashed border-white/20 rounded-xl text-sm font-medium text-[var(--neu-text)] transition-colors disabled:opacity-50">
          {isUploading ? (
            <>
              <div className="w-6 h-6 rounded-full border-2 border-nova-500 border-t-transparent animate-spin" />
              Uploading...
            </>
          ) : (
            <>Click to upload</>
          )}
        </button>
      )}
      <input type="file" accept="image/*,.pdf" ref={fileRef} onChange={handleFile} className="hidden" />
    </div>
  );
}

const STATE_MAP: Record<string, string[]> = {
  'Nigeria': ['Lagos', 'Kano', 'Rivers', 'Oyo', 'Enugu', 'Delta', 'Kaduna', 'Ogun'],
  'Ghana': ['Greater Accra', 'Ashanti', 'Western', 'Eastern', 'Central', 'Northern'],
  'Kenya': ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Nyeri'],
  'South Africa': ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State']
};

const CITY_MAP: Record<string, Record<string, string[]>> = {
  'Nigeria': {
    'Lagos': ['Ikeja', 'Surulere', 'Lagos Island', 'Victoria Island', 'Lekki'],
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
