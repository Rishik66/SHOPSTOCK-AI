import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle, 
  Mic, StopCircle, Volume2, Globe, AlertCircle, 
  ArrowRight, ArrowLeft, Check, Printer, Bot, RefreshCw, Barcode,
  Receipt, ChevronRight, X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { Product, CartItem } from '../types';
import { parseVoiceBillingCommand } from '../services/voiceBillingService';
import { extractBestSpeechAlternative, normalizeSlangSpeech } from '../services/speechAccentService';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { identifyProductByBarcode, playBarcodeBeep } from '../services/barcodeService';

export function Billing() {
  const { products, setProducts, transactions, setTransactions, language, addNotification, currentUser } = useApp();
  
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showReceipt, setShowReceipt] = useState<string | null>(null);

  // Mobile navigation tab: 'products' | 'bill' (only active on mobile screens < lg)
  const [mobileTab, setMobileTab] = useState<'products' | 'bill'>('products');

  // Barcode Scanner Modal State
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);

  // Voice Billing Agent State
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceInput, setVoiceInput] = useState('');
  const [voiceLang, setVoiceLang] = useState('en-IN');

  const recognitionRef = useRef<any>(null);
  const capturedTextRef = useRef('');
  const silenceTimerRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);

  // Synchronize default voice locale with app language (default to Indian English for Kirana shops)
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
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voiceLang || 'en-IN';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {}
  };

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.category.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q))
    );
  }, [products, search]);

  const addToCart = (product: Product, quantityToAdd: number = 1) => {
    if (product.stock === 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        const newQty = Math.min(product.stock, existing.quantity + quantityToAdd);
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: newQty } : item);
      }
      const initialQty = Math.min(product.stock, quantityToAdd);
      return [...prev, { product, quantity: initialQty }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return { ...item, quantity: 0 };
          if (newQty > item.product.stock) return item;
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.product.sellingPrice * item.quantity), 0);
  }, [cart]);

  const cartTotalQuantity = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Complete Sale transaction logic
  const completeSaleWithItems = (targetCart: CartItem[] = cart) => {
    if (targetCart.length === 0) {
      setVoiceError('Cart is empty. Add items to complete sale.');
      return;
    }
    
    // Validate stock
    for (const item of targetCart) {
      const p = products.find(x => x.id === item.product.id);
      if (!p || p.stock < item.quantity) {
        addNotification({ type: 'error', message: `Only ${p?.stock || 0} ${item.product.name} available in stock.` });
        return;
      }
    }

    const txId = 'TXN-' + Date.now().toString().slice(-6);
    const date = new Date().toISOString();
    const currentTotal = targetCart.reduce((sum, item) => sum + (item.product.sellingPrice * item.quantity), 0);
    const profit = targetCart.reduce((sum, item) => sum + ((item.product.sellingPrice - item.product.purchasePrice) * item.quantity), 0);

    const newTx = {
      id: txId,
      date,
      items: targetCart.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        quantity: i.quantity,
        sellingPrice: i.product.sellingPrice,
        purchasePrice: i.product.purchasePrice,
      })),
      total: currentTotal,
      profit,
    };

    // Update stock levels
    const updatedProducts = products.map(p => {
      const cartItem = targetCart.find(ci => ci.product.id === p.id);
      if (cartItem) {
        return { ...p, stock: p.stock - cartItem.quantity };
      }
      return p;
    });

    setProducts(updatedProducts);
    setTransactions([newTx, ...transactions]);
    addNotification({ type: 'success', message: `${tr(language, 'notif_sale')} (₹${currentTotal})` });
    setShowReceipt(txId);
  };

  // Barcode scanned in billing handler
  const handleBarcodeScanned = (scannedProduct: Product) => {
    const existing = products.find(p => 
      p.id === scannedProduct.id || 
      (p.barcode && p.barcode.trim() === scannedProduct.barcode?.trim()) ||
      p.name.toLowerCase() === scannedProduct.name.toLowerCase()
    );

    if (existing) {
      if (existing.stock <= 0) {
        const msg = `${existing.name} is out of stock!`;
        setVoiceError(msg);
        speak(msg);
        return;
      }
      addToCart(existing, 1);
      const msg = `Added ${existing.name} (₹${existing.sellingPrice}) to bill!`;
      setVoiceFeedback(msg);
      speak(msg);
    } else {
      // Auto-create product from catalog so it can be billed immediately!
      const newProduct: Product = {
        ...scannedProduct,
        stock: 20
      };
      setProducts([...products, newProduct]);
      addToCart(newProduct, 1);
      const msg = `Recognized ${newProduct.name} (₹${newProduct.sellingPrice}) and added to bill!`;
      setVoiceFeedback(msg);
      speak(msg);
    }
  };

  // Execute Voice Billing Command
  const executeBillingCommand = (speechText: string) => {
    setVoiceError(null);
    setVoiceFeedback(null);

    const normalizedText = normalizeSlangSpeech(speechText);
    const result = parseVoiceBillingCommand(normalizedText, products, voiceLang);

    if (result.action === 'NOT_UNDERSTOOD' || result.action === 'NO_ITEMS_FOUND' || result.action === 'OUT_OF_STOCK') {
      setVoiceError(result.feedback);
      speak(result.feedback);
      return;
    }

    if (result.action === 'CLEAR_CART') {
      setCart([]);
      setVoiceFeedback('Bill cleared.');
      speak('Bill cleared.');
      return;
    }

    if (result.action === 'COMPLETE_BILL') {
      if (cart.length === 0) {
        setVoiceError('Cart is empty. Please add items before giving bill.');
        speak('Cart is empty. Please add items first.');
        return;
      }
      completeSaleWithItems(cart);
      return;
    }

    // ADD_ITEMS action: update cart with recognized items
    let updatedCart = [...cart];
    result.items.forEach(newItem => {
      const storeProduct = products.find(p => p.id === newItem.product.id) || newItem.product;
      const existingIdx = updatedCart.findIndex(item => item.product.id === storeProduct.id);
      if (existingIdx >= 0) {
        const targetQty = updatedCart[existingIdx].quantity + newItem.quantity;
        const finalQty = Math.min(storeProduct.stock, targetQty);
        updatedCart[existingIdx] = {
          ...updatedCart[existingIdx],
          quantity: finalQty
        };
      } else {
        const finalQty = Math.min(storeProduct.stock, newItem.quantity);
        if (finalQty > 0) {
          updatedCart.push({ product: storeProduct, quantity: finalQty });
        }
      }
    });

    setCart(updatedCart);
    setVoiceFeedback(result.feedback);
    speak(result.feedback);

    // If "give bill" or "print bill" requested:
    if (result.shouldCompleteBill) {
      setTimeout(() => {
        completeSaleWithItems(updatedCart);
      }, 500);
    }
  };

  // Stop voice billing with optional execution
  const stopVoiceBilling = (shouldExecute: boolean = true) => {
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
        executeBillingCommand(text);
      }
    }
  };

  // Start voice billing with continuous listening & generous 2.2s silence buffer
  const startVoiceBilling = () => {
    stopVoiceBilling(false);
    setVoiceError(null);
    setVoiceFeedback(null);
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
    recognition.continuous = true; // DO NOT cut off on small pauses
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
        stopVoiceBilling(true);
      }, 2200);
    };

    recognition.onerror = (event: any) => {
      console.warn('Voice billing error:', event.error);
      if (event.error === 'no-speech') {
        // In continuous mode, no-speech is just silence waiting for user to speak
        return;
      }
      if (event.error === 'not-allowed') {
        setVoiceError('Microphone permission blocked. Please allow mic access in your browser bar.');
        stopVoiceBilling(false);
      } else if (event.error !== 'aborted') {
        setVoiceError(`Voice notice: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // If browser terminates stream while user was still speaking
      if (isListeningRef.current) {
        const text = capturedTextRef.current.trim();
        if (text) {
          stopVoiceBilling(true);
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
      stopVoiceBilling(false);
    }
  };

  // Toggle voice recognition
  const toggleVoiceBilling = () => {
    if (isListening) {
      // User tapped button while listening -> conclude and process immediately!
      stopVoiceBilling(true);
    } else {
      startVoiceBilling();
    }
  };

  const handleManualVoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiceInput.trim()) return;
    executeBillingCommand(voiceInput.trim());
    setVoiceInput('');
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-24 lg:pb-0">
      
      {/* 🚀 AI Voice Assistant & Barcode Scanner Billing Strip */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-xl shadow-blue-900/20 border border-blue-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                Instant Billing
              </span>
              <span className="text-[11px] sm:text-xs text-blue-200 font-semibold truncate">
                Speak or Scan to add products directly
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight flex items-center gap-2">
              <span>Smart Billing Agent</span>
              <Bot size={20} className="text-blue-300 sm:w-6 sm:h-6" />
            </h1>
            <p className="text-[11px] sm:text-xs text-blue-100 max-w-xl hidden xs:block">
              Tell the agent e.g. <span className="underline decoration-amber-400 font-bold">"2 biscuits and 3 milk packets"</span> or click <span className="font-bold text-amber-300">Scan Barcode</span> to instantly scan items with camera!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
            {/* Language Selector */}
            <div className="flex items-center gap-1.5 bg-black/25 backdrop-blur-md px-2.5 py-2 rounded-xl border border-white/10 text-xs">
              <Globe size={13} className="text-blue-200 shrink-0" />
              <select
                value={voiceLang}
                onChange={(e) => setVoiceLang(e.target.value)}
                className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs"
              >
                <option value="en-US" className="text-slate-900">🇺🇸 English</option>
                <option value="en-IN" className="text-slate-900">🇮🇳 Indian English</option>
                <option value="hi-IN" className="text-slate-900">🇮🇳 हिन्दी</option>
                <option value="te-IN" className="text-slate-900">🇮🇳 తెలుగు</option>
                <option value="kn-IN" className="text-slate-900">🇮🇳 ಕನ್ನಡ</option>
              </select>
            </div>

            {/* 📷 Barcode Scanner Button */}
            <button
              type="button"
              onClick={() => setIsBarcodeModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
              title="Scan Barcode with Camera or Barcode Gun to Add Item to Bill"
            >
              <Barcode size={16} />
              <span>Scan Barcode</span>
            </button>

            {/* Big Mic Button */}
            <button
              type="button"
              onClick={toggleVoiceBilling}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse hover:bg-red-600 shadow-red-500/50'
                  : 'bg-white text-blue-700 hover:bg-blue-50 shadow-white/20'
              }`}
            >
              {isListening ? (
                <>
                  <StopCircle size={16} className="animate-spin" />
                  <span>Stop & Bill</span>
                </>
              ) : (
                <>
                  <Mic size={16} />
                  <span>Voice Billing</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Listening Banner */}
        {isListening && (
          <div className="mt-3 p-3.5 bg-gradient-to-r from-red-600 to-rose-700 backdrop-blur-md border border-red-300/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in shadow-lg">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white"></span>
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-100 flex items-center gap-1.5">
                  <span>🎙️ Listening carefully...</span>
                  <span className="text-white/80 font-normal">Speak at your natural pace (we won't cut you off)</span>
                </span>
                <span className="text-xs sm:text-sm font-black text-white mt-0.5 block">
                  {voiceTranscript ? `"${voiceTranscript}"` : 'Say e.g. "2 biscuits and 3 milk packets"...'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => stopVoiceBilling(true)}
                className="px-3.5 py-1.5 bg-white text-red-700 hover:bg-red-50 font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                title="Finish speaking and process immediately"
              >
                <span>✓ Done Speaking</span>
              </button>
              <button
                type="button"
                onClick={() => stopVoiceBilling(false)}
                className="px-2.5 py-1.5 bg-black/20 hover:bg-black/30 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                title="Cancel voice input"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Voice Feedback Success Banner */}
        {voiceFeedback && (
          <div className="mt-2.5 p-2.5 bg-emerald-500/90 text-white rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle size={15} className="text-white shrink-0" />
              <span>{voiceFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => speak(voiceFeedback)}
              title="Hear voice confirmation"
              className="p-1 hover:bg-white/20 rounded-md transition-colors"
            >
              <Volume2 size={15} />
            </button>
          </div>
        )}

        {/* Voice Error Banner */}
        {voiceError && (
          <div className="mt-2.5 p-2.5 bg-amber-500/95 text-white rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="text-white shrink-0" />
              <span>{voiceError}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => speak(voiceError)}
                title="Hear voice notice"
                className="p-1 hover:bg-white/20 rounded-md transition-colors cursor-pointer"
              >
                <Volume2 size={15} />
              </button>
              <button onClick={() => setVoiceError(null)} className="font-bold px-2 py-0.5 hover:opacity-75 cursor-pointer">✕</button>
            </div>
          </div>
        )}

        {/* Manual Voice Order Input Fallback */}
        <div className="mt-3 pt-3 border-t border-white/15 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <p className="text-xs text-blue-100 flex items-center gap-1.5">
            <span>Speak items & quantities to add directly to current bill.</span>
          </p>

          {/* Quick Manual Voice Command Input */}
          <form onSubmit={handleManualVoiceSubmit} className="flex gap-1.5 shrink-0">
            <input
              type="text"
              value={voiceInput}
              onChange={(e) => setVoiceInput(e.target.value)}
              placeholder="e.g. 2 biscuits 3 milk..."
              className="bg-black/25 text-white placeholder-blue-200 border border-white/20 rounded-xl px-3 py-1.5 text-xs outline-none focus:bg-black/40 focus:border-white transition-all flex-1 sm:w-60"
            />
            <button
              type="submit"
              disabled={!voiceInput.trim()}
              className="px-3.5 py-1.5 bg-white text-blue-800 font-bold text-xs rounded-xl hover:bg-blue-50 disabled:opacity-40 transition-all shrink-0"
            >
              Add to Bill
            </button>
          </form>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 📱 MOBILE VIEW TAB SWITCHER (VISIBLE ONLY ON MOBILE < LG) */}
      {/* ========================================================= */}
      <div className="lg:hidden flex bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm sticky top-0 z-30">
        <button
          type="button"
          onClick={() => setMobileTab('products')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            mobileTab === 'products'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Search size={15} />
          <span>Products ({filteredProducts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('bill')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 relative ${
            mobileTab === 'bill'
              ? 'bg-blue-600 text-white shadow-md'
              : cart.length > 0
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <ShoppingCart size={15} />
          <span>Current Bill</span>
          {cartTotalQuantity > 0 && (
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
              mobileTab === 'bill' ? 'bg-white text-blue-700' : 'bg-emerald-600 text-white'
            }`}>
              {cartTotalQuantity} • ₹{subtotal}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* MAIN POS INTERFACE (PRODUCTS GRID + LIVE BILL)            */}
      {/* On Laptop (lg): Side-by-Side 2 columns                    */}
      {/* On Mobile (<lg): Clean dedicated views based on MobileTab  */}
      {/* ========================================================= */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        
        {/* ----------------------------------------------------- */}
        {/* 1. PRODUCTS PANEL                                     */}
        {/* ----------------------------------------------------- */}
        <div className={`w-full flex-1 flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden lg:h-[calc(100vh-17rem)] ${
          mobileTab === 'products' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Search Bar */}
          <div className="p-3 sm:p-4 border-b border-gray-200 bg-slate-50 flex items-center justify-between gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input
                type="text"
                placeholder="Search products or scan barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && search.trim()) {
                    e.preventDefault();
                    const code = search.trim();
                    const res = identifyProductByBarcode(code, products);
                    if (res) {
                      playBarcodeBeep();
                      handleBarcodeScanned(res.product);
                      setSearch('');
                    }
                  }
                }}
                className="w-full pl-9 pr-9 py-2 sm:py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-xs sm:text-sm transition-all"
              />
              <button
                type="button"
                onClick={() => setIsBarcodeModalOpen(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Open Camera Barcode Scanner"
              >
                <Barcode size={17} />
              </button>
            </div>
            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
              {filteredProducts.length} items
            </span>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-50/50">
            {filteredProducts.length === 0 ? (
              <div className="py-12 sm:py-16 text-center text-gray-400 space-y-3">
                <ShoppingCart size={36} className="mx-auto text-gray-300" />
                <p className="font-bold text-gray-700 text-sm">No matching products found</p>
                <p className="text-xs text-gray-400 max-w-sm mx-auto px-4">
                  Speak items or tap "Scan Barcode" to scan any packaging directly into the bill.
                </p>
                <button
                  type="button"
                  onClick={() => setIsBarcodeModalOpen(true)}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Barcode size={15} /> Scan Barcode to Add
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5">
                {filteredProducts.map(p => {
                  const cartItem = cart.find(ci => ci.product.id === p.id);
                  const isOutOfStock = p.stock === 0;

                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p, 1)}
                      disabled={isOutOfStock}
                      className={`relative p-3 sm:p-3.5 border rounded-2xl text-left transition-all flex flex-col justify-between select-none ${
                        isOutOfStock 
                          ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed' 
                          : cartItem
                            ? 'bg-blue-50/70 border-blue-400 shadow-xs active:scale-[0.98]'
                            : 'bg-white border-gray-200 hover:border-blue-500 hover:shadow-md active:scale-[0.98]'
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-1 mb-1.5 w-full">
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-wider truncate max-w-[90px]">
                          {p.category}
                        </span>

                        {isOutOfStock ? (
                          <span className="text-[9px] font-black px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full uppercase">
                            Out
                          </span>
                        ) : cartItem ? (
                          <span className="text-[10px] font-black px-2 py-0.5 bg-blue-600 text-white rounded-full flex items-center gap-1 shadow-xs animate-scale-in">
                            <span>{cartItem.quantity}</span>
                            <span className="text-[8px] opacity-80 uppercase">in bill</span>
                          </span>
                        ) : p.barcode ? (
                          <span className="font-mono text-[9px] text-gray-400 bg-slate-100 px-1 py-0.5 rounded flex items-center gap-0.5">
                            <Barcode size={9} />
                          </span>
                        ) : null}
                      </div>

                      {/* Product Name */}
                      <div className="font-bold text-xs sm:text-sm text-gray-900 mb-2 line-clamp-2 leading-tight">
                        {p.name}
                      </div>

                      {/* Price & Stock */}
                      <div className="flex justify-between items-baseline pt-2 border-t border-gray-100 mt-auto w-full">
                        <span className="font-black text-sm sm:text-base text-gray-900">₹{p.sellingPrice}</span>
                        <span className={`text-[10px] sm:text-[11px] font-semibold ${p.stock <= p.minimumStock ? 'text-amber-600' : 'text-gray-500'}`}>
                          Stock: {p.stock}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ----------------------------------------------------- */}
        {/* 2. LIVE CART / CURRENT BILL PANEL                     */}
        {/* On Mobile: Full width when mobileTab === 'bill'       */}
        {/* On Laptop: Side column w-96 always visible             */}
        {/* ----------------------------------------------------- */}
        <div className={`w-full lg:w-96 flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden lg:h-[calc(100vh-17rem)] ${
          mobileTab === 'bill' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Header */}
          <div className="p-3.5 sm:p-4 border-b border-gray-200 bg-slate-50 flex justify-between items-center">
            <div className="flex items-center gap-2">
              {/* Back button on mobile */}
              <button
                type="button"
                onClick={() => setMobileTab('products')}
                className="lg:hidden p-1.5 -ml-1 text-gray-600 hover:text-gray-900 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                title="Back to products list"
              >
                <ArrowLeft size={16} />
              </button>

              <h2 className="font-black text-sm sm:text-base text-gray-900 flex items-center gap-2">
                <ShoppingCart size={18} className="text-blue-600" />
                <span>Current Bill</span>
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to clear all items from this bill?")) {
                      setCart([]);
                    }
                  }}
                  className="text-xs text-red-600 hover:text-red-700 font-bold px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  Clear Bill
                </button>
              )}
              <span className="text-xs bg-blue-100 text-blue-800 font-black px-2.5 py-0.5 rounded-full">
                {cartTotalQuantity} items
              </span>
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3 py-10 sm:py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center shadow-xs">
                  <ShoppingCart size={28} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-700">Your bill is empty</p>
                  <p className="text-xs text-gray-400 max-w-[220px] mx-auto mt-0.5">
                    Scan a product barcode, speak your order, or tap items from the catalog.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2 w-full max-w-xs">
                  <button
                    type="button"
                    onClick={() => setMobileTab('products')}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <Search size={14} />
                    <span>Browse & Add Products</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBarcodeModalOpen(true)}
                    className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <Barcode size={15} />
                    <span>Scan Product Barcode</span>
                  </button>
                </div>
              </div>
            ) : (
              cart.map(item => (
                <div 
                  key={item.product.id} 
                  className="flex items-center justify-between p-3 bg-slate-50/80 hover:bg-slate-50 rounded-xl border border-gray-200/80 transition-all gap-2"
                >
                  {/* Name and Price per unit */}
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs sm:text-sm text-gray-900 truncate">
                      {item.product.name}
                    </div>
                    <div className="text-[11px] text-gray-500 font-medium">
                      ₹{item.product.sellingPrice} each • <span className="text-slate-400">{item.product.category}</span>
                    </div>
                  </div>

                  {/* Quantity Stepper & Amount */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div className="flex items-center border border-gray-300 rounded-lg bg-white shadow-2xs">
                      <button 
                        type="button"
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 active:bg-slate-100 transition-colors"
                        title="Decrease quantity"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-7 text-center font-black text-xs text-gray-900 select-none">
                        {item.quantity}
                      </span>
                      <button 
                        type="button"
                        onClick={() => updateQuantity(item.product.id, 1)}
                        disabled={item.quantity >= item.product.stock}
                        className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 active:bg-slate-100 disabled:opacity-30 transition-colors"
                        title="Increase quantity"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <div className="w-14 sm:w-16 text-right font-black text-xs sm:text-sm text-gray-900">
                      ₹{item.product.sellingPrice * item.quantity}
                    </div>

                    <button 
                      type="button"
                      onClick={() => updateQuantity(item.product.id, -item.quantity)}
                      className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Footer / Bill Summary */}
          {cart.length > 0 && (
            <div className="p-4 border-t border-gray-200 bg-slate-50 space-y-3">
              <div className="space-y-1.5 text-xs sm:text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>{tr(language, 'bill_subtotal')} ({cartTotalQuantity} items)</span>
                  <span className="font-semibold text-gray-700">₹{subtotal}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base font-black text-gray-900 pt-1.5 border-t border-gray-200">
                  <span>{tr(language, 'bill_total')} Payable</span>
                  <span className="text-lg sm:text-xl text-blue-600 font-black">₹{subtotal}</span>
                </div>
              </div>

              {/* Complete Sale Button */}
              <button
                type="button"
                onClick={() => completeSaleWithItems(cart)}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check size={18} />
                <span>Complete Sale & Print Bill (₹{subtotal})</span>
              </button>

              {/* Mobile button to add more items */}
              <button
                type="button"
                onClick={() => setMobileTab('products')}
                className="lg:hidden w-full py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                <span>+ Add More Items to Bill</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 🛒 MOBILE STICKY FLOATING BILL BAR                        */}
      {/* Visible only on mobile (<lg) when on 'products' tab and    */}
      {/* there are items in the cart so shopkeeper never loses bill */}
      {/* ========================================================= */}
      {mobileTab === 'products' && cart.length > 0 && (
        <div className="lg:hidden fixed bottom-3 left-3 right-3 z-40 animate-slide-up">
          <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3 shadow-2xl border border-slate-700 flex items-center justify-between gap-3">
            <div 
              onClick={() => setMobileTab('bill')}
              className="flex items-center gap-2.5 cursor-pointer flex-1"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <ShoppingCart size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-white">₹{subtotal}</span>
                  <span className="text-[10px] font-bold bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded-full">
                    {cartTotalQuantity} items
                  </span>
                </div>
                <div className="text-[10px] text-slate-300 truncate">
                  Tap to view current bill items
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileTab('bill')}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-1 shrink-0"
            >
              <span>View Bill</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        mode="billing"
        onScannedForBilling={handleBarcodeScanned}
      />

      {/* Sale Receipt Modal */}
      {showReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200 flex flex-col max-h-[92vh]">
            <div className="p-5 sm:p-6 bg-slate-900 text-white text-center relative">
              <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 font-black text-xl shadow-md">
                ✓
              </div>
              <h3 className="font-extrabold text-lg">{currentUser?.shopName || 'ShopStock Store'}</h3>
              <p className="text-xs text-blue-200 mt-0.5">Prop: {currentUser?.ownerName || 'Store Owner'}</p>
              <p className="text-[11px] text-gray-400 mt-1">Invoice #{showReceipt}</p>
            </div>

            <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4">
              <div className="border-b border-dashed border-gray-300 pb-3 text-xs space-y-1">
                <div className="flex justify-between text-gray-500">
                  <span>Date:</span>
                  <span>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Payment Mode:</span>
                  <span className="font-semibold text-gray-800">Cash / UPI</span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between font-bold text-gray-600 border-b border-gray-200 pb-1">
                  <span>Item</span>
                  <span>Qty × Price</span>
                  <span>Total</span>
                </div>
                {cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-gray-800 py-0.5">
                    <span className="font-medium truncate max-w-[120px]">{item.product.name}</span>
                    <span className="text-gray-500">{item.quantity} × ₹{item.product.sellingPrice}</span>
                    <span className="font-bold">₹{item.product.sellingPrice * item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="border-t-2 border-dashed border-gray-300 pt-3 flex justify-between items-baseline font-black">
                <span className="text-sm">Total Paid:</span>
                <span className="text-xl text-blue-600">₹{subtotal}</span>
              </div>

              <div className="text-center text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                {tr(language, 'bill_thank')}
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Printer size={15} /> Print
              </button>
              <button
                type="button"
                onClick={() => { setShowReceipt(null); setCart([]); setMobileTab('products'); }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition-all"
              >
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
