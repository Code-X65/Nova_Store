import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchDispatchQueue, type Order } from './api/orders';
import { format } from 'date-fns';
import { TruckIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';

export default function DispatchQueue() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-dispatch-queue'],
    queryFn: () => fetchDispatchQueue({ limit: 50 }),
  });

  if (isLoading) return <div className="p-6 text-gray-400">Loading queue...</div>;
  if (isError) return <div className="p-6 text-red-400">Failed to load dispatch queue</div>;

  const orders = data?.orders || [];
  
  const readyForDispatch = orders.filter(o => o.delivery_status === 'ready_for_dispatch');
  const dispatched = orders.filter(o => o.delivery_status === 'dispatched' || o.delivery_status === 'out_for_delivery');

  const QueueCard = ({ order }: { order: Order }) => (
    <div 
      onClick={() => navigate(`/admin/orders/${order.id}`)}
      className="bg-[#1a1b23] border border-gray-800 rounded-xl p-4 hover:border-nova-500/50 cursor-pointer transition-colors"
    >
      <div className="flex justify-between items-start mb-2">
        <span className="font-bold text-white">#{order.order_number}</span>
        <span className="text-xs text-gray-500">{format(new Date(order.created_at), 'HH:mm')}</span>
      </div>
      <p className="text-sm text-gray-300 mb-4">{order.user?.first_name} {order.user?.last_name}</p>
      <div className="flex justify-between items-center mt-auto">
        <span className="px-2 py-1 bg-gray-800 text-gray-400 rounded text-xs font-medium border border-gray-700">
          {order.delivery_status.replace(/_/g, ' ').toUpperCase()}
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">Dispatch Queue</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Ready to Dispatch */}
        <div className="bg-[#14151a] border border-gray-800 rounded-xl flex flex-col p-4">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardDocumentCheckIcon className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-medium text-white">Ready for Dispatch</h2>
            <span className="ml-auto bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full text-xs">
              {readyForDispatch.length}
            </span>
          </div>
          <div className="space-y-4 overflow-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
            {readyForDispatch.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">No orders waiting for dispatch.</div>
            ) : (
              readyForDispatch.map(order => <QueueCard key={order.id} order={order} />)
            )}
          </div>
        </div>

        {/* Out for Delivery */}
        <div className="bg-[#14151a] border border-gray-800 rounded-xl flex flex-col p-4">
          <div className="flex items-center gap-2 mb-4">
            <TruckIcon className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-medium text-white">En Route</h2>
            <span className="ml-auto bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full text-xs">
              {dispatched.length}
            </span>
          </div>
          <div className="space-y-4 overflow-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
            {dispatched.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">No active deliveries.</div>
            ) : (
              dispatched.map(order => <QueueCard key={order.id} order={order} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}