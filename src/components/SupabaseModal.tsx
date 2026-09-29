import React, { useState, useEffect } from 'react';
import { Cloud, CheckCircle, AlertCircle, RefreshCw, Copy, Check, ExternalLink, X, Database, ShieldCheck, Key } from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig, testSupabaseConnection, isSupabaseConfigured } from '../services/supabaseClient';
import { syncAllToSupabase } from '../services/supabaseSyncService';
import { useApp } from '../context/AppContext';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCHEMA = `-- 1. Create shop_users table (stores shop owner profiles & credentials)
CREATE TABLE IF NOT EXISTS public.shop_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  category TEXT DEFAULT 'General Store',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create shop_products table (stores inventory items scoped by user_id)
CREATE TABLE IF NOT EXISTS public.shop_products (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.shop_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  purchase_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  minimum_stock INTEGER NOT NULL DEFAULT 5,
  barcode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create shop_transactions table (stores sales & profit records)
CREATE TABLE IF NOT EXISTS public.shop_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.shop_users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  profit NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.shop_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_transactions ENABLE ROW LEVEL SECURITY;

-- 5. Create Permissive Policies
DROP POLICY IF EXISTS "Allow public all on shop_users" ON public.shop_users;
CREATE POLICY "Allow public all on shop_users" ON public.shop_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on shop_products" ON public.shop_products;
CREATE POLICY "Allow public all on shop_products" ON public.shop_products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on shop_transactions" ON public.shop_transactions;
CREATE POLICY "Allow public all on shop_transactions" ON public.shop_transactions FOR ALL USING (true) WITH CHECK (true);`;

export function SupabaseModal({ isOpen, onClose }: SupabaseModalProps) {
  const { currentUser, products, transactions, addNotification } = useApp();

  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = getSupabaseConfig();
      setUrl(config.url);
      setKey(config.key);
      setIsConnected(isSupabaseConfigured());
      setStatusMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setStatusMsg(null);
    const res = await testSupabaseConnection(url, key);
    setTesting(false);
    setStatusMsg(res);
  };

  const handleSave = async () => {
    if (!url.trim() || !key.trim()) {
      setStatusMsg({ success: false, message: 'Please enter both Project URL and Anon API Key.' });
      return;
    }

    setTesting(true);
    setStatusMsg(null);
    const res = await testSupabaseConnection(url, key);
    setTesting(false);

    if (res.success) {
      saveSupabaseConfig(url, key);
      setIsConnected(true);
      setStatusMsg({ success: true, message: 'Supabase connected and saved!' });
      addNotification({ type: 'success', message: 'Connected to Supabase Cloud Database!' });

      // Automatically sync current store data
      if (currentUser) {
        setSyncing(true);
        const syncRes = await syncAllToSupabase(currentUser, products, transactions);
        setSyncing(false);
        if (syncRes.success) {
          setStatusMsg({ success: true, message: 'Connected & all data synced with Supabase!' });
        }
      }
    } else {
      setStatusMsg(res);
    }
  };

  const handleSyncNow = async () => {
    if (!currentUser) return;
    setSyncing(true);
    setStatusMsg(null);
    const res = await syncAllToSupabase(currentUser, products, transactions);
    setSyncing(false);
    setStatusMsg(res);
    if (res.success) {
      addNotification({ type: 'success', message: 'All products & sales synced to Supabase!' });
    }
  };

  const handleDisconnect = () => {
    if (window.confirm('Disconnect from Supabase? The app will continue in offline LocalStorage mode.')) {
      clearSupabaseConfig();
      setUrl('');
      setKey('');
      setIsConnected(false);
      setStatusMsg({ success: true, message: 'Disconnected. Using LocalStorage.' });
      addNotification({ type: 'info', message: 'Switched to LocalStorage mode.' });
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-in">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-800 p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 backdrop-blur-md rounded-2xl shadow-inner">
              <Database className="text-white" size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">Supabase Cloud Database</h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isConnected ? 'bg-emerald-400 text-slate-950' : 'bg-amber-400 text-slate-950'
                }`}>
                  {isConnected ? 'Connected' : 'Local Mode'}
                </span>
              </div>
              <p className="text-xs text-emerald-100">
                Sync login, products, and sales across laptop and mobile
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">

          {/* Status Message Banner */}
          {statusMsg && (
            <div className={`p-3 rounded-2xl border flex items-start gap-2.5 animate-fade-in ${
              statusMsg.success 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {statusMsg.success ? (
                <CheckCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 font-semibold leading-relaxed">
                {statusMsg.message}
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Supabase Project URL
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="https://your-project.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-xs text-gray-900 transition-all"
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Found in Supabase: <span className="font-semibold text-gray-700">Project Settings → API → Project URL</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Supabase Anon Public API Key
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-xs text-gray-900 transition-all"
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Found in Supabase: <span className="font-semibold text-gray-700">Project Settings → API → Project API Keys → anon public</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={testing || syncing}
              className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              {testing ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              <span>{isConnected ? 'Update & Sync' : 'Save & Connect'}</span>
            </button>

            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !url.trim()}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              {testing ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
              <span>Test Ping</span>
            </button>

            {isConnected && (
              <>
                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  title="Push all local products and sales to Supabase"
                >
                  <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                  <span>Sync Now</span>
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-3 py-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  title="Disconnect"
                >
                  Disconnect
                </button>
              </>
            )}
          </div>

          {/* Quick Setup Instructions & SQL Schema */}
          <div className="pt-3 border-t border-gray-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Database size={13} className="text-emerald-600" />
                <span>Supabase Setup (30 Seconds)</span>
              </span>
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-1 font-semibold"
              >
                <span>supabase.com</span>
                <ExternalLink size={11} />
              </a>
            </div>

            <ol className="list-decimal list-inside space-y-1 text-gray-600 text-[11px] leading-relaxed">
              <li>Create a free project at <span className="font-semibold text-gray-800">supabase.com</span>.</li>
              <li>Go to <span className="font-semibold text-gray-800">SQL Editor</span> and run the schema below to create the 3 tables.</li>
              <li>Copy your <span className="font-semibold text-gray-800">Project URL</span> & <span className="font-semibold text-gray-800">anon public key</span> above and click Connect!</li>
            </ol>

            {/* SQL Schema Accordion */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowSql(!showSql)}
                className="w-full flex items-center justify-between p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <span>{showSql ? 'Hide SQL Schema' : 'View & Copy SQL Schema'}</span>
                <span className="text-[10px] text-gray-500">{showSql ? '▲' : '▼'}</span>
              </button>

              {showSql && (
                <div className="mt-2 relative">
                  <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-[10px] font-mono overflow-x-auto max-h-48 border border-slate-800 leading-snug">
                    {SQL_SCHEMA}
                  </pre>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="absolute top-2 right-2 px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-md transition-all cursor-pointer"
                  >
                    {copiedSql ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedSql ? 'Copied!' : 'Copy SQL'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
