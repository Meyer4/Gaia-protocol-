import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Loader2, MessageSquare, Mic, MicOff, Volume2, VolumeX, X } from 'lucide-react';
import { api, type ConfigResponse } from '@/lib/api';
import { usePoll } from '@/lib/hooks';
import { useNetwork } from '@/lib/network';
import type { Settings } from '@/lib/hooks';
import { cn } from '@/utils';

interface Message {
  role: 'user' | 'model';
  text: string;
  model?: string;
}

const VOICE_LANGUAGES = [
  { value: 'en-US', label: 'English' },
  { value: 'es-ES', label: 'Español' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'pt-BR', label: 'Português' },
  { value: 'zh-CN', label: '中文' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'hi-IN', label: 'हिन्दी' },
  { value: 'ar-SA', label: 'العربية' },
];

/**
 * The assistant talks to the node's Gemini proxy. Speech input and output use
 * the browser's real Web Speech APIs. When the provider is unreachable the
 * assistant reports the upstream error instead of inventing an answer.
 */
export function AIAssistant({ settings }: { settings: Settings }) {
  const { status, miner, nodeId } = useNetwork();
  const config = usePoll<ConfigResponse>(() => api.config(), 60_000);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState(navigator.language || 'en-US');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  const aiReady = Boolean(config.data?.ai.configured) || Boolean(settings.geminiKey.trim());

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language;

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) void send(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    return () => {
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const speak = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((voice) => voice.lang === language) ??
      voices.find((voice) => voice.lang.startsWith(language.split('-')[0])) ??
      voices.find((voice) => voice.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  const toggleListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
      return;
    }
    stopSpeaking();
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;

    setError(null);
    setInput('');
    const history = messagesRef.current.slice(-10).map((message) => ({ role: message.role, text: message.text }));
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setBusy(true);

    try {
      const response = await api.chat({
        message: text,
        language,
        history,
        apiKey: settings.geminiKey.trim() || undefined,
      });
      setMessages((prev) => [...prev, { role: 'model', text: response.text, model: response.model }]);
      speak(response.text);
    } catch (err: any) {
      const message = err?.message ?? String(err);
      setError(message);
      setMessages((prev) => [...prev, { role: 'model', text: `Provider error: ${message}` }]);
    } finally {
      setBusy(false);
    }
  };

  const liveContext = status
    ? `${status.network.liveNodes} live node(s), ${status.ledger.blocks} verified block(s), ${status.zkp.valid} valid ZK proof(s).`
    : 'Waiting for the first status read.';

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={() => setOpen(true)}
            className={cn(
              'fixed bottom-16 right-5 z-[400] p-4 rounded-full border shadow-lg transition-colors',
              speaking ? 'bg-emerald-500 text-black border-emerald-400' : 'bg-zinc-900 text-emerald-400 border-zinc-800 hover:border-emerald-500/50',
            )}
            aria-label="Open the assistant"
          >
            <Bot className={cn('w-6 h-6', speaking && 'animate-pulse')} />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-16 right-5 z-[400] w-[min(380px,calc(100vw-24px))] h-[min(560px,calc(100vh-96px))] flex flex-col rounded-xl border border-zinc-800 bg-[#0a0a0c]/97 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,0,0,0.6)] overflow-hidden"
          >
            <header className="p-3 border-b border-zinc-800 flex items-center justify-between gap-2 bg-zinc-900/60">
              <div className="flex items-center gap-2 min-w-0">
                <Bot className={cn('w-4 h-4 shrink-0', speaking ? 'text-emerald-400 animate-pulse' : 'text-zinc-400')} />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-zinc-100">Gaia assistant</div>
                  <div className="text-[10px] font-mono text-zinc-600 truncate">
                    {config.data?.ai.model ?? (aiReady ? 'model resolves on first call' : 'provider not configured')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1 text-[10px] text-zinc-300 outline-none"
                >
                  {VOICE_LANGUAGES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setVoiceEnabled((enabled) => !enabled)}
                  className={cn('p-1.5 rounded hover:bg-zinc-800', voiceEnabled ? 'text-emerald-400' : 'text-zinc-600')}
                  aria-label="Toggle voice output"
                >
                  {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-4">
                  <MessageSquare className="w-8 h-8 text-emerald-500/60" />
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Ask about the live state of this node — verified blocks, zero-knowledge proofs, host load or the seismic feed.
                  </p>
                  <p className="text-[10px] font-mono text-zinc-600">{liveContext}</p>
                  {!aiReady && (
                    <p className="text-[10px] text-amber-400 border border-amber-500/30 rounded px-2 py-1">
                      No Gemini key configured — add one in Settings or set GEMINI_API_KEY on the server.
                    </p>
                  )}
                </div>
              )}

              {messages.map((message, index) => (
                <div key={index} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap',
                      message.role === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-sm'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-sm',
                    )}
                  >
                    {message.text}
                    {message.model && <div className="mt-1 text-[9px] font-mono text-zinc-600">{message.model}</div>}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex justify-start">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span className="text-[11px] text-zinc-500">Waiting for the model…</span>
                  </div>
                </div>
              )}

              {error && !busy && (
                <div className="text-[10px] text-rose-400 border border-rose-500/30 rounded-md px-2 py-1.5 bg-rose-500/5">{error}</div>
              )}

              <div ref={endRef} />
            </div>

            <footer className="p-2 border-t border-zinc-800 flex items-center gap-2 bg-zinc-950">
              <button
                onClick={toggleListening}
                disabled={!recognitionRef.current}
                className={cn(
                  'p-2 rounded-full border transition-colors disabled:opacity-30',
                  listening ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-emerald-300',
                )}
                title={recognitionRef.current ? 'Dictate' : 'Speech recognition is unavailable in this browser'}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void send();
                }}
                placeholder={aiReady ? 'Ask Gaia…' : 'Configure a Gemini key first'}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-2 text-xs text-zinc-100 outline-none focus:border-emerald-500/40"
              />
              {speaking && (
                <button onClick={stopSpeaking} className="text-[10px] text-rose-400 hover:underline shrink-0">
                  stop
                </button>
              )}
            </footer>

            <div className="px-3 pb-2 bg-zinc-950">
              <div className="text-[9px] font-mono text-zinc-700 truncate">
                node {nodeId.slice(0, 8)} · {miner.running ? `mining at ${miner.hashrate.toLocaleString()} H/s` : 'miner idle'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
