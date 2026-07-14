const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const AuditService = require('../services/audit.service');

function hashRecoveryCodes(codes) {
  return codes.map(code => crypto.createHash('sha256').update(code).digest('hex'));
}

function generateRecoveryCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(16).toString('hex').slice(0, 16).toUpperCase());
  }
  return codes;
}

class TwoFactorService {
  async getSecurityRecord(userId) {
    const { data, error } = await supabaseAdmin
      .from('admin_security')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async enable(userId) {
    const secret = speakeasy.generateSecret({
      name: `Nova Store (${userId.slice(0, 8)})`,
      issuer: 'Nova Store',
      length: 32,
    });

    const recoveryCodes = generateRecoveryCodes();

    const record = {
      user_id: userId,
      two_factor_enabled: true,
      totp_secret: secret.base32,
      recovery_codes: hashRecoveryCodes(recoveryCodes),
      backup_codes_used: 0,
      last_verified_at: null,
    };

    const { data, error } = await supabaseAdmin
      .from('admin_security')
      .upsert([record], { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;

    await supabaseAdmin
      .from('users')
      .update({ two_factor_enabled: true })
      .eq('id', userId);

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    AuditService.logRaw({
      action: 'security.2fa.enabled',
      userId,
      severity: 'info',
      actionType: 'UPDATE',
    });

    return {
      totp_secret: secret.base32,
      otpauth_url: secret.otpauth_url,
      qr_code_url: qrCodeUrl,
      recovery_codes: recoveryCodes,
    };
  }

  async verify(userId, token) {
    const record = await this.getSecurityRecord(userId);
    if (!record || !record.totp_secret) {
      return { verified: false, reason: '2FA not enabled' };
    }

    const verified = speakeasy.totp.verify({
      secret: record.totp_secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (verified) {
      await supabaseAdmin
        .from('admin_security')
        .update({ last_verified_at: new Date().toISOString() })
        .eq('user_id', userId);

      AuditService.logRaw({
        action: 'security.2fa.verified',
        userId,
        severity: 'info',
        actionType: 'LOGIN',
      });
    }

    return { verified };
  }

  async disable(userId, passwordMatch) {
    if (!passwordMatch) {
      throw new Error('Password confirmation required');
    }

    const { error } = await supabaseAdmin
      .from('admin_security')
      .update({
        two_factor_enabled: false,
        totp_secret: null,
        recovery_codes: null,
        backup_codes_used: 0,
        last_verified_at: null,
      })
      .eq('user_id', userId);

    if (error) throw error;

    await supabaseAdmin
      .from('users')
      .update({ two_factor_enabled: false })
      .eq('id', userId);

    AuditService.logRaw({
      action: 'security.2fa.disabled',
      userId,
      severity: 'warning',
      actionType: 'UPDATE',
    });

    return { disabled: true };
  }

  async useRecoveryCode(userId, code) {
    const record = await this.getSecurityRecord(userId);
    if (!record || !record.recovery_codes) {
      return { success: false, reason: 'No recovery codes available' };
    }

    const hashed = crypto.createHash('sha256').update(code).digest('hex');
    const codes = record.recovery_codes || [];
    const idx = codes.findIndex(c => c === hashed);

    if (idx === -1) {
      AuditService.logRaw({
        action: 'security.2fa.recovery_failed',
        userId,
        severity: 'warning',
        actionType: 'LOGIN',
      });
      return { success: false, reason: 'Invalid recovery code' };
    }

    const updatedCodes = codes.filter((_, i) => i !== idx);
    const usedCount = (record.backup_codes_used || 0) + 1;

    await supabaseAdmin
      .from('admin_security')
      .update({
        recovery_codes: updatedCodes,
        backup_codes_used: usedCount,
        last_verified_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    AuditService.logRaw({
      action: 'security.2fa.recovery_used',
      userId,
      severity: 'warning',
      actionType: 'LOGIN',
    });

    return { success: true, remaining: updatedCodes.length };
  }

  async getStatus(userId) {
    const record = await this.getSecurityRecord(userId);
    if (!record) {
      return { enabled: false };
    }
    return {
      enabled: record.two_factor_enabled,
      last_verified_at: record.last_verified_at,
      recovery_codes_remaining: (record.recovery_codes || []).length,
      backup_codes_used: record.backup_codes_used || 0,
    };
  }
}

module.exports = new TwoFactorService();
