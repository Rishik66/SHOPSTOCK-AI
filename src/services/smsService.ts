const SMS_CONFIG_KEY = 'ss_sms_config';

export interface SmsConfig {
  provider: 'fast2sms' | 'twilio' | 'none';
  fast2SmsApiKey?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
}

export function getSmsConfig(): SmsConfig {
  try {
    const raw = localStorage.getItem(SMS_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}

  return {
    provider: (import.meta as any).env?.VITE_SMS_PROVIDER || 'none',
    fast2SmsApiKey: (import.meta as any).env?.VITE_FAST2SMS_API_KEY || '',
    twilioAccountSid: (import.meta as any).env?.VITE_TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: (import.meta as any).env?.VITE_TWILIO_AUTH_TOKEN || '',
    twilioPhoneNumber: (import.meta as any).env?.VITE_TWILIO_PHONE_NUMBER || '',
  };
}

export function saveSmsConfig(config: Partial<SmsConfig>): void {
  const current = getSmsConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(SMS_CONFIG_KEY, JSON.stringify(updated));
}

export function isSmsConfigured(): boolean {
  const cfg = getSmsConfig();
  if (cfg.provider === 'fast2sms') {
    return Boolean(cfg.fast2SmsApiKey);
  }
  if (cfg.provider === 'twilio') {
    return Boolean(cfg.twilioAccountSid && cfg.twilioAuthToken && cfg.twilioPhoneNumber);
  }
  return false;
}

export interface SendSmsParams {
  phoneNumber: string; // 10 digits or with +91
  otpCode: string;
  shopName?: string;
}

/**
 * Dispatches real SMS to user's personal mobile phone
 */
export async function sendOtpViaSms(params: SendSmsParams): Promise<{ success: boolean; error?: string }> {
  const config = getSmsConfig();
  const rawDigits = params.phoneNumber.replace(/\D/g, '');
  const tenDigits = rawDigits.slice(-10);

  if (tenDigits.length !== 10) {
    return { success: false, error: 'Invalid 10-digit mobile number for SMS delivery.' };
  }

  // 1. Fast2SMS Provider (India quick SMS & OTP)
  if (config.provider === 'fast2sms' && config.fast2SmsApiKey) {
    try {
      const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(
        config.fast2SmsApiKey
      )}&route=otp&variables_values=${encodeURIComponent(params.otpCode)}&flash=0&numbers=${tenDigits}`;

      const res = await fetch(url, { method: 'GET' });
      const data = await res.json();
      if (data && (data.return === true || data.status_code === 200)) {
        return { success: true };
      } else {
        return { success: false, error: data?.message?.[0] || 'Fast2SMS delivery notice.' };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error while reaching Fast2SMS gateway.' };
    }
  }

  // 2. Twilio Provider
  if (config.provider === 'twilio' && config.twilioAccountSid && config.twilioAuthToken) {
    try {
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`;
      const body = new URLSearchParams({
        To: `+91${tenDigits}`,
        From: config.twilioPhoneNumber || '',
        Body: `Your ShopStock AI verification code is ${params.otpCode}. Valid for 10 minutes.`,
      });

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`${config.twilioAccountSid}:${config.twilioAuthToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await res.json();
      if (res.ok) {
        return { success: true };
      } else {
        return { success: false, error: data?.message || 'Twilio SMS dispatch failed.' };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error contacting Twilio.' };
    }
  }

  return {
    success: false,
    error: 'No active SMS Gateway is configured. Please provide a Fast2SMS or Twilio API key in SMS Settings.'
  };
}
