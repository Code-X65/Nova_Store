import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { updateGuarantor, deleteGuarantor } from '../api/riders';
import type { Guarantor } from '../api/riders';

interface GuarantorCardProps {
  guarantor: Guarantor;
  riderId: string;
  onClose: () => void;
}

export default function GuarantorCard({ guarantor, riderId, onClose }: GuarantorCardProps) {
  const qc = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: guarantor.full_name,
    relationship: guarantor.relationship,
    phone: guarantor.phone,
    address: guarantor.address,
    id_type: guarantor.id_type || 'none',
    id_number: guarantor.id_number || ''
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateGuarantor(riderId, guarantor.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-riders'] });
      toast.success('Guarantor updated');
      setIsEditing(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update guarantor'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteGuarantor(riderId, guarantor.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-riders'] });
      toast.success('Guarantor removed');
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to remove guarantor'),
  });

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-white">{form.full_name}</p>
          <p className="text-xs text-[var(--neu-text)]">{form.relationship}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="text-xs text-[var(--neu-text)] hover:text-white transition-colors">
              Edit
            </button>
          ) : (
            <>
              <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="text-xs text-green-400 hover:text-green-300 disabled:opacity-40">
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setIsEditing(false)} className="text-xs text-[var(--neu-text)] hover:text-white transition-colors">
                Cancel
              </button>
            </>
          )}
          <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="text-red-400 hover:text-red-300 disabled:opacity-40">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="space-y-3">
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => set('full_name', e.target.value)}
            className="input text-sm py-2 px-3 rounded-lg w-full"
            placeholder="Full Name"
          />
          <input
            type="text"
            value={form.relationship}
            onChange={(e) => set('relationship', e.target.value)}
            className="input text-sm py-2 px-3 rounded-lg w-full"
            placeholder="Relationship"
          />
          <input
            type="text"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className="input text-sm py-2 px-3 rounded-lg w-full"
            placeholder="Phone"
          />
          <input
            type="text"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            className="input text-sm py-2 px-3 rounded-lg w-full"
            placeholder="Address"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.id_type}
              onChange={(e) => set('id_type', e.target.value)}
              className="input text-sm py-2 px-3 rounded-lg w-full bg-transparent"
            >
              <option value="none">None</option>
              <option value="national_id">National ID</option>
              <option value="drivers_license">Driver's License</option>
              <option value="passport">Passport</option>
              <option value="other">Other</option>
            </select>
            <input
              type="text"
              value={form.id_number}
              onChange={(e) => set('id_number', e.target.value)}
              className="input text-sm py-2 px-3 rounded-lg w-full"
              placeholder="ID Number"
            />
          </div>
        </div>
      )}

      {!isEditing && (
        <div className="space-y-1 text-xs text-[var(--neu-text)]">
          <p>Phone: {form.phone}</p>
          <p>Address: {form.address}</p>
          <p>ID: {form.id_type === 'none' ? 'None' : `${form.id_type} - ${form.id_number || 'N/A'}`}</p>
        </div>
      )}
    </div>
  );
}
