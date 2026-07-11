import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAcceptInviteToken, useAcceptInvite } from './hooks/useAcceptInvite';
import { useAdminSession } from '@/admin/hooks/useAdminSession';
// Removed custom UI components to use standard HTML elements
import { refreshCsrfToken } from '@/admin/lib/api';
import toast from 'react-hot-toast';

export default function AcceptInvite() {
 const { token } = useParams<{ token: string }>();
 const navigate = useNavigate();
 const { isLoggedIn, refetch: refetchAuth } = useAdminSession();
 const [name, setName] = useState('');
 const [password, setPassword] = useState('');

 const { data: inviteData, isLoading, isError, error } = useAcceptInviteToken(token || '');
 const { mutate: acceptInvite, isPending } = useAcceptInvite();

 // If already logged in, we might want to auto-accept or just show a simpler button
 // But if the logged-in user email doesn't match the invite email, we might have issues.
 // For now, let's keep it simple.

 const handleAccept = (e?: React.FormEvent) => {
 if (e) e.preventDefault();
 if (!token) return;

 // Backend expects firstName / lastName; derive them from the single name field.
 const trimmed = name.trim();
 const spaceIdx = trimmed.indexOf(' ');
 const firstName = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
 const lastName = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();

 acceptInvite(
 { token, firstName, lastName, password },
 {
 onSuccess: async () => {
 toast.success('Invitation accepted successfully!');
 await refreshCsrfToken();
 await refetchAuth();
 navigate('/admin');
 },
 onError: (err: any) => {
 toast.error(err.response?.data?.message || 'Failed to accept invitation');
 },
 }
 );
 };

 if (isLoading) {
 return (
 <div className="min-h-screen flex w-full bg-[#111315] items-center justify-center">
 <div className="w-8 h-8 rounded-full border-2 border-[#d4af37] border-t-transparent animate-spin" />
 </div>
 );
 }

 if (isError || !inviteData) {
 return (
 <div className="min-h-screen flex w-full bg-[#111315] items-center justify-center p-6">
 <div className="w-full max-w-md rounded-2xl border border-[#2a3535] bg-gradient-to-b from-[#1a2826] to-[#181a1c] p-8 shadow-2xl text-center space-y-4">
 <h2 className="text-xl font-bold tracking-wider text-[#ef4444] uppercase">Invalid or Expired Invitation</h2>
 <p className="text-gray-400">
 {((error as any)?.response?.data?.message) || 'This invitation link is invalid or has expired.'}
 </p>
 <button onClick={() => navigate('/admin/login')} className="w-full bg-[#20524c] hover:bg-[#28665f] text-white font-semibold rounded-lg py-3 transition-all">
 Go to Login
 </button>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-screen flex w-full bg-[#111315] items-center justify-center p-6">
 {/* Logo header */}
 <div className="absolute top-10 left-1/2 -translate-x-1/2 text-center">
 <h1 className="text-3xl font-serif tracking-widest text-[#d4af37]" style={{ fontFamily: 'Georgia, serif' }}>
 NovaStore
 </h1>
 </div>

 <div className="w-full max-w-md rounded-2xl border border-[#2a3535] bg-gradient-to-b from-[#1a2826] to-[#181a1c] p-8 shadow-2xl relative overflow-hidden mt-10">
 {/* Subtle teal glow at the top inside the card */}
 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-[#408a80] blur-[40px] opacity-40" />

 <div className="text-center mb-6 relative z-10">
 <h2 className="text-2xl font-bold tracking-wider text-[#d4af37] uppercase">Accept Invitation</h2>
 <p className="text-gray-400 text-sm mt-2">
 You've been invited to join <span className="font-semibold text-white">{inviteData.storeName}</span> as <span className="font-semibold text-[#5ea399]">{inviteData.roleName}</span>.
 </p>
 </div>

 {!isLoggedIn ? (
 <form onSubmit={handleAccept} className="space-y-5 relative z-10">
 <div>
 <label htmlFor="email" className="block text-xs text-gray-400 mb-1 ml-1">Email address</label>
 <input
 id="email"
 name="email"
 type="email"
 value={inviteData.email}
 disabled
 className="w-full bg-[#1b1d1f] border border-[#2a3535] text-gray-400 rounded-lg px-4 py-3 focus:outline-none"
 />
 </div>

 <div>
 <label htmlFor="name" className="block text-xs text-gray-400 mb-1 ml-1">Full Name</label>
 <input
 id="name"
 name="name"
 type="text"
 required
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="John Doe"
 className="w-full bg-[#1b1d1f] border border-[#d4af37] text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#d4af37] transition-colors placeholder-gray-600"
 />
 </div>

 <div>
 <label htmlFor="password" className="block text-xs text-gray-400 mb-1 ml-1">Create Password</label>
 <input
 id="password"
 name="password"
 type="password"
 required
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 placeholder="••••••••"
 className="w-full bg-[#1b1d1f] border border-[#d4af37] text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#d4af37] transition-colors placeholder-gray-600 tracking-widest font-mono"
 />
 </div>

 <button type="submit" disabled={isPending} className="w-full bg-[#20524c] hover:bg-[#28665f] text-white font-semibold rounded-lg py-3 flex items-center justify-center transition-all shadow-[0_4px_14px_0_rgba(32,82,76,0.39)] hover:shadow-[0_6px_20px_rgba(32,82,76,0.23)] hover:-translate-y-[1px]">
 {isPending ? (
 <div className="w-5 h-5 border-2 border-t-white rounded-full animate-spin" />
 ) : (
 <span className="tracking-widest uppercase text-sm">Accept &amp; Join</span>
 )}
 </button>
 </form>
 ) : (
 <div className="space-y-6 text-center relative z-10">
 <p className="text-gray-400">
 You are currently logged in. By clicking below, you will accept the invitation and add this role to your account.
 </p>
 <button
 onClick={() => handleAccept()}
 disabled={isPending}
 className="w-full bg-[#20524c] hover:bg-[#28665f] text-white font-semibold rounded-lg py-3 flex items-center justify-center transition-all shadow-[0_4px_14px_0_rgba(32,82,76,0.39)] hover:shadow-[0_6px_20px_rgba(32,82,76,0.23)] hover:-translate-y-[1px]"
 >
 {isPending ? (
 <div className="w-5 h-5 border-2 border-t-white rounded-full animate-spin" />
 ) : (
 <span className="tracking-widest uppercase text-sm">Accept Invitation</span>
 )}
 </button>
 </div>
 )}
 </div>
 </div>
 );
}
