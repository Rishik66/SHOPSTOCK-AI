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
  AlertCircle
} from 'lucide-react';
import { useApp, DEMO_USER } from '../context/AppContext';
import { tr } from '../i18n';
import { Language } from '../types';
import { SupabaseModal } from '../components/SupabaseModal';
import { isSupabaseConfigured } from '../services/supabaseClient';

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

      {/* SECTION 2: LANGUAGE SELECTION */}
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

      {/* SECTION 4: ACCOUNT SESSION & LOGOUT */}
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
    </div>
  );
}
