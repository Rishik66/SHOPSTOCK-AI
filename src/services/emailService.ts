import emailjs from '@emailjs/browser';

const EMAILJS_CONFIG_KEY = 'ss_emailjs_config';

export interface EmailJsConfig {
  publicKey: string;
  serviceId: string;
  templateId: string;
}

// User-provided public key for emailjs.com
export const DEFAULT_EMAILJS_PUBLIC_KEY = '-N8FcrZvABffbiYcI';

/**
 * Retrieves the current EmailJS configuration from LocalStorage, environment, or defaults
 */
export function getEmailJsConfig(): EmailJsConfig {
  try {
    const raw = localStorage.getItem(EMAILJS_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        publicKey: parsed.publicKey || DEFAULT_EMAILJS_PUBLIC_KEY,
        serviceId: parsed.serviceId || (import.meta as any).env?.VITE_EMAILJS_SERVICE_ID || '',
        templateId: parsed.templateId || (import.meta as any).env?.VITE_EMAILJS_TEMPLATE_ID || '',
      };
    }
  } catch {}

  return {
    publicKey: (import.meta as any).env?.VITE_EMAILJS_PUBLIC_KEY || DEFAULT_EMAILJS_PUBLIC_KEY,
    serviceId: (import.meta as any).env?.VITE_EMAILJS_SERVICE_ID || '',
    templateId: (import.meta as any).env?.VITE_EMAILJS_TEMPLATE_ID || '',
  };
}

/**
 * Saves EmailJS configuration to LocalStorage
 */
export function saveEmailJsConfig(config: Partial<EmailJsConfig>): void {
  const current = getEmailJsConfig();
  const updated = {
    ...current,
    ...config,
    publicKey: config.publicKey !== undefined ? config.publicKey : current.publicKey,
  };
  localStorage.setItem(EMAILJS_CONFIG_KEY, JSON.stringify(updated));
}

/**
 * Checks if EmailJS is fully configured with Service ID and Template ID
 */
export function isEmailJsReady(): boolean {
  const cfg = getEmailJsConfig();
  return Boolean(cfg.publicKey && cfg.serviceId && cfg.templateId);
}

export interface SendOtpParams {
  toEmail: string;
  toName: string;
  otpCode: string;
  shopName?: string;
}

/**
 * Dispatches a real OTP email directly to the recipient's personal inbox via EmailJS
 */
export async function sendOtpViaEmail(params: SendOtpParams): Promise<{ success: boolean; error?: string }> {
  const config = getEmailJsConfig();

  if (!config.publicKey) {
    return { success: false, error: 'EmailJS Public Key is missing.' };
  }

  if (!config.serviceId || !config.templateId) {
    return {
      success: false,
      error: 'EmailJS Service ID or Template ID is missing. Please provide your Service ID and Template ID from emailjs.com.'
    };
  }

  try {
    // Template parameters mapped to all common template variable names
    const templateParams: Record<string, unknown> = {
      to_email: params.toEmail,
      email: params.toEmail,
      user_email: params.toEmail,
      recipient_email: params.toEmail,
      to_name: params.toName || 'Store Owner',
      user_name: params.toName || 'Store Owner',
      otp_code: params.otpCode,
      otp: params.otpCode,
      passcode: params.otpCode,
      shop_name: params.shopName || 'ShopStock AI Store',
      message: `Your ShopStock AI verification code is ${params.otpCode}. Valid for 10 minutes.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const response = await emailjs.send(
      config.serviceId,
      config.templateId,
      templateParams,
      config.publicKey
    );

    if (response.status === 200) {
      return { success: true };
    } else {
      return { success: false, error: `EmailJS responded with status code ${response.status}: ${response.text}` };
    }
  } catch (err: any) {
    console.error('EmailJS dispatch failed:', err);
    return {
      success: false,
      error: err?.text || err?.message || 'Failed to dispatch email via EmailJS.'
    };
  }
}
