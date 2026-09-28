import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle, 
  Mic, StopCircle, Sparkles, Volume2, Globe, AlertCircle, 
  ArrowRight, Check, Printer, Bot, RefreshCw 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { Product, CartItem } from '../types';
import { parseVoiceBillingCommand } from '../services/voiceBillingService';

export function Billing() {
  const { products, setProducts, transactions, setTransactions, language, addNotification, currentUser } = useApp();
  
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showReceipt, setShowReceipt] = useState<string | null>(null);

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

    const newTxn = {
      id: txId,
      date,
      items: targetCart.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        quantity: i.quantity,
        sellingPrice: i.product.sellingPrice,
        purchasePrice: i.product.purchasePrice
      })),
      total: currentTotal,
      profit
    };

    setTransactions([newTxn, ...transactions]);

    const newProducts = products.map(p => {
      const cItem = targetCart.find(i => i.product.id === p.id);
      if (cItem) {
        return { ...p, stock: p.stock - cItem.quantity };
      }
      return p;
    });
    setProducts(newProducts);
    
    addNotification({ type: 'success', message: tr(language, 'notif_sale') });
    setShowReceipt(txId);
    speak(`Bill generated for ₹${currentTotal}!`);
  };

  // Process spoken or written voice billing query
  const executeBillingCommand = (rawSpeech: string) => {
    if (!rawSpeech.trim()) return;
    setVoiceError(null);
    setVoiceFeedback(null);

    const result = parseVoiceBillingCommand(rawSpeech, products);

    if (result.action === 'CLEAR_CART') {
      setCart([]);
      setVoiceFeedback('Bill cleared.');
      speak('Bill cleared.');
      return;
    }

    if (result.action === 'NOT_UNDERSTOOD') {
      setVoiceError(result.feedback);
      speak("Could not match those items in inventory.");
      return;
    }

    // Clone current cart to mutate synchronously
    let updatedCart = [...cart];

    if (result.items.length > 0) {
      for (const item of result.items) {
        const existingIdx = updatedCart.findIndex(ci => ci.product.id === item.product.id);
        if (existingIdx >= 0) {
          const newQty = Math.min(item.product.stock, updatedCart[existingIdx].quantity + item.quantity);
          updatedCart[existingIdx] = { ...updatedCart[existingIdx], quantity: newQty };
        } else {
          const initialQty = Math.min(item.product.stock, item.quantity);
          updatedCart.push({ product: item.product, quantity: initialQty });
        }
      }
      setCart(updatedCart);
    }

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
        capturedTextRef.current = '';
        executeBillingCommand(text);
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
    executeBillingCommand(voiceInput.trim());
    setVoiceInput('');
  };

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* 🎙️ Voice Billing Agent Command Center */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-blue-500/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
              <Bot size={28} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  Voice Billing Agent
                  <span className="text-[10px] font-bold bg-emerald-400 text-emerald-950 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Hands-Free POS
                  </span>
                </h2>
              </div>
              <p className="text-xs text-blue-100 font-medium mt-0.5">
                Speak your customer's order: e.g. <span className="underline font-semibold">"2 biscuits and 3 milk packets"</span> or <span className="underline font-semibold">"Give bill"</span>
              </p>
            </div>
          </div>

          {/* Voice Controls: Mic Button & Locale */}
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            {/* Language Selector */}
            <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-xs">
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

            {/* Big Mic Button */}
            <button
              type="button"
              onClick={toggleVoiceBilling}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md ${
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
                  <span>Start Voice Billing</span>
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

        {/* Quick Voice Phrases + Manual Keyboard Entry */}
        <div className="mt-4 pt-3.5 border-t border-white/15 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Spoken Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-blue-200 flex items-center gap-1 mr-1">
              <Sparkles size={12} className="text-amber-300" /> Click to Test:
            </span>
            {[
              "2 biscuits and 3 milk packets",
              "1 Maggi and 2 Tata Salt",
              "2 Coca-Cola and 1 Bread",
              "Give bill"
            ].map((phrase, i) => (
              <button
                key={i}
                type="button"
                onClick={() => executeBillingCommand(phrase)}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg border border-white/20 transition-all text-left flex items-center gap-1.5"
              >
                <span>{phrase.includes('Give bill') ? '🧾' : '🎤'}</span>
                <span>{phrase}</span>
              </button>
            ))}
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
                placeholder={tr(language, 'bill_search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-sm transition-all"
              />
            </div>
            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
              {filteredProducts.length} items
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
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
                    <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md inline-block mb-1.5 uppercase tracking-wider">
                      {p.category}
                    </span>
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
              <span className="bg-blue-600 text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                {cart.reduce((s, i) => s + i.quantity, 0)} pcs
              </span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3 p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-400 flex items-center justify-center">
                  <ShoppingCart size={28} />
                </div>
                <div>
                  <p className="font-bold text-gray-700 text-sm">Bill is empty</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Click products or use the <strong className="text-blue-600">Voice Billing Agent</strong> above to speak items!
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {cart.map(item => (
                  <div key={item.product.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs text-gray-900 truncate">{item.product.name}</div>
                      <div className="text-[11px] text-gray-500">₹{item.product.sellingPrice} each</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm">
                        <button 
                          onClick={() => updateQuantity(item.product.id, -1)} 
                          className="p-1 text-gray-600 hover:text-gray-900"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-gray-900">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.product.id, 1)} 
                          disabled={item.quantity >= item.product.stock}
                          className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <div className="font-black text-xs text-gray-900 w-14 text-right">
                        ₹{item.product.sellingPrice * item.quantity}
                      </div>

                      <button 
                        onClick={() => updateQuantity(item.product.id, -item.quantity)} 
                        className="text-gray-400 hover:text-red-600 p-1"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200 bg-slate-50 space-y-3">
            <div className="flex justify-between items-center text-xs text-gray-600 font-medium">
              <span>{tr(language, 'bill_subtotal')}</span>
              <span className="font-bold text-gray-900">₹{subtotal}</span>
            </div>
            <div className="flex justify-between items-center text-lg font-black text-gray-900 pt-2 border-t border-gray-200">
              <span>{tr(language, 'bill_total')}</span>
              <span className="text-blue-600 text-2xl font-black">₹{subtotal}</span>
            </div>
            
            <button
              type="button"
              onClick={() => completeSaleWithItems(cart)}
              disabled={cart.length === 0}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-base shadow-lg shadow-blue-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <CheckCircle size={20} />
              <span>Complete Sale & Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* 🧾 Bill Receipt Modal */}
      {showReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 overflow-y-auto print:p-0">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-blue-600 text-white font-black text-xl rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-md">
                  S
                </div>
                <h2 className="text-xl font-black text-gray-900">{currentUser?.shopName || 'ShopStock Store'}</h2>
                <p className="text-xs text-gray-500 font-medium">{tr(language, 'bill_receipt')}</p>
                <div className="text-[11px] text-gray-400 mt-2 flex justify-between border-b border-gray-100 pb-2">
                  <span>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="font-mono font-bold text-gray-700">{showReceipt}</span>
                </div>
              </div>
              
              <div className="border-t border-b border-dashed border-gray-300 py-3 mb-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-400 font-semibold border-b border-gray-100 pb-1">
                      <th className="pb-1 font-bold">Item</th>
                      <th className="pb-1 font-bold text-right">Qty</th>
                      <th className="pb-1 font-bold text-right">Price</th>
                      <th className="pb-1 font-bold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {cart.map(item => (
                      <tr key={item.product.id}>
                        <td className="py-1.5 pr-2 truncate max-w-[130px] font-medium text-gray-900">{item.product.name}</td>
                        <td className="py-1.5 text-right font-semibold">{item.quantity}</td>
                        <td className="py-1.5 text-right text-gray-500">₹{item.product.sellingPrice}</td>
                        <td className="py-1.5 text-right font-bold text-gray-900">₹{item.product.sellingPrice * item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex justify-between items-center text-xl font-black text-gray-900 mb-6 bg-slate-50 p-3 rounded-xl">
                <span>{tr(language, 'bill_total')}</span>
                <span className="text-blue-600">₹{subtotal}</span>
              </div>
              
              <div className="text-center text-xs text-gray-500 font-medium">
                {tr(language, 'bill_thank')}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-slate-50 flex gap-2.5 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Printer size={15} /> {tr(language, 'bill_print')}
              </button>
              <button
                type="button"
                onClick={() => { setShowReceipt(null); setCart([]); }}
                className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all"
              >
                <Plus size={15} /> {tr(language, 'bill_newSale')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
