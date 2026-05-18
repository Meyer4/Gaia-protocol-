import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Globe2, 
  Network, 
  BrainCircuit, 
  Activity, 
  ShieldAlert,
  Server,
  Zap,
  Terminal as TerminalIcon,
  Search,
  Eye,
  Menu,
  Fingerprint,
  Lock,
  CheckCircle2,
  FileKey,
  Play,
  Settings,
  BookOpen,
  Briefcase,
  Mail,
  FileText,
  Send,
  User,
  Github,
  Linkedin,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Cpu,
  CircuitBoard,
  X,
  Minus,
  Square,
  Layers,
  Clock,
  ChevronRight,
  Monitor,
  HardDrive,
  Settings as SystemSettings
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/tabs';
import { Badge } from '@/badge';
import { Progress } from '@/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/dialog';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { MapIcon, Loader2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { AIAssistant } from './AIAssistant';
import { cn } from './utils';

// --- Types ---

type AppWindow = {
  id: string;
  title: string;
  icon: any;
  content: React.ReactNode;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
};

// --- Background Component ---

function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, radius: 250 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: {x: number, y: number, vx: number, vy: number, size: number, isHub: boolean, pulseTimer: number, baseX: number, baseY: number}[] = [];
    let animationFrameId: number;
    let width = 0;
    let height = 0;

    const init = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      
      const particleCount = Math.min(Math.floor(width * height / 7000), 150);
      particles = Array.from({ length: particleCount }).map(() => {
        const isHub = Math.random() > 0.92;
        const x = Math.random() * width;
        const y = Math.random() * height;
        return {
          x, y,
          baseX: x, baseY: y,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          size: isHub ? Math.random() * 2 + 3 : Math.random() * 1.5 + 0.5,
          isHub,
          pulseTimer: Math.random() * Math.PI * 2
        };
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };
    
    const handleMouseLeave = () => {
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const draw = () => {
      ctx.fillStyle = 'rgba(9, 9, 11, 0.2)';
      ctx.fillRect(0, 0, width, height);

      const mouse = mouseRef.current;

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.pulseTimer += 0.03;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        const dxMouse = mouse.x - p.x;
        const dyMouse = mouse.y - p.y;
        const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
        
        if (distMouse < mouse.radius) {
          const forceDirectionX = dxMouse / distMouse;
          const forceDirectionY = dyMouse / distMouse;
          const force = (mouse.radius - distMouse) / mouse.radius;
          const directionX = forceDirectionX * force * 5;
          const directionY = forceDirectionY * force * 5;
          
          p.x -= directionX;
          p.y -= directionY;
          
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(0, 255, 204, ${force * 0.4})`;
          ctx.lineWidth = force * 1.5;
          ctx.stroke();
        }

        const currentSize = p.isHub ? p.size + Math.sin(p.pulseTimer) * 1.5 : p.size;
        
        ctx.beginPath();
        if (p.isHub) {
          ctx.fillStyle = `rgba(0, 255, 204, ${0.4 + Math.sin(p.pulseTimer) * 0.2})`;
          ctx.shadowBlur = 20;
          ctx.shadowColor = 'rgba(0, 255, 204, 0.8)';
        } else {
          ctx.fillStyle = 'rgba(0, 255, 204, 0.4)';
          ctx.shadowBlur = Math.sin(p.pulseTimer) * 5 > 0 ? 5 : 0;
          ctx.shadowColor = 'rgba(0, 255, 204, 0.4)';
        }
        ctx.arc(p.x, p.y, Math.max(0.1, currentSize), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const maxDist = p.isHub || p2.isHub ? 220 : 120;

          if (dist < maxDist) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            const opacity = (1 - dist / maxDist) * (p.isHub || p2.isHub ? 0.35 : 0.15);
            ctx.strokeStyle = `rgba(0, 255, 204, ${opacity})`;
            ctx.lineWidth = p.isHub || p2.isHub ? 1.5 : 0.5;
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', init);
    init();
    draw();

    return () => {
      window.removeEventListener('resize', init);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 opacity-40 pointer-events-none mix-blend-screen bg-[#050505]" />;
}

// --- Window Component ---

function Window({
  window,
  onClose,
  onMinimize,
  onMaximize,
  onFocus,
  children
}: {
  window: AppWindow;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onFocus: () => void;
  children: React.ReactNode;
}) {
  const constraintsRef = useRef(null);

  if (!window.isOpen || window.isMinimized) return null;

  return (
    <motion.div
      drag
      dragMomentum={false}
      onPointerDown={onFocus}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
        top: window.isMaximized ? 0 : 'auto',
        left: window.isMaximized ? 0 : 'auto',
        width: window.isMaximized ? '100%' : '80%',
        height: window.isMaximized ? 'calc(100vh - 48px)' : '70vh',
      }}
      className={cn(
        "absolute flex flex-col bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden pointer-events-auto",
        window.isMaximized ? "z-[100] inset-0" : "resize overflow-auto"
      )}
      style={{
        zIndex: window.zIndex,
        minWidth: '300px',
        minHeight: '200px'
      }}
    >
      {/* Window Header */}
      <div
        className="h-10 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 cursor-move select-none sticky top-0 z-10"
        onDoubleClick={onMaximize}
      >
        <div className="flex items-center gap-2">
          <window.icon className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">{window.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onMinimize} className="p-1.5 hover:bg-zinc-800 rounded transition-colors">
            <Minus className="w-3.5 h-3.5 text-zinc-500" />
          </button>
          <button onClick={onMaximize} className="p-1.5 hover:bg-zinc-800 rounded transition-colors">
            <Square className="w-3.5 h-3.5 text-zinc-500" />
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-red-500/20 group rounded transition-colors">
            <X className="w-3.5 h-3.5 text-zinc-500 group-hover:text-red-500" />
          </button>
        </div>
      </div>

      {/* Window Content */}
      <div className="flex-1 overflow-auto p-6 bg-[#0a0a0c]">
        {children}
      </div>
    </motion.div>
  );
}

// --- Main App Component ---

export default function App() {
  const { t, i18n } = useTranslation();
  const [windows, setWindows] = useState<AppWindow[]>([]);
  const [maxZIndex, setMaxZIndex] = useState(10);
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  const nodeId = React.useMemo(() => {
    const stored = localStorage.getItem('gaia_node_id');
    if (stored) return stored;
    const newId = Math.random().toString(36).substring(2, 9);
    localStorage.setItem('gaia_node_id', newId);
    return newId;
  }, []);
  
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('gaia_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      showOutreach: true,
      showPortfolio: true,
      showGuide: true,
      userName: 'George Meya',
      userPhone1: '+265 991593725',
      userPhone2: '+265 883991420',
      jobTitle: 'Founder & Architect, Gaia Protocol'
    };
  });

  useEffect(() => {
    localStorage.setItem('gaia_settings', JSON.stringify(settings));
  }, [settings]);

  const [peers, setPeers] = useState<string[]>([]);
  const [earthquakes, setEarthquakes] = useState<any[]>([]);
  const [eqError, setEqError] = useState<string | null>(null);
  const [computeRate, setComputeRate] = useState(0);
  const [hashHistory, setHashHistory] = useState<any[]>(Array.from({ length: 20 }).map((_, i) => ({ time: i, hashes: 0 })));
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [networkEvents, setNetworkEvents] = useState<any[]>([]);

  useEffect(() => {
    const eventSource = new EventSource('/api/stream');
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setNetworkEvents(prev => [data, ...prev].slice(0, 50));
      } catch (err) {}
    };
    return () => eventSource.close();
  }, []);

  useEffect(() => {
    fetch('/api/network/stats')
      .then(r => r.json())
      .then(d => setGlobalStats(d))
      .catch(e => console.warn('Backend currently unreachable', e));
  }, []);

  useEffect(() => {
    setHashHistory(prev => {
      const newHistory = [...prev.slice(1), { time: prev[prev.length - 1].time + 1, hashes: computeRate }];
      return newHistory;
    });
  }, [computeRate]);

  useEffect(() => {
    const channel = new BroadcastChannel('gaia-mesh');
    channel.onmessage = (event) => {
      const { type, sender, target } = event.data;
      if (sender === nodeId) return;
      if (type === 'hello') {
        setPeers(p => !p.includes(sender) ? [...p, sender] : p);
        channel.postMessage({ type: 'hello-ack', sender: nodeId, target: sender });
      } else if (type === 'hello-ack' && target === nodeId) {
        setPeers(p => !p.includes(sender) ? [...p, sender] : p);
      } else if (type === 'peer-disconnect') {
        setPeers(p => p.filter(id => id !== sender));
      }
    };
    channel.postMessage({ type: 'hello', sender: nodeId });
    const handleUnload = () => channel.postMessage({ type: 'peer-disconnect', sender: nodeId });
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      channel.close();
    };
  }, [nodeId]);

  useEffect(() => {
    const fetchEq = () => {
      fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson')
        .then(r => {
          if (!r.ok) throw new Error("API Response not ok");
          return r.json();
        })
        .then(d => { 
          if (d.features) {
            setEarthquakes(d.features); 
            setEqError(null);
          }
        })
        .catch((e) => {
          console.error(e);
          setEqError("Failed to sync seismic network.");
        });
    };
    fetchEq();
    const interval = setInterval(fetchEq, 30000);
    return () => clearInterval(interval);
  }, []);

  const openWindow = (id: string, title: string, icon: any, content: React.ReactNode) => {
    setIsStartMenuOpen(false);
    setWindows(prev => {
      const existing = prev.find(w => w.id === id);
      if (existing) {
        return prev.map(w => w.id === id ? { ...w, isOpen: true, isMinimized: false, zIndex: maxZIndex + 1 } : w);
      }
      return [...prev, { id, title, icon, content, isOpen: true, isMinimized: false, isMaximized: false, zIndex: maxZIndex + 1 }];
    });
    setMaxZIndex(prev => prev + 1);
  };

  const closeWindow = (id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isOpen: false } : w));
  };

  const minimizeWindow = (id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: true } : w));
  };

  const toggleMaximizeWindow = (id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMaximized: !w.isMaximized } : w));
  };

  const focusWindow = (id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: maxZIndex + 1, isMinimized: false } : w));
    setMaxZIndex(prev => prev + 1);
  };

  // Default windows on load
  useEffect(() => {
    openWindow('dashboard', t('Global Overview'), Activity, <DashboardView peers={peers} computeRate={computeRate} earthquakes={earthquakes} nodeId={nodeId} hashHistory={hashHistory} eqError={eqError} globalStats={globalStats} networkEvents={networkEvents} />);
  }, []);

  return (
    <div className="h-screen w-screen bg-[#050505] text-zinc-100 font-sans overflow-hidden relative select-none">
      <NetworkBackground />
      
      {/* Desktop Icons */}
      <div className="absolute inset-0 p-6 flex flex-col flex-wrap gap-6 items-start content-start z-10">
        <DesktopIcon
          icon={Activity}
          label={t("Dashboard")}
          onClick={() => openWindow('dashboard', t('Global Overview'), Activity, <DashboardView peers={peers} computeRate={computeRate} earthquakes={earthquakes} nodeId={nodeId} hashHistory={hashHistory} eqError={eqError} globalStats={globalStats} networkEvents={networkEvents} />)}
        />
        <DesktopIcon
          icon={TerminalIcon}
          label={t("Terminal")}
          onClick={() => openWindow('terminal', t('Console'), TerminalIcon, <TerminalView peers={peers} nodeId={nodeId} computeRate={computeRate} networkEvents={networkEvents} />)}
        />
        <DesktopIcon
          icon={Network}
          label={t("Network")}
          onClick={() => openWindow('network', t('P2P Network'), Network, <NetworkView peers={peers} nodeId={nodeId} />)}
        />
        <DesktopIcon
          icon={BrainCircuit}
          label={t("World Engine")}
          onClick={() => openWindow('brain', t('World Engine'), BrainCircuit, <BrainView setComputeRate={setComputeRate} computeRate={computeRate} />)}
        />
        <DesktopIcon
          icon={Fingerprint}
          label={t("ZK Proofs")}
          onClick={() => openWindow('zkp', t('Trust & ZK Proofs'), Fingerprint, <ZkpView />)}
        />
        <DesktopIcon
          icon={ShieldAlert}
          label={t("Seismic Grid")}
          onClick={() => openWindow('senses', t('Sensor Grid'), Eye, <SensesView earthquakes={earthquakes} eqError={eqError} />)}
        />
        <DesktopIcon
          icon={Settings}
          label={t("Settings")}
          onClick={() => openWindow('settings', t('Settings'), Settings, <SettingsView settings={settings} setSettings={setSettings} />)}
        />
      </div>

      {/* Open Windows */}
      <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
        <div className="relative w-full h-full pointer-events-none">
          {windows.map(win => (
            <Window
              key={win.id}
              window={win}
              onClose={() => closeWindow(win.id)}
              onMinimize={() => minimizeWindow(win.id)}
              onMaximize={() => toggleMaximizeWindow(win.id)}
              onFocus={() => focusWindow(win.id)}
            >
              {win.content}
            </Window>
          ))}
        </div>
      </div>

      {/* Taskbar */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-zinc-950/80 backdrop-blur-md border-t border-zinc-800/50 flex items-center justify-between px-2 z-[200]">
        <div className="flex items-center gap-1 h-full">
          <button
            onClick={() => setIsStartMenuOpen(!isStartMenuOpen)}
            className={cn(
              "p-2 rounded hover:bg-zinc-800 transition-colors flex items-center gap-2",
              isStartMenuOpen && "bg-zinc-800"
            )}
          >
            <div className="w-8 h-8 rounded bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50">
               <Globe2 className="w-5 h-5 text-emerald-400" />
            </div>
          </button>

          <div className="h-6 w-px bg-zinc-800 mx-1" />

          {windows.filter(w => w.isOpen).map(win => (
            <button
              key={win.id}
              onClick={() => win.isMinimized ? focusWindow(win.id) : minimizeWindow(win.id)}
              className={cn(
                "h-10 px-3 flex items-center gap-2 rounded transition-all border-b-2",
                win.isMinimized ? "border-transparent text-zinc-500" : "border-emerald-500 bg-zinc-800/50 text-zinc-100",
                !win.isMinimized && win.zIndex === maxZIndex && "bg-zinc-800"
              )}
            >
              <win.icon className="w-4 h-4" />
              <span className="text-xs font-medium hidden sm:block">{win.title}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 px-4">
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            {computeRate.toLocaleString()} H/s
          </div>
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono border-l border-zinc-800 pl-4">
            <Clock className="w-3.5 h-3.5" />
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Start Menu */}
      <AnimatePresence>
        {isStartMenuOpen && (
          <>
            <div className="fixed inset-0 z-[190]" onClick={() => setIsStartMenuOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-14 left-2 w-96 bg-[#0a0a0c]/95 backdrop-blur-2xl border border-zinc-800/50 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[200] overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 bg-gradient-to-br from-zinc-900 to-black border-b border-zinc-800/50 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30 relative">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/5 animate-pulse" />
                  <User className="w-8 h-8 text-emerald-400 relative z-10" />
                </div>
                <div>
                  <div className="text-lg font-bold text-zinc-100 tracking-tight">{settings.userName}</div>
                  <div className="text-xs text-emerald-500/70 font-mono uppercase tracking-widest">{settings.jobTitle}</div>
                </div>
              </div>

              {/* Search */}
              <div className="p-4 border-b border-zinc-800/30">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search applications..."
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-sm text-zinc-300 outline-none focus:border-emerald-500/30 transition-colors"
                    autoFocus
                  />
                </div>
              </div>

              {/* Apps List */}
              <div className="p-2 max-h-[400px] overflow-y-auto grid grid-cols-1 gap-1">
                {[
                  { id: 'dashboard', icon: Activity, label: t('System Dashboard'), desc: 'Monitor network performance', view: <DashboardView peers={peers} computeRate={computeRate} earthquakes={earthquakes} nodeId={nodeId} hashHistory={hashHistory} eqError={eqError} globalStats={globalStats} networkEvents={networkEvents} /> },
                  { id: 'terminal', icon: TerminalIcon, label: t('Root Terminal'), desc: 'Execute system commands', view: <TerminalView peers={peers} nodeId={nodeId} computeRate={computeRate} networkEvents={networkEvents} /> },
                  { id: 'network', icon: Network, label: t('P2P Mesh Explorer'), desc: 'Visualize distributed nodes', view: <NetworkView peers={peers} nodeId={nodeId} /> },
                  { id: 'brain', icon: BrainCircuit, label: t('AI World Engine'), desc: 'Distributed neural modeling', view: <BrainView setComputeRate={setComputeRate} computeRate={computeRate} /> },
                  { id: 'senses', icon: Eye, label: t('Environmental Grid'), desc: 'Live seismic & sensor data', view: <SensesView earthquakes={earthquakes} eqError={eqError} /> },
                  { id: 'zkp', icon: Fingerprint, label: t('ZK Trust Center'), desc: 'Verify cryptographic proofs', view: <ZkpView /> },
                  { id: 'outreach', icon: Briefcase, label: t('Outreach Manager'), desc: 'Automated investor pitching', view: <OutreachView settings={settings} /> },
                  { id: 'portfolio', icon: User, label: t('Developer Profile'), desc: 'View creator credentials', view: <PortfolioView settings={settings} /> },
                  { id: 'settings', icon: SystemSettings, label: t('OS Settings'), desc: 'Configure system preferences', view: <SettingsView settings={settings} setSettings={setSettings} /> },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => openWindow(item.id, item.label, item.icon, item.view)}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-emerald-500/5 group transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:border-emerald-500/30 group-hover:bg-emerald-500/10 transition-colors">
                      <item.icon className="w-5 h-5 text-zinc-500 group-hover:text-emerald-400" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-zinc-300 group-hover:text-emerald-400">{item.label}</div>
                      <div className="text-[10px] text-zinc-500 group-hover:text-zinc-400">{item.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="p-4 bg-black/40 border-t border-zinc-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-emerald-400 transition-colors">
                    <Lock className="w-4 h-4" />
                  </button>
                  <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-emerald-400 transition-colors">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[10px] font-mono text-zinc-600 tracking-tighter">KALI_GAIA_KERNEL_V0.9.4</div>
                <button className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-500 hover:text-red-500 transition-colors">
                  <Zap className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AIAssistant />
    </div>
  );
}

function DesktopIcon({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-2 rounded hover:bg-white/5 transition-colors w-20 group"
    >
      <div className="w-12 h-12 rounded-lg bg-zinc-900/50 backdrop-blur-md border border-zinc-800 flex items-center justify-center group-hover:border-emerald-500/50 group-hover:bg-emerald-500/10 transition-all shadow-lg">
        <Icon className="w-6 h-6 text-zinc-400 group-hover:text-emerald-400" />
      </div>
      <span className="text-[10px] font-bold text-zinc-400 text-center uppercase tracking-wider drop-shadow-md group-hover:text-zinc-200">{label}</span>
    </button>
  );
}

// --- Sub-Views (Restored from original) ---

function SettingsView({ settings, setSettings }: { settings: any, setSettings: any }) {
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState(i18n.language);

  const changeLang = (l: string) => {
    i18n.changeLanguage(l);
    setLang(l);
  };

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-2 mb-6">
          <Settings className="w-6 h-6 text-emerald-400" />
          <h2 className="text-2xl font-bold">{t("Settings Configuration")}</h2>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="space-y-6">
           <Card className="bg-zinc-900/50 border-zinc-800/50">
              <CardHeader>
                 <CardTitle>Global Identity</CardTitle>
                 <CardDescription>Configure your presenter identity for pitching and outreach.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="space-y-2">
                   <label className="text-sm font-medium text-zinc-400">Display Name</label>
                   <input 
                     type="text" 
                     value={settings.userName} 
                     onChange={(e) => setSettings({...settings, userName: e.target.value})}
                     className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200 outline-none focus:border-emerald-500/50 transition-colors" 
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-sm font-medium text-zinc-400">Job Title / Role</label>
                   <input 
                     type="text" 
                     value={settings.jobTitle} 
                     onChange={(e) => setSettings({...settings, jobTitle: e.target.value})}
                     className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200 outline-none focus:border-emerald-500/50 transition-colors" 
                   />
                 </div>
              </CardContent>
           </Card>
         </div>

         <div className="space-y-6">
           <Card className="bg-zinc-900/50 border-zinc-800/50">
              <CardHeader>
                 <CardTitle>{t("Language & Localization")}</CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="flex flex-col gap-4">
                    <select 
                      value={lang} 
                      onChange={(e) => changeLang(e.target.value)} 
                      className="bg-zinc-950 border border-zinc-800 rounded-md py-2 px-3 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer text-zinc-200 w-full"
                    >
                       <option value="en">English</option>
                       <option value="es">Español</option>
                       <option value="fr">Français</option>
                    </select>
                 </div>
              </CardContent>
           </Card>
         </div>
       </div>
    </div>
  );
}

function GuideView() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 max-w-4xl">
       <div className="flex items-center gap-2 mb-6">
          <BookOpen className="w-6 h-6 text-emerald-400" />
          <h2 className="text-2xl font-bold">{t("Guide & Onboarding")}</h2>
       </div>

       <Card className="bg-zinc-900/50 border-zinc-800/50 overflow-hidden">
          <div className="h-2 bg-purple-500 w-full" />
          <CardHeader>
             <CardTitle className="text-xl text-purple-400">{t("ZKP Explanation")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-zinc-300">
             <h3 className="text-lg font-medium text-zinc-100">{t("What is a Zero-Knowledge Proof?")}</h3>
             <p>{t("zkp_body")}</p>
          </CardContent>
       </Card>
    </div>
  );
}

function PortfolioView({ settings }: { settings?: any }) {
  const userName = settings?.userName || "George Meya";
  const jobTitle = settings?.jobTitle || "Founder & Architect";

  return (
    <div className="space-y-6 max-w-5xl">
       <div className="flex items-center gap-2 mb-6">
          <User className="w-6 h-6 text-emerald-400" />
          <h2 className="text-2xl font-bold">{userName}</h2>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-zinc-900/50 border-zinc-800/50 md:col-span-1 border-t-emerald-500 border-t-2">
             <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                <div className="w-32 h-32 rounded-full bg-zinc-950 border-4 border-zinc-800 flex items-center justify-center overflow-hidden">
                   <User className="w-16 h-16 text-zinc-600" />
                </div>
                <div>
                   <h3 className="text-xl font-bold text-zinc-100">{userName}</h3>
                   <p className="text-emerald-400 font-medium text-sm">{jobTitle}</p>
                </div>
             </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800/50 md:col-span-2">
             <CardHeader>
                <CardTitle>About my vision</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4 text-zinc-300 leading-relaxed text-sm">
                <p>
                   Hi, I'm {userName}. I'm the creator of the Gaia Protocol and a passionate builder in Web3, DePIN, and AI architecture. 
                </p>
             </CardContent>
          </Card>
       </div>
    </div>
  );
}

function OutreachView({ settings }: { settings?: any }) {
  const { t } = useTranslation();
  const [pitch, setPitch] = useState('');
  const [target, setTarget] = useState('dept_of_energy');
  const [investorEmail, setInvestorEmail] = useState('');
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/pitches').then(r => r.json()).then(d => {
      if(d.success && d.pitches) setHistory(d.pitches);
    }).catch(() => {});
  }, [pitch]);

  const generatePitch = async () => {
    setGenerating(true);
    setPitch('');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const promptText = `Write a compelling email pitch for Gaia Protocol. Target: ${target}`;
      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: promptText
      });
      setPitch(response.text || 'No response generated.');
    } catch (err: any) {
      setPitch(`Error generating pitch: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
       <h2 className="text-2xl font-bold">{t("Commercial Outreach")}</h2>
       <Card className="bg-zinc-900/50 border-zinc-800/50">
          <CardContent className="pt-6 space-y-4">
             <select
               value={target}
               onChange={(e) => setTarget(e.target.value)}
               className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 px-3 text-sm text-zinc-100"
             >
                <option value="dept_of_energy">Gov / Scientific Research</option>
                <option value="depin_vc">DePIN / Web3 Venture Capital</option>
                <option value="ai_enterprise">Enterprise AI Operations</option>
             </select>
             <button onClick={generatePitch} disabled={generating} className="w-full py-2 bg-emerald-500 text-black font-bold rounded">
                {generating ? "Drafting..." : "Draft Email"}
             </button>
             {pitch && <div className="p-4 bg-zinc-950 border border-zinc-800 rounded text-sm text-zinc-300 whitespace-pre-wrap">{pitch}</div>}
          </CardContent>
       </Card>
    </div>
  );
}

function SensesView({ earthquakes, eqError }: { earthquakes: any[], eqError?: string | null }) {
  const [selectedEq, setSelectedEq] = useState<any>(null);

  return (
    <div className="space-y-6">
        <h2 className="text-2xl font-bold">Earth Sensor Grid</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="col-span-1 lg:col-span-2 h-[400px]">
               <GoogleMapWrapper earthquakes={earthquakes} onMarkerClick={setSelectedEq} />
            </div>
            <Card className="bg-zinc-900/50 border-zinc-800/50 overflow-y-auto h-[400px]">
               <CardContent className="pt-6">
                  <div className="space-y-4">
                     {earthquakes.map((eq, i) => (
                       <div key={i} onClick={() => setSelectedEq(eq)} className="p-3 bg-zinc-950 border border-zinc-800 rounded cursor-pointer">
                          <div className="text-emerald-400 font-bold">MAG {eq.properties.mag?.toFixed(1)}</div>
                          <div className="text-zinc-300 text-xs truncate">{eq.properties.place}</div>
                       </div>
                     ))}
                  </div>
               </CardContent>
            </Card>
        </div>
    </div>
  )
}

function GoogleMapWrapper({ earthquakes, onMarkerClick }: { earthquakes: any[], onMarkerClick: (eq: any) => void }) {
  const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
  if (!API_KEY) return <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-500 font-mono">Google Maps Key Missing</div>;

  return (
    <APIProvider apiKey={API_KEY}>
      <GoogleMap
        defaultCenter={{ lat: 0, lng: 0 }}
        defaultZoom={2}
        style={{ width: '100%', height: '100%' }}
      >
        {earthquakes.map((eq, i) => (
          <AdvancedMarker key={i} position={{ lat: eq.geometry.coordinates[1], lng: eq.geometry.coordinates[0] }} onClick={() => onMarkerClick(eq)}>
            <Pin background="#10b981" />
          </AdvancedMarker>
        ))}
      </GoogleMap>
    </APIProvider>
  );
}

function ZkpView() {
  const [proofs, setProofs] = useState(0);
  return (
    <div className="space-y-6">
       <h2 className="text-2xl font-bold">Cryptographic Primitives</h2>
       <div className="grid grid-cols-2 gap-6">
          <Card className="bg-zinc-900/50 border-zinc-800/50">
             <CardContent className="p-6 text-center">
                <div className="text-zinc-400 text-sm mb-1">Local Proofs</div>
                <div className="text-3xl font-bold text-purple-400">{proofs}</div>
                <button onClick={() => setProofs(p => p+1)} className="mt-4 px-4 py-2 bg-purple-500 text-white rounded">Generate Proof</button>
             </CardContent>
          </Card>
       </div>
    </div>
  )
}

function TerminalView({ peers, nodeId, computeRate, networkEvents }: any) {
  const [history, setHistory] = useState<any[]>([
    { type: 'system', text: 'KALI GAIA OS v0.9.4 (kernel 6.1.0-kali-amd64)' },
    { type: 'system', text: 'Last login: ' + new Date().toUTCString() + ' from 127.0.0.1' },
    { type: 'system', text: ' ' },
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleCommand = (e: any) => {
    if (e.key === 'Enter') {
      const fullCmd = input.trim();
      const args = fullCmd.toLowerCase().split(' ');
      const cmd = args[0];

      setHistory(prev => [...prev, { type: 'input', text: `root@kali:~# ${fullCmd}` }]);
      setInput('');
      
      let response = '';
      if (cmd === 'ls') {
        response = 'bin  boot  dev  etc  home  lib  lib64  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var';
      } else if (cmd === 'whoami') {
        response = 'root';
      } else if (cmd === 'clear') {
        setHistory([]);
        return;
      } else if (cmd === 'nmap') {
        response = `Starting Nmap 7.93 ( https://nmap.org ) at ${new Date().toISOString()}\nNmap scan report for gaia.network (127.0.0.1)\nHost is up (0.000045s latency).\nNot shown: 998 closed tcp ports (reset)\nPORT     STATE SERVICE\n80/tcp   open  http\n443/tcp  open  https\n3000/tcp open  gaia-protocol\n\nNmap done: 1 IP address (1 host up) scanned in 0.08 seconds`;
      } else if (cmd === 'uname') {
        response = 'Linux kali 6.1.0-kali-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.27-1kali1 (2023-05-12) x86_64 GNU/Linux';
      } else if (cmd === 'help') {
        response = 'Available commands: ls, whoami, clear, nmap, uname, ifconfig, help, exit';
      } else if (cmd === 'ifconfig') {
        response = `eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n        inet 192.168.1.15  netmask 255.255.255.0  broadcast 192.168.1.255\n        inet6 fe80::a00:27ff:fe4e:66a1  prefixlen 64  scopeid 0x20<link>\n        ether 08:00:27:4e:66:a1  txqueuelen 1000  (Ethernet)\n        RX packets 150232  bytes 12453210 (11.8 MiB)\n        TX packets 98231  bytes 8543210 (8.1 MiB)\n\nlo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536\n        inet 127.0.0.1  netmask 255.0.0.0\n        inet6 ::1  prefixlen 128  scopeid 0x10<host>\n        loop  txqueuelen 1000  (Local Loopback)`;
      } else if (cmd === '') {
        return;
      } else {
        response = `bash: ${cmd}: command not found`;
      }

      setTimeout(() => {
        setHistory(prev => [...prev, { type: 'output', text: response }]);
      }, 50);
    }
  };

  return (
    <div className="h-full flex flex-col font-mono text-sm bg-[#050505] p-4 rounded-lg border border-zinc-800 shadow-inner overflow-hidden">
       <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
          {history.map((h, i) => (
            <div key={i} className={cn(
              h.type === 'input' ? 'text-[#00ffcc] font-bold' :
              h.type === 'system' ? 'text-zinc-500' :
              'text-zinc-300 whitespace-pre-wrap'
            )}>
              {h.text}
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-blue-400 font-bold whitespace-nowrap">root@kali:~#</span>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleCommand}
              className="flex-1 bg-transparent border-none outline-none text-[#00ffcc] caret-emerald-400"
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
          </div>
       </div>
    </div>
  )
}

function DashboardView({ peers, computeRate, earthquakes, nodeId, hashHistory, eqError, globalStats, networkEvents }: any) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Mesh Nodes', value: (peers.length + 1).toString(), icon: Server },
          { label: 'Hashrate', value: `${computeRate.toLocaleString()} H/s`, icon: Zap },
          { label: 'Earthquakes', value: earthquakes.length.toString(), icon: ShieldAlert },
          { label: 'Peers', value: peers.length.toString(), icon: Network },
        ].map((stat, i) => (
          <Card key={i} className="bg-zinc-900/50 border-zinc-800/50">
            <CardContent className="p-6 flex items-center justify-between">
               <div>
                  <p className="text-xs font-bold uppercase text-zinc-500 mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
               </div>
               <stat.icon className="w-8 h-8 text-emerald-500/20" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-2 bg-zinc-900/50 border-zinc-800/50">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-widest text-zinc-400">Network Participation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hashHistory}>
                  <Area type="monotone" dataKey="hashes" stroke="#00ffcc" fill="#00ffcc22" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800/50">
           <CardHeader><CardTitle className="text-sm uppercase tracking-widest text-zinc-400">Live Feed</CardTitle></CardHeader>
           <CardContent className="space-y-3">
              {networkEvents.slice(0, 5).map((e, i) => (
                <div key={i} className="text-[10px] font-mono border-l-2 border-emerald-500 pl-2">
                   <div className="text-zinc-500">{new Date(e.timestamp).toLocaleTimeString()}</div>
                   <div className="text-zinc-300 truncate">{e.message}</div>
                </div>
              ))}
           </CardContent>
        </Card>
      </div>
    </div>
  );
}

import createGlobe from "cobe";

function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let phi = 0;
    if (!canvasRef.current) return;
    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 400 * 2,
      height: 400 * 2,
      phi: 0,
      theta: 0,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.1, 0.1, 0.1],
      markerColor: [0.0, 1.0, 0.8],
      glowColor: [0.0, 0.2, 0.2],
      markers: [
        { location: [37.7595, -122.4367], size: 0.03 },
        { location: [-13.9626, 33.7741], size: 0.12 },
      ],
      onRender: (state: any) => {
        state.phi = phi;
        phi += 0.005;
      },
    } as any);

    return () => globe.destroy();
  }, []);

  return <canvas ref={canvasRef} className="w-[300px] h-[300px] mx-auto opacity-60" />;
}

function NetworkView({ peers, nodeId }: any) {
  return (
    <div className="space-y-6 text-center">
       <Globe />
       <h2 className="text-2xl font-bold">Decentralized Mesh Visualization</h2>
       <div className="flex justify-center gap-4">
          {peers.map((p: string, i: number) => (
            <div key={i} className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded font-mono text-xs text-emerald-400">
               {p}
            </div>
          ))}
       </div>
    </div>
  )
}

function BrainView({ setComputeRate, computeRate }: any) {
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    if (!computing) { setComputeRate(0); return; }
    const i = setInterval(() => setComputeRate(Math.floor(Math.random() * 100000)), 1000);
    return () => clearInterval(i);
  }, [computing]);

  return (
    <div className="space-y-6">
       <h2 className="text-2xl font-bold">World Engine</h2>
       <Card className="bg-zinc-900/50 border-zinc-800/50 p-12 text-center">
          <BrainCircuit className={cn("w-16 h-16 mx-auto mb-6", computing ? "text-emerald-400 animate-pulse" : "text-zinc-700")} />
          <button
            onClick={() => setComputing(!computing)}
            className={cn("px-8 py-3 rounded-full font-bold transition-all", computing ? "bg-red-500 text-white" : "bg-emerald-500 text-black")}
          >
            {computing ? "Stop Computation" : "Start Global Job"}
          </button>
       </Card>
    </div>
  )
}
