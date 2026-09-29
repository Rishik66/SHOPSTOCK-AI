import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Plus, Edit2, Trash2, PlusCircle, MinusCircle, X, 
  Mic, StopCircle, Bot, Volume2, Globe, AlertCircle, 
  CheckCircle, ArrowRight, PackagePlus, Box, Barcode 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { Product } from '../types';
import { parseVoiceInventoryCommand, VoiceStockChange } from '../services/voiceInventoryService';
import { extractBestSpeechAlternative, normalizeSlangSpeech, cleanTextForSpeech } from '../services/speechAccentService';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { generateEAN13Barcode } from '../services/barcodeService';

export function Inventory() {
  const { products, setProducts, language, addNotification } = useApp();
  
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({});
  
  const [adjustStock, setAdjustStock] = useState<{ id: string, type: 'add' | 'remove', name: string, stock: number } | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);

  // Barcode Scanner Modal State
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);

  // Voice Inventory Assistant State
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [voiceChanges, setVoiceChanges] = useState<VoiceStockChange[] | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceInput, setVoiceInput] = useState('');
  const [voiceLang, setVoiceLang] = useState('en-IN');

  const recognitionRef = useRef<any>(null);
  const capturedTextRef = useRef('');
  const silenceTimerRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);

  // Sync voice locale with app language (default to Indian English for Kirana shops)
  useEffect(() => {
    if (language === 'te') setVoiceLang('te-IN');
    else if (language === 'hi') setVoiceLang('hi-IN');
    else if (language === 'kn') setVoiceLang('kn-IN');
    else setVoiceLang('en-IN');
  }, [language]);

  // Clean up mic and timer on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        try {
          const cleaned = cleanTextForSpeech(text, voiceLang || 'en-IN');
          const utterance = new SpeechSynthesisUtterance(cleaned || text);
          utterance.lang = voiceLang || 'en-IN';
          utterance.rate = 1.0;
          window.speechSynthesis.speak(utterance);
        } catch {}
      }, 50);
    } catch {}
  };

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.category.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [products, search]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { name, category, stock, purchasePrice, sellingPrice, minimumStock, barcode } = formData;
    if (!name || !category || stock === undefined || !purchasePrice || !sellingPrice || !minimumStock) return;

    if (sellingPrice < purchasePrice) {
      alert("Selling price cannot be less than purchase price!");
      return;
    }

    if (editingId) {
      setProducts(products.map(p => p.id === editingId ? { 
        ...p, 
        ...formData, 
        barcode: barcode?.trim() || undefined 
      } as Product : p));
      addNotification({ type: 'success', message: tr(language, 'notif_updated', { name }) });
    } else {
      const newProduct: Product = {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        name,
        category,
        stock,
        purchasePrice,
        sellingPrice,
        minimumStock,
        barcode: barcode?.trim() || undefined
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

  // Barcode scanned in inventory handler
  const handleBarcodeScannedForInventory = (scannedProduct: Product, quantityToAdd: number) => {
    let nextProducts = [...products];
    const existingIdx = nextProducts.findIndex(p => 
      (p.barcode && p.barcode.trim() === scannedProduct.barcode?.trim()) ||
      p.id === scannedProduct.id || 
      p.name.toLowerCase() === scannedProduct.name.toLowerCase()
    );

    let updatedProduct: Product;
    if (existingIdx >= 0) {
      const prev = nextProducts[existingIdx];
      const newStock = prev.stock + quantityToAdd;
      updatedProduct = {
        ...prev,
        stock: newStock,
        barcode: scannedProduct.barcode || prev.barcode
      };
      nextProducts[existingIdx] = updatedProduct;
    } else {
      // Auto-create product with the scanned quantity
      updatedProduct = {
        ...scannedProduct,
        stock: quantityToAdd
      };
      nextProducts.push(updatedProduct);
    }

    setProducts(nextProducts);
    const msg = `Scanned ${updatedProduct.name}: Added +${quantityToAdd} units (Total Stock: ${updatedProduct.stock})`;
    setVoiceFeedback(msg);
    addNotification({ type: 'success', message: msg });
    speak(msg);
  };

  // Process voice restock command (e.g. "Add 60 biscuit packets and 6 milk packets to the inventory")
  const executeVoiceRestock = (rawSpeech: string) => {
    if (!rawSpeech.trim()) return;
    setVoiceError(null);
    setVoiceFeedback(null);
    setVoiceChanges(null);

    const normalizedSpeech = normalizeSlangSpeech(rawSpeech);
    const result = parseVoiceInventoryCommand(normalizedSpeech, products);

    if (!result.success || result.changes.length === 0) {
      setVoiceError(result.feedback);
      speak(result.feedback || "Could not match those products in inventory. Please try again.");
      return;
    }

    // Apply stock updates to existing products, and add any new products seamlessly
    let nextProducts = [...products];

    result.changes.forEach(change => {
      const existingIdx = nextProducts.findIndex(p => 
        p.id === change.product.id || 
        p.name.toLowerCase() === change.product.name.toLowerCase()
      );
      if (existingIdx >= 0) {
        nextProducts[existingIdx] = { ...nextProducts[existingIdx], stock: change.newStock };
      } else {
        // Auto-create new product in inventory with the new stock!
        nextProducts.push({
          ...change.product,
          stock: change.newStock
        });
      }
    });

    setProducts(nextProducts);
    setVoiceFeedback(result.feedback);
    setVoiceChanges(result.changes);
    addNotification({ type: 'success', message: result.feedback });
    speak(result.feedback);
  };

  // Stop voice restock with optional execution
  const stopVoiceRestock = (shouldExecute: boolean = true) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    isListeningRef.current = false;
    setIsListening(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (shouldExecute) {
      const text = capturedTextRef.current.trim();
      if (text) {
        capturedTextRef.current = '';
        executeVoiceRestock(text);
      }
    }
  };

  // Start voice restock with continuous listening & generous 2.2s silence buffer
  const startVoiceRestock = () => {
    stopVoiceRestock(false);
    setVoiceError(null);
    setVoiceFeedback(null);
    setVoiceChanges(null);
    setVoiceTranscript('');
    capturedTextRef.current = '';

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceError('Voice recognition requires Google Chrome or Microsoft Edge.');
      return;
    }

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = voiceLang || 'en-IN';
    recognition.continuous = true; // DO NOT cut off on pauses
    recognition.interimResults = true; // Live typing as you speak
    recognition.maxAlternatives = 5; // Evaluate top 5 candidate transcripts across regional accents

    recognition.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
      setVoiceError(null);
    };

    recognition.onresult = (event: any) => {
      const { bestTranscript } = extractBestSpeechAlternative(event.results, products);
      const clean = bestTranscript.trim();
      if (clean) {
        capturedTextRef.current = clean;
        setVoiceTranscript(clean);
      }

      // Reset silence grace period timer: gives user a full 2.2 seconds of pause to think or speak next items
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      silenceTimerRef.current = setTimeout(() => {
        // User has been completely silent for 2.2 seconds after speaking
        stopVoiceRestock(true);
      }, 2200);
    };

    recognition.onerror = (event: any) => {
      console.warn('Voice inventory error:', event.error);
      if (event.error === 'no-speech') {
        // In continuous mode, no-speech is just silence waiting for user to speak
        return;
      }
      if (event.error === 'not-allowed') {
        setVoiceError('Microphone permission blocked. Please allow mic access in your browser bar.');
        stopVoiceRestock(false);
      } else if (event.error !== 'aborted') {
        setVoiceError(`Voice notice: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        const text = capturedTextRef.current.trim();
        if (text) {
          stopVoiceRestock(true);
        } else {
          setIsListening(false);
          isListeningRef.current = false;
        }
      }
    };

    try {
      recognition.start();
    } catch (e: any) {
      setVoiceError('Could not start microphone. Please refresh or check browser permissions.');
      stopVoiceRestock(false);
    }
  };

  // Toggle voice recognition
  const toggleVoiceRestock = () => {
    if (isListening) {
      stopVoiceRestock(true);
    } else {
      startVoiceRestock();
    }
  };

  const handleManualVoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiceInput.trim()) return;
    executeVoiceRestock(voiceInput.trim());
    setVoiceInput('');
  };

  return (
    <div className="flex flex-col gap-6">

      {/* 🚀 AI Voice Assistant & Barcode Restock Strip */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl shadow-emerald-900/20 border border-emerald-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                Instant Stock In
              </span>
              <span className="text-xs text-emerald-200 font-semibold">
                Scan barcode or speak to add stock automatically
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
              <span>Smart Stock Manager</span>
              <Bot size={24} className="text-emerald-300" />
            </h1>
            <p className="text-xs text-emerald-100 max-w-xl">
              Tap <span className="font-bold text-amber-300">Scan Barcode</span> to scan product packaging, or tell the agent e.g. <span className="underline decoration-amber-400 font-bold">"Add 60 biscuit packets and 6 milk packets"</span>!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
            {/* Language Selector */}
            <div className="flex items-center gap-1.5 bg-black/25 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-xs">
              <Globe size={14} className="text-emerald-200" />
              <select
                value={voiceLang}
                onChange={(e) => setVoiceLang(e.target.value)}
                className="bg-transparent text-white font-bold outline-none cursor-pointer"
              >
                <option value="te-IN" className="text-slate-900">🇮🇳 తెలుగు (Telugu)</option>
                <option value="en-IN" className="text-slate-900">🇮🇳 English (India)</option>
                <option value="hi-IN" className="text-slate-900">🇮🇳 हिन्दी (Hindi)</option>
                <option value="kn-IN" className="text-slate-900">🇮🇳 ಕನ್ನಡ (Kannada)</option>
                <option value="en-US" className="text-slate-900">🇺🇸 English (US)</option>
              </select>
            </div>

            {/* 📷 Scan Barcode Button */}
            <button
              type="button"
              onClick={() => setIsBarcodeModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
              title="Scan Barcode to Add or Update Stock"
            >
              <Barcode size={18} />
              <span>Scan Barcode</span>
            </button>

            {/* Big Mic Button */}
            <button
              type="button"
              onClick={toggleVoiceRestock}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer shrink-0 ${
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
          <div className="mt-4 p-3.5 bg-gradient-to-r from-red-600 to-rose-700 backdrop-blur-md border border-red-300/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in shadow-lg">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white"></span>
              </span>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-100 flex items-center gap-1.5">
                  <span>🎙️ Listening carefully...</span>
                  <span className="text-white/80 font-normal">Speak at your natural pace (we won't cut you off)</span>
                </span>
                <span className="text-xs sm:text-sm font-black text-white mt-0.5 block">
                  {voiceTranscript ? `"${voiceTranscript}"` : 'Say e.g. "Add 60 biscuit packets and 6 milk packets to the inventory"...'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => stopVoiceRestock(true)}
                className="px-3.5 py-1.5 bg-white text-red-700 hover:bg-red-50 font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                title="Finish speaking and update stock immediately"
              >
                <span>✓ Done Speaking</span>
              </button>
              <button
                type="button"
                onClick={() => stopVoiceRestock(false)}
                className="px-2.5 py-1.5 bg-black/20 hover:bg-black/30 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                title="Cancel voice input"
              >
                <X size={14} />
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

        {/* Manual Text Entry for Voice Command */}
        <div className="mt-4 pt-3.5 border-t border-white/15 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <p className="text-xs text-emerald-100 flex items-center gap-1.5">
            <span>Speak or type items & quantities to update stock automatically.</span>
          </p>

          <form onSubmit={handleManualVoiceSubmit} className="flex gap-1.5 shrink-0">
            <input
              type="text"
              value={voiceInput}
              onChange={(e) => setVoiceInput(e.target.value)}
              placeholder="e.g. Add 50 biscuit packets..."
              className="bg-black/25 text-white placeholder-emerald-200 border border-white/20 rounded-xl px-3 py-1.5 text-xs outline-none focus:bg-black/40 focus:border-white transition-all w-full sm:w-64"
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

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder={tr(language, 'inv_search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-sm transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Scan Barcode button */}
          <button
            type="button"
            onClick={() => setIsBarcodeModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Barcode size={16} /> Scan Barcode
          </button>

          {/* Add Product button */}
          <button
            onClick={() => { setFormData({}); setEditingId(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-xs uppercase tracking-wider shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Plus size={16} /> {tr(language, 'inv_add')}
          </button>

          {products.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Are you sure you want to remove all products from your inventory? This will clear all items.")) {
                  setProducts([]);
                  addNotification({
                    type: 'info',
                    message: 'Inventory cleared. All products removed.'
                  });
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-xs transition-all cursor-pointer"
              title="Clear all products"
            >
              <Trash2 size={15} />
              <span className="hidden sm:inline">Clear All</span>
            </button>
          )}
        </div>
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
                  <td colSpan={7} className="p-12 text-center text-gray-500 space-y-2">
                    <Box size={36} className="mx-auto text-gray-300 mb-2" />
                    <p className="font-bold text-gray-700 text-sm">Your inventory is empty</p>
                    <p className="text-xs text-gray-400">
                      Tap "Scan Barcode" or speak "Add 60 biscuit packets and 6 milk packets" to stock your store instantly.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-gray-900">{p.name}</div>
                      {p.barcode && (
                        <div className="font-mono text-[10px] text-gray-500 bg-slate-100 px-1.5 py-0.5 rounded w-fit flex items-center gap-1 mt-0.5">
                          <Barcode size={11} className="text-gray-400" />
                          <span>{p.barcode}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-gray-500">{p.category}</td>
                    <td className="p-4 font-bold text-gray-800">{p.stock}</td>
                    <td className="p-4 text-gray-600">₹{p.purchasePrice}</td>
                    <td className="p-4 font-bold text-blue-600">₹{p.sellingPrice}</td>
                    <td className="p-4">
                      {p.stock <= p.minimumStock ? (
                        <span className="px-2.5 py-1 text-xs font-bold bg-red-100 text-red-700 rounded-full border border-red-200">
                          {tr(language, 'inv_lowstock')}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full">
                          {tr(language, 'inv_instock')}
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

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        mode="inventory"
        onScannedForInventory={handleBarcodeScannedForInventory}
      />

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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Barcode (EAN-13 / Custom)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, barcode: generateEAN13Barcode() })}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-lg"
                    >
                      🎲 Generate
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsBarcodeModalOpen(true)}
                      className="text-[11px] font-bold text-amber-800 hover:text-amber-900 bg-amber-100 px-2 py-0.5 rounded-lg flex items-center gap-1"
                    >
                      <Barcode size={12} /> Scan
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 8901719101038"
                  value={formData.barcode || ''}
                  onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full border-gray-300 rounded-xl p-2.5 border font-mono text-sm outline-none focus:ring-2 focus:ring-blue-600"
                />
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
