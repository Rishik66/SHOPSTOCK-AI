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

  const getSR = () => {
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  };

  const srSupported = !!getSR();

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

  const startVoice = () => {
    if (!srSupported) return;
    const SR = getSR();
    const recognition = new SR();
    
    const langMap: Record<string, string> = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN', kn: 'kn-IN' };
    recognition.lang = langMap[language] || 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleSend(transcript);
    };
    
    recognition.onerror = (event: any) => {
      console.error(event.error);
      setIsListening(false);
    };

    recognition.start();
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
        <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} className="flex gap-2 relative">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={isListening ? tr(language, 'ai_listening') : tr(language, 'ai_placeholder')}
            disabled={isListening}
            className="flex-1 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-4 py-3 pr-12 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <button
            type="button"
            onClick={startVoice}
            disabled={!srSupported}
            title={!srSupported ? tr(language, 'ai_noVoice') : ''}
            className={`absolute right-16 top-1/2 -translate-y-1/2 p-2 rounded-lg ${isListening ? 'text-red-500 bg-red-50 animate-pulse' : 'text-gray-400 hover:text-gray-600 disabled:opacity-50'}`}
          >
            <Mic size={20} />
          </button>
          <button
            type="submit"
            disabled={!input.trim() || isListening}
            className="px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
