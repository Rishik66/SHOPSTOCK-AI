import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Bot, User, CheckCircle, XCircle, Volume2, VolumeX, Globe, AlertCircle, Sparkles, StopCircle, Check, HelpCircle, Activity } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { AIMessage, AIAction } from '../types';
import { processQuery, isRealAIConfigured } from '../services/aiService';
import { extractBestSpeechAlternative, normalizeSlangSpeech, cleanTextForSpeech } from '../services/speechAccentService';
import { GeminiModal } from '../components/GeminiModal';

export function AIAssistant() {
  const { products, setProducts, transactions, language, addNotification, currentUser, setCurrentPage } = useApp();
  
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>('');
  const [thinking, setThinking] = useState(false);
  const [pendingAction, setPendingAction] = useState<AIAction | null>(null);
  const [transcriptPreview, setTranscriptPreview] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [selectedVoiceLang, setSelectedVoiceLang] = useState<string>(
    language === 'te' ? 'te-IN' : language === 'hi' ? 'hi-IN' : language === 'kn' ? 'kn-IN' : 'en-IN'
  );

  // Text-To-Speech (Auto-Speak Aloud) State
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(true);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // Mic Hardware Diagnostic Test State
  const [testingMic, setTestingMic] = useState<boolean>(false);
  const [testVolume, setTestVolume] = useState<number>(0);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Gemini Real AI Modal State
  const [showGeminiModal, setShowGeminiModal] = useState<boolean>(false);
  const [isGeminiActive, setIsGeminiActive] = useState<boolean>(isRealAIConfigured());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const capturedTextRef = useRef<string>('');
  const silenceTimerRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);

  // Speech Synthesis Engine References
  const isSpeakingRef = useRef<boolean>(false);
  const speechCancelTimeoutRef = useRef<any>(null);
  const keepAliveIntervalRef = useRef<any>(null);
  const availableVoicesRef = useRef<SpeechSynthesisVoice[]>([]);

  const getSR = () => {
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  };

  const srSupported = !!getSR();

  // Populate and prime browser voices
  useEffect(() => {
    const updateVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        availableVoicesRef.current = window.speechSynthesis.getVoices();
      }
    };
    updateVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

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
      stopVoice();
      stopSpeaking();
    };
  }, []);

  // Stop speech synthesis & cancel all timers
  const stopSpeaking = () => {
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    setSpeakingMessageId(null);

    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
    if (speechCancelTimeoutRef.current) {
      clearTimeout(speechCancelTimeoutRef.current);
      speechCancelTimeoutRef.current = null;
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        console.warn("TTS cancel error:", e);
      }
    }
  };

  // Splits long text into conversational chunks (<=160 chars) to prevent Chrome's 15s freeze bug
  const splitIntoSpeechChunks = (text: string): string[] => {
    if (!text) return [];
    const rawSentences = text.split(/(?<=[.?!;:\n])\s+/);
    const chunks: string[] = [];

    for (const sentence of rawSentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      if (trimmed.length <= 160) {
        chunks.push(trimmed);
      } else {
        const parts = trimmed.split(/(?<=[,])\s+/);
        let temp = '';
        for (const part of parts) {
          if ((temp + ' ' + part).trim().length <= 160) {
            temp = temp ? `${temp} ${part}` : part;
          } else {
            if (temp) chunks.push(temp.trim());
            if (part.length > 160) {
              const words = part.split(' ');
              let wordChunk = '';
              for (const w of words) {
                if ((wordChunk + ' ' + w).length <= 160) {
                  wordChunk = wordChunk ? `${wordChunk} ${w}` : w;
                } else {
                  if (wordChunk) chunks.push(wordChunk.trim());
                  wordChunk = w;
                }
              }
              if (wordChunk) temp = wordChunk;
              else temp = '';
            } else {
              temp = part;
            }
          }
        }
        if (temp.trim()) {
          chunks.push(temp.trim());
        }
      }
    }

    return chunks.length > 0 ? chunks : [text];
  };

  // Finds the best matched browser voice for the selected language
  const findBestVoice = (targetLang: string): SpeechSynthesisVoice | null => {
    const voices = availableVoicesRef.current.length > 0
      ? availableVoicesRef.current
      : (typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis.getVoices() : []);
    
    if (!voices || voices.length === 0) return null;

    const targetLower = targetLang.toLowerCase();
    const langCode = targetLower.split('-')[0];

    // 1. Exact match (e.g. 'te-in')
    let match = voices.find(v => v.lang.toLowerCase() === targetLower || v.lang.toLowerCase().replace('_', '-') === targetLower);
    if (match) return match;

    // 2. Language prefix with 'india' or 'in'
    match = voices.find(v => v.lang.toLowerCase().startsWith(langCode) && (v.lang.toLowerCase().includes('in') || v.name.toLowerCase().includes('india')));
    if (match) return match;

    // 3. Any voice matching language code (e.g. starts with 'te', 'hi', 'kn', 'en')
    match = voices.find(v => v.lang.toLowerCase().startsWith(langCode));
    if (match) return match;

    // 4. If English, prefer Indian English voice
    if (langCode === 'en') {
      match = voices.find(v => v.name.toLowerCase().includes('india') || v.lang.toLowerCase().includes('en-in'));
      if (match) return match;
    }

    return null;
  };

  // Keep-alive timer prevents Chrome from pausing synthesis after 15 seconds
  const startKeepAlive = () => {
    if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
    keepAliveIntervalRef.current = setInterval(() => {
      if (typeof window !== 'undefined' && window.speechSynthesis && isSpeakingRef.current) {
        try {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } catch {}
      }
    }, 7000);
  };

  // Speaks clean text aloud sequentially
  const speak = (rawText: string, messageId?: string, force: boolean = false) => {
    if (!force && !autoSpeak) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Do not speak if microphone voice recognition is active
    if (isListeningRef.current) return;

    // Stop ongoing speech
    stopSpeaking();

    // 60ms buffer to allow Chrome's async cancel to finish
    speechCancelTimeoutRef.current = setTimeout(() => {
      try {
        const targetLang = selectedVoiceLang || (
          language === 'te' ? 'te-IN' :
          language === 'hi' ? 'hi-IN' :
          language === 'kn' ? 'kn-IN' : 'en-IN'
        );

        const cleaned = cleanTextForSpeech(rawText, targetLang);
        if (!cleaned || !cleaned.trim()) return;

        const chunks = splitIntoSpeechChunks(cleaned);
        if (chunks.length === 0) return;

        isSpeakingRef.current = true;
        setIsSpeaking(true);
        setSpeakingMessageId(messageId || null);

        startKeepAlive();

        const bestVoice = findBestVoice(targetLang);

        const playChunk = (index: number) => {
          if (!isSpeakingRef.current || index >= chunks.length) {
            stopSpeaking();
            return;
          }

          const utterance = new SpeechSynthesisUtterance(chunks[index]);
          utterance.lang = targetLang;
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          if (bestVoice) {
            utterance.voice = bestVoice;
          }

          utterance.onend = () => {
            if (isSpeakingRef.current) {
              if (index + 1 < chunks.length) {
                playChunk(index + 1);
              } else {
                stopSpeaking();
              }
            }
          };

          utterance.onerror = (event: any) => {
            if (event.error === 'interrupted' || event.error === 'canceled') {
              return;
            }
            console.warn("Speech chunk error:", event.error);
            if (isSpeakingRef.current) {
              if (index + 1 < chunks.length) {
                playChunk(index + 1);
              } else {
                stopSpeaking();
              }
            }
          };

          window.speechSynthesis.speak(utterance);
        };

        playChunk(0);
      } catch (err) {
        console.warn("Speech synthesis error:", err);
        stopSpeaking();
      }
    }, 60);
  };

  const stopVoice = (shouldSend: boolean = false) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    isListeningRef.current = false;
    setIsListening(false);
    setVoiceStatus('');

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (shouldSend) {
      const finalQuery = capturedTextRef.current.trim();
      if (finalQuery) {
        capturedTextRef.current = '';
        setTranscriptPreview('');
        handleSend(finalQuery);
      }
    }
  };

  const handleSend = async (text: string) => {
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

    try {
      const historySnapshot = messages.slice(-5).map(m => ({ role: m.role, text: m.text }));
      const response = await processQuery(
        text.trim(), 
        products, 
        transactions, 
        language, 
        currentUser, 
        historySnapshot
      );
      
      const aiMsg: AIMessage = {
        id: Date.now().toString() + 'ai',
        role: 'assistant',
        text: response.text,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, aiMsg]);
      speak(response.text, aiMsg.id);

      if (response.action) {
        setPendingAction(response.action);
      }
    } catch (err: any) {
      console.warn("AI processing error:", err);
      const fallbackMsg: AIMessage = {
        id: Date.now().toString() + 'ai-err',
        role: 'assistant',
        text: "I encountered a minor issue processing your request. Please try again or check your query.",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, fallbackMsg]);
      speak(fallbackMsg.text, fallbackMsg.id);
    } finally {
      setThinking(false);
    }
  };

  const startVoice = () => {
    stopSpeaking();
    stopVoice(false);
    setVoiceError(null);
    setTranscriptPreview('');
    capturedTextRef.current = '';

    if (!srSupported) {
      setVoiceError("Voice recognition requires Google Chrome or Microsoft Edge. Please open this site in Google Chrome.");
      return;
    }

    const SR = getSR();
    const recognition = new SR();
    recognitionRef.current = recognition;

    recognition.lang = selectedVoiceLang || 'en-IN';
    recognition.continuous = true; // DO NOT cut off prematurely
    recognition.interimResults = true; // Live typing as you speak
    recognition.maxAlternatives = 5; // Multi-candidate phonetic alternatives for regional accents

    recognition.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
      setVoiceStatus('Listening carefully... Speak at your own speed');
      setVoiceError(null);
    };

    recognition.onaudiostart = () => {
      setVoiceStatus('Microphone active — listening...');
    };

    recognition.onresult = (event: any) => {
      const { bestTranscript } = extractBestSpeechAlternative(event.results, products);
      const clean = bestTranscript.trim();
      if (clean) {
        capturedTextRef.current = clean;
        setTranscriptPreview(clean);
        setInput(clean);
        setVoiceStatus(`Heard: "${clean}"`);
      }

      // Reset silence grace period timer: 2.2 seconds of clear silence after speaking
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = setTimeout(() => {
        stopVoice(true);
      }, 2200);
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error === 'no-speech') {
        return; // Continuous mode handles silence gracefully
      }
      if (event.error === 'not-allowed') {
        setVoiceError("Microphone permission denied. Click the lock/tune icon next to https:// in your address bar and set Microphone to Allow.");
        stopVoice(false);
      } else if (event.error !== 'aborted') {
        setVoiceError(`Voice notice: ${event.error}. You can also type or use the quick query chips.`);
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        const finalQuery = capturedTextRef.current.trim();
        if (finalQuery) {
          stopVoice(true);
        } else {
          setIsListening(false);
          isListeningRef.current = false;
        }
      }
    };

    try {
      recognition.start();
    } catch (err: any) {
      console.error("Recognition start failed:", err);
      setIsListening(false);
      setVoiceError("Could not start microphone. Click the mic icon again to retry.");
    }
  };

  // Pure, Dedicated Speech Recognition without conflicting audio locks
  const toggleVoice = () => {
    if (isListening) {
      stopVoice(true);
    } else {
      startVoice();
    }
  };

  // Hardware Microphone Diagnostic Tool
  const runMicDiagnostic = async () => {
    setTestingMic(true);
    setTestResult(null);
    setTestVolume(0);

    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let animId: number | null = null;
    let peakVolume = 0;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const startTime = Date.now();

      const measure = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const norm = Math.min(100, Math.round((avg / 64) * 100));
        setTestVolume(norm);
        if (norm > peakVolume) peakVolume = norm;

        // Run for 3.5 seconds
        if (Date.now() - startTime < 3500) {
          animId = requestAnimationFrame(measure);
        } else {
          // Finished testing! Clean up stream immediately so SpeechRecognition has free mic
          if (animId) cancelAnimationFrame(animId);
          if (audioCtx) {
            try { audioCtx.close(); } catch {}
          }
          if (stream) {
            stream.getTracks().forEach(t => t.stop());
          }
          setTestingMic(false);
          setTestVolume(0);

          if (peakVolume > 8) {
            setTestResult(`✅ Microphone is working perfectly! Peak volume detected: ${peakVolume}%. Speech Recognition is ready.`);
          } else {
            setTestResult(`⚠️ Microphone detected 0% sound! Your microphone is muted in Windows, or input volume is 0%. Go to Windows Settings > Sound > Input volume.`);
          }
        }
      };

      measure();
    } catch (e: any) {
      setTestingMic(false);
      setTestResult("❌ Could not access microphone. Chrome has blocked mic permission. Click the lock icon in the URL bar to allow it.");
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
      speak(msgText, aiMsg.id);
    }
    setPendingAction(null);
  };

  const suggestions = React.useMemo(() => {
    if (language === 'te') {
      return [
        "📊 అమ్మకాలు పెంచడం ఎలా?",
        "🥛 గాయత్రి పాలు ఎంత ఉన్నాయి?",
        "📦 స్టాక్ ఎంత ఉంది?",
        "💰 నేటి అమ్మకాలు ఎంత?",
        "⚠️ తక్కువ స్టాక్ ఉన్నవి ఏవి?"
      ];
    }
    if (language === 'hi') {
      return [
        "📊 बिक्री कैसे बढ़ाएं?",
        "🥛 अमूल दूध कितना है?",
        "📦 स्टॉक कितना है?",
        "💰 आज की बिक्री कितनी है?",
        "⚠️ कम स्टॉक क्या है?"
      ];
    }
    if (language === 'kn') {
      return [
        "📊 ಮಾರಾಟ ಹೆಚ್ಚಿಸುವುದು ಹೇಗೆ?",
        "📦 ದಾಸ್ತಾನು ಎಷ್ಟಿದೆ?",
        "💰 ಇಂದಿನ ಮಾರಾಟ ಎಷ್ಟು?",
        "⚠️ ಕಡಿಮೆ ಇರುವ ಸರಕುಗಳು ಯಾವುವು?"
      ];
    }
    return [
      "📊 How to improve sales?",
      "🥛 How many Gayatri Milk do I have?",
      "Which products are low in stock?",
      "What should I restock?",
      "How much did I sell today?"
    ];
  }, [language]);

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
                Voice & Text AI
              </span>
            </h2>
            <p className="text-xs text-gray-500">
              Real-time shop assistant: Ask for sales improvement ideas, stock analysis, or speak voice commands
            </p>
          </div>
        </div>

        {/* Controls: Auto-Speak + Speaking Stop + AI Engine + Voice Language + Mic Diagnostic */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Active Speaking Indicator with Stop Button */}
          {isSpeaking && (
            <button
              type="button"
              onClick={stopSpeaking}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-500/20 animate-pulse transition-all cursor-pointer"
              title="AI is speaking aloud. Click to stop speech immediately"
            >
              <VolumeX size={14} />
              <span>Speaking... [Stop]</span>
            </button>
          )}

          {/* Auto-Speak ON/OFF Toggle */}
          <button
            type="button"
            onClick={() => {
              if (isSpeaking) stopSpeaking();
              setAutoSpeak(!autoSpeak);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              autoSpeak
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-xs'
                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
            }`}
            title={autoSpeak ? "Auto-Speak is ON: AI automatically speaks answers aloud. Click to mute" : "Auto-Speak is OFF: Click to enable voice answers"}
          >
            {autoSpeak ? <Volume2 size={13} className="text-emerald-600" /> : <VolumeX size={13} className="text-gray-400" />}
            <span className="hidden sm:inline">{autoSpeak ? 'Auto-Speak: ON' : 'Auto-Speak: OFF'}</span>
            <span className="sm:hidden">{autoSpeak ? 'Speak: ON' : 'Speak: OFF'}</span>
          </button>

          {/* AI Engine Status Button */}
          <button
            type="button"
            onClick={() => setShowGeminiModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              isGeminiActive
                ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
            title="Click to configure Real-Time Google Gemini AI"
          >
            <Sparkles size={13} className={isGeminiActive ? 'text-purple-600 animate-pulse' : 'text-emerald-600'} />
            <span className="hidden sm:inline">{isGeminiActive ? 'Google Gemini Live' : 'Connect Real AI'}</span>
            <span className="sm:hidden">{isGeminiActive ? 'Gemini' : 'Connect AI'}</span>
          </button>

          {/* Hardware Diagnostic Button */}
          <button
            type="button"
            onClick={runMicDiagnostic}
            disabled={testingMic}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-sm transition-all"
            title="Test if your physical microphone is receiving sound"
          >
            <Activity size={14} className={testingMic ? 'text-red-500 animate-spin' : 'text-blue-600'} />
            <span className="hidden sm:inline">{testingMic ? 'Testing Mic...' : 'Test Mic'}</span>
          </button>

          {/* Voice Language Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-gray-700 shadow-sm">
            <Globe size={14} className="text-blue-600" />
            <select
              value={selectedVoiceLang}
              onChange={(e) => setSelectedVoiceLang(e.target.value)}
              className="bg-transparent font-bold text-blue-700 outline-none cursor-pointer"
            >
              <option value="te-IN">🇮🇳 తెలుగు (Telugu)</option>
              <option value="en-IN">🇮🇳 English (India)</option>
              <option value="hi-IN">🇮🇳 हिन्दी (Hindi)</option>
              <option value="kn-IN">🇮🇳 ಕನ್ನಡ (Kannada)</option>
              <option value="en-US">🇺🇸 English (US)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Hardware Diagnostic Live Modal/Banner */}
      {testingMic && (
        <div className="bg-blue-600 text-white p-3.5 flex items-center justify-between gap-4 animate-fade-in shadow-md">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <div className="text-xs">
              <span className="font-bold uppercase tracking-wider block">Testing Physical Microphone...</span>
              <span>Say "Hello" or make a sound into your microphone right now!</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-mono">{testVolume}% Volume</span>
            <div className="w-24 h-3 bg-blue-800 rounded-full overflow-hidden p-0.5 border border-white/30">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-75"
                style={{ width: `${testVolume}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic Result Banner */}
      {testResult && (
        <div className={`p-3 text-xs flex items-center justify-between gap-2 border-b font-medium ${
          testResult.startsWith('✅') ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-amber-50 text-amber-900 border-amber-200'
        }`}>
          <span>{testResult}</span>
          <button onClick={() => setTestResult(null)} className="font-bold px-2 py-0.5 hover:opacity-75">✕</button>
        </div>
      )}

      {/* Real AI Connect Banner when running local engine */}
      {!isGeminiActive && (
        <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border-b border-purple-200/80 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-purple-900 shrink-0 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={16} className="text-purple-600 shrink-0" />
            <span className="truncate sm:overflow-visible">
              Unlock open conversational answers & deep sales analysis: <strong>Connect Google Gemini Real AI</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowGeminiModal(true)}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs shrink-0 shadow-xs transition-colors cursor-pointer"
          >
            Connect Free Key
          </button>
        </div>
      )}
      
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
              <div className="flex-1 whitespace-pre-line text-sm leading-relaxed">{msg.text}</div>
              {msg.role === 'assistant' && (
                <button
                  type="button"
                  onClick={() => {
                    if (isSpeaking && speakingMessageId === msg.id) {
                      stopSpeaking();
                    } else {
                      speak(msg.text, msg.id, true);
                    }
                  }}
                  title={isSpeaking && speakingMessageId === msg.id ? "Stop speaking aloud" : "Speak response aloud"}
                  className={`self-start p-1.5 rounded-lg transition-all cursor-pointer ${
                    isSpeaking && speakingMessageId === msg.id
                      ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse'
                      : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  {isSpeaking && speakingMessageId === msg.id ? (
                    <VolumeX size={16} />
                  ) : (
                    <Volume2 size={16} />
                  )}
                </button>
              )}
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
            <Sparkles size={12} className="text-amber-500" /> Click to Ask:
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

        {/* Live Speech Recognition Listening Banner */}
        {isListening && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-400 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-pulse">
            <div className="flex items-center gap-3 min-w-0">
              <span className="relative flex h-4 w-4 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600"></span>
              </span>
              <div className="min-w-0">
                <div className="text-xs font-black text-red-900 uppercase tracking-wider flex items-center gap-2">
                  <span>{voiceStatus || `Listening (${selectedVoiceLang})... Speak clearly`}</span>
                </div>
                <div className="text-sm font-bold text-gray-900 mt-1">
                  {transcriptPreview ? (
                    <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      "{transcriptPreview}"
                    </span>
                  ) : (
                    <span className="text-gray-600 italic font-normal">
                      Speak now (e.g., "Which products are low in stock?" or "Today's sales?")...
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={() => {
                  const text = capturedTextRef.current.trim() || transcriptPreview.trim() || input.trim();
                  stopVoice();
                  if (text) {
                    handleSend(text);
                    setTranscriptPreview('');
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Check size={14} /> Send Voice Query
              </button>
              <button
                type="button"
                onClick={() => {
                  capturedTextRef.current = '';
                  setTranscriptPreview('');
                  stopVoice();
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
          <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3.5 rounded-xl flex items-center justify-between gap-2 shadow-sm font-medium">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={18} className="text-amber-600 shrink-0" />
              <span>{voiceError}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runMicDiagnostic}
                className="underline font-bold text-blue-700 hover:text-blue-900"
              >
                Run Hardware Mic Test
              </button>
              <button onClick={() => setVoiceError(null)} className="text-amber-700 hover:text-amber-950 font-bold px-1.5 py-0.5 rounded">✕</button>
            </div>
          </div>
        )}

        {/* Text Input and Microphone Form */}
        <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} className="flex gap-2 relative">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={isListening ? "Listening... Speak into your microphone now" : tr(language, 'ai_placeholder')}
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
                : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
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

      {/* Google Gemini API Key Modal */}
      <GeminiModal
        isOpen={showGeminiModal}
        onClose={() => setShowGeminiModal(false)}
        onConfigChanged={() => setIsGeminiActive(isRealAIConfigured())}
      />
    </div>
  );
}
