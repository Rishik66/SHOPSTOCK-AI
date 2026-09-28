import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Bot, User, CheckCircle, XCircle, Volume2, Globe, AlertCircle, Sparkles, StopCircle, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { AIMessage, AIAction } from '../types';
import { processQuery } from '../services/aiService';

export function AIAssistant() {
  const { products, setProducts, transactions, language, addNotification, currentUser } = useApp();
  
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [pendingAction, setPendingAction] = useState<AIAction | null>(null);
  const [transcriptPreview, setTranscriptPreview] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [selectedVoiceLang, setSelectedVoiceLang] = useState<string>('en-IN');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const getSR = () => {
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  };

  const srSupported = !!getSR();

  // Match voice locale to UI language by default
  useEffect(() => {
    if (language === 'te') setSelectedVoiceLang('te-IN');
    else if (language === 'hi') setSelectedVoiceLang('hi-IN');
    else if (language === 'kn') setSelectedVoiceLang('kn-IN');
    else setSelectedVoiceLang('en-IN');
  }, [language]);

  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      text: tr(language, 'ai_greeting'),
      timestamp: new Date().toISOString()
    }]);
  }, [language]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking, pendingAction]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const langMap: Record<string, string> = { en: 'en-US', te: 'te-IN', hi: 'hi-IN', kn: 'kn-IN' };
      utterance.lang = langMap[language] || 'en-US';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("TTS error:", e);
    }
  };

  const stopListening = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      } catch {}
      mediaStreamRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsListening(false);
    setAudioLevel(0);
  };

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    
    const userMsg: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text.trim(),
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingAction(null);
    setThinking(true);

    setTimeout(() => {
      const response = processQuery(text.trim(), products, transactions, language);
      
      const aiMsg: AIMessage = {
        id: Date.now().toString() + 'ai',
        role: 'assistant',
        text: response.text,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, aiMsg]);
      setThinking(false);
      speak(response.text);

      if (response.action) {
        setPendingAction(response.action);
      }
    }, 500);
  };

  const toggleVoice = async () => {
    setVoiceError(null);
    setTranscriptPreview('');

    if (isListening) {
      stopListening();
      return;
    }

    if (!srSupported) {
      setVoiceError("Voice recognition requires Google Chrome or Microsoft Edge. Please open this site in Chrome or Edge.");
      return;
    }

    // 1. Hardware Microphone Verification & Decibel Meter
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 128;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateAudioLevel = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const normalized = Math.min(100, Math.round((avg / 64) * 100));
            setAudioLevel(normalized);
            animFrameRef.current = requestAnimationFrame(updateAudioLevel);
          };
          updateAudioLevel();
        }
      } catch (audioErr) {
        console.warn("Visualizer init skipped:", audioErr);
      }
    } catch (micErr: any) {
      console.warn("Microphone access blocked:", micErr);
      setVoiceError("Microphone access blocked. Click the lock/settings icon in the browser URL bar and allow Microphone.");
      return;
    }

    // 2. Initialize Speech Recognition
    const SR = getSR();
    const recognition = new SR();
    recognitionRef.current = recognition;

    recognition.lang = selectedVoiceLang;
    recognition.continuous = false; // Reliable single utterance recognition in Chrome
    recognition.interimResults = true; // Live typing preview as user speaks
    recognition.maxAlternatives = 1;

    let capturedText = '';

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceError(null);
    };

    recognition.onresult = (event: any) => {
      let accumulated = '';
      for (let i = 0; i < event.results.length; ++i) {
        accumulated += event.results[i][0].transcript;
      }
      const activeText = accumulated.trim();
      if (activeText) {
        capturedText = activeText;
        setTranscriptPreview(activeText);
        setInput(activeText);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      stopListening();
      if (event.error === 'no-speech') {
        setVoiceError("No speech was heard. Speak closer to the microphone, or try switching to 'English (US)' mode.");
      } else if (event.error === 'not-allowed') {
        setVoiceError("Microphone permission was denied. Click the lock icon in Chrome's address bar to enable it.");
      } else if (event.error === 'audio-capture') {
        setVoiceError("No audio input detected. Please check your Windows Microphone device in Sound Settings.");
      } else if (event.error === 'network') {
        setVoiceError("Speech recognition server network error. Try switching voice language or typing your question.");
      } else {
        setVoiceError(`Speech error (${event.error}). Try again or type below.`);
      }
    };

    recognition.onend = () => {
      stopListening();
      if (capturedText.trim()) {
        handleSend(capturedText.trim());
        setTranscriptPreview('');
      }
    };

    try {
      recognition.start();
    } catch (err: any) {
      console.error("Recognition start failed:", err);
      stopListening();
      setVoiceError("Could not start speech recognition. Please try clicking the mic again.");
    }
  };

  const handleAction = (confirm: boolean) => {
    if (!pendingAction) return;
    
    if (confirm) {
      setProducts(products.map(p => 
        p.id === pendingAction.productId ? { ...p, stock: pendingAction.newStock } : p
      ));
      
      const msgText = pendingAction.type === 'ADD_STOCK' ? 
        tr(language, 'ai_stockAdded', { qty: pendingAction.quantity, name: pendingAction.productName, new: pendingAction.newStock }) :
        tr(language, 'ai_stockRemoved', { qty: pendingAction.quantity, name: pendingAction.productName, new: pendingAction.newStock });
        
      addNotification({ 
        type: 'success', 
        message: pendingAction.type === 'ADD_STOCK' ? 
          tr(language, 'notif_stockAdded', { qty: pendingAction.quantity, name: pendingAction.productName }) :
          tr(language, 'notif_stockRemoved', { qty: pendingAction.quantity, name: pendingAction.productName })
      });
      
      const aiMsg: AIMessage = {
        id: Date.now().toString() + 'ai-conf',
        role: 'assistant',
        text: msgText,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMsg]);
      speak(msgText);
    }
    setPendingAction(null);
  };

  const suggestions = [
    "How many Maggi do I have?",
    "Which products are low in stock?",
    "What should I restock?",
    "How much did I sell today?",
    "Today's profit?",
    "Best selling products"
  ];

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden lg:h-[calc(100vh-4rem)]">
      {/* Top Header */}
      <div className="p-4 border-b border-gray-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
            <Bot size={22} />
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900 flex items-center gap-2">
              {tr(language, 'ai_title')}
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Live AI
              </span>
            </h2>
            <p className="text-xs text-gray-500">
              Ask about stock, sales, or say "Add 20 Maggi"
            </p>
          </div>
        </div>

        {/* Voice Language Selector */}
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-gray-700 shadow-sm">
          <Globe size={14} className="text-blue-600" />
          <span className="text-gray-400">Mic Lang:</span>
          <select
            value={selectedVoiceLang}
            onChange={(e) => setSelectedVoiceLang(e.target.value)}
            className="bg-transparent font-bold text-blue-700 outline-none cursor-pointer"
          >
            <option value="en-IN">🇮🇳 English (India)</option>
            <option value="en-US">🇺🇸 English (US)</option>
            <option value="hi-IN">🇮🇳 हिन्दी (Hindi)</option>
            <option value="te-IN">🇮🇳 తెలుగు (Telugu)</option>
            <option value="kn-IN">🇮🇳 ಕನ್ನಡ (Kannada)</option>
          </select>
        </div>
      </div>
      
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 flex gap-3 shadow-sm ${
              msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'
            }`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={18} />
                </div>
              )}
              <div className="whitespace-pre-line text-sm leading-relaxed">{msg.text}</div>
            </div>
          </div>
        ))}
        
        {thinking && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 rounded-bl-sm flex gap-3 items-center shadow-sm">
              <Bot size={20} className="text-blue-600 animate-spin" />
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        {pendingAction && !thinking && (
          <div className="flex justify-start ml-10">
            <div className="bg-white border-2 border-blue-500 rounded-2xl p-4 max-w-sm shadow-md space-y-3">
              <div className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle size={16} className="text-blue-600" /> Confirm Stock Update
              </div>
              <div className="text-sm font-semibold text-gray-800">
                {pendingAction.productName}: {pendingAction.currentStock} → <span className="text-blue-600 font-bold text-base">{pendingAction.newStock} units</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleAction(true)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20">
                  <CheckCircle size={16} /> {tr(language, 'ai_confirm')}
                </button>
                <button onClick={() => handleAction(false)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200">
                  <XCircle size={16} /> {tr(language, 'ai_cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
      
      {/* Bottom Input Area */}
      <div className="p-4 border-t border-gray-200 bg-white space-y-3">
        {/* Suggested Quick Questions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1 mr-1">
            <Sparkles size={12} className="text-amber-500" /> Suggestions:
          </span>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSend(s)}
              className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-gray-700 border border-slate-200 rounded-full text-xs font-medium transition-all"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Live Audio & Voice Listening Banner */}
        {isListening && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3 min-w-0">
              <span className="relative flex h-3.5 w-3.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600"></span>
              </span>
              <div className="min-w-0">
                <div className="text-xs font-black text-red-900 uppercase tracking-wider flex items-center gap-2">
                  <span>Listening ({selectedVoiceLang})... Speak clearly</span>
                  {/* Live decibel level bar */}
                  <div className="flex items-center gap-0.5 h-3 ml-2">
                    {[15, 35, 55, 75, 95].map((thresh, idx) => (
                      <span
                        key={idx}
                        className={`w-1 rounded-full transition-all duration-75 ${
                          audioLevel >= thresh ? 'bg-emerald-500 h-3.5' : 'bg-gray-300 h-1.5'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-800 italic truncate mt-0.5">
                  {transcriptPreview || "Speak your question now (e.g. 'How many Maggi do I have?')..."}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={stopListening}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                Done / Process
              </button>
              <button
                type="button"
                onClick={() => {
                  stopListening();
                  setTranscriptPreview('');
                  setInput('');
                }}
                className="px-3 py-2 text-gray-500 hover:text-gray-800 text-xs font-bold rounded-xl hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Voice Error Banner */}
        {voiceError && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3 rounded-xl flex items-center justify-between gap-2 shadow-sm font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-600 shrink-0" />
              <span>{voiceError}</span>
            </div>
            <button onClick={() => setVoiceError(null)} className="text-amber-700 hover:text-amber-950 font-bold px-1.5 py-0.5 rounded">✕</button>
          </div>
        )}

        {/* Input and Microphone Form */}
        <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} className="flex gap-2 relative">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={isListening ? "Listening to your voice... Speak now" : tr(language, 'ai_placeholder')}
            className="flex-1 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl px-4 py-3 pr-24 focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none text-sm transition-all"
          />
          
          {/* Microphone Action Button */}
          <button
            type="button"
            onClick={toggleVoice}
            title={isListening ? "Click to Stop & Send" : "Click to Speak"}
            className={`absolute right-14 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${
              isListening 
                ? 'text-white bg-red-600 animate-pulse hover:bg-red-700 shadow-md shadow-red-500/30' 
                : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
            }`}
          >
            {isListening ? <StopCircle size={20} /> : <Mic size={20} />}
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-md shadow-blue-500/20 transition-all"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
