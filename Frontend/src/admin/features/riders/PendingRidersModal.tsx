import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchPendingRiders, approveRider, rejectRider, listGuarantors, type Rider } from './api/riders';
import GuarantorCard from './GuarantorCard';
import { useState } from 'react';
import { CheckIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { Modal } from '@/admin/components/ui/Modal';

interface PendingRidersModalProps {
  onClose: () => void;
}

export default function PendingRidersModal({ onClose }: PendingRidersModalProps) {
  const qc = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['pending-riders'],
    queryFn: () => fetchPendingRiders({}),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveRider(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-riders'] });
      qc.invalidateQueries({ queryKey: ['admin-riders'] });
      toast.success('Rider approved');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to approve rider'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectRider(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-riders'] });
      qc.invalidateQueries({ queryKey: ['admin-riders'] });
      toast.success('Rider rejected');
      setRejectingId(null);
      setRejectReason('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to reject rider'),
  });

  const riders: Rider[] = data?.data || [];

  return (
    <Modal
      onClose={onClose}
      variant="panel"
      size="lg"
      panelClassName="glass-card"
      shadowClassName=""
      maxHeightClassName="max-h-[80vh]"
      animated
      headerPaddingClassName="px-6 py-5"
      headerClassName="border-[var(--panel-border)]"
      titleClassName="text-base font-bold text-white"
      title="Pending Rider Approvals"
      description={`${riders.length} rider${riders.length !== 1 ? 's' : ''} awaiting review`}
      bodyClassName="space-y-4"
    >
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-nova-500 border-t-transparent animate-spin" />
            </div>
          ) : error ? (
            <p className="text-center text-red-400 text-sm">Failed to load pending riders</p>
          ) : riders.length === 0 ? (
            <p className="text-center text-[var(--neu-text)] text-sm py-8">No pending riders at this time.</p>
          ) : (
            riders.map((rider) => (
              <PendingRiderRow
                key={rider.id}
                rider={rider}
                onApprove={() => approveMutation.mutate(rider.id)}
                onReject={() => {
                  setRejectingId(rider.id);
                  setRejectReason('');
                }}
                isApproving={approveMutation.isPending}
                isRejecting={rejectMutation.isPending}
              />
            ))
          )}

        {rejectingId && (
          <div className="px-6 py-4 border-t border-[var(--panel-border)] space-y-2">
            <label className="text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider">Rejection Reason</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-black border border-gray-800 text-gray-300 text-sm rounded-lg p-3 outline-none focus:border-nova-500 focus:ring-1 focus:ring-nova-500"
              rows={2}
              placeholder="Optional reason..."
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setRejectingId(null); setRejectReason(''); }} className="btn-secondary px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={() => rejectMutation.mutate({ id: rejectingId, reason: rejectReason })}
                disabled={rejectMutation.isPending}
                className="btn-danger text-sm px-5 py-2 disabled:opacity-40"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject Rider'}
              </button>
            </div>
          </div>
        )}
    </Modal>
  );
}

function PendingRiderRow({
  rider,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  rider: Rider;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const [showGuarantors, setShowGuarantors] = useState(false);
  const { data: guarantorsData } = useQuery({
    queryKey: ['guarantors', rider.id],
    queryFn: () => listGuarantors(rider.id),
    enabled: showGuarantors,
  });

  return (
    <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-bold text-white">
            {rider.first_name} {rider.last_name}
          </p>
          <p className="text-xs text-[var(--neu-text)]">{rider.phone} {rider.email ? `• ${rider.email}` : ''}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-amber-500/10 text-amber-400 border-amber-500/20">
              PENDING APPROVAL
            </span>
            <span className="text-[10px] text-[var(--neu-text)]">{new Date(rider.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onApprove} disabled={isApproving} className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-40" title="Approve">
            <CheckIcon className="w-4 h-4" />
          </button>
          <button onClick={onReject} disabled={isRejecting} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40" title="Reject">
            <XCircleIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs text-[var(--neu-text)]">
        <div>
          <p className="font-bold text-gray-400">Photos</p>
          <p className="mt-1">{rider.photo_frontal ? 'Frontal ✓' : 'Frontal ✗'} • {rider.photo_left_profile ? 'Left ✓' : 'Left ✗'} • {rider.photo_right_profile ? 'Right ✓' : 'Right ✗'}</p>
        </div>
        <div>
          <p className="font-bold text-gray-400">Address</p>
          <p className="mt-1">{[rider.street_address, rider.city, rider.state, rider.country].filter(Boolean).join(', ') || 'Not provided'}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowGuarantors(!showGuarantors)}
          className="text-xs text-nova-400 hover:text-nova-300 font-medium"
        >
          {showGuarantors ? 'Hide' : 'Show'} Guarantors
        </button>
        {rider.id_doc_url && <span className="text-[10px] text-[var(--neu-text)]">ID Doc ✓</span>}
        {rider.vehicle_doc_url && <span className="text-[10px] text-[var(--neu-text)]">Vehicle Doc ✓</span>}
      </div>

      {showGuarantors && (
        <div className="space-y-3 pt-2 border-t border-[var(--panel-border)]">
          {guarantorsData?.data?.length ? (
            guarantorsData.data.map((g) => (
              <div key={g.id} className="text-xs text-[var(--neu-text)]">
                <p className="font-bold text-white">{g.full_name}</p>
                <p>{g.relationship} • {g.phone} • {g.address}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-[var(--neu-text)]">No guarantors provided.</p>
          )}
        </div>
      )}
    </div>
  );
}
