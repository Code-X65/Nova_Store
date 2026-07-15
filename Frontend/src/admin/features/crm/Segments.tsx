import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { DataTable } from '@/shared/ui/DataTable';
import { createColumnHelper } from '@tanstack/react-table';
import { fetchSegments, createSegment, updateSegment, deleteSegment, type Segment } from './api/segments';

const columnHelper = createColumnHelper<Segment>();

export default function Segments() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editActive, setEditActive] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-crm-segments'],
    queryFn: () => fetchSegments({ page: 1, limit: 50 }),
  });

  const segments: Segment[] = data?.segments || [];

  const createMut = useMutation({
    mutationFn: () => createSegment({ name, description: desc, is_active: true, rules: {} }),
    onSuccess: () => { toast.success('Segment created'); qc.invalidateQueries({ queryKey: ['admin-crm-segments'] }); setName(''); setDesc(''); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, name, description, is_active }: any) => updateSegment(id, { name, description, is_active }),
    onSuccess: () => { toast.success('Segment updated'); qc.invalidateQueries({ queryKey: ['admin-crm-segments'] }); setEditing(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteSegment(id),
    onSuccess: () => { toast.success('Segment deleted'); qc.invalidateQueries({ queryKey: ['admin-crm-segments'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const startEdit = (s: Segment) => {
    setEditing(s.id);
    setEditName(s.name);
    setEditDesc(s.description || '');
    setEditActive(s.is_active);
  };

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (info) => {
        const s = info.row.original;
        return editing === s.id ? (
          <input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-black border border-white/10 rounded p-1 text-gray-200 outline-none w-full" />
        ) : (
          <span className="text-gray-200">{s.name}</span>
        );
      },
    }),
    columnHelper.accessor('description', {
      header: 'Description',
      cell: (info) => {
        const s = info.row.original;
        return editing === s.id ? (
          <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="bg-black border border-white/10 rounded p-1 text-gray-200 outline-none w-full" />
        ) : (
          <span className="text-gray-400">{s.description || '—'}</span>
        );
      },
    }),
    columnHelper.accessor('is_active', {
      header: 'Status',
      cell: (info) => {
        const s = info.row.original;
        return editing === s.id ? (
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
            Active
          </label>
        ) : (
          <span className={`inline-flex px-2 py-1 rounded text-xs ${s.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'}`}>
            {s.is_active ? 'Active' : 'Inactive'}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const s = info.row.original;
        return editing === s.id ? (
          <div className="flex gap-2 justify-end">
            <button onClick={() => updateMut.mutate({ id: s.id, name: editName, description: editDesc, is_active: editActive })} className="text-nova-400 hover:text-nova-300 text-xs">Save</button>
            <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-300 text-xs">Cancel</button>
          </div>
        ) : (
          <div className="flex gap-2 justify-end">
            <button onClick={() => startEdit(s)} className="text-blue-400 hover:text-blue-300 text-xs">Edit</button>
            <button onClick={() => { if (confirm('Delete this segment?')) deleteMut.mutate(s.id); }} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
          </div>
        );
      },
    }),
  ], [editing, editName, editDesc, editActive, updateMut, deleteMut]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">Customer Segments</h1>

      <div className="bg-black rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Segment name" className="bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" className="bg-black border border-white/10 rounded-lg p-2.5 text-gray-200 outline-none" />
        <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !name} className="bg-nova-500 text-white rounded-lg px-4 disabled:opacity-50">Create Segment</button>
      </div>

      <div className="bg-black rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <DataTable columns={columns} data={segments} />
        )}
      </div>
    </div>
  );
}
