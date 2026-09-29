import React, { useState } from 'react';
import { Bot, Sparkles, Key, Check, AlertCircle, RefreshCw, ExternalLink, X, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { getGeminiApiKey, setGeminiApiKey, testGeminiApiKey, isRealAIConfigured } from '../services/aiService';

interface GeminiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged?: () => void;
}

export function GeminiModal({ isOpen, onClose, onConfigChanged }: GeminiModalProps) {
  const [apiKeyInput, setApiKeyInput] = useState<string>(getGeminiApiKey());
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(isRealAIConfigured());

  if (!isOpen) return null;

  const handleSaveAndTest = async () => {
    const clean = apiKeyInput.trim();
    if (!clean) {
      setGeminiApiKey('');
      setIsConfigured(false);
      setStatusMsg({
        text: 'API key cleared. AI Assistant reverted to Built-in Smart Retail Engine.',
        success: true
      });
      if (onConfigChanged) onConfigChanged();
      return;
    }

    setIsTesting(true);
    setStatusMsg(null);

    try {
      const res = await testGeminiApiKey(clean);
      if (res.success) {
        setGeminiApiKey(clean);
        setIsConfigured(true);
        setStatusMsg({
          text: '✅ Google Gemini Real-Time AI connected! Your Assistant will now answer any retail or business query with live thinking.',
          success: true
        });
        if (onConfigChanged) onConfigChanged();
      } else {
        setStatusMsg({
          text: `❌ ${res.message}`,
          success: false
        });
      }
    } catch (err: any) {
      setStatusMsg({
        text: `❌ Connection error: ${err?.message || 'Check your internet connection'}`,
        success: false
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClear = () => {
    setApiKeyInput('');
    setGeminiApiKey('');
    setIsConfigured(false);
    setStatusMsg({
      text: 'Gemini API key removed. Reverted to Built-in Smart Retail AI Engine.',
      success: true
    });
    if (onConfigChanged) onConfigChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Sparkles size={22} className="text-amber-300" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white flex items-center gap-2">
                Connect Real-Time AI
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isConfigured ? 'bg-emerald-400 text-slate-900' : 'bg-white/20 text-white'
                }`}>
                  {isConfigured ? 'Active' : 'Offline Engine'}
                </span>
              </h3>
              <p className="text-xs text-purple-100">
                Powered by Google Gemini 1.5 & 2.0 Flash
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-800">
          {/* Benefit Explanation */}
          <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 text-xs sm:text-sm text-purple-900 space-y-2">
            <div className="font-bold flex items-center gap-2 text-purple-950">
              <Bot size={16} className="text-purple-700" />
              <span>What happens when you connect Google Gemini:</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-purple-800 text-xs leading-relaxed">
              <li><strong>Real Chatbot Thinking:</strong> Ask about increasing profits, marketing ideas, or why certain items are slow.</li>
              <li><strong>Deep Store Intelligence:</strong> Gemini reads your live inventory numbers and sales to create tailored combo bundles.</li>
              <li><strong>Fluent Multilingual Voice:</strong> Speaks and understands Telugu, Hindi, Kannada, and Indian English with accent tolerance.</li>
            </ul>
          </div>

          {/* Quick 3-Step Guide to get free key */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2.5">
            <div className="flex items-center justify-between font-bold text-slate-900">
              <span>How to get a FREE Google Gemini API Key (1 minute):</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-bold"
              >
                <span>Google AI Studio</span>
                <ExternalLink size={12} />
              </a>
            </div>
            <ol className="list-decimal pl-5 space-y-1 text-slate-600">
              <li>Open <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium">aistudio.google.com/app/apikey</a> with your Google account.</li>
              <li>Click the blue <strong>"Create API key"</strong> button.</li>
              <li>Copy the key (starts with <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono">AIzaSy...</code>) and paste it below.</li>
            </ol>
            <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 pt-1">
              <ShieldCheck size={14} />
              <span>100% Free: No credit card required. Keys are stored safely in your browser.</span>
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Google Gemini API Key
            </label>
            <div className="relative">
              <Key size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-3 text-sm font-mono text-slate-900 focus:ring-2 focus:ring-purple-600 focus:bg-white outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Live Status Message */}
          {statusMsg && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
              statusMsg.success 
                ? 'bg-purple-50 text-purple-900 border-purple-200' 
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}>
              {statusMsg.success ? <Check size={16} className="text-purple-600 shrink-0" /> : <AlertCircle size={16} className="text-rose-600 shrink-0" />}
              <span>{statusMsg.text}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          {isConfigured ? (
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              Clear Key
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveAndTest}
              disabled={isTesting}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md shadow-purple-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={15} className={isTesting ? 'animate-spin' : ''} />
              <span>{isTesting ? 'Verifying with Google...' : 'Save & Connect AI'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
