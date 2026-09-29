import React, { useState, useEffect, useRef } from 'react';
import { 
  Store, User, Lock, Mail, Phone, ArrowRight, ShieldCheck, 
  Sparkles, Globe, Eye, EyeOff, Check, UserCheck, Cloud, 
  RefreshCw, Key, ArrowLeft, Smartphone, CheckCircle, AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Language, UserAccount } from '../types';
import { getRegisteredUsers } from '../utils/storage';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { SupabaseModal } from '../components/SupabaseModal';

export function AuthPage() {
  const { 
    login, 
    signup, 
    loginDemo, 
    language, 
    setLanguage, 
    findUserAccount, 
    resetPassword,
    addNotification 
  } = useApp();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  
  // Login fields
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Signup fields
  const [signupMethod, setSignupMethod] = useState<'mobile' | 'email'>('mobile');
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [category, setCategory] = useState('Grocery / Kirana');

  // Forgot Password fields & step wizard
  const [forgotStep, setForgotStep] = useState<'identifier' | 'otp' | 'new-password' | 'success'>('identifier');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [targetUser, setTargetUser] = useState<UserAccount | null>(null);
  const [generatedOtp, setGeneratedOtp] = useState<string>('');
  const [enteredOtp, setEnteredOtp] = useState<string>('');
  const [otpSentDestination, setOtpSentDestination] = useState<string>('');
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [simulatedNotification, setSimulatedNotification] = useState<{ message: string; otp: string } | null>(null);

  const [savedUsers, setSavedUsers] = useState<UserAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Load saved accounts on mount
  useEffect(() => {
    const list = getRegisteredUsers();
    setSavedUsers(list);
    const nonDemo = list.filter(u => u.id !== 'demo_ravi');
    if (nonDemo.length > 0 && !loginIdentifier) {
      setLoginIdentifier(nonDemo[0].phone || nonDemo[0].email || nonDemo[0].ownerName);
    }
  }, [mode]);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // 1. Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setError('Please enter your mobile number or email, and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await login(loginIdentifier.trim(), loginPassword);
      if (!res.success) {
        setError(res.error || 'Failed to login');
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Signup (Mobile or Gmail)
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanShop = shopName.trim();
    const cleanOwner = ownerName.trim();
    const cleanPhone = signupPhone.replace(/\D/g, '');
    const cleanEmail = signupEmail.trim();

    if (!cleanShop || !cleanOwner || !signupPassword.trim()) {
      setError('Please complete all required fields.');
      return;
    }

    if (signupMethod === 'mobile') {
      if (!cleanPhone || cleanPhone.length < 10) {
        setError('Please enter a valid 10-digit Indian mobile number.');
        return;
      }
    } else {
      if (!cleanEmail || !cleanEmail.includes('@')) {
        setError('Please enter a valid Gmail / Email address.');
        return;
      }
    }

    if (signupPassword.length < 4) {
      setError('Password should be at least 4 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await signup({
        shopName: cleanShop,
        ownerName: cleanOwner,
        email: cleanEmail || `${cleanPhone}@mobile.shopstock.ai`,
        phone: cleanPhone ? cleanPhone.slice(-10) : undefined,
        password: signupPassword,
        category
      });
      if (!res.success) {
        setError(res.error || 'Failed to register account.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Forgot Password: Step 1 (Send OTP)
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSimulatedNotification(null);

    const clean = forgotIdentifier.trim();
    if (!clean) {
      setError('Please enter your registered mobile number or Gmail ID.');
      return;
    }

    setLoading(true);
    try {
      const user = await findUserAccount(clean);
      if (!user) {
        setError(`No account found for "${clean}". Please check your mobile number / Gmail ID, or create a new account.`);
        return;
      }

      setTargetUser(user);

      // Generate secure 6-digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);

      // Mask destination for privacy display
      let destination = '';
      const cleanDigits = clean.replace(/\D/g, '');
      if (cleanDigits.length >= 10 || user.phone) {
        const ph = user.phone || cleanDigits;
        destination = `+91 ${ph.slice(0, 2)}••••••${ph.slice(-2)}`;
      } else {
        const parts = (user.email || clean).split('@');
        const userPart = parts[0];
        const domain = parts[1] || 'gmail.com';
        destination = `${userPart.slice(0, 2)}••••••@${domain}`;
      }

      setOtpSentDestination(destination);
      setResendCooldown(45); // 45s cooldown
      setForgotStep('otp');

      // Dispatch simulated secure SMS/Email notification banner with auto-fill
      setSimulatedNotification({
        message: `Secure OTP sent to ${destination}`,
        otp: code
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResendOtp = () => {
    if (resendCooldown > 0 || !targetUser) return;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setResendCooldown(45);
    setSimulatedNotification({
      message: `New OTP re-sent to ${otpSentDestination}`,
      otp: code
    });
  };

  // Handle Forgot Password: Step 2 (Verify OTP)
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanInputOtp = enteredOtp.trim();
    if (!cleanInputOtp) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }

    if (cleanInputOtp !== generatedOtp) {
      setError('Incorrect OTP code. Please check the code and try again.');
      return;
    }

    // OTP verified! Proceed to new password
    setSimulatedNotification(null);
    setForgotStep('new-password');
  };

  // Handle Forgot Password: Step 3 (Reset Password & Login)
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || newPassword.length < 4) {
      setError('New password must be at least 4 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    if (!targetUser) {
      setError('Session expired. Please restart the password reset process.');
      setForgotStep('identifier');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(targetUser.id, newPassword);
      if (res.success) {
        addNotification({
          type: 'success',
          message: `Password updated successfully for ${targetUser.shopName}!`
        });

        // Log directly into the account
        await login(targetUser.phone || targetUser.email || targetUser.ownerName, newPassword);
      } else {
        setError(res.error || 'Failed to update password.');
      }
    } finally {
      setLoading(false);
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSupabaseModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer backdrop-blur-md ${
              isSupabaseConfigured()
                ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/35'
                : 'bg-white/10 text-white/90 border-white/20 hover:bg-white/20'
            }`}
            title="Cloud Database Settings (Supabase)"
          >
            <Cloud size={14} className={isSupabaseConfigured() ? 'text-emerald-400' : 'text-amber-400'} />
            <span className="hidden xs:inline">{isSupabaseConfigured() ? 'Cloud Synced' : 'Cloud Database'}</span>
          </button>

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
      </div>

      {/* Main Card Container */}
      <div className="max-w-md w-full mx-auto my-8">
        <div className="bg-white/95 text-slate-900 rounded-3xl shadow-2xl p-6 sm:p-8 border border-white/20 backdrop-blur-xl">
          
          {/* Header & Mode Switcher */}
          {mode !== 'forgot' ? (
            <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {mode === 'login' ? 'Welcome Back!' : 'Start Your Smart Store'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {mode === 'login' 
                    ? 'Sign in to access your personal store inventory and sales.' 
                    : 'Create your private account with your Mobile Number or Gmail.'}
                </p>
              </div>

              {/* Mode Tabs: Sign In / Create Account */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl mb-6 font-semibold text-sm">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }}
                  className={`py-2.5 rounded-xl transition-all cursor-pointer ${mode === 'login' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(null); setSuccessMsg(null); }}
                  className={`py-2.5 rounded-xl transition-all cursor-pointer ${mode === 'signup' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Create Account
                </button>
              </div>
            </>
          ) : (
            /* Forgot Password Top Navigation */
            <div className="mb-6">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setForgotStep('identifier'); }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 mb-3 cursor-pointer"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </button>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Key size={22} className="text-blue-600" />
                Reset Password
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Verify your identity with an OTP to create a new password and recover your store account.
              </p>
            </div>
          )}

          {/* Live Simulated OTP Notification Banner */}
          {simulatedNotification && (
            <div className="mb-5 p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>SMS / Email OTP Delivered</span>
                  </div>
                  <p className="text-xs text-emerald-900 font-medium">
                    {simulatedNotification.message}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-slate-600 font-medium">Your 6-digit Code:</span>
                    <span className="font-mono font-black text-sm text-emerald-950 bg-white px-2 py-0.5 rounded border border-emerald-300 shadow-xs tracking-widest">
                      {simulatedNotification.otp}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnteredOtp(simulatedNotification.otp)}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shrink-0 shadow-xs transition-colors cursor-pointer"
                  title="Auto-fill OTP code"
                >
                  Auto-fill
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <CheckCircle size={16} className="shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* MODE 1: SIGN IN                                          */}
          {/* ======================================================== */}
          {mode === 'login' && (
            <>
              {/* Saved Accounts on This Device */}
              {savedUsers.filter(u => u.id !== 'demo_ravi').length > 0 && (
                <div className="mb-5 p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl">
                  <div className="text-xs font-bold text-blue-900 mb-2 flex items-center gap-1.5">
                    <UserCheck size={15} className="text-blue-600" />
                    <span>Saved Accounts on this Device:</span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {savedUsers.filter(u => u.id !== 'demo_ravi').map(user => {
                      const userIdent = user.phone || user.email || user.ownerName;
                      const isSelected = loginIdentifier.toLowerCase() === user.ownerName.toLowerCase() || 
                                         loginIdentifier.toLowerCase() === user.email.toLowerCase() ||
                                         (user.phone && loginIdentifier.includes(user.phone)) ||
                                         loginIdentifier.toLowerCase() === user.shopName.toLowerCase();
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            setLoginIdentifier(userIdent);
                            setError(null);
                            setTimeout(() => passwordInputRef.current?.focus(), 50);
                          }}
                          className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white text-slate-800 border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-bold flex items-center gap-1.5 truncate">
                              <Store size={13} /> {user.shopName}
                            </div>
                            <div className={`text-[11px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                              {user.ownerName} • {user.phone ? `📱 +91 ${user.phone}` : `✉️ ${user.email}`}
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {isSelected ? '✓ Selected' : 'Select'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Mobile Number or Gmail ID
                  </label>
                  <div className="relative">
                    <Smartphone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="e.g. 9876543210 or ramesh@gmail.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                    />
                  </div>

                  {/* Forgot Password Link */}
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setForgotStep('identifier');
                        setError(null);
                        setSuccessMsg(null);
                        setForgotIdentifier(loginIdentifier);
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all mt-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? <RefreshCw size={18} className="animate-spin" /> : <>Sign In to My Store <ArrowRight size={18} /></>}
                </button>
              </form>
            </>
          )}

          {/* ======================================================== */}
          {/* MODE 2: CREATE ACCOUNT (MOBILE NUMBER OR GMAIL)          */}
          {/* ======================================================== */}
          {mode === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-[11px] text-blue-900 font-medium">
                ✨ <strong>Clean Slate Guarantee:</strong> Fresh accounts start with <strong>0 products and ₹0 sales</strong>. All inventory and sales you record will be securely saved to your account.
              </div>

              {/* Toggle: Sign Up with Mobile vs Gmail */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Register With
                </label>
                <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setSignupMethod('mobile')}
                    className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      signupMethod === 'mobile' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Smartphone size={14} />
                    <span>Mobile Number</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignupMethod('email')}
                    className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      signupMethod === 'email' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Mail size={14} />
                    <span>Gmail / Email</span>
                  </button>
                </div>
              </div>

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
                    placeholder="e.g. Sri Lakshmi Super Store"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Owner Full Name
                </label>
                <div className="relative">
                  <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Ramesh Patel"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                  />
                </div>
              </div>

              {/* Dynamic Input based on signupMethod */}
              {signupMethod === 'mobile' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Mobile Number (for Login & OTP Recovery)
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 flex items-center gap-1 text-slate-700 text-xs font-bold select-none pr-2 border-r border-slate-300">
                      <span>🇮🇳</span>
                      <span>+91</span>
                    </div>
                    <input
                      type="tel"
                      required
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="98765 43210"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-20 pr-4 py-2.5 text-sm font-medium tracking-wide focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Enter your 10-digit mobile number. You can login and reset password using this number.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Gmail / Email Address
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
                  {/* Optional mobile number when registering with Gmail */}
                  <div className="mt-2.5">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Mobile Number (Optional, for SMS OTP):
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3 flex items-center gap-1 text-slate-600 text-xs font-bold select-none pr-1.5 border-r border-slate-200">
                        <span>🇮🇳 +91</span>
                      </div>
                      <input
                        type="tel"
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="98765 43210 (Optional)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-18 pr-3 py-2 text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Create a secure password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                >
                  <option value="Grocery / Kirana">Grocery / Kirana</option>
                  <option value="Provisions & General Store">Provisions & General Store</option>
                  <option value="Dairy & Bakery">Dairy & Bakery</option>
                  <option value="Supermarket">Supermarket</option>
                  <option value="Other Retail">Other Retail</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all mt-3 cursor-pointer disabled:opacity-50"
              >
                {loading ? <RefreshCw size={18} className="animate-spin" /> : <>Create My Account <ArrowRight size={18} /></>}
              </button>
            </form>
          )}

          {/* ======================================================== */}
          {/* MODE 3: FORGOT PASSWORD WIZARD (STEP 1, 2, 3)            */}
          {/* ======================================================== */}
          {mode === 'forgot' && (
            <div className="space-y-4">
              {/* Step Progress Dots */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
                <div className={`flex items-center gap-1.5 font-bold ${forgotStep === 'identifier' ? 'text-blue-600' : 'text-slate-400'}`}>
                  <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px]">1</span>
                  <span>Identify</span>
                </div>
                <div className="w-6 h-0.5 bg-slate-200"></div>
                <div className={`flex items-center gap-1.5 font-bold ${forgotStep === 'otp' ? 'text-blue-600' : 'text-slate-400'}`}>
                  <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px]">2</span>
                  <span>OTP</span>
                </div>
                <div className="w-6 h-0.5 bg-slate-200"></div>
                <div className={`flex items-center gap-1.5 font-bold ${forgotStep === 'new-password' ? 'text-blue-600' : 'text-slate-400'}`}>
                  <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px]">3</span>
                  <span>New Password</span>
                </div>
              </div>

              {/* FORGOT STEP 1: Enter Mobile / Gmail */}
              {forgotStep === 'identifier' && (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Your Registered Mobile Number or Gmail ID
                    </label>
                    <div className="relative">
                      <Smartphone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={forgotIdentifier}
                        onChange={(e) => setForgotIdentifier(e.target.value)}
                        placeholder="e.g. 9876543210 or ramesh@gmail.com"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      We will look up your account and send a 6-digit verification OTP to your personal phone or email.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <RefreshCw size={18} className="animate-spin" /> : <>Send Verification OTP <ArrowRight size={18} /></>}
                  </button>
                </form>
              )}

              {/* FORGOT STEP 2: Enter & Verify OTP */}
              {forgotStep === 'otp' && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-950">
                    <div>OTP code dispatched to: <strong>{otpSentDestination}</strong></div>
                    <button
                      type="button"
                      onClick={() => setForgotStep('identifier')}
                      className="text-[11px] text-blue-600 hover:underline mt-1 font-semibold block"
                    >
                      Change mobile / email
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Enter 6-Digit OTP Code
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={6}
                        required
                        autoFocus
                        value={enteredOtp}
                        onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="••••••"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 text-center text-2xl font-mono font-black tracking-[0.5em] focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500">Didn't receive code?</span>
                    {resendCooldown > 0 ? (
                      <span className="text-slate-400 font-semibold font-mono">
                        Resend in {resendCooldown}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        className="font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    Verify OTP & Continue <ArrowRight size={18} />
                  </button>
                </form>
              )}

              {/* FORGOT STEP 3: Create New Password */}
              {forgotStep === 'new-password' && (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  {targetUser && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-medium flex items-center gap-2">
                      <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                      <span>
                        Verified! You are setting a new password for <strong>{targetUser.shopName}</strong> ({targetUser.ownerName}).
                      </span>
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        New Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                        {showNewPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min. 4 characters)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all mt-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <RefreshCw size={18} className="animate-spin" /> : <>Save New Password & Sign In <ArrowRight size={18} /></>}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Quick Demo Access Divider (Only on login/signup) */}
          {mode !== 'forgot' && (
            <>
              <div className="relative my-6 text-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                <span className="relative bg-white px-3 text-xs font-bold text-slate-400 uppercase tracking-wider">or instant demo</span>
              </div>

              {/* 1-Click Demo Login Button */}
              <button
                type="button"
                onClick={loginDemo}
                className="w-full py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <Sparkles size={18} className="text-emerald-600" />
                1-Click Demo (Ravi General Store)
              </button>
            </>
          )}

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

      {/* Supabase Settings Modal */}
      <SupabaseModal isOpen={showSupabaseModal} onClose={() => setShowSupabaseModal(false)} />
    </div>
  );
}
