import React, { useState } from 'react';
import { Store, User, Lock, Mail, ArrowRight, ShieldCheck, Sparkles, Globe } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Language } from '../types';

export function AuthPage() {
  const { login, signup, loginDemo, language, setLanguage } = useApp();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  
  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup fields
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [category, setCategory] = useState('Grocery / Kirana');

  const [error, setError] = useState<string | null>(null);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError('Please fill in both email and password.');
      return;
    }
    const res = login(loginEmail, loginPassword);
    if (!res.success) {
      setError(res.error || 'Failed to login');
    }
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!shopName.trim() || !ownerName.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      setError('Please complete all fields.');
      return;
    }
    if (signupPassword.length < 4) {
      setError('Password should be at least 4 characters.');
      return;
    }
    const res = signup({
      shopName: shopName.trim(),
      ownerName: ownerName.trim(),
      email: signupEmail.trim(),
      password: signupPassword,
      category
    });
    if (!res.success) {
      setError(res.error || 'Failed to register');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Bar with Language Selector */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-blue-500/30">
            S
          </div>
          <div>
            <h1 className="font-extrabold text-xl tracking-tight text-white">SHOPSTOCK AI</h1>
            <p className="text-xs text-blue-300 font-medium hidden sm:block">Smart retail management for Indian Kirana & Stores</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
          <Globe size={16} className="text-blue-300" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            aria-label="Language"
            className="bg-transparent text-sm text-white font-medium outline-none cursor-pointer"
          >
            <option value="en" className="text-slate-900">English</option>
            <option value="te" className="text-slate-900">తెలుగు (Telugu)</option>
            <option value="hi" className="text-slate-900">हिन्दी (Hindi)</option>
            <option value="kn" className="text-slate-900">ಕನ್ನಡ (Kannada)</option>
          </select>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-md w-full mx-auto my-8">
        <div className="bg-white/95 text-slate-900 rounded-3xl shadow-2xl p-6 sm:p-8 border border-white/20 backdrop-blur-xl">
          
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {mode === 'login' ? 'Welcome Back!' : 'Start Your Smart Store'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {mode === 'login' 
                ? 'Sign in to access your personal store inventory and sales.' 
                : 'Create your private account. Only you can view your store data.'}
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl mb-6 font-semibold text-sm">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`py-2.5 rounded-xl transition-all ${mode === 'login' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); }}
              className={`py-2.5 rounded-xl transition-all ${mode === 'signup' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Create Account
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <span className="font-bold">⚠️</span> {error}
            </div>
          )}

          {/* Sign In Form */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="e.g. ravi@store.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all mt-2"
              >
                Sign In to My Shop <ArrowRight size={18} />
              </button>
            </form>
          )}

          {/* Sign Up Form */}
          {mode === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Shop / Store Name
                </label>
                <div className="relative">
                  <Store size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="e.g. Lakshmi Kirana Store"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Owner's Name
                </label>
                <div className="relative">
                  <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="e.g. ramesh@gmail.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Create a secure password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Store Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                >
                  <option value="Grocery / Kirana">Grocery / Kirana</option>
                  <option value="General Store">General Store</option>
                  <option value="Dairy & Milk">Dairy & Milk</option>
                  <option value="Bakery & Sweets">Bakery & Sweets</option>
                  <option value="Supermarket">Supermarket</option>
                  <option value="Other Retail">Other Retail</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all mt-3"
              >
                Create My Account <ArrowRight size={18} />
              </button>
            </form>
          )}

          {/* Quick Demo Access Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <span className="relative bg-white px-3 text-xs font-bold text-slate-400 uppercase tracking-wider">or instant demo</span>
          </div>

          {/* 1-Click Demo Login Button for Judges */}
          <button
            type="button"
            onClick={loginDemo}
            className="w-full py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Sparkles size={18} className="text-emerald-600" />
            1-Click Demo (Ravi General Store)
          </button>

          {/* Privacy & Isolation badge */}
          <div className="mt-6 flex items-start gap-2 text-[11px] text-slate-600 bg-slate-100 p-3 rounded-xl border border-slate-200">
            <ShieldCheck size={16} className="text-emerald-700 shrink-0 mt-0.5" />
            <span>
              <strong>Private & Isolated Data:</strong> Your inventory, prices, and profits are strictly private to your account. Other shop owners cannot see or access your store data.
            </span>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-blue-300/80 font-medium">
        ShopStock AI — “Scan. Speak. Sell. ShopStock handles the rest.”
      </div>
    </div>
  );
}
