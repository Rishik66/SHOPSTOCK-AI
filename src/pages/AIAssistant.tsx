import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Bot, User, CheckCircle, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { AIMessage, AIAction } from '../types';
import { processQuery } from '../services/aiService';

export function AIAssistant() {
  const { products, setProducts, transactions, language, addNotification } = useApp();
  
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [pendingAction, setPendingAction] = useState<AIAction | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);



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

  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    const langMap: Record<string, string> = { en: 'en-US', te: 'te-IN', hi: 'hi-IN', kn: 'kn-IN' };
    utterance.lang = langMap[language] || 'en-US';
    window.speechSynthesis.speak(utterance);
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
    }, 600);
  };

  const [transcriptPreview, setTranscriptPreview] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  const getSR = () => {
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  };

  const srSupported = !!getSR();

  const toggleVoice = () => {
    setVoiceError(null);

    // If currently listening, stop and send
    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsListening(false);
      return;
    }

    if (!srSupported) {
      setVoiceError(tr(language, 'ai_noVoice'));
      return;
    }

    const SR = getSR();
    const recognition = new SR();
    recognitionRef.current = recognition;

    const langMap: Record<string, string> = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN', kn: 'kn-IN' };
    recognition.lang = langMap[language] || 'en-IN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let capturedText = '';

    recognition.onstart = () => {
      setIsListening(true);
      setTranscriptPreview('');
      setVoiceError(null);
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          final += item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }

      const activeText = (final || interim).trim();
      if (activeText) {
        capturedText = activeText;
        setTranscriptPreview(activeText);
        setInput(activeText);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error === 'no-speech') {
        setVoiceError("No speech detected. Please speak closer to your microphone or check microphone volume in Windows settings.");
      } else if (event.error === 'not-allowed') {
        setVoiceError("Microphone permission was blocked. Click the lock/settings icon in the browser address bar to allow microphone access.");
      } else if (event.error === 'audio-capture') {
        setVoiceError("No microphone found. Please connect or enable your microphone.");
      } else if (event.error === 'network') {
        setVoiceError("Speech service network error. Please try again or type your question.");
      } else {
        setVoiceError(`Voice error (${event.error}). Try again or type below.`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (capturedText.trim()) {
        handleSend(capturedText.trim());
        setTranscriptPreview('');
      }
    };

    try {
      recognition.start();
    } catch (err: any) {
      console.error("Recognition start failed:", err);
      setIsListening(false);
      setVoiceError("Could not start microphone. Please try again.");
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
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden lg:h-[calc(100vh-4rem)]">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Bot size={24} /></div>
        <div>
          <h2 className="font-semibold text-lg">{tr(language, 'ai_title')}</h2>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-4 flex gap-3 ${
              msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}>
              {msg.role === 'assistant' && <Bot size={20} className="text-gray-500 shrink-0 mt-0.5" />}
              <div className="whitespace-pre-line text-[15px]">{msg.text}</div>
            </div>
          </div>
        ))}
        
        {thinking && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl p-4 rounded-bl-sm flex gap-3 items-center">
              <Bot size={20} className="text-gray-500" />
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        {pendingAction && !thinking && (
          <div className="flex justify-start ml-11">
            <div className="bg-white border border-gray-200 rounded-xl p-4 max-w-sm shadow-sm space-y-3">
              <div className="text-sm font-medium text-gray-800">
                Current stock: {pendingAction.currentStock} → New stock: {pendingAction.newStock}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleAction(true)} className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  <CheckCircle size={16} /> {tr(language, 'ai_confirm')}
                </button>
                <button onClick={() => handleAction(false)} className="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300">
                  <XCircle size={16} /> {tr(language, 'ai_cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t border-gray-200 bg-white space-y-3">
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => handleSend(s)} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Live Voice Listening Banner */}
        {isListening && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm animate-pulse">
            <div className="flex items-center gap-3 min-w-0">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-red-800 uppercase tracking-wider">
                  Listening ({language.toUpperCase()})... Speak now
                </div>
                <div className="text-sm text-gray-800 italic truncate font-medium">
                  {transcriptPreview || "Listening for your voice... (e.g., 'How many Maggi do I have?')"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleVoice}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 shadow-sm"
              >
                Done / Send
              </button>
              <button
                type="button"
                onClick={() => {
                  if (recognitionRef.current) {
                    try { recognitionRef.current.abort(); } catch {}
                  }
                  setIsListening(false);
                  setTranscriptPreview('');
                  setInput('');
                }}
                className="px-2 py-1.5 text-gray-500 text-xs font-semibold hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Voice Error Banner */}
        {voiceError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded-xl flex items-center justify-between gap-2 shadow-sm">
            <span className="font-medium">{voiceError}</span>
            <button onClick={() => setVoiceError(null)} className="text-amber-700 hover:text-amber-950 font-bold px-1.5 py-0.5 rounded">✕</button>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} className="flex gap-2 relative">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={isListening ? "Listening... speak now" : tr(language, 'ai_placeholder')}
            className="flex-1 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-4 py-3 pr-12 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <button
            type="button"
            onClick={toggleVoice}
            disabled={!srSupported}
            title={!srSupported ? tr(language, 'ai_noVoice') : (isListening ? "Click to Stop & Send" : "Click to Speak")}
            className={`absolute right-16 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${
              isListening 
                ? 'text-white bg-red-600 animate-pulse hover:bg-red-700 shadow-md' 
                : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40'
            }`}
          >
            <Mic size={20} />
          </button>
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
