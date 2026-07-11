import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fetchOrderDetails, markReadyForDispatch, dispatchOrder, updateOrderStatus } from './api/orders';
import toast from 'react-hot-toast';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function OrderDetail() {
 const { id } = useParams<{ id: string }>();
 const navigate = useNavigate();
 const queryClient = useQueryClient();

 const { data: orderData, isLoading } = useQuery({
 queryKey: ['admin-order', id],
 queryFn: () => fetchOrderDetails(id!),
 enabled: !!id,
 });

 const order = orderData?.order;

 const readyMutation = useMutation({
 mutationFn: () => markReadyForDispatch(id!),
 onSuccess: () => {
 toast.success('Order marked as ready for dispatch');
 queryClient.invalidateQueries({ queryKey: ['admin-order', id] });
 },
 onError: (err: any) => toast.error(err.response?.data?.message || 'Action failed'),
 });

 const dispatchMutation = useMutation({
 mutationFn: (payload: { driverName: string; driverPhone?: string }) => dispatchOrder(id!, payload),
 onSuccess: () => {
 toast.success('Order dispatched');
 queryClient.invalidateQueries({ queryKey: ['admin-order', id] });
 },
 onError: (err: any) => toast.error(err.response?.data?.message || 'Action failed'),
 });

 if (isLoading) {
 return <div className="p-6 text-gray-400">Loading order details...</div>;
 }

 if (!order) {
 return <div className="p-6 text-red-400">Order not found</div>;
 }

 return (
 <div className="flex flex-col h-full space-y-6 w-full">
 <div className="flex items-center gap-4">
 <button
 onClick={() => navigate(-1)}
 className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
 >
 <ArrowLeftIcon className="w-5 h-5" />
 </button>
 <h1 className="text-2xl font-bold text-white tracking-tight">
 Order #{order.order_number}
 </h1>
 <div className="ml-auto flex gap-3">
 <span className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm font-medium">
 {order.status.replace('_', ' ').toUpperCase()}
 </span>
 {order.delivery_status && (
 <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-sm font-medium border border-indigo-500/20">
 {order.delivery_status.replace(/_/g, ' ').toUpperCase()}
 </span>
 )}
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 {/* Main Column */}
 <div className="md:col-span-2 space-y-6">
 {/* Items */}
 <div className="bg-black rounded-xl p-6">
 <h2 className="text-lg font-medium text-white mb-4">Order Items</h2>
 <div className="space-y-4">
 {order.items?.map((item: any) => (
 <div key={item.id} className="flex justify-between items-center py-2 last:border-0">
 <div>
 <p className="text-gray-300 font-medium">{item.product_name}</p>
 <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
 </div>
 <p className="text-gray-300">${(item.price_at_time * item.quantity).toFixed(2)}</p>
 </div>
 ))}
 </div>
 <div className="mt-6 pt-4 flex justify-between">
 <span className="text-gray-400">Total</span>
 <span className="text-lg font-bold text-white">${Number(order.total_amount).toFixed(2)}</span>
 </div>
 </div>

 {/* Action Panel */}
 <div className="bg-black rounded-xl p-6">
 <h2 className="text-lg font-medium text-white mb-4">Fulfillment Actions</h2>
 <div className="flex flex-wrap gap-3">
 {order.status === 'processing' && order.delivery_status === 'not_dispatched' && (
 <button
 onClick={() => readyMutation.mutate()}
 disabled={readyMutation.isPending}
 className="bg-nova-600 hover:bg-nova-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
 >
 {readyMutation.isPending ? 'Processing...' : 'Mark Ready for Dispatch'}
 </button>
 )}
 {order.delivery_status === 'ready_for_dispatch' && (
 <button
 onClick={() => {
 const name = window.prompt("Enter Driver Name:");
 if (name) dispatchMutation.mutate({ driverName: name });
 }}
 disabled={dispatchMutation.isPending}
 className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
 >
 {dispatchMutation.isPending ? 'Dispatching...' : 'Dispatch Order'}
 </button>
 )}
 </div>
 </div>
 </div>

 {/* Sidebar Column */}
 <div className="space-y-6">
 <div className="bg-black rounded-xl p-6">
 <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Customer Info</h2>
 <p className="text-white font-medium">{order.user?.first_name} {order.user?.last_name}</p>
 <p className="text-gray-400 text-sm mt-1">{order.user?.email}</p>
 </div>

 <div className="bg-black rounded-xl p-6">
 <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Shipping Details</h2>
 <p className="text-gray-300 text-sm">{order.shipping_address?.street}</p>
 <p className="text-gray-300 text-sm">{order.shipping_address?.city}, {order.shipping_address?.state} {order.shipping_address?.postal_code}</p>
 </div>
 </div>
 </div>
 </div>
 );
}