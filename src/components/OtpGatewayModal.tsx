import { useState, useEffect } from 'react';
import { Mail, Smartphone, Key, CheckCircle, AlertCircle, X, ExternalLink, HelpCircle } from 'lucide-react';
import { 
  getEmailJsConfig, 
  saveEmailJsConfig, 
  DEFAULT_EMAILJS_PUBLIC_KEY, 
  DEFAULT_EMAILJS_SERVICE_ID,
  isEmailJsReady 
} from '../services/emailService';
import { 
  getSmsConfig, 
  saveSmsConfig, 
  isSmsConfigured 
} from '../services/smsService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function OtpGatewayModal({ isOpen, onClose, onSaved }: Props) {
  const [activeTab, setActiveTab] = useState<'email' | 'sms'>('email');

  // EmailJS fields
  const [publicKey, setPublicKey] = useState(DEFAULT_EMAILJS_PUBLIC_KEY);
  const [serviceId, setServiceId] = useState(DEFAULT_EMAILJS_SERVICE_ID);
  const [templateId, setTemplateId] = useState('');

  // SMS fields
  const [smsProvider, setSmsProvider] = useState<'fast2sms' | 'twilio' | 'none'>('fast2sms');
  const [fast2SmsApiKey, setFast2SmsApiKey] = useState('');
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const emailCfg = getEmailJsConfig();
      setPublicKey(emailCfg.publicKey || DEFAULT_EMAILJS_PUBLIC_KEY);
      setServiceId(emailCfg.serviceId || DEFAULT_EMAILJS_SERVICE_ID);
      setTemplateId(emailCfg.templateId || '');

      const smsCfg = getSmsConfig();
      setSmsProvider(smsCfg.provider || 'fast2sms');
      setFast2SmsApiKey(smsCfg.fast2SmsApiKey || '');
      setTwilioAccountSid(smsCfg.twilioAccountSid || '');
      setTwilioAuthToken(smsCfg.twilioAuthToken || '');
      setTwilioPhoneNumber(smsCfg.twilioPhoneNumber || '');

      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    // Save EmailJS
    saveEmailJsConfig({
      publicKey: publicKey.trim() || DEFAULT_EMAILJS_PUBLIC_KEY,
      serviceId: serviceId.trim(),
      templateId: templateId.trim(),
    });

    // Save SMS
    saveSmsConfig({
      provider: smsProvider,
      fast2SmsApiKey: fast2SmsApiKey.trim(),
      twilioAccountSid: twilioAccountSid.trim(),
      twilioAuthToken: twilioAuthToken.trim(),
      twilioPhoneNumber: twilioPhoneNumber.trim(),
    });

    setSavedSuccess(true);
    if (onSaved) onSaved();
    setTimeout(() => {
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white text-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-200">
              <Key size={20} />
            </div>
            <div>
              <h3 className="font-black text-lg tracking-tight">OTP Delivery Gateway</h3>
              <p className="text-xs text-blue-200">Deliver verification codes directly to real personal inboxes & phones</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 p-2 bg-slate-100 border-b border-slate-200 font-bold text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('email')}
            className={`py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'email' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail size={16} />
            <span>Personal Email (EmailJS)</span>
            {isEmailJsReady() && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sms')}
            className={`py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'sms' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone size={16} />
            <span>Mobile SMS (India)</span>
            {isSmsConfigured() && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 flex-1">
          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle size={16} className="text-emerald-600 shrink-0" />
              <span>Gateway configuration saved successfully!</span>
            </div>
          )}

          {/* TAB 1: EmailJS */}
          {activeTab === 'email' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl text-blue-950 space-y-1.5">
                <div className="font-extrabold flex items-center gap-1.5 text-blue-900">
                  <Mail size={15} /> Real Gmail / Email Delivery Setup
                </div>
                <p className="text-slate-600">
                  When configured, password reset OTPs will arrive in real-time in the user's personal Gmail inbox!
                </p>
                <a
                  href="https://dashboard.emailjs.com/admin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline pt-1"
                >
                  Open EmailJS Dashboard <ExternalLink size={12} />
                </a>
              </div>

              {/* Public Key */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  EmailJS Public Key
                </label>
                <input
                  type="text"
                  required
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder="e.g. -N8FcrZvABffbiYcI"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-mono text-xs focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Your registered Public Key from Account $\to$ General in EmailJS.
                </p>
              </div>

              {/* Service ID */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  EmailJS Service ID
                </label>
                <input
                  type="text"
                  required
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  placeholder="e.g. service_xxxxxxx (or service_gmail)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-mono text-xs focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Found in EmailJS under <strong>Email Services</strong> tab (click on your Gmail connection).
                </p>
              </div>

              {/* Template ID */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  EmailJS Template ID
                </label>
                <input
                  type="text"
                  required
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  placeholder="e.g. template_xxxxxxx"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-mono text-xs focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Found in EmailJS under <strong>Email Templates</strong> tab.
                </p>
              </div>

              {/* Template Setup Guide */}
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-[11px] text-slate-700 space-y-1">
                <div className="font-bold flex items-center gap-1 text-slate-800">
                  <HelpCircle size={13} className="text-blue-600" />
                  Email Template Settings:
                </div>
                <div>• In your template, set <strong>To Email</strong>: <code className="bg-white px-1 py-0.5 rounded font-mono border text-blue-700">{'{{to_email}}'}</code></div>
                <div>• Subject: <code className="bg-white px-1 py-0.5 rounded font-mono border">ShopStock AI Verification: {'{{otp_code}}'}</code></div>
                <div>• Content: <code className="bg-white px-1 py-0.5 rounded font-mono border">Hello {'{{to_name}}'}, your OTP is {'{{otp_code}}'}.</code></div>
              </div>
            </div>
          )}

          {/* TAB 2: SMS */}
          {activeTab === 'sms' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-2xl text-indigo-950 space-y-1.5">
                <div className="font-extrabold flex items-center gap-1.5 text-indigo-900">
                  <Smartphone size={15} /> Real Mobile SMS Delivery (India)
                </div>
                <p className="text-slate-600">
                  Connect <strong>Fast2SMS</strong> (fastest for India) or <strong>Twilio</strong> to send SMS directly to personal mobile phone inboxes.
                </p>
              </div>

              {/* Provider selector */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  SMS Provider
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSmsProvider('fast2sms')}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs text-center transition-all cursor-pointer ${
                      smsProvider === 'fast2sms'
                        ? 'bg-blue-50 border-blue-600 text-blue-700'
                        : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🇮🇳 Fast2SMS (India)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSmsProvider('twilio')}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs text-center transition-all cursor-pointer ${
                      smsProvider === 'twilio'
                        ? 'bg-blue-50 border-blue-600 text-blue-700'
                        : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🌐 Twilio SMS
                  </button>
                </div>
              </div>

              {smsProvider === 'fast2sms' && (
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Fast2SMS API Authorization Key
                  </label>
                  <input
                    type="text"
                    value={fast2SmsApiKey}
                    onChange={(e) => setFast2SmsApiKey(e.target.value)}
                    placeholder="Enter Fast2SMS API Key"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-mono text-xs focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                    <span>Free credits available on signup</span>
                    <a
                      href="https://www.fast2sms.com/dashboard/dev-api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-bold"
                    >
                      Get Fast2SMS API Key $\to$
                    </a>
                  </div>
                </div>
              )}

              {smsProvider === 'twilio' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Twilio Account SID
                    </label>
                    <input
                      type="text"
                      value={twilioAccountSid}
                      onChange={(e) => setTwilioAccountSid(e.target.value)}
                      placeholder="ACxxxxxxxxxxxxxxxx"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-mono text-xs focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Twilio Auth Token
                    </label>
                    <input
                      type="password"
                      value={twilioAuthToken}
                      onChange={(e) => setTwilioAuthToken(e.target.value)}
                      placeholder="Auth Token"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-mono text-xs focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Twilio Phone Number
                    </label>
                    <input
                      type="text"
                      value={twilioPhoneNumber}
                      onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                      placeholder="+1xxxxxxxxxx"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-mono text-xs focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              Save Gateway Settings
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
