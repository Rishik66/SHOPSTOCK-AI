import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Cloud, 
  RefreshCw, 
  Globe, 
  Store, 
  User, 
  Mail, 
  Tag, 
  LogOut, 
  Check, 
  Wifi, 
  WifiOff, 
  ShieldCheck, 
  Key, 
  Database,
  Calendar,
  AlertCircle,
  Sparkles,
  Bot,
  Eye,
  EyeOff,
  ExternalLink
} from 'lucide-react';
import { useApp, DEMO_USER } from '../context/AppContext';
import { tr } from '../i18n';
import { Language } from '../types';
import { SupabaseModal } from '../components/SupabaseModal';
import { OtpGatewayModal } from '../components/OtpGatewayModal';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { getGeminiApiKey, setGeminiApiKey, isRealAIConfigured, testGeminiApiKey } from '../services/aiService';
import { isEmailJsReady, getEmailJsConfig } from '../services/emailService';
import { isSmsConfigured, getSmsConfig } from '../services/smsService';

export function Settings() {
  const { 
    currentUser, 
    language, 
    setLanguage, 
    autoSyncEnabled, 
    setAutoSyncEnabled, 
    isOnline, 
    lastSyncTime, 
    syncNow, 
    logout, 
    resetDemoData, 
    products, 
    transactions 
  } = useApp();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showOtpGatewayModal, setShowOtpGatewayModal] = useState(false);

  // Real AI (Gemini) State
  const [geminiKeyInput, setGeminiKeyInput] = useState<string>(getGeminiApiKey());
  const [showGeminiKey, setShowGeminiKey] = useState<boolean>(false);
  const [testingGemini, setTestingGemini] = useState<boolean>(false);
  const [geminiStatusMsg, setGeminiStatusMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [isGeminiActive, setIsGeminiActive] = useState<boolean>(isRealAIConfigured());

  const handleSaveGeminiKey = async () => {
    const clean = geminiKeyInput.trim();
    if (!clean) {
      setGeminiApiKey('');
      setIsGeminiActive(false);
      setGeminiStatusMsg({
        text: 'Gemini API key removed. Reverted to Smart Retail AI Engine.',
        success: true
      });
      setTimeout(() => setGeminiStatusMsg(null), 5000);
      return;
    }

    setTestingGemini(true);
    setGeminiStatusMsg(null);

    try {
      const testRes = await testGeminiApiKey(clean);
      if (testRes.success) {
        setGeminiApiKey(clean);
        setIsGeminiActive(true);
        setGeminiStatusMsg({
          text: '✅ Google Gemini Real-Time AI connected successfully! Your assistant will now answer any question with live analysis.',
          success: true
        });
      } else {
        setGeminiStatusMsg({
          text: `❌ ${testRes.message}`,
          success: false
        });
      }
    } catch (err: any) {
      setGeminiStatusMsg({
        text: `❌ Connection error: ${err?.message || 'Check network connection'}`,
        success: false
      });
    } finally {
      setTestingGemini(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const res = await syncNow();
      setSyncStatusMsg({
        text: res.message || (res.success ? 'Successfully synchronized data to Supabase!' : 'Sync failed.'),
        success: res.success
      });
    } catch (err: any) {
      setSyncStatusMsg({
        text: err?.message || 'Sync encountered an unexpected error.',
        success: false
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(null), 6000);
    }
  };

  const handleLogout = () => {
    if (window.confirm(tr(language, 'settings_logout_confirm'))) {
      logout();
    }
  };

  const languagesList: { id: Language; label: string; subLabel: string; flag: string }[] = [
    { id: 'en', label: 'English', subLabel: 'Default Language', flag: '🇺🇸' },
    { id: 'te', label: 'తెలుగు', subLabel: 'Telugu', flag: '🇮🇳' },
    { id: 'hi', label: 'हिन्दी', subLabel: 'Hindi', flag: '🇮🇳' },
    { id: 'kn', label: 'ಕನ್ನಡ', subLabel: 'Kannada', flag: '🇮🇳' },
  ];

  const formatLastSync = (isoString: string | null) => {
    if (!isoString) return 'Not synced yet in this session';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 
        ' (' + date.toLocaleDateString() + ')';
    } catch {
      return isoString;
    }
  };

  const cloudConfigured = isSupabaseConfigured();

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Banner / Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <SettingsIcon size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {tr(language, 'settings_title')}
            </h1>
            <p className="text-sm text-gray-500">
              Manage automatic cloud sync, store language, and shopkeeper profile.
            </p>
          </div>
        </div>

        {/* Live Network & Cloud Pill */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
            isOnline 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            {isOnline ? <Wifi size={13} className="text-emerald-600" /> : <WifiOff size={13} className="text-rose-600" />}
            <span>{isOnline ? tr(language, 'settings_network_online') : tr(language, 'settings_network_offline')}</span>
          </div>

          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
            cloudConfigured 
              ? 'bg-blue-50 text-blue-700 border-blue-200' 
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            <Cloud size={13} className={cloudConfigured ? 'text-blue-600' : 'text-amber-600'} />
            <span>{cloudConfigured ? 'Supabase Active' : 'Cloud Setup Needed'}</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: SUPABASE CLOUD & AUTOMATIC SYNC */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Cloud size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                {tr(language, 'settings_cloud_title')}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Real-time multi-device cloud synchronization with Supabase PostgreSQL database.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <Key size={13} />
            <span className="hidden sm:inline">{tr(language, 'settings_cloud_config')}</span>
            <span className="sm:hidden">API Keys</span>
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Main User Requested Feature: AUTO-SYNC TOGGLE */}
          <div className="p-4 sm:p-5 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900 text-sm sm:text-base">
                    {tr(language, 'settings_auto_sync_label')}
                  </span>
                  <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    autoSyncEnabled 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    {autoSyncEnabled ? 'Auto-Sync ON' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                  {tr(language, 'settings_auto_sync_desc')}
                </p>
              </div>

              {/* iOS / modern style switch toggle */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-8 bg-gray-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>

          {/* Sync Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-500 font-medium">Network Connection</div>
                <div className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                  {isOnline ? 'Internet Online' : 'No Internet (Offline)'}
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-500 font-medium">Supabase Cloud</div>
                <div className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                  {cloudConfigured ? 'Connected & Verified' : 'Setup Required'}
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Database size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-500 font-medium">Last Synced</div>
                <div className="text-xs font-bold text-gray-900 truncate" title={lastSyncTime || ''}>
                  {formatLastSync(lastSyncTime)}
                </div>
              </div>
            </div>
          </div>

          {/* Sync Trigger and Notification */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="text-xs text-gray-500">
              <span>Local Store: </span>
              <strong className="text-gray-800">{products.length}</strong> products,{' '}
              <strong className="text-gray-800">{transactions.length}</strong> recorded sales.
            </div>

            <button
              onClick={handleManualSync}
              disabled={isSyncing || !isOnline}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm shadow-xs transition-all cursor-pointer ${
                isSyncing || !isOnline
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98'
              }`}
            >
              <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Synchronizing...' : tr(language, 'settings_sync_now')}</span>
            </button>
          </div>

          {syncStatusMsg && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
              syncStatusMsg.success 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              {syncStatusMsg.success ? <Check size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
              <span>{syncStatusMsg.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: REAL-TIME AI CHATBOT & GOOGLE GEMINI ENGINE */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>Real-Time AI Assistant Engine (Google Gemini)</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  isGeminiActive ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'
                }`}>
                  {isGeminiActive ? 'Gemini Live Active' : 'Smart Retail Engine'}
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Sync with real AI to enable open conversational chatting, live sales analysis, and customized growth ideas.
              </p>
            </div>
          </div>

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <span>Get Free API Key</span>
            <ExternalLink size={13} />
          </a>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm text-slate-700 space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-2">
              <Bot size={16} className="text-purple-600" />
              <span>How Real AI Sync Works in ShopStock AI:</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-600 text-xs sm:text-sm">
              <li><strong>Open-Ended Conversations:</strong> Ask anything—not just fixed commands, but advice, explanations, and customer strategies.</li>
              <li><strong>Deep Sales & Data Analysis:</strong> The AI examines your real-time stock levels, today's sales, and slow-moving products to recommend bundle combos and pricing.</li>
              <li><strong>Fluent Multilingual Voice:</strong> Speaks and understands Telugu, Hindi, Kannada, and English.</li>
              <li><strong>100% Free:</strong> Google Gemini provides a free tier with no credit card required.</li>
            </ul>
          </div>

          {/* API Key Form */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Google Gemini API Key
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  placeholder="Paste your Gemini API key (AIzaSy...)"
                  className="w-full bg-slate-50 border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-purple-600 focus:bg-white p-3 pr-10 outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                >
                  {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveGeminiKey}
                  disabled={testingGemini}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={15} className={testingGemini ? 'animate-spin' : ''} />
                  <span>{testingGemini ? 'Verifying...' : 'Save & Test Key'}</span>
                </button>

                {isGeminiActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setGeminiKeyInput('');
                      setGeminiApiKey('');
                      setIsGeminiActive(false);
                      setGeminiStatusMsg({ text: 'Reverted to Built-in Smart Retail AI Engine.', success: true });
                    }}
                    className="px-3 py-3 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100 text-xs font-bold transition-all cursor-pointer"
                  >
                    Clear Key
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Test Status Feedback */}
          {geminiStatusMsg && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
              geminiStatusMsg.success 
                ? 'bg-purple-50 text-purple-900 border-purple-200' 
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}>
              {geminiStatusMsg.success ? <Check size={16} className="text-purple-600 shrink-0" /> : <AlertCircle size={16} className="text-rose-600 shrink-0" />}
              <span>{geminiStatusMsg.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: LANGUAGE SELECTION */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Globe size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                {tr(language, 'settings_lang_title')}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                {tr(language, 'settings_lang_desc')}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {languagesList.map((item) => {
              const isSelected = language === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setLanguage(item.id)}
                  className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{item.flag}</span>
                    {isSelected && (
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-xs">
                        <Check size={14} />
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-base font-bold text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.subLabel}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 3: STORE & ACCOUNT PROFILE */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Store size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                {tr(language, 'settings_profile_title')}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Details associated with your registered store account.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-1">
                <Store size={13} />
                <span>Shop Name</span>
              </div>
              <div className="text-sm font-bold text-gray-900 truncate">
                {currentUser?.shopName || 'ShopStock Store'}
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-1">
                <User size={13} />
                <span>Owner Name</span>
              </div>
              <div className="text-sm font-bold text-gray-900 truncate">
                {currentUser?.ownerName || 'Store Owner'}
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-1">
                <Mail size={13} />
                <span>Email Address</span>
              </div>
              <div className="text-sm font-bold text-gray-900 truncate">
                {currentUser?.email || 'owner@store.local'}
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-1">
                <Tag size={13} />
                <span>Category</span>
              </div>
              <div className="text-sm font-bold text-gray-900 truncate">
                {currentUser?.category || 'Retail Store'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: REAL-TIME OTP GATEWAY (EMAILJS & SMS) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Key size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>OTP Delivery Gateway (EmailJS & SMS)</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  isEmailJsReady() ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                }`}>
                  {isEmailJsReady() ? 'EmailJS Connected' : 'Setup Needed'}
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Configure real-time dispatch of verification codes to personal Gmail/Email inboxes or mobile SMS.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowOtpGatewayModal(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Key size={13} />
            <span>Configure Gateway</span>
          </button>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Mail size={14} className="text-blue-600" /> Personal Email (EmailJS)
                </span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  isEmailJsReady() ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                }`}>
                  {isEmailJsReady() ? 'Active' : 'Missing Service/Template ID'}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Delivers 6-digit OTP codes directly to user Gmail / Email inboxes.
              </p>
              <div className="text-[11px] font-mono text-slate-500 bg-white p-2 rounded border border-slate-200 truncate">
                Public Key: {getEmailJsConfig().publicKey || 'Not set'}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Key size={14} className="text-indigo-600" /> Mobile SMS Gateway
                </span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  isSmsConfigured() ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                }`}>
                  {isSmsConfigured() ? 'Active' : 'Optional (Fast2SMS/Twilio)'}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Sends OTP text messages directly to Indian mobile phone numbers (+91).
              </p>
              <div className="text-[11px] font-mono text-slate-500 bg-white p-2 rounded border border-slate-200 truncate">
                Provider: {getSmsConfig().provider !== 'none' ? getSmsConfig().provider.toUpperCase() : 'None configured'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5: ACCOUNT SESSION & LOGOUT */}
      <div className="bg-white rounded-2xl border border-rose-200/80 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <LogOut size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                {tr(language, 'settings_logout')}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Securely sign out of your account on this device. Your data remains safely backed up in Supabase.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {currentUser?.id === DEMO_USER.id && (
              <button
                onClick={() => {
                  if (window.confirm(tr(language, 'resetConfirm'))) {
                    resetDemoData();
                  }
                }}
                className="px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold text-xs transition-colors cursor-pointer"
              >
                {tr(language, 'reset')}
              </button>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-xs transition-all cursor-pointer active:scale-98"
            >
              <LogOut size={16} />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Supabase Configuration Modal */}
      <SupabaseModal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} />

      {/* OTP Delivery Gateway Modal */}
      <OtpGatewayModal isOpen={showOtpGatewayModal} onClose={() => setShowOtpGatewayModal(false)} />
    </div>
  );
}
