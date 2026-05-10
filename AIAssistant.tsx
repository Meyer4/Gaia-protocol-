import React, { useState, useEffect, useRef } from 'react';
import { Bot, Mic, MicOff, X, Volume2, VolumeX, MessageSquare, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { GoogleGenAI } from '@google/genai';

export function AIAssistant() {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: string, text: string}[]>([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [selectedLang, setSelectedLang] = useState(navigator.language || 'en-US');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthesisRef.current = window.speechSynthesis;
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onstart = () => {
          setIsListening(true);
        };
        
        recognitionRef.current.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          
          if (finalTranscript) {
            setInputText(finalTranscript);
            handleSendMessage(finalTranscript);
          } else if (interimTranscript) {
            setInputText(interimTranscript);
          }
        };
        
        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
        };
        
        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }
  }, []);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = selectedLang;
    }
  }, [selectedLang]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speak = (text: string) => {
    if (!voiceEnabled || !synthesisRef.current) return;
    
    // Stop any ongoing speech
    synthesisRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Try to find a good voice for the current language
    const voices = synthesisRef.current.getVoices();
    const lang = selectedLang;
    
    const preferredVoice = voices.find(v => v.lang.startsWith(lang) && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium'))) 
                        || voices.find(v => v.lang.startsWith(lang))
                        || voices.find(v => v.lang.startsWith('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthesisRef.current.speak(utterance);
  };

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        // Cancel any ongoing speaking before listening
        if (synthesisRef.current?.speaking) {
          synthesisRef.current.cancel();
        }
        recognitionRef.current?.start();
      } catch (e) {}
    }
  };

  const stopSpeaking = () => {
    synthesisRef.current?.cancel();
    setIsSpeaking(false);
  };

  const handleSendMessage = async (textToUse?: string) => {
    const messageText = textToUse || inputText;
    if (!messageText.trim()) return;

    if (isOffline) {
      setMessages(prev => [...prev, { role: 'model', text: "I'm sorry, I am not available offline. Please check your internet connection." }]);
      setInputText('');
      speak("I'm sorry, I am not available offline. Please check your internet connection.");
      return;
    }

    const newMessages = [...messages, { role: 'user', text: messageText }];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const systemInstruction = `You are Gaia, a highly capable AI assistant integrated into the Gaia Protocol dashboard. Your personality is professional, highly intelligent, and helpful—similar to top-tier AI assistants like Claude or Microsoft Copilot. You should always respond in the user's preferred spoken language: ${selectedLang}. Keep responses concise, clear, and natural to be spoken aloud by a text-to-speech engine.`;


      const chatHistory = messages.slice(-10).map((h: any) => ({
        role: h.role, // "user" or "model"
        parts: [{ text: h.text }]
      }));
      chatHistory.push({ role: 'user', parts: [{ text: messageText }] });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: chatHistory,
        config: { systemInstruction }
      });
      
      const responseText = response.text || "Sorry, I can't speak right now.";
      
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
      speak(responseText);
    } catch (error: any) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: `Sorry, an error occurred: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 p-4 rounded-full shadow-lg z-50 flex items-center justify-center transition-all duration-500
          ${isSpeaking ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.5)]' : 'bg-zinc-800 text-emerald-400 hover:bg-zinc-700 border border-zinc-700'}
          ${isOpen ? 'hidden' : 'block'}
        `}
      >
        <Bot className={`w-7 h-7 ${isSpeaking ? 'animate-pulse' : ''}`} />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 w-80 sm:w-96 h-[500px] z-50 flex flex-col shadow-2xl"
          >
            <Card className="flex-1 flex flex-col bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden">
              <CardHeader className="p-4 border-b border-zinc-800 flex flex-row items-center justify-between pb-4 space-y-0">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-zinc-100">
                  <Bot className={`w-5 h-5 ${isSpeaking ? 'text-emerald-400 animate-pulse' : 'text-zinc-400'}`} />
                  Gaia {isOffline && <span className="text-xs text-rose-500 font-normal ml-2 border border-rose-500/50 rounded-full px-2 py-0.5 bg-rose-500/10">Offline</span>}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <select 
                    value={selectedLang}
                    onChange={(e) => setSelectedLang(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-md px-2 py-1 outline-none"
                  >
                    <option value="en-US">English</option>
                    <option value="es-ES">Español</option>
                    <option value="fr-FR">Français</option>
                    <option value="de-DE">Deutsch</option>
                    <option value="zh-CN">中文</option>
                    <option value="ja-JP">日本語</option>
                    <option value="hi-IN">हिन्दी</option>
                    <option value="ny-MW">Chichewa</option>
                    <option value="ar-SA">العربية</option>
                  </select>
                  <button 
                    onClick={() => setVoiceEnabled(!voiceEnabled)}
                    className={`p-1.5 rounded-md hover:bg-zinc-800 transition-colors ${voiceEnabled ? 'text-emerald-400' : 'text-zinc-500'}`}
                    title={voiceEnabled ? "Voice Enabled" : "Voice Disabled"}
                  >
                    {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-50">
                    <MessageSquare className="w-10 h-10 text-emerald-500" />
                    <p className="text-sm font-medium text-zinc-300">How can I help you manage the network today?</p>
                  </div>
                )}
                
                {messages.map((msg, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={i} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                        msg.role === 'user' 
                          ? 'bg-emerald-600 text-white rounded-br-sm' 
                          : 'bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-bl-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="bg-zinc-800 border border-zinc-700 rounded-2xl rounded-bl-sm px-4 py-2 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                      <span className="text-xs text-zinc-400 font-medium">Processing...</span>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </CardContent>

              <CardFooter className="p-3 border-t border-zinc-800 flex items-center gap-2 bg-zinc-950">
                {isSpeaking && (
                   <button
                     onClick={stopSpeaking}
                     className="absolute -top-12 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 text-rose-400 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 hover:bg-zinc-700 transition-colors shadow-lg z-10"
                   >
                     <VolumeX className="w-3 h-3" /> Stop Speaking
                   </button>
                )}
                
                <button
                  onClick={toggleListen}
                  className={`p-2.5 rounded-full flex-shrink-0 transition-all duration-300 ${
                    isListening 
                      ? 'bg-red-500/20 text-red-500 border border-red-500/50 animate-pulse' 
                      : 'bg-zinc-800 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-700'
                  }`}
                  disabled={isLoading}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  placeholder="Ask Gaia anything..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  disabled={isLoading}
                />
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
