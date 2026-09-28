import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Plus, Edit2, Trash2, PlusCircle, MinusCircle, X, 
  Mic, StopCircle, Bot, Sparkles, Volume2, Globe, AlertCircle, 
  CheckCircle, ArrowRight, PackagePlus, Box 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { Product } from '../types';
import { parseVoiceInventoryCommand, VoiceStockChange } from '../services/voiceInventoryService';

export function Inventory() {
  const { products, setProducts, language, addNotification } = useApp();
  
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({});
  
  const [adjustStock, setAdjustStock] = useState<{ id: string, type: 'add' | 'remove', name: string, stock: number } | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);

  // Voice Inventory Assistant State
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [voiceChanges, setVoiceChanges] = useState<VoiceStockChange[] | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceInput, setVoiceInput] = useState('');
  const [voiceLang, setVoiceLang] = useState('en-US');

  const recognitionRef = useRef<any>(null);
  const capturedTextRef = useRef('');

  // Sync voice locale with app language
  useEffect(() => {
    if (language === 'te') setVoiceLang('te-IN');
    else if (language === 'hi') setVoiceLang('hi-IN');
    else if (language === 'kn') setVoiceLang('kn-IN');
    else setVoiceLang('en-US');
  }, [language]);

  // Clean up mic on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {}
  };

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [products, search]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { name, category, stock, purchasePrice, sellingPrice, minimumStock } = formData;
    if (!name || !category || stock === undefined || purchasePrice === undefined || sellingPrice === undefined || minimumStock === undefined) return;
    
    if (editingId) {
      setProducts(products.map(p => p.id === editingId ? { ...p, ...formData as Product } : p));
      addNotification({ type: 'success', message: tr(language, 'notif_updated', { name }) });
    } else {
      const newProduct: Product = {
        id: Date.now().toString(),
        name, category, stock, purchasePrice, sellingPrice, minimumStock
      };
      setProducts([...products, newProduct]);
      addNotification({ type: 'success', message: tr(language, 'notif_added', { name }) });
    }
    setShowForm(false);
    setEditingId(null);
    setFormData({});
  };

  const handleEdit = (p: Product) => {
    setFormData(p);
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(tr(language, 'inv_confirmDelete'))) {
      setProducts(products.filter(p => p.id !== id));
      addNotification({ type: 'info', message: tr(language, 'notif_deleted', { name }) });
    }
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustStock || adjustQty <= 0) return;
    const { id, type, name, stock } = adjustStock;
    if (type === 'remove' && adjustQty > stock) return;

    const newStock = type === 'add' ? stock + adjustQty : stock - adjustQty;
    setProducts(products.map(p => p.id === id ? { ...p, stock: newStock } : p));
    
    addNotification({ type: 'success', message: tr(language, type === 'add' ? 'notif_stockAdded' : 'notif_stockRemoved', { qty: adjustQty, name }) });
    setAdjustStock(null);
    setAdjustQty(0);
  };

  // Process voice restock command (e.g. "Add 60 biscuit packets and 6 milk packets to the inventory")
  const executeVoiceRestock = (rawSpeech: string) => {
    if (!rawSpeech.trim()) return;
    setVoiceError(null);
    setVoiceFeedback(null);
    setVoiceChanges(null);

    const result = parseVoiceInventoryCommand(rawSpeech, products);

    if (!result.success || result.changes.length === 0) {
      setVoiceError(result.feedback);
      speak("Could not match those products in inventory. Please try again.");
      return;
    }

    // Apply stock updates to products state
    const updatedProducts = products.map(p => {
      const change = result.changes.find(c => c.product.id === p.id);
      if (change) {
        return { ...p, stock: change.newStock };
      }
      return p;
    });

    setProducts(updatedProducts);
    setVoiceFeedback(result.feedback);
    setVoiceChanges(result.changes);
    addNotification({ type: 'success', message: result.feedback });
    speak(result.feedback);
  };

  // Toggle voice recognition
  const toggleVoiceRestock = () => {
    setVoiceError(null);
    setVoiceFeedback(null);
    setVoiceChanges(null);
    setVoiceTranscript('');
    capturedTextRef.current = '';

    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsListening(false);
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceError('Voice recognition requires Google Chrome or Microsoft Edge.');
      return;
    }

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = voiceLang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceError(null);
    };

    recognition.onresult = (event: any) => {
      let speech = '';
      for (let i = 0; i < event.results.length; ++i) {
        speech += event.results[i][0].transcript;
      }
      const clean = speech.trim();
      if (clean) {
        capturedTextRef.current = clean;
        setVoiceTranscript(clean);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('Voice inventory error:', event.error);
      setIsListening(false);
      if (event.error === 'no-speech') {
        setVoiceError('No speech detected. Please speak closer to your microphone.');
      } else if (event.error === 'not-allowed') {
        setVoiceError('Microphone permission blocked. Please allow mic access in your browser bar.');
      } else {
        setVoiceError(`Voice error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      const text = capturedTextRef.current.trim();
      if (text) {
        capturedTextRef.current = '';
        executeVoiceRestock(text);
      }
    };

    try {
      recognition.start();
    } catch (err) {
      setIsListening(false);
      setVoiceError('Could not start microphone. Click again to retry.');
    }
  };

  const handleManualVoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiceInput.trim()) return;
    executeVoiceRestock(voiceInput.trim());
    setVoiceInput('');
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* 🎙️ Voice Inventory Restock Command Center */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-emerald-500/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
              <PackagePlus size={28} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  Voice Inventory Restock
                  <span className="text-[10px] font-bold bg-white text-emerald-900 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    AI Auto-Stock
                  </span>
                </h2>
              </div>
              <p className="text-xs text-emerald-100 font-medium mt-0.5">
                Speak stock additions: e.g. <span className="underline font-semibold">"Add 60 biscuit packets and 6 milk packets to the inventory"</span>
              </p>
            </div>
          </div>

          {/* Voice Controls: Mic Button & Locale */}
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            {/* Language Selector */}
            <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-xs">
              <Globe size={14} className="text-emerald-200" />
              <select
                value={voiceLang}
                onChange={(e) => setVoiceLang(e.target.value)}
                className="bg-transparent text-white font-bold outline-none cursor-pointer"
              >
                <option value="en-US" className="text-slate-900">🇺🇸 English (US)</option>
                <option value="en-IN" className="text-slate-900">🇮🇳 English (India)</option>
                <option value="hi-IN" className="text-slate-900">🇮🇳 हिन्दी (Hindi)</option>
                <option value="te-IN" className="text-slate-900">🇮🇳 తెలుగు (Telugu)</option>
                <option value="kn-IN" className="text-slate-900">🇮🇳 ಕನ್ನಡ (Kannada)</option>
              </select>
            </div>

            {/* Big Mic Button */}
            <button
              type="button"
              onClick={toggleVoiceRestock}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse hover:bg-red-600 shadow-red-500/50'
                  : 'bg-white text-emerald-800 hover:bg-emerald-50 shadow-white/20'
              }`}
            >
              {isListening ? (
                <>
                  <StopCircle size={18} className="animate-spin" />
                  <span>Listening... Stop</span>
                </>
              ) : (
                <>
                  <Mic size={18} />
                  <span>Voice Restock</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Listening Banner */}
        {isListening && (
          <div className="mt-4 p-3.5 bg-red-600/90 backdrop-blur-md border border-red-300/40 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in shadow-inner">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white"></span>
              </span>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-100 block">
                  Listening to your stock additions... Speak clearly!
                </span>
                <span className="text-sm font-black text-white">
                  {voiceTranscript ? `"${voiceTranscript}"` : 'Say e.g. "Add 60 biscuit packets and 6 milk packets to the inventory"...'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => {
                  const text = capturedTextRef.current.trim() || voiceTranscript.trim();
                  if (recognitionRef.current) {
                    try { recognitionRef.current.stop(); } catch {}
                  }
                  setIsListening(false);
                  if (text) executeVoiceRestock(text);
                }}
                className="px-3 py-1.5 bg-white text-red-700 font-bold text-xs rounded-lg shadow-sm hover:bg-red-50"
              >
                ✓ Update Stock Now
              </button>
            </div>
          </div>
        )}

        {/* Voice Changes Summary Card */}
        {voiceChanges && voiceChanges.length > 0 && (
          <div className="mt-3 p-3.5 bg-white text-slate-900 rounded-xl text-xs font-semibold shadow-md animate-fade-in space-y-2 border border-emerald-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                <span>Stock Updated Successfully:</span>
              </div>
              <button
                type="button"
                onClick={() => speak(voiceFeedback || '')}
                title="Hear audio confirmation"
                className="p-1 hover:bg-slate-100 text-emerald-700 rounded-md transition-colors"
              >
                <Volume2 size={16} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
              {voiceChanges.map(c => (
                <div key={c.product.id} className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block truncate">{c.product.name}</span>
                    <span className="text-[11px] text-emerald-700 font-semibold">
                      +{c.quantity} units added
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Stock:</span>
                    <span className="font-mono font-bold text-xs text-slate-700">
                      {c.previousStock} → <strong className="text-emerald-700 text-sm">{c.newStock}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Voice Error Banner */}
        {voiceError && (
          <div className="mt-3 p-3 bg-amber-500/90 text-white rounded-xl text-xs font-medium flex items-center justify-between gap-2 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-white shrink-0" />
              <span>{voiceError}</span>
            </div>
            <button onClick={() => setVoiceError(null)} className="font-bold px-2 py-0.5 hover:opacity-75">✕</button>
          </div>
        )}

        {/* Quick Phrases + Manual Text Entry */}
        <div className="mt-4 pt-3.5 border-t border-white/15 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Quick Spoken Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-emerald-200 flex items-center gap-1 mr-1">
              <Sparkles size={12} className="text-amber-300" /> Click to Test:
            </span>
            {[
              "Add 60 biscuit packets and 6 milk packets to the inventory",
              "Add 20 Maggi and 10 Tata Salt",
              "Add 15 Coca-Cola and 10 Bread",
              "Add 25 Aashirvaad Atta"
            ].map((phrase, i) => (
              <button
                key={i}
                type="button"
                onClick={() => executeVoiceRestock(phrase)}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg border border-white/20 transition-all text-left flex items-center gap-1.5"
              >
                <span>📦</span>
                <span>{phrase.length > 32 ? phrase.slice(0, 30) + '...' : phrase}</span>
              </button>
            ))}
          </div>

          {/* Quick Manual Voice Command Input */}
          <form onSubmit={handleManualVoiceSubmit} className="flex gap-1.5 shrink-0">
            <input
              type="text"
              value={voiceInput}
              onChange={(e) => setVoiceInput(e.target.value)}
              placeholder="Or type: Add 60 biscuits 6 milk..."
              className="bg-black/25 text-white placeholder-emerald-200 border border-white/20 rounded-xl px-3 py-1.5 text-xs outline-none focus:bg-black/40 focus:border-white transition-all w-48 sm:w-60"
            />
            <button
              type="submit"
              disabled={!voiceInput.trim()}
              className="px-3 py-1.5 bg-white text-emerald-900 font-bold text-xs rounded-xl hover:bg-emerald-50 disabled:opacity-40 transition-all flex items-center gap-1"
            >
              Update
            </button>
          </form>
        </div>
      </div>

      {/* Search & Add Product Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder={tr(language, 'inv_search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-sm transition-all"
          />
        </div>
        <button
          onClick={() => { setFormData({}); setEditingId(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-sm shadow-md shadow-blue-500/20 transition-all"
        >
          <Plus size={18} /> {tr(language, 'inv_add')}
        </button>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="p-4">{tr(language, 'inv_product')}</th>
                <th className="p-4">{tr(language, 'inv_category')}</th>
                <th className="p-4">{tr(language, 'inv_stock')}</th>
                <th className="p-4">{tr(language, 'inv_purchase')}</th>
                <th className="p-4">{tr(language, 'inv_selling')}</th>
                <th className="p-4">{tr(language, 'inv_status')}</th>
                <th className="p-4">{tr(language, 'inv_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">{tr(language, 'inv_empty')}</td>
                </tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-bold text-gray-900">{p.name}</td>
                    <td className="p-4 text-gray-600 font-medium">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">
                        {p.category}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-black text-gray-900 text-base">{p.stock}</span>
                      <span className="text-xs text-gray-400 ml-1.5 font-medium">/ min {p.minimumStock}</span>
                    </td>
                    <td className="p-4 font-medium text-gray-600">₹{p.purchasePrice}</td>
                    <td className="p-4 font-bold text-gray-900">₹{p.sellingPrice}</td>
                    <td className="p-4">
                      {p.stock <= p.minimumStock ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                          🔴 {tr(language, 'inv_lowstock')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
                          🟢 {tr(language, 'inv_instock')}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleEdit(p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title={tr(language, 'inv_edit')}><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title={tr(language, 'inv_delete')}><Trash2 size={16} /></button>
                        <div className="w-px h-4 bg-gray-200 mx-1"></div>
                        <button onClick={() => setAdjustStock({ id: p.id, type: 'add', name: p.name, stock: p.stock })} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title={tr(language, 'inv_addstock')}><PlusCircle size={16} /></button>
                        <button onClick={() => setAdjustStock({ id: p.id, type: 'remove', name: p.name, stock: p.stock })} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg" title={tr(language, 'inv_removestock')}><MinusCircle size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-200 bg-slate-50">
              <h2 className="font-bold text-lg text-gray-900">{editingId ? tr(language, 'inv_edit') : tr(language, 'inv_add')}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">{tr(language, 'inv_name')}*</label>
                <input required type="text" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border-gray-300 rounded-xl p-2.5 border focus:ring-2 focus:ring-blue-600 text-sm outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">{tr(language, 'inv_category')}*</label>
                <input required type="text" value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full border-gray-300 rounded-xl p-2.5 border focus:ring-2 focus:ring-blue-600 text-sm outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">{tr(language, 'inv_stock')}*</label>
                  <input required type="number" min="0" value={formData.stock ?? ''} onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) })} className="w-full border-gray-300 rounded-xl p-2.5 border focus:ring-2 focus:ring-blue-600 text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">{tr(language, 'inv_minstock')}*</label>
                  <input required type="number" min="1" value={formData.minimumStock ?? ''} onChange={e => setFormData({ ...formData, minimumStock: parseInt(e.target.value) })} className="w-full border-gray-300 rounded-xl p-2.5 border focus:ring-2 focus:ring-blue-600 text-sm outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">{tr(language, 'inv_purchase')}*</label>
                  <input required type="number" min="0" step="0.01" value={formData.purchasePrice ?? ''} onChange={e => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) })} className="w-full border-gray-300 rounded-xl p-2.5 border focus:ring-2 focus:ring-blue-600 text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">{tr(language, 'inv_selling')}*</label>
                  <input required type="number" min="0" step="0.01" value={formData.sellingPrice ?? ''} onChange={e => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) })} className="w-full border-gray-300 rounded-xl p-2.5 border focus:ring-2 focus:ring-blue-600 text-sm outline-none" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t mt-4">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 font-semibold text-sm hover:bg-gray-50">{tr(language, 'cancel')}</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-sm shadow-md shadow-blue-500/20">{tr(language, 'save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Stock Adjust Modal */}
      {adjustStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-200 bg-slate-50">
              <h2 className="font-bold text-lg text-gray-900">{tr(language, adjustStock.type === 'add' ? 'inv_addstock' : 'inv_removestock')}</h2>
              <button onClick={() => setAdjustStock(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-gray-200">
                <p className="text-xs text-gray-500">Product: <span className="font-bold text-gray-900">{adjustStock.name}</span></p>
                <p className="text-xs text-gray-500 mt-0.5">Current Stock: <span className="font-bold text-gray-900">{adjustStock.stock} units</span></p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">{tr(language, 'inv_qty')}</label>
                <input autoFocus required type="number" min="1" max={adjustStock.type === 'remove' ? adjustStock.stock : undefined} value={adjustQty || ''} onChange={e => setAdjustQty(parseInt(e.target.value))} className="w-full border-gray-300 rounded-xl p-2.5 border focus:ring-2 focus:ring-blue-600 text-sm outline-none" />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t mt-4">
                <button type="button" onClick={() => setAdjustStock(null)} className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 font-semibold text-sm hover:bg-gray-50">{tr(language, 'cancel')}</button>
                <button type="submit" className={`px-5 py-2 text-white rounded-xl font-bold text-sm shadow-md ${adjustStock.type === 'add' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/20'}`}>{tr(language, 'confirm')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
