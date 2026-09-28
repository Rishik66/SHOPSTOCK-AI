import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle, 
  Mic, StopCircle, Sparkles, Volume2, Globe, AlertCircle, 
  ArrowRight, Check, Printer, Bot, RefreshCw, Barcode 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { Product, CartItem } from '../types';
import { parseVoiceBillingCommand } from '../services/voiceBillingService';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { identifyProductByBarcode, playBarcodeBeep, FMCG_BARCODE_CATALOG } from '../services/barcodeService';

export function Billing() {
  const { products, setProducts, transactions, setTransactions, language, addNotification, currentUser } = useApp();
  
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showReceipt, setShowReceipt] = useState<string | null>(null);

  // Barcode Scanner Modal State
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);

  // Voice Billing Agent State
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceInput, setVoiceInput] = useState('');
  const [voiceLang, setVoiceLang] = useState('en-US');

  const recognitionRef = useRef<any>(null);
  const capturedTextRef = useRef('');

  // Synchronize default voice locale with app language
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

  const subtotal = cart.reduce((sum, item) => sum + (item.product.sellingPrice * item.quantity), 0);

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

    const result = parseVoiceBillingCommand(speechText, products);

    if (result.action === 'NOT_UNDERSTOOD') {
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
      const existingIdx = updatedCart.findIndex(item => item.product.id === newItem.product.id);
      if (existingIdx >= 0) {
        const targetQty = updatedCart[existingIdx].quantity + newItem.quantity;
        const finalQty = Math.min(newItem.product.stock, targetQty);
        updatedCart[existingIdx] = {
          ...updatedCart[existingIdx],
          quantity: finalQty
        };
      } else {
        const finalQty = Math.min(newItem.product.stock, newItem.quantity);
        if (finalQty > 0) {
          updatedCart.push({ product: newItem.product, quantity: finalQty });
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

  // Toggle voice recognition
  const toggleVoiceBilling = () => {
    setVoiceError(null);
    setVoiceFeedback(null);
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
      console.warn('Voice billing error:', event.error);
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
        executeBillingCommand(text);
      }
    };

    try {
      recognition.start();
    } catch (e: any) {
      setVoiceError('Could not start microphone. Please refresh or check browser permissions.');
      setIsListening(false);
    }
  };

  const handleManualVoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiceInput.trim()) return;
    executeBillingCommand(voiceInput.trim());
    setVoiceInput('');
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* 🚀 AI Voice Assistant & Barcode Scanner Billing Strip */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl shadow-blue-900/20 border border-blue-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                Instant Billing
              </span>
              <span className="text-xs text-blue-200 font-semibold">
                Speak or Scan to add products directly to the bill
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
              <span>Smart Billing Agent</span>
              <Bot size={24} className="text-blue-300" />
            </h1>
            <p className="text-xs text-blue-100 max-w-xl">
              Tell the agent e.g. <span className="underline decoration-amber-400 font-bold">"2 biscuits and 3 milk packets"</span> or click <span className="font-bold text-amber-300">Scan Barcode</span> to instantly scan items with camera!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
            {/* Language Selector */}
            <div className="flex items-center gap-1.5 bg-black/25 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-xs">
              <Globe size={14} className="text-blue-200" />
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

            {/* 📷 Barcode Scanner Button */}
            <button
              type="button"
              onClick={() => setIsBarcodeModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
              title="Scan Barcode with Camera or Barcode Gun to Add Item to Bill"
            >
              <Barcode size={18} />
              <span>Scan Barcode</span>
            </button>

            {/* Big Mic Button */}
            <button
              type="button"
              onClick={toggleVoiceBilling}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse hover:bg-red-600 shadow-red-500/50'
                  : 'bg-white text-blue-700 hover:bg-blue-50 shadow-white/20'
              }`}
            >
              {isListening ? (
                <>
                  <StopCircle size={18} className="animate-spin" />
                  <span>Stop & Bill</span>
                </>
              ) : (
                <>
                  <Mic size={18} />
                  <span>Voice Billing</span>
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
                  Listening to your shop order... Speak now!
                </span>
                <span className="text-sm font-black text-white">
                  {voiceTranscript ? `"${voiceTranscript}"` : 'Say e.g. "2 biscuits and 3 milk packets"...'}
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
                  if (text) executeBillingCommand(text);
                }}
                className="px-3 py-1.5 bg-white text-red-700 font-bold text-xs rounded-lg shadow-sm hover:bg-red-50"
              >
                ✓ Add to Bill Now
              </button>
            </div>
          </div>
        )}

        {/* Voice Feedback Success Banner */}
        {voiceFeedback && (
          <div className="mt-3 p-3 bg-emerald-500/90 text-white rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-white shrink-0" />
              <span>{voiceFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => speak(voiceFeedback)}
              title="Hear voice confirmation"
              className="p-1 hover:bg-white/20 rounded-md transition-colors"
            >
              <Volume2 size={16} />
            </button>
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

        {/* Quick Voice & Barcode Test Chips + Manual Input */}
        <div className="mt-4 pt-3.5 border-t border-white/15 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Spoken & Barcode Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-blue-200 flex items-center gap-1 mr-1">
              <Sparkles size={12} className="text-amber-300" /> Click to Test:
            </span>
            <button
              type="button"
              onClick={() => handleBarcodeScanned({ id: '1', name: 'Parle-G Biscuits', category: 'Biscuits', stock: 25, purchasePrice: 8, sellingPrice: 10, minimumStock: 20, barcode: '8901719101038' })}
              className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm"
            >
              <Barcode size={13} />
              <span>Scan Parle-G (₹10)</span>
            </button>
            <button
              type="button"
              onClick={() => handleBarcodeScanned({ id: '2', name: 'Amul Milk', category: 'Dairy', stock: 15, purchasePrice: 54, sellingPrice: 60, minimumStock: 10, barcode: '8901262010047' })}
              className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm"
            >
              <Barcode size={13} />
              <span>Scan Milk (₹60)</span>
            </button>
            <button
              type="button"
              onClick={() => executeBillingCommand("2 biscuits and 3 milk packets")}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg border border-white/20 transition-all text-left flex items-center gap-1.5"
            >
              <span>🎤</span>
              <span>2 biscuits 3 milk</span>
            </button>
            <button
              type="button"
              onClick={() => executeBillingCommand("Give bill")}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg border border-white/20 transition-all text-left flex items-center gap-1.5"
            >
              <span>🧾</span>
              <span>Give bill</span>
            </button>
          </div>

          {/* Quick Manual Voice Command Input */}
          <form onSubmit={handleManualVoiceSubmit} className="flex gap-1.5 shrink-0">
            <input
              type="text"
              value={voiceInput}
              onChange={(e) => setVoiceInput(e.target.value)}
              placeholder="Or type: 2 biscuits 3 milk..."
              className="bg-black/25 text-white placeholder-blue-200 border border-white/20 rounded-xl px-3 py-1.5 text-xs outline-none focus:bg-black/40 focus:border-white transition-all w-48 sm:w-60"
            />
            <button
              type="submit"
              disabled={!voiceInput.trim()}
              className="px-3 py-1.5 bg-white text-blue-800 font-bold text-xs rounded-xl hover:bg-blue-50 disabled:opacity-40 transition-all flex items-center gap-1"
            >
              Add
            </button>
          </form>
        </div>
      </div>

      {/* Main POS Interface (Products Grid + Live Cart) */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Products Panel */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden lg:h-[calc(100vh-17rem)]">
          <div className="p-4 border-b border-gray-200 bg-slate-50 flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search products or scan barcode (press Enter)..."
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
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-sm transition-all"
              />
              <button
                type="button"
                onClick={() => setIsBarcodeModalOpen(true)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Open Camera Barcode Scanner"
              >
                <Barcode size={18} />
              </button>
            </div>
            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
              {filteredProducts.length} items
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
            {filteredProducts.length === 0 ? (
              <div className="py-16 text-center text-gray-400 space-y-3">
                <ShoppingCart size={40} className="mx-auto text-gray-300" />
                <p className="font-bold text-gray-700 text-sm">No matching products found</p>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  You can speak items ("2 biscuits and 3 milk packets") or tap "Scan Barcode" to scan any item packaging directly.
                </p>
                <button
                  type="button"
                  onClick={() => setIsBarcodeModalOpen(true)}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Barcode size={16} /> Scan Barcode to Add
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {filteredProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p, 1)}
                    disabled={p.stock === 0}
                    className={`relative p-3.5 border rounded-2xl text-left transition-all flex flex-col justify-between ${
                      p.stock === 0 
                        ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed' 
                        : 'bg-white border-gray-200 hover:border-blue-500 hover:shadow-md active:scale-[0.98]'
                    }`}
                  >
                    {p.stock === 0 && (
                      <div className="absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-full uppercase">
                        Out
                      </div>
                    )}
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          {p.category}
                        </span>
                        {p.barcode && (
                          <span className="font-mono text-[9px] text-gray-400 bg-slate-100 px-1 py-0.5 rounded flex items-center gap-0.5">
                            <Barcode size={10} />
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-sm text-gray-900 mb-2 line-clamp-1">{p.name}</div>
                    </div>
                    <div className="flex justify-between items-baseline pt-2 border-t border-gray-100 mt-2">
                      <span className="font-black text-base text-gray-900">₹{p.sellingPrice}</span>
                      <span className={`text-[11px] font-semibold ${p.stock <= p.minimumStock ? 'text-amber-600' : 'text-gray-500'}`}>
                        Stock: {p.stock}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Cart / Bill Panel */}
        <div className="w-full lg:w-96 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden lg:h-[calc(100vh-17rem)]">
          <div className="p-4 border-b border-gray-200 bg-slate-50 flex justify-between items-center">
            <h2 className="font-bold text-base text-gray-900 flex items-center gap-2">
              <ShoppingCart size={18} className="text-blue-600" />
              <span>Current Bill</span>
            </h2>
            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs text-red-600 hover:underline font-medium"
                >
                  Clear
                </button>
              )}
              <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                {cart.reduce((s, i) => s + i.quantity, 0)} items
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2 py-12">
                <ShoppingCart size={40} className="text-gray-300" />
                <p className="text-sm font-semibold text-gray-600">Bill is empty</p>
                <p className="text-xs text-gray-400 text-center max-w-[200px]">
                  Scan a barcode, speak your order, or click products to build the bill.
                </p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.product.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-gray-100">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="font-bold text-sm text-gray-900 truncate">{item.product.name}</div>
                    <div className="text-xs text-gray-500 font-medium">₹{item.product.sellingPrice} each</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center border border-gray-300 rounded-lg bg-white">
                      <button 
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="p-1 text-gray-500 hover:text-gray-800 transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-7 text-center font-bold text-xs">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.product.id, 1)}
                        disabled={item.quantity >= item.product.stock}
                        className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="w-16 text-right font-black text-sm text-gray-900">
                      ₹{item.product.sellingPrice * item.quantity}
                    </div>
                    <button 
                      onClick={() => updateQuantity(item.product.id, -item.quantity)}
                      className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-gray-200 bg-slate-50 space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-500 text-xs">
                <span>{tr(language, 'bill_subtotal')}</span>
                <span>₹{subtotal}</span>
              </div>
              <div className="flex justify-between text-base font-black text-gray-900 pt-1 border-t border-gray-200">
                <span>{tr(language, 'bill_total')}</span>
                <span className="text-xl text-blue-600">₹{subtotal}</span>
              </div>
            </div>

            <button
              onClick={() => completeSaleWithItems(cart)}
              disabled={cart.length === 0}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Check size={18} />
              <span>{tr(language, 'bill_complete')} (₹{subtotal})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        mode="billing"
        onScannedForBilling={handleBarcodeScanned}
      />

      {/* Sale Receipt Modal */}
      {showReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
            <div className="p-6 bg-slate-900 text-white text-center relative">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 font-black text-xl shadow-md">
                ✓
              </div>
              <h3 className="font-extrabold text-lg">{currentUser?.shopName || 'ShopStock Store'}</h3>
              <p className="text-xs text-blue-200 mt-0.5">Prop: {currentUser?.ownerName || 'Store Owner'}</p>
              <p className="text-[11px] text-gray-400 mt-1">Invoice #{showReceipt}</p>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4">
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
                  <div key={idx} className="flex justify-between items-center text-gray-800">
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
                onClick={() => { setShowReceipt(null); setCart([]); }}
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
