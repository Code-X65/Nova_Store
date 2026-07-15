import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { EyeIcon, EyeSlashIcon, LockClosedIcon, UserIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { login, type LoginCredentials } from '@/admin/lib/auth';

const schema = z.object({
 email: z.string().email('Invalid email address'),
 password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
 const navigate = useNavigate();
 const location = useLocation();
 const qc = useQueryClient();
 const from = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard';
 const [showPw, setShowPw] = useState(false);

 // Two-factor step: shown after the server responds with TWO_FACTOR_REQUIRED.
 // We keep the verified email/password in state so the code can be re-submitted
 // together with them (the backend re-validates the full credential set each time).
 const [twoFactorRequired, setTwoFactorRequired] = useState(false);
 const [twoFactorMode, setTwoFactorMode] = useState<'totp' | 'recovery'>('totp');
 const [twoFactorCode, setTwoFactorCode] = useState('');
 const [pendingCredentials, setPendingCredentials] = useState<FormData | null>(null);

 const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
 resolver: zodResolver(schema),
 });

 const { mutate, isPending } = useMutation({
 mutationFn: (data: LoginCredentials) => login(data),
 onSuccess: (session) => {
 qc.setQueryData(['admin-session'], session);
 const channel = new BroadcastChannel('admin-session-channel');
 channel.postMessage('LOGIN');
 channel.close();
 navigate(from, { replace: true });
 },
 onError: (err: unknown) => {
 const data = (err as any)?.response?.data;
 if (data?.code === 'TWO_FACTOR_REQUIRED') {
 setTwoFactorRequired(true);
 toast('Enter your two-factor authentication code to continue.', { icon: '🔐' });
 return;
 }
 const errorData = data?.error;
 const msg = typeof errorData === 'object' ? errorData?.message : (errorData || data?.message || 'Invalid email or password');
 toast.error(msg);
 // If we were on the 2FA step, stay there so the user can just retry the code
 // rather than being bounced back to re-enter their password.
 },
 });

 const submitCredentials = (d: FormData) => {
 setPendingCredentials(d);
 mutate(d);
 };

 const submitTwoFactor = () => {
 if (!pendingCredentials || !twoFactorCode.trim()) return;
 mutate({
 ...pendingCredentials,
 ...(twoFactorMode === 'totp'
 ? { twoFactorToken: twoFactorCode.trim() }
 : { recoveryCode: twoFactorCode.trim() }),
 });
 };

 return (
 <div className="min-h-screen flex w-full bg-[#111315]">
 
 {/* LEFT PANEL - Image */}
 <div className="hidden lg:flex lg:w-1/2 relative bg-[#111315]">
 {/* Logo overlay on image */}
 <div className="absolute top-8 left-10 z-10">
 <h1 className="text-4xl font-serif tracking-widest text-[#d4af37]" style={{ fontFamily: 'Georgia, serif' }}>
 NovaStore
 </h1>
 </div>
 
 {/* The background image */}
 <div 
 className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-90"
 style={{ backgroundImage:"url('/admin_login_bg.png')" }}
 />
 {/* Subtle dark gradient over the image to blend it with the right side */}
 <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#111315]/80" />
 </div>

 {/* RIGHT PANEL - Form */}
 <div className="flex-1 flex flex-col items-center justify-center relative p-6 sm:p-12">
 
 {/* Logo (Top center of right pane) */}
 <div className="mb-10 text-center">
 <h1 className="text-4xl font-serif tracking-widest text-[#d4af37]" style={{ fontFamily: 'Georgia, serif' }}>
 NovaStore
 </h1>
 </div>

 {/* Login Card */}
 <div className="w-full max-w-[420px] rounded-2xl border border-[#2a3535] bg-gradient-to-b from-[#1a2826] to-[#181a1c] p-8 shadow-2xl relative overflow-hidden">
 
 {/* Subtle teal glow at the top inside the card */}
 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-[#408a80] blur-[40px] opacity-40"></div>

 <div className="text-center mb-8 relative z-10">
 <h2 className="text-2xl font-bold tracking-wider text-[#5ea399] uppercase mb-1">Admin Login</h2>
 <p className="text-gray-400 text-sm">
 {twoFactorRequired ? 'Enter your two-factor authentication code' : 'Secure Admin Access Portal'}
 </p>
 </div>

 {twoFactorRequired ? (
 <div className="space-y-5 relative z-10">
 <div className="flex justify-center mb-2">
 <div className="w-12 h-12 rounded-full bg-[#20524c]/40 flex items-center justify-center">
 <ShieldCheckIcon className="w-6 h-6 text-[#5ea399]" />
 </div>
 </div>

 <div>
 <label htmlFor="admin-2fa-code" className="block text-xs text-gray-400 mb-1 ml-1">
 {twoFactorMode === 'totp' ? 'Authenticator Code' : 'Recovery Code'}
 </label>
 <input
 id="admin-2fa-code"
 type="text"
 inputMode={twoFactorMode === 'totp' ? 'numeric' : 'text'}
 autoComplete="one-time-code"
 autoFocus
 value={twoFactorCode}
 onChange={(e) => setTwoFactorCode(e.target.value)}
 onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitTwoFactor(); } }}
 className="w-full bg-[#1b1d1f] border border-[#d4af37] text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#d4af37] transition-colors placeholder-gray-600 tracking-widest font-mono text-center text-lg"
 placeholder={twoFactorMode === 'totp' ? '123456' : 'XXXXXXXXXXXXXXXX'}
 />
 </div>

 <button
 type="button"
 onClick={submitTwoFactor}
 disabled={isPending || !twoFactorCode.trim()}
 className="w-full bg-[#20524c] hover:bg-[#28665f] text-white font-semibold rounded-lg py-3 flex items-center justify-center transition-all shadow-[0_4px_14px_0_rgba(32,82,76,0.39)] hover:shadow-[0_6px_20px_rgba(32,82,76,0.23)] hover:-translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
 >
 {isPending ? (
 <div className="w-5 h-5 border-2 border-t-white rounded-full animate-spin" />
 ) : (
 <span className="tracking-widest uppercase text-sm">Verify</span>
 )}
 </button>

 <div className="flex items-center justify-between text-xs">
 <button
 type="button"
 onClick={() => { setTwoFactorMode(m => m === 'totp' ? 'recovery' : 'totp'); setTwoFactorCode(''); }}
 className="text-[#a3a3a3] hover:text-[#d4af37] transition-colors underline-offset-4 hover:underline"
 >
 {twoFactorMode === 'totp' ? 'Use a recovery code instead' : 'Use authenticator code instead'}
 </button>
 <button
 type="button"
 onClick={() => { setTwoFactorRequired(false); setTwoFactorCode(''); setPendingCredentials(null); }}
 className="text-[#a3a3a3] hover:text-white transition-colors"
 >
 Back
 </button>
 </div>
 </div>
 ) : (
 <>
 <form
 id="admin-login-form"
 onSubmit={handleSubmit(submitCredentials)}
 className="space-y-5 relative z-10"
 noValidate
 >
 {/* Email Field */}
 <div>
 <label htmlFor="admin-email" className="block text-xs text-gray-400 mb-1 ml-1">Admin Email or ID</label>
 <div className="relative">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
 <UserIcon className="w-5 h-5" />
 </div>
 <input
 id="admin-email"
 type="email"
 autoComplete="email"
 className="w-full bg-[#1b1d1f] border border-[#d4af37] text-white rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#d4af37] transition-colors placeholder-gray-600"
 placeholder="NovaStore"
 {...register('email')}
 />
 </div>
 {errors.email && (
 <p className="text-[#ef4444] text-xs mt-1 ml-1">{errors.email.message}</p>
 )}
 </div>

 {/* Password Field */}
 <div>
 <label htmlFor="admin-password" className="block text-xs text-gray-400 mb-1 ml-1">Password</label>
 <div className="relative">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
 <LockClosedIcon className="w-5 h-5" />
 </div>
 <input
 id="admin-password"
 type={showPw ? 'text' : 'password'}
 autoComplete="current-password"
 className="w-full bg-[#1b1d1f] border border-[#d4af37] text-white rounded-lg pl-10 pr-10 py-3 focus:outline-none focus:ring-1 focus:ring-[#d4af37] transition-colors placeholder-gray-600 tracking-widest font-mono"
 placeholder="••••••••"
 {...register('password')}
 />
 <button
 type="button"
 onClick={() => setShowPw((v) => !v)}
 className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
 tabIndex={-1}
 >
 {showPw ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
 </button>
 </div>
 {errors.password && (
 <p className="text-[#ef4444] text-xs mt-1 ml-1">{errors.password.message}</p>
 )}
 </div>

 <div className="flex justify-end">
 <a href="#" className="text-xs text-[#a3a3a3] hover:text-[#d4af37] transition-colors decoration-[#d4af37] underline-offset-4 hover:underline">
 Forgot Password?
 </a>
 </div>

 {/* Submit Button */}
 <button
 id="admin-login-submit"
 type="submit"
 disabled={isPending}
 className="w-full bg-[#20524c] hover:bg-[#28665f] text-white font-semibold rounded-lg py-3 flex items-center justify-center transition-all shadow-[0_4px_14px_0_rgba(32,82,76,0.39)] hover:shadow-[0_6px_20px_rgba(32,82,76,0.23)] hover:-translate-y-[1px]"
 >
 {isPending ? (
 <div className="w-5 h-5 border-2 border-t-white rounded-full animate-spin" />
 ) : (
 <span className="tracking-widest uppercase text-sm">Secure Login</span>
 )}
 </button>
 </form>

 {/* Social / Third-Party Login */}
 <div className="mt-8 relative z-10">
 <div className="relative">
 <div className="absolute inset-0 flex items-center">
 <div className="w-full border-t border-[#333]"></div>
 </div>
 <div className="relative flex justify-center text-xs">
 <span className="px-2 bg-transparent text-gray-400">Or verify with:</span>
 </div>
 </div>

 <div className="mt-6 grid grid-cols-2 gap-4">
 <button className="flex items-center justify-center px-4 py-2 bg-gradient-to-b from-[#3a3d40] to-[#202224] border border-[#444] rounded-full shadow-inner hover:brightness-110 transition-all">
 {/* Google Logo SVG */}
 <svg className="w-5 h-5" viewBox="0 0 24 24">
 <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
 <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
 <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
 <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
 </svg>
 </button>
 <button className="flex items-center justify-center px-4 py-2 bg-gradient-to-b from-[#3a3d40] to-[#202224] border border-[#444] rounded-full shadow-inner hover:brightness-110 transition-all">
 <span className="font-bold text-gray-300 text-sm tracking-wide lowercase">yubikey</span>
 </button>
 </div>
 </div>
 </>
 )}
 </div>

 {/* Footer */}
 <div className="absolute bottom-6 left-0 right-0 text-center">
 <p className="text-xs text-gray-500">
 System Status: <span className="text-[#5ea399]">Online</span> | © 2026 NovaState Admin | <a href="#" className="hover:text-gray-300 transition-colors">Need Help?</a>
 </p>
 </div>
 
 </div>
 </div>
 );
}