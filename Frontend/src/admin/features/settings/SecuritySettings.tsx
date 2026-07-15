import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetch2faStatus, enable2fa, verify2fa, disable2fa, redeem2faRecoveryCode, type TwoFactorSetup } from './api/security';
import toast from 'react-hot-toast';
import { ShieldCheckIcon, KeyIcon, QrCodeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function SecuritySettings() {
  const qc = useQueryClient();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');

  const { data: statusResp, isLoading } = useQuery({
    queryKey: ['2fa-status'],
    queryFn: fetch2faStatus,
  });

  const enableMutation = useMutation({
    mutationFn: async () => enable2fa(),
    onSuccess: (data) => {
      setSetup(data);
      setToken('');
      toast.success('Scan the QR code with your authenticator app');
    },
    onError: () => toast.error('Failed to start 2FA enrollment'),
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      await verify2fa(token);
    },
    onSuccess: () => {
      toast.success('Two-factor authentication enabled');
      setSetup(null);
      setToken('');
      qc.invalidateQueries({ queryKey: ['2fa-status'] });
    },
    onError: () => toast.error('Invalid or expired token'),
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      await disable2fa(password);
    },
    onSuccess: () => {
      toast.success('Two-factor authentication disabled');
      setPassword('');
      qc.invalidateQueries({ queryKey: ['2fa-status'] });
    },
    onError: () => toast.error('Could not disable 2FA — check your password'),
  });

  const recoveryMutation = useMutation({
    mutationFn: async () => redeem2faRecoveryCode(recoveryCode),
    onSuccess: (d) => {
      toast.success(`Recovery code accepted. ${d.remaining} remaining.`);
      setRecoveryCode('');
    },
    onError: () => toast.error('Invalid recovery code'),
  });

  if (isLoading) {
    return <p className="text-muted-foreground p-4">Loading security settings…</p>;
  }

  const enabled = statusResp?.enabled;

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Security</h1>
        <p className="text-sm text-muted-foreground mt-1">Protect your account with two-factor authentication (TOTP).</p>
      </div>

      {/* Status banner */}
      <div className={`glass-card p-4 rounded-xl border flex items-center gap-3 ${enabled ? 'border-emerald-500/30' : 'border-amber-500/30'}`}>
        {enabled ? <ShieldCheckIcon className="w-6 h-6 text-emerald-400" /> : <ExclamationTriangleIcon className="w-6 h-6 text-amber-400" />}
        <div className="flex-1">
          <p className="font-medium text-white">
            Two-factor authentication is {enabled ? 'enabled' : 'disabled'}
          </p>
          {enabled && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {statusResp?.recovery_codes_remaining ?? 0} recovery code(s) remaining.
              {statusResp?.last_verified_at ? ` Last verified ${new Date(statusResp.last_verified_at).toLocaleString()}.` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Enrollment / setup */}
      {!enabled && !setup && (
        <div className="glass-card p-6 rounded-xl border">
          <div className="flex items-center gap-2 mb-3">
            <KeyIcon className="w-5 h-5 text-nova-400" />
            <h2 className="text-lg font-semibold text-white">Enable 2FA</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Add an extra layer of security by requiring a time-based one-time code from your authenticator app at login.
          </p>
          <button
            onClick={() => enableMutation.mutate()}
            disabled={enableMutation.isPending}
            className="px-4 py-2 rounded-lg bg-nova-500 text-white text-sm font-medium hover:bg-nova-600 disabled:opacity-50 transition-colors"
          >
            {enableMutation.isPending ? 'Generating…' : 'Begin Setup'}
          </button>
        </div>
      )}

      {setup && (
        <div className="glass-card p-6 rounded-xl border space-y-5">
          <div className="flex items-center gap-2">
            <QrCodeIcon className="w-5 h-5 text-nova-400" />
            <h2 className="text-lg font-semibold text-white">Scan &amp; Confirm</h2>
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
              <img src={setup.qr_code_url} alt="2FA QR code" className="w-44 h-44 rounded-lg bg-white p-2" />
              <p className="text-xs text-muted-foreground">Scan with Google Authenticator / Authy</p>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Manual key</p>
                <code className="block bg-[#111111] rounded-lg px-3 py-2 text-sm text-emerald-300 break-all font-mono">
                  {setup.totp_secret}
                </code>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Recovery codes (store safely)</p>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {setup.recovery_codes.map((c) => (
                    <code key={c} className="bg-[#111111] rounded px-2 py-1 text-xs text-gray-300 font-mono">{c}</code>
                  ))}
                </div>
              </div>
              <div className="flex items-end gap-2 pt-2">
                <div className="flex-1">
                  <label className="text-[11px] text-muted-foreground">Verification code</label>
                  <input
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-[#111111] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-nova-500"
                  />
                </div>
                <button
                  onClick={() => verifyMutation.mutate()}
                  disabled={verifyMutation.isPending || token.length < 6}
                  className="px-4 py-2 rounded-lg bg-nova-500 text-white text-sm font-medium hover:bg-nova-600 disabled:opacity-50 transition-colors"
                >
                  {verifyMutation.isPending ? 'Verifying…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disable */}
      {enabled && (
        <div className="glass-card p-6 rounded-xl border space-y-3">
          <h2 className="text-lg font-semibold text-white">Disable 2FA</h2>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[11px] text-muted-foreground">Confirm your password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#111111] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-nova-500"
              />
            </div>
            <button
              onClick={() => disableMutation.mutate()}
              disabled={disableMutation.isPending || !password}
              className="px-4 py-2 rounded-lg bg-danger text-white text-sm font-medium hover:bg-danger/80 disabled:opacity-50 transition-colors"
            >
              {disableMutation.isPending ? 'Disabling…' : 'Disable'}
            </button>
          </div>
        </div>
      )}

      {/* Recovery code usage */}
      <div className="glass-card p-6 rounded-xl border space-y-3">
        <h2 className="text-lg font-semibold text-white">Use a recovery code</h2>
        <p className="text-sm text-muted-foreground">
          If you lost access to your authenticator, redeem one of your recovery codes to regain access.
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-[11px] text-muted-foreground">Recovery code</label>
            <input
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              placeholder="XXXXXXXXXXXXXXXX"
              className="w-full bg-[#111111] rounded-lg px-3 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:ring-1 focus:ring-nova-500"
            />
          </div>
          <button
            onClick={() => recoveryMutation.mutate()}
            disabled={recoveryMutation.isPending || recoveryCode.length < 8}
            className="px-4 py-2 rounded-lg bg-surface-2 text-white text-sm font-medium hover:bg-white/10 disabled:opacity-50 transition-colors"
          >
            {recoveryMutation.isPending ? 'Redeeming…' : 'Redeem'}
          </button>
        </div>
      </div>
    </div>
  );
}
