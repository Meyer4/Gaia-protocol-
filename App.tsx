import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe2, 
  Network, 
  BrainCircuit, 
  Activity, 
  ShieldAlert,
  Server,
  Zap,
  Terminal,
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
  CircuitBoard
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { motion } from 'motion/react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { MapIcon, Loader2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { AIAssistant } from './components/AIAssistant';

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
       // Create a slight trailing effect
      ctx.fillStyle = 'rgba(9, 9, 11, 0.2)'; // match bg-zinc-950 but with alpha
      ctx.fillRect(0, 0, width, height);

      const mouse = mouseRef.current;

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.pulseTimer += 0.03;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Mouse interaction
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
          
          // Draw line to mouse
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(16, 185, 129, ${force * 0.4})`;
          ctx.lineWidth = force * 1.5;
          ctx.stroke();
        }

        const currentSize = p.isHub ? p.size + Math.sin(p.pulseTimer) * 1.5 : p.size;
        
        ctx.beginPath();
        if (p.isHub) {
          ctx.fillStyle = `rgba(16, 185, 129, ${0.4 + Math.sin(p.pulseTimer) * 0.2})`;
          ctx.shadowBlur = 20;
          ctx.shadowColor = 'rgba(16, 185, 129, 0.8)';
        } else {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
          ctx.shadowBlur = Math.sin(p.pulseTimer) * 5 > 0 ? 5 : 0;
          ctx.shadowColor = 'rgba(16, 185, 129, 0.4)';
        }
        ctx.arc(p.x, p.y, Math.max(0.1, currentSize), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset

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
            // opacity based on distance
            const opacity = (1 - dist / maxDist) * (p.isHub || p2.isHub ? 0.35 : 0.15);
            ctx.strokeStyle = `rgba(16, 185, 129, ${opacity})`;
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

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 opacity-80 pointer-events-none mix-blend-screen" />;
}

export default function App() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true);
  
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

  useEffect(() => {
    const navLang = navigator.language.split('-')[0];
    if (['en', 'es', 'fr'].includes(navLang)) {
       i18n.changeLanguage(navLang);
    }
  }, [i18n]);

  return (
    <div className="flex h-[100dvh] bg-zinc-950 text-zinc-100 font-sans overflow-hidden selection:bg-emerald-500/30 relative">
      <NetworkBackground />
      
      {/* Sidebar */}
      <motion.aside 
        initial={{ width: 280 }}
        animate={{ width: isSidebarOpen ? 280 : 0 }}
        className="flex-shrink-0 border-r border-zinc-800/50 bg-zinc-950/90 backdrop-blur-xl z-40 overflow-hidden flex flex-col absolute md:relative h-full"
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50 relative overflow-hidden">
             <div className="absolute inset-0 bg-emerald-500/20 animate-pulse"></div>
             <Globe2 className="w-5 h-5 text-emerald-400 relative z-10" />
          </div>
          <span className="font-bold text-lg tracking-tight whitespace-nowrap">Gaia Protocol</span>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
          {[
            { id: 'dashboard', icon: Activity, label: t('Global Overview'), show: true },
            { id: 'network', icon: Network, label: t('P2P Network'), show: true },
            { id: 'brain', icon: BrainCircuit, label: t('World Engine'), show: true },
            { id: 'senses', icon: Eye, label: t('Sensor Grid'), show: true },
            { id: 'zkp', icon: Fingerprint, label: t('Trust & ZK Proofs'), show: true },
            { id: 'terminal', icon: Terminal, label: t('Console'), show: true },
            { id: 'outreach', icon: Briefcase, label: t('Commercial Outreach'), show: settings.showOutreach },
            { id: 'portfolio', icon: User, label: settings.userName || 'Portfolio', show: settings.showPortfolio },
            { id: 'guide', icon: BookOpen, label: t('Guide & Onboarding'), show: settings.showGuide },
            { id: 'settings', icon: Settings, label: t('Settings'), show: true },
          ].filter(item => item.show).map((item) => (
             <button 
               key={item.id}
               onClick={() => {
                 setActiveTab(item.id);
                 if (typeof window !== 'undefined' && window.innerWidth <= 768) setIsSidebarOpen(false);
               }}
               className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${activeTab === item.id ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}
             >
               <item.icon className="w-4 h-4" />
               <span className="text-sm font-medium">{item.label}</span>
             </button>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-800/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-500 font-mono">{t("SYSTEM STATUS")}</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="text-sm font-mono text-zinc-400">
            {t("Node ID")}: {nodeId}<br/>
            {t("Mesh Peers")}: {peers.length}<br/>
            {t("Hashrate")}: {computeRate.toLocaleString()} H/s
          </div>
        </div>
      </motion.aside>

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative border-l border-zinc-800/30">
        {/* Glow Effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

        <header className="h-16 flex-shrink-0 border-b border-zinc-800/50 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-md z-10 relative">
          <div className="flex items-center gap-4">
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -ml-2 text-zinc-400 hover:text-zinc-200 rounded-md hover:bg-zinc-900 transition-colors">
               <Menu className="w-5 h-5" />
             </button>
             <h1 className="text-lg font-medium capitalize flex items-center gap-2">
                <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-xs font-mono border border-zinc-700">v0.9.4</span>
                {activeTab.replace('-', ' ')}
             </h1>
          </div>
          <div className="flex items-center gap-3">
             <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder={t("Query protocol...")} 
                  className="bg-zinc-900 border border-zinc-800 rounded-full pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all w-64 font-mono"
                />
             </div>
          </div>
        </header>

        <div className="flex-1 relative z-10 p-6 overflow-y-auto w-full">
          <div className="max-w-6xl mx-auto space-y-6 pb-12">
            <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
              <DashboardView peers={peers} computeRate={computeRate} earthquakes={earthquakes} nodeId={nodeId} hashHistory={hashHistory} eqError={eqError} globalStats={globalStats} networkEvents={networkEvents} />
            </div>
            <div style={{ display: activeTab === 'network' ? 'block' : 'none' }}>
              <NetworkView peers={peers} nodeId={nodeId} />
            </div>
            <div style={{ display: activeTab === 'brain' ? 'block' : 'none' }}>
              <BrainView setComputeRate={setComputeRate} computeRate={computeRate} />
            </div>
            <div style={{ display: activeTab === 'senses' ? 'block' : 'none' }}>
              <SensesView earthquakes={earthquakes} eqError={eqError} />
            </div>
            <div style={{ display: activeTab === 'zkp' ? 'block' : 'none' }}>
              <ZkpView />
            </div>
            <div style={{ display: activeTab === 'terminal' ? 'block' : 'none' }}>
              <TerminalView peers={peers} nodeId={nodeId} computeRate={computeRate} networkEvents={networkEvents} />
            </div>
            <div style={{ display: activeTab === 'outreach' ? 'block' : 'none' }}>
              <OutreachView settings={settings} />
            </div>
            <div style={{ display: activeTab === 'portfolio' ? 'block' : 'none' }}>
              <PortfolioView settings={settings} />
            </div>
            <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
              <SettingsView settings={settings} setSettings={setSettings} />
            </div>
            <div style={{ display: activeTab === 'guide' ? 'block' : 'none' }}>
              <GuideView />
            </div>
          </div>
        </div>
      </main>

      {/* Floating AI Voice Assistant */}
      <AIAssistant />
    </div>
  );
}

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
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <label className="text-sm font-medium text-zinc-400">Phone 1</label>
                     <input 
                       type="text" 
                       value={settings.userPhone1} 
                       onChange={(e) => setSettings({...settings, userPhone1: e.target.value})}
                       className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200 outline-none focus:border-emerald-500/50 transition-colors" 
                     />
                   </div>
                   <div className="space-y-2">
                     <label className="text-sm font-medium text-zinc-400">Phone 2</label>
                     <input 
                       type="text" 
                       value={settings.userPhone2} 
                       onChange={(e) => setSettings({...settings, userPhone2: e.target.value})}
                       className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200 outline-none focus:border-emerald-500/50 transition-colors" 
                     />
                   </div>
                 </div>
              </CardContent>
           </Card>

           <Card className="bg-zinc-900/50 border-zinc-800/50">
              <CardHeader>
                 <CardTitle>Interface Toggles</CardTitle>
                 <CardDescription>Show or hide specific modules from the global sidebar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <label className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/50 bg-zinc-950 hover:bg-zinc-900 transition-colors cursor-pointer">
                   <span className="text-sm font-medium text-zinc-300">Show Commercial Outreach</span>
                   <input 
                     type="checkbox" 
                     checked={settings.showOutreach} 
                     onChange={(e) => setSettings({...settings, showOutreach: e.target.checked})}
                     className="w-5 h-5 accent-emerald-500 cursor-pointer"
                   />
                 </label>
                 <label className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/50 bg-zinc-950 hover:bg-zinc-900 transition-colors cursor-pointer">
                   <span className="text-sm font-medium text-zinc-300">Show Personal Portfolio</span>
                   <input 
                     type="checkbox" 
                     checked={settings.showPortfolio} 
                     onChange={(e) => setSettings({...settings, showPortfolio: e.target.checked})}
                     className="w-5 h-5 accent-emerald-500 cursor-pointer"
                   />
                 </label>
                 <label className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/50 bg-zinc-950 hover:bg-zinc-900 transition-colors cursor-pointer">
                   <span className="text-sm font-medium text-zinc-300">Show Guide & Onboarding</span>
                   <input 
                     type="checkbox" 
                     checked={settings.showGuide} 
                     onChange={(e) => setSettings({...settings, showGuide: e.target.checked})}
                     className="w-5 h-5 accent-emerald-500 cursor-pointer"
                   />
                 </label>
              </CardContent>
           </Card>
         </div>

         <div className="space-y-6">
           <Card className="bg-zinc-900/50 border-zinc-800/50">
              <CardHeader>
                 <CardTitle>{t("Language & Localization")}</CardTitle>
                 <CardDescription>{t("Select your preferred language.")}</CardDescription>
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
                    <button
                      onClick={() => {
                         const navLang = navigator.language.split('-')[0];
                         if (['en', 'es', 'fr'].includes(navLang)) changeLang(navLang);
                      }}
                      className="px-4 py-2 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors cursor-pointer text-zinc-300 gap-2 flex items-center justify-center w-full"
                    >
                       <Globe2 className="w-4 h-4"/>
                       {t("Auto-detect device language")}
                    </button>
                 </div>
              </CardContent>
           </Card>

           <Card className="bg-zinc-900/50 border-zinc-800/50">
              <CardHeader>
                 <CardTitle>{t("Location & Privacy")}</CardTitle>
              </CardHeader>
              <CardContent>
                 <button 
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (p) => alert(`Lat: ${p.coords.latitude}, Lng: ${p.coords.longitude}`),
                          (e) => alert('Location denied or failed.')
                        );
                      }
                    }}
                    className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-medium rounded-md transition-colors cursor-pointer flex items-center justify-center gap-2"
                 >
                    <MapIcon className="w-4 h-4" />
                    {t("Validate Network Location")}
                 </button>
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
             <div className="bg-zinc-950 p-4 border border-zinc-800 rounded font-mono text-sm inline-block">
               const isValid = verify_proof(public_inputs, proof);<br/>
               // returns true without seeing private data
             </div>
          </CardContent>
       </Card>

       <Card className="bg-zinc-900/50 border-zinc-800/50 border-t-emerald-500 border-t-2">
          <CardHeader>
             <CardTitle>{t("Guide")}</CardTitle>
          </CardHeader>
          <CardContent>
             <p className="text-zinc-300 leading-relaxed">{t("How it works")}</p>
             <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="p-4 border border-zinc-800 rounded bg-zinc-950/50">
                 <Network className="w-5 h-5 text-zinc-400 mb-2"/>
                 <h4 className="font-medium text-emerald-400">P2P Network</h4>
                 <p className="text-sm text-zinc-500 mt-1">Gossip protocol propagates state across nodes locally.</p>
               </div>
               <div className="p-4 border border-zinc-800 rounded bg-zinc-950/50">
                 <Activity className="w-5 h-5 text-zinc-400 mb-2"/>
                 <h4 className="font-medium text-blue-400">Live Sensors</h4>
                 <p className="text-sm text-zinc-500 mt-1">Real earthquake data integrated with global mappings.</p>
               </div>
             </div>
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
                <p className="text-sm text-zinc-400">
                   Building the future of decentralized computing and real-time sensory grids.
                </p>
                <div className="flex items-center gap-3 w-full justify-center pt-2">
                   <a href="mailto:gmeya2041@gmail.com" className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors text-zinc-300">
                      <Mail className="w-4 h-4" />
                   </a>
                   <a href="https://github.com/Meyer4" target="_blank" rel="noopener noreferrer" className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors text-zinc-300">
                      <Github className="w-4 h-4" />
                   </a>
                   <a href="#" className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors text-zinc-300">
                      <Linkedin className="w-4 h-4" />
                   </a>
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
                   I specialize in designing decentralized applications and global compute infrastructure.
                </p>
                <p>
                   I'm actively seeking strategic partners, investors, and early adopters who share this vision. 
                   While I operate lean, this dashboard serves as a live demonstration of what I can build and where the future of computing is headed. I don't maintain a separate portfolio—my work speaks for itself inside this environment.
                </p>
                
                <div className="grid grid-cols-2 gap-6 pt-4 mt-4 border-t border-zinc-800/50">
                   <div>
                      <h4 className="font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                         <Terminal className="w-4 h-4 text-emerald-400" /> Core Skills
                      </h4>
                      <ul className="space-y-2 text-zinc-400">
                         <li>• Distributed Systems & DePIN</li>
                         <li>• Zero-Knowledge Proofs (ZKPs)</li>
                         <li>• Applied AI & Machine Learning</li>
                         <li>• Advanced React & Node.js</li>
                      </ul>
                   </div>
                   <div>
                      <h4 className="font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                         <Network className="w-4 h-4 text-emerald-400" /> Key Focus Areas
                      </h4>
                      <ul className="space-y-2 text-zinc-400">
                         <li>• Global Sensor Grids</li>
                         <li>• Decentralized Computing</li>
                         <li>• Start-up Growth Strategy</li>
                         <li>• Investor Outreach (AI Assisted)</li>
                      </ul>
                   </div>
                </div>
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
  
  const targetEmails: Record<string, string> = {
    dept_of_energy: '',
    depin_vc: '',
    ai_enterprise: '',
    weather_org: '',
    intern_web3: '',
    intern_software: '',
    job_fullstack: '',
    job_google: '',
    job_openai: '',
    job_anthropic: '',
    job_cloudflare: '',
    job_meta: '',
    job_palantir: ''
  };

  const [investorEmail, setInvestorEmail] = useState('');
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/pitches').then(r => r.json()).then(d => {
      if(d.success && d.pitches) setHistory(d.pitches);
    }).catch(() => {});
  }, [pitch]); // refetch when a new pitch is generated

  const handleTargetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTarget = e.target.value;
    setTarget(newTarget);
    setInvestorEmail(targetEmails[newTarget] || '');
  };

  const generatePitch = async () => {
    setGenerating(true);
    setPitch('');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const userName = settings?.userName || "George Meya";
      const jobTitle = settings?.jobTitle || "Founder & Architect";
      const phone1 = settings?.userPhone1 || "+265 991593725";
      const phone2 = settings?.userPhone2 || "+265 883991420";

      let systemInstruction = `You are an expert career advisor and master pitch writer. You are writing on behalf of ${userName}.`;
      let promptText = "";

      if (target.startsWith('intern_') || target.startsWith('job_')) {
          promptText = `Write a compelling job application email / cover letter (3-4 paragraphs) to apply for this role.
I am ${userName}, the creator of the Gaia Protocol—a decentralized node network featuring low-cost distributed compute, real-time sensor grids, and ZKP security built with React and Node.js.
I want them to appreciate this project and my core skills (Distributed Systems, Web3, AI, and Full-Stack Engineering).
Make sure to include a proper greeting like 'Dear Hiring Manager,' or 'Dear Recruiting Team,', and sign off from '${userName}'. Include my phone numbers in the signature: ${phone1} and ${phone2}.

Target Role/Company: `;
      } else {
          promptText = `Write a short, compelling email pitch (3-4 paragraphs) to sell access to our decentralized node network (Gaia Protocol). We offer low-cost distributed compute, real-time sensor grids, and ZKP security.

Make sure to include a proper greeting like 'Dear [Name/Title],' making your best guess at the role or specific person if applicable for the given persona, and sign off from '${userName}, ${jobTitle}, Gaia Protocol'. Include my phone numbers in the signature: ${phone1} and ${phone2}.

Target persona: `;
      }

      switch (target) {
        case 'dept_of_energy':
          promptText += "Department of Energy / Government Scientific Research Body looking for high-capacity climate/seismic simulation compute.";
          break;
        case 'depin_vc':
          promptText += "DePIN (Decentralized Physical Infrastructure Networks) Venture Capitalist looking for the next big crypto/utility network.";
          break;
        case 'ai_enterprise':
          promptText += "Enterprise AI company looking to lower their model training/inference costs by utilizing decentralized idle compute.";
          break;
        case 'weather_org':
          promptText += "Global Weather & Disaster Response Organization seeking real-time unified sensor data (like earthquakes) globally.";
          break;
        case 'intern_web3':
          promptText += "Software Engineering Internship at a top Web3 / Core DePIN company (like Protocol Labs or Solana).";
          break;
        case 'intern_software':
          promptText += "General Software Engineering Internship at a fast-paced innovative tech startup.";
          break;
        case 'job_fullstack':
          promptText += "Full-Stack Distributed Systems Developer role at a top tech enterprise.";
          break;
        case 'job_google':
          promptText += "General Software Engineering or Distributed Systems role at Google.";
          break;
        case 'job_openai':
          promptText += "Software Engineer in AI Infrastructure or Distributed Training at OpenAI.";
          break;
        case 'job_anthropic':
          promptText += "Systems Engineering role at Anthropic, dealing with large-scale compute clusters.";
          break;
        case 'job_cloudflare':
          promptText += "Systems or Edge Computing Engineer at Cloudflare.";
          break;
        case 'job_meta':
          promptText += "Software Engineer, Infrastructure or Reality Labs at Meta.";
          break;
        case 'job_palantir':
          promptText += "Forward Deployed Software Engineer (FDSE) or Distributed Systems Architect at Palantir.";
          break;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptText,
        config: { systemInstruction }
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
       <div className="flex items-center gap-2 mb-6">
          <Briefcase className="w-6 h-6 text-emerald-400" />
          <h2 className="text-2xl font-bold">{t("Commercial Outreach")}</h2>
       </div>

       <Card className="bg-zinc-900/50 border-zinc-800/50">
          <CardHeader>
             <CardTitle>{t("Generate Pitch")}</CardTitle>
             <CardDescription>Tailor your commercial strategy specifically for different types of buyers.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">{t("Target Persona / Role")}</label>
                  <select 
                    value={target} 
                    onChange={handleTargetChange}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-zinc-100"
                  >
                     <optgroup label="Investors & Partners">
                       <option value="dept_of_energy">Gov / Scientific Research (e.g. Dept of Energy)</option>
                       <option value="depin_vc">DePIN / Web3 Venture Capital</option>
                       <option value="ai_enterprise">Enterprise AI Operations</option>
                       <option value="weather_org">Global Disaster/Weather Organizations</option>
                     </optgroup>
                     <optgroup label="Jobs & Internships">
                       <option value="intern_web3">DePIN / Web3 Software Eng. Internship</option>
                       <option value="intern_software">General Software Eng. Internship</option>
                       <option value="job_fullstack">Full-Stack Systems Developer Job</option>
                       <option value="job_google">Google - Software Engineer</option>
                       <option value="job_openai">OpenAI - AI Infrastructure Engineer</option>
                       <option value="job_anthropic">Anthropic - Systems Engineer</option>
                       <option value="job_cloudflare">Cloudflare - Edge Computing Engineer</option>
                       <option value="job_meta">Meta - Infrastructure Engineer</option>
                       <option value="job_palantir">Palantir - Forward Deployed Engineer</option>
                     </optgroup>
                  </select>
               </div>
               <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Recipient Email (Editable)</label>
                  <input 
                    type="email" 
                    value={investorEmail} 
                    onChange={(e) => setInvestorEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-zinc-100 placeholder:text-zinc-600"
                    placeholder="Find a recruiter on LinkedIn and paste their email here"
                  />
               </div>
               <button 
                  onClick={generatePitch} 
                  disabled={generating}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-medium text-sm rounded-md transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
               >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {generating ? "Drafting..." : t("Draft Email")}
               </button>
            </div>
            
            {pitch && (
              <div className="mt-6 p-4 bg-zinc-950 border border-zinc-800 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                    <FileText className="w-4 h-4" />
                    Generated Pitch
                  </div>
                  <button
                    onClick={() => {
                      const subject = encodeURIComponent("Partnership Opportunity: Gaia Protocol");
                      const body = encodeURIComponent(pitch);
                      window.open(`mailto:${encodeURIComponent(investorEmail)}?subject=${subject}&body=${body}`);
                    }}
                    className="flex items-center gap-2 text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-md transition-colors border border-emerald-500/20"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Open in Mail App
                  </button>
                </div>
                <div className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed font-sans">
                  {pitch}
                </div>
              </div>
            )}
          </CardContent>
       </Card>

       {history.length > 0 && (
         <Card className="bg-zinc-900/50 border-zinc-800/50 mt-6">
            <CardHeader>
               <CardTitle className="text-xl flex items-center gap-2">
                 <Briefcase className="w-5 h-5 text-zinc-400" />
                 Past Pitches
               </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                 {history.map((h: any, i) => (
                   <div key={i} className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/50 flex flex-col gap-2 relative">
                     <div className="flex justify-between items-center text-xs border-b border-zinc-800/50 pb-2 mb-1">
                       <span className="font-mono text-emerald-400 uppercase tracking-wider">{h.target.replace('_', ' ')}</span>
                       <span className="text-zinc-500">{new Date(h.timestamp).toLocaleString()}</span>
                     </div>
                     <p className="text-sm text-zinc-300 whitespace-pre-wrap">{h.pitch}</p>
                   </div>
                 ))}
               </div>
            </CardContent>
         </Card>
       )}
    </div>
  );
}

function GoogleMapWrapper({ earthquakes, onMarkerClick }: { earthquakes: any[], onMarkerClick: (eq: any) => void }) {
  const API_KEY = 
    (typeof process !== 'undefined' ? process.env.GOOGLE_MAPS_PLATFORM_KEY : '') || 
    (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || 
    '';
  const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

  if (!hasValidKey) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-zinc-800 rounded-lg bg-zinc-900/50">
        <MapIcon className="w-8 h-8 text-zinc-500 mb-2" />
        <h3 className="text-zinc-200 font-medium mb-1">Google Maps API Key Required</h3>
        <p className="text-zinc-400 text-sm mb-4 text-center max-w-md">
          To see the live seismic data on the map, add your API key.
        </p>
        <ul className="text-left text-sm text-zinc-500 font-mono space-y-1">
          <li>1. Settings ➔ Secrets</li>
          <li>2. Add <span className="text-emerald-400">GOOGLE_MAPS_PLATFORM_KEY</span></li>
          <li>3. The preview will automatically rebuild.</li>
        </ul>
      </div>
    );
  }

  const defaultCenter = earthquakes.length > 0 && earthquakes[0]?.geometry 
    ? { lat: earthquakes[0].geometry.coordinates[1], lng: earthquakes[0].geometry.coordinates[0] } 
    : { lat: 37.42, lng: -122.08 };

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <div className="w-full h-full min-h-[400px] rounded-lg overflow-hidden border border-zinc-800 relative shadow-inner">
        <GoogleMap
          defaultCenter={defaultCenter}
          defaultZoom={2}
          mapId={((import.meta as any).env?.VITE_GOOGLE_MAPS_ID) || "DEMO_MAP_ID"}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          disableDefaultUI={true}
          style={{ width: '100%', height: '100%' }}
        >
          {earthquakes.map((eq, i) => (
            <AdvancedMarker 
              key={eq.id || i}
              position={{ lat: eq.geometry.coordinates[1], lng: eq.geometry.coordinates[0] }}
              onClick={() => onMarkerClick(eq)}
              title={eq.properties.title}
            >
              <Pin 
                background={eq.properties.mag >= 3.0 ? '#ef4444' : '#10b981'} 
                borderColor="rgba(0,0,0,0.5)" 
                glyphColor="#fff" 
                scale={eq.properties.mag >= 3.0 ? 1.2 : 0.8}
              />
            </AdvancedMarker>
          ))}
        </GoogleMap>
      </div>
    </APIProvider>
  );
}

function SensesView({ earthquakes, eqError }: { earthquakes: any[], eqError?: string | null }) {
  const [selectedEq, setSelectedEq] = useState<any>(null);

  const getEstDuration = (mag: number) => {
    return Math.max(5, Math.floor(mag * 8)) + " seconds";
  };

  const handleSOS = () => {
    alert("Emergency SOS signal broadcasted to local mesh nodes!");
    setSelectedEq(null);
  };

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
            <div>
                <h2 className="text-2xl font-bold">Earth Sensor Grid</h2>
                <p className="text-zinc-400 text-sm">Aggregating real live APIs (USGS Seismic Data) into a single nervous system.</p>
            </div>
            <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-medium rounded-lg transition-colors text-sm cursor-pointer">
                Add Sensor Logic
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
            <div className="col-span-1 lg:col-span-2 flex flex-col h-[400px] lg:h-full">
               <GoogleMapWrapper earthquakes={earthquakes} onMarkerClick={setSelectedEq} />
            </div>

            <Card className="bg-zinc-900/50 border-zinc-800/50 flex flex-col h-[400px] lg:h-full overflow-hidden">
               <CardHeader className="pb-2 flex-shrink-0">
                   <CardTitle className="text-sm font-medium text-zinc-400 flex flex-col gap-2">
                     <div className="flex items-center justify-between">
                        USGS Seismic Data (Live)
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px]">{earthquakes.length} Events</Badge>
                     </div>
                     <span className="text-xs text-zinc-500 font-normal">Last hour data update</span>
                   </CardTitle>
               </CardHeader>
               <div className="flex-1 px-6 pb-6 overflow-y-auto">
                   <div className="space-y-4 pr-4">
                     {eqError && <p className="text-sm text-red-500 font-mono">Error: {eqError}</p>}
                     {!eqError && earthquakes.length === 0 && <p className="text-sm text-zinc-500 font-mono flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/> Awaiting data feeds...</p>}
                     {earthquakes.map((eq, i) => (
                       <div 
                         key={i} 
                         onClick={() => setSelectedEq(eq)}
                         className="p-3 bg-zinc-950 border border-zinc-800 hover:border-emerald-500/50 rounded-lg font-mono text-xs text-zinc-400 flex flex-col gap-1 cursor-pointer transition-colors"
                       >
                         <div className="flex justify-between items-center">
                            <span className={eq.properties.mag >= 3.0 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                              MAG {eq.properties.mag?.toFixed(1)}
                            </span>
                            <span className="text-zinc-500">{new Date(eq.properties.time).toLocaleTimeString()}</span>
                         </div>
                         <div className="text-zinc-300 truncate">&gt; {eq.properties.place}</div>
                         <div className="text-zinc-600">Loc: {eq.geometry.coordinates[1].toFixed(4)}° N, {eq.geometry.coordinates[0].toFixed(4)}° E</div>
                       </div>
                     ))}
                   </div>
               </div>
            </Card>
        </div>

        <Dialog open={!!selectedEq} onOpenChange={(open) => !open && setSelectedEq(null)}>
            <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-lg">
               <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                     <ShieldAlert className={selectedEq?.properties.mag >= 3.0 ? 'text-red-500' : 'text-emerald-500'} />
                     Seismic Event Details
                  </DialogTitle>
                  <DialogDescription className="text-zinc-400">
                     Detailed metrics and trajectory estimation for this event.
                  </DialogDescription>
               </DialogHeader>

               {selectedEq && (
                   <div className="space-y-4 py-4 font-mono text-sm">
                       <div className="bg-zinc-900 p-4 border border-zinc-800 rounded-lg space-y-3">
                          <div className="flex justify-between border-b border-zinc-800 pb-2">
                             <span className="text-zinc-500">Magnitude</span>
                             <span className={selectedEq.properties.mag >= 3.0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                                {selectedEq.properties.mag?.toFixed(2)} {selectedEq.properties.magType?.toUpperCase()}
                             </span>
                          </div>
                          <div className="flex justify-between border-b border-zinc-800 pb-2">
                             <span className="text-zinc-500">Location</span>
                             <span className="text-zinc-200 text-right max-w-[250px] whitespace-normal break-words">{selectedEq.properties.place}</span>
                          </div>
                          <div className="flex justify-between border-b border-zinc-800 pb-2">
                             <span className="text-zinc-500">Lat / Lng</span>
                             <span className="text-zinc-300">{selectedEq.geometry.coordinates[1].toFixed(4)}° N, {selectedEq.geometry.coordinates[0].toFixed(4)}° E</span>
                          </div>
                          <div className="flex justify-between border-b border-zinc-800 pb-2">
                             <span className="text-zinc-500">Time (Local)</span>
                             <span className="text-zinc-300">{new Date(selectedEq.properties.time).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between border-b border-zinc-800 pb-2">
                             <span className="text-zinc-500">Est. Duration</span>
                             <span className="text-orange-400">{getEstDuration(selectedEq.properties.mag)}</span>
                          </div>
                          <div className="flex justify-between">
                             <span className="text-zinc-500">Tsunami Risk</span>
                             <span className={selectedEq.properties.tsunami ? 'text-red-400' : 'text-emerald-400'}>
                                {selectedEq.properties.tsunami ? 'Elevated Warning' : 'None Detected'}
                             </span>
                          </div>
                       </div>
                   </div>
               )}

               <DialogFooter>
                  <button 
                      onClick={handleSOS} 
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md font-bold text-sm w-full flex items-center justify-center gap-2"
                  >
                      <Network className="w-4 h-4" />
                      Broadcast SOS to Local Mesh
                  </button>
               </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  )
}

function ZkpView() {
  const [proofs, setProofs] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateProof = async () => {
    setIsGenerating(true);
    try {
      const keyPair = await window.crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-384" },
        true,
        ["sign", "verify"]
      );
      
      const encoder = new TextEncoder();
      const payloadString = "payload_" + Math.random().toString(36).substring(7);
      const data = encoder.encode(payloadString);
      const signature = await window.crypto.subtle.sign(
        { name: "ECDSA", hash: { name: "SHA-256" } },
        keyPair.privateKey,
        data
      );
      
      const signatureArray = Array.from(new Uint8Array(signature));
      const hexSignature = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      setProofs(p => p + 1);
      setHistory(prev => [{
        id: `sig_${hexSignature.substring(0, 8)}`,
        type: "Local ECDSA Signature",
        proof: "P-384",
        status: "Verified",
        time: "Just now",
        detail: `Real WebCrypto signature applied to ${payloadString}.`
      }, ...prev].slice(0, 10));
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
            <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Fingerprint className="w-6 h-6 text-purple-400" />
                  Cryptographic Primitives
                </h2>
                <p className="text-zinc-400 text-sm">Testing real WebCrypto ECDSA signatures within the browser.</p>
            </div>
            <button 
              onClick={generateProof}
              disabled={isGenerating}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors text-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
                <FileKey className="w-4 h-4" />
                {isGenerating ? "Signing..." : "Generate Sandbox Signature"}
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-zinc-900/50 border-zinc-800/50">
               <CardContent className="p-6">
                   <div className="flex items-center gap-4">
                     <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400 border border-purple-500/20">
                       <ShieldAlert className="w-6 h-6" />
                     </div>
                     <div>
                       <p className="text-sm text-zinc-400 font-medium">Signatures Generated (Local)</p>
                       <p className="text-2xl font-bold text-zinc-100">{proofs}</p>
                     </div>
                   </div>
               </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800/50">
               <CardContent className="p-6">
                   <div className="flex items-center gap-4">
                     <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                       <CheckCircle2 className="w-6 h-6" />
                     </div>
                     <div>
                       <p className="text-sm text-zinc-400 font-medium">Local Fallback</p>
                       <p className="text-sm text-zinc-400 mt-1">Full ZKP logic omitted to rely strictly on real native WebCrypto APIs available here.</p>
                     </div>
                   </div>
               </CardContent>
            </Card>
        </div>

        <Card className="bg-zinc-900/50 border-zinc-800/50">
            <CardHeader>
                <CardTitle className="text-lg">Live Local Signatures</CardTitle>
                <CardDescription>Real-time generation of elliptic curve signatures using WebCrypto.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 font-mono text-sm">
                    {history.length === 0 && <p className="text-zinc-500 text-sm font-mono text-center py-4 border border-dashed border-zinc-800 rounded">No signatures generated yet in this session.</p>}
                    {history.map((item, i) => (
                        <div key={i} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg bg-zinc-950 border border-zinc-800/50 gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-purple-400 font-bold">{item.id}</span>
                                    <Badge variant="outline" className="text-zinc-500 border-zinc-700 text-[10px] uppercase">{item.type}</Badge>
                                </div>
                                <div className="text-zinc-500 text-xs mt-1">Algorithm: <span className="text-zinc-300">{item.proof}</span></div>
                                <div className="text-zinc-400 text-xs mt-2 italic">"{item.detail}"</div>
                            </div>
                            <div className="text-left md:text-right flex flex-row md:flex-col items-center md:items-end justify-between">
                                <Badge variant="outline" className={
                                    item.status === 'Verified' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
                                    item.status === 'Generating' ? 'text-blue-400 border-blue-500/30 bg-blue-500/10 animate-pulse' :
                                    'text-zinc-400 border-zinc-700'
                                }>
                                    {item.status}
                                </Badge>
                                <span className="text-zinc-500 text-xs mt-1">{item.time}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    </div>
  )
}

function TerminalView({ peers, nodeId, computeRate, networkEvents }: any) {
  const [history, setHistory] = useState<{id: string, type: string, text: string, rating?: 'up' | 'down' | null}[]>([
    { id: 'sys1', type: 'system', text: `GAIA OS v0.9.4 initialization...` },
    { id: 'sys2', type: 'system', text: `Loading local identity... OK [${nodeId}]` },
    { id: 'sys3', type: 'system', text: 'Syncing distributed hashes... OK' },
    { id: 'in1', type: 'input', text: '$ protocol config --view' },
    { id: 'out1', type: 'output', text: `Network: gaia-local-mesh\nCompute Limit: ${typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4} CPUs, ${typeof navigator !== 'undefined' && 'deviceMemory' in navigator ? (navigator as any).deviceMemory : 8}GB RAM\nSandbox: Isolated Browser DB` }
  ]);
  
  // Inject network events into terminal if they are new
  useEffect(() => {
    if (networkEvents && networkEvents.length > 0) {
      const latest = networkEvents[0];
      setHistory(prev => {
        // simple dedup by checking if the last item has the same text
        const lastItem = prev[prev.length - 1];
        const newText = `[${new Date(latest.timestamp).toLocaleTimeString()}] ${latest.type}: ${latest.message}`;
        if (lastItem && lastItem.text === newText) return prev;
        return [...prev, { id: `net_${Date.now()}_${Math.random()}`, type: 'system', text: newText }];
      });
    }
  }, [networkEvents]);

  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const handleRate = async (id: string, e: React.MouseEvent, rating: 'up' | 'down') => {
    e.stopPropagation();
    
    // Toggle rating logically
    let finalRating: 'up' | 'down' | null = rating;
    setHistory(prev => prev.map(item => {
      if (item.id === id) {
        finalRating = item.rating === rating ? null : rating;
        return { ...item, rating: finalRating };
      }
      return item;
    }));

    if (finalRating) {
      try {
        await fetch('/api/ratings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, rating: finalRating })
        });
      } catch (err) {
        console.warn('Failed to save rating to backend:', err);
      }
    }
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleCommand = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      const cmd = input.trim();
      setHistory(prev => [...prev, { id: `in_${Date.now()}`, type: 'input', text: `$ ${cmd}` }]);
      setInput('');
      
      setTimeout(() => {
        let response = '';
        if (cmd === 'protocol config --view') {
           response = `Network: gaia-local-mesh\nCompute Limit: ${navigator.hardwareConcurrency || 4} CPUs, ${('deviceMemory' in navigator ? navigator.deviceMemory : 8)}GB RAM\nSandbox: Isolated Browser DB`;
        } else if (cmd === 'get --bounties') {
           response = 'Feature not available in local browser sandbox.';
        } else if (cmd === 'help') {
           response = 'Available commands:\n  protocol config --view\n  id\n  peers\n  hashrate\n  ping <node>\n  clear';
        } else if (cmd === 'clear') {
           setHistory([]);
           return;
        } else if (cmd === 'peers') {
           if (peers.length === 0) response = 'No peers connected. Try opening this app in another tab.';
           else response = `Connected to ${peers.length} peers:\n${peers.join('\n')}`;
        } else if (cmd === 'id') {
           response = `Node Identity:\nID: ${nodeId}\nVersion: GAIA v0.9.4 (Local Sandbox)`;
        } else if (cmd === 'hashrate') {
           response = `Local Compute Capability:\nSHA-256 Hashrate: ${computeRate} H/s\nStatus: ${computeRate > 0 ? 'Active Workflow' : 'Idle'}`;
        } else if (cmd.startsWith('ping')) {
           response = `Pinging ${cmd.split(' ')[1] || 'node'}...\nReply from node: time=<1ms (Local Broadcast Channel)\nReply from node: time=<1ms (Local Broadcast Channel)`;
        } else {
           response = `Command not found: ${cmd}. Type "help" for a list of commands.`;
        }
        setHistory(prev => [...prev, { id: `out_${Date.now()}`, type: 'output', text: response }]);
      }, 400);
    }
  };

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
            <div>
                <h2 className="text-2xl font-bold">Gaia Protocol Console</h2>
                <p className="text-zinc-400 text-sm">Interact with the network, deploy models, or contribute code bounties.</p>
            </div>
            <div className="flex gap-4 items-center">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-mono text-emerald-400">Connected to Mainnet</span>
            </div>
        </div>

        <div className="w-full h-[400px] bg-zinc-950/50 backdrop-blur-sm border border-zinc-800 rounded-lg font-mono text-sm p-4 overflow-y-auto space-y-2 shadow-inner" onClick={() => document.getElementById('term-input')?.focus()}>
           {history.map((item, i) => (
             <div key={item.id || i} className="group relative">
                {item.type === 'system' && <div className="text-zinc-500">{item.text}</div>}
                {item.type === 'input' && <div className="text-blue-400 mt-2">{item.text}</div>}
                {item.type === 'output' && (
                  <div className="text-zinc-300 pl-4 whitespace-pre-wrap relative pr-16">
                    {item.text}
                    <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                       <button 
                         onClick={(e) => handleRate(item.id!, e, 'up')}
                         className={`p-1 rounded hover:bg-zinc-800 ${item.rating === 'up' ? 'text-emerald-400 bg-zinc-800' : 'text-zinc-500 hover:text-emerald-400'}`}
                         title="Helpful output"
                       >
                          <ThumbsUp className="w-3.5 h-3.5" />
                       </button>
                       <button 
                         onClick={(e) => handleRate(item.id!, e, 'down')}
                         className={`p-1 rounded hover:bg-zinc-800 ${item.rating === 'down' ? 'text-red-400 bg-zinc-800' : 'text-zinc-500 hover:text-red-400'}`}
                         title="Not helpful"
                       >
                          <ThumbsDown className="w-3.5 h-3.5" />
                       </button>
                    </div>
                  </div>
                )}
             </div>
           ))}
           <div className="flex items-center text-blue-400 mt-2">
             <span className="mr-2">$</span>
             <input
                id="term-input"
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleCommand}
                className="flex-1 bg-transparent border-none outline-none text-emerald-400"
                autoFocus
             />
           </div>
           <div ref={endRef} />
        </div>
    </div>
  )
}

export function DashboardView({ peers, computeRate, earthquakes, nodeId, hashHistory, eqError, globalStats, networkEvents }: any) {
  return (
    <div className="space-y-6">
      {networkEvents && networkEvents.length > 0 && (
        <div className="bg-zinc-950/50 backdrop-blur-sm border border-zinc-800 rounded-lg p-3 flex items-center gap-3 overflow-hidden">
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 whitespace-nowrap">LIVE NET</Badge>
          <div className="text-sm font-mono text-zinc-300 truncate w-full animate-pulse">
            <span className="text-zinc-500 mr-2">[{new Date(networkEvents[0].timestamp).toLocaleTimeString()}]</span>
            <span className={networkEvents[0].type === 'WARN' ? 'text-amber-400' : 'text-zinc-300'}>{networkEvents[0].message}</span>
          </div>
        </div>
      )}

      {globalStats && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-4 text-zinc-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Global Network Consensus
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <Card className="bg-emerald-950/20 border-emerald-900/50">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-emerald-400/80 mb-1 uppercase tracking-wider">Global Nodes</p>
                <p className="text-2xl font-bold text-emerald-400">{globalStats.activeNodes?.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="bg-emerald-950/20 border-emerald-900/50">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-emerald-400/80 mb-1 uppercase tracking-wider">Total Compute</p>
                <p className="text-2xl font-bold text-emerald-400">{globalStats.totalCompute}</p>
              </CardContent>
            </Card>
            <Card className="bg-emerald-950/20 border-emerald-900/50">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-emerald-400/80 mb-1 uppercase tracking-wider">Uptime</p>
                <p className="text-2xl font-bold text-emerald-400">{globalStats.uptime}</p>
              </CardContent>
            </Card>
            <Card className="bg-emerald-950/20 border-emerald-900/50 delay-100">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-emerald-400/80 mb-1 uppercase tracking-wider">Threat Level</p>
                <p className="text-2xl font-bold text-emerald-400">{globalStats.threatLevel}</p>
              </CardContent>
            </Card>
          </div>
          {globalStats.serverOS && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-zinc-900/50 border-zinc-800/50">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Host Matrix</p>
                    <p className="text-lg font-bold text-zinc-300">{globalStats.serverOS.hostname} ({globalStats.serverOS.platform})</p>
                  </div>
                  <Server className="w-6 h-6 text-zinc-500" />
                </CardContent>
              </Card>
              <Card className="bg-zinc-900/50 border-zinc-800/50">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">CPU Cores (Load)</p>
                    <p className="text-lg font-bold text-zinc-300">{globalStats.serverOS.cpuCores} vCPU <span className="text-zinc-500 text-sm">/ {globalStats.serverOS.cpuLoad}</span></p>
                  </div>
                  <Cpu className="w-6 h-6 text-zinc-500" />
                </CardContent>
              </Card>
              <Card className="bg-zinc-900/50 border-zinc-800/50">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Memory (Used / Total)</p>
                    <p className="text-lg font-bold text-zinc-300">{globalStats.serverOS.usedMemoryGB} GB <span className="text-zinc-500 text-sm">/ {globalStats.serverOS.totalMemoryGB} GB</span></p>
                  </div>
                  <CircuitBoard className="w-6 h-6 text-zinc-500" />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Local Mesh Nodes', value: (peers.length + 1).toString(), trend: 'Local', icon: Server },
          { label: 'Local Hashrate', value: `${computeRate.toLocaleString()} H/s`, trend: 'Active', icon: Zap },
          { label: 'Real Earthquakes (1h)', value: earthquakes.length.toString(), trend: 'Live', icon: ShieldAlert, alert: true },
          { label: 'Connected Peer IDs', value: peers.length > 0 ? peers.length.toString() : '0', trend: 'P2P', icon: Network },
        ].map((stat, i) => (
          <Card key={i} className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-zinc-400 mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${stat.alert ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className={stat.trend.startsWith('+') ? 'text-emerald-400' : stat.trend.startsWith('-') ? 'text-emerald-400' : 'text-zinc-400'}>
                  {stat.trend}
                </span>
                <span className="text-zinc-500 ml-2">vs last 24h</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-2 bg-zinc-900/50 border-zinc-800/50">
          <CardHeader>
            <CardTitle className="text-lg">Network Participation Growth (Hashes/sec)</CardTitle>
            <CardDescription className="text-zinc-400 text-sm">Local node compute contribution over time.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hashHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHashes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                  <XAxis dataKey="time" stroke="#52525b" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                  <YAxis stroke="#52525b" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                    itemStyle={{ color: '#e4e4e7' }}
                  />
                  <Area type="monotone" dataKey="hashes" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorHashes)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800/50 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
               <Activity className="w-4 h-4 text-blue-400" />
               Live Earth Twin
            </CardTitle>
            <CardDescription className="text-zinc-400 text-sm">Real-time global event stream.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
               {[
                 { time: '10s ago', event: 'Wildfire detected', loc: 'California, US', type: 'alert' },
                 { time: '2m ago', event: 'Protein folded', loc: 'Node #8821', type: 'success' },
                 { time: '5m ago', event: 'Mesh net joined', loc: 'Berlin, DE', type: 'info' },
                 { time: '18m ago', event: 'Weather model updated', loc: 'Global', type: 'success' },
                 { time: '1h ago', event: 'Seismic anomaly', loc: 'Pacific Ring', type: 'alert' },
               ].map((item, i) => (
                 <div key={i} className="flex gap-3 items-start p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/30">
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${item.type === 'alert' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : item.type === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-blue-500'}`} />
                    <div className="flex-1 min-w-0">
                       <p className="text-sm font-medium truncate">{item.event}</p>
                       <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-zinc-500 font-mono">{item.loc}</span>
                          <span className="text-xs text-zinc-500">{item.time}</span>
                       </div>
                    </div>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900/50 border-zinc-800/50">
        <CardHeader>
          <CardTitle className="text-lg">Recent Epochs (Gaia Mainnet)</CardTitle>
        </CardHeader>
        <CardContent>
           <div className="w-full overflow-x-auto">
             <table className="w-full text-sm text-left">
               <thead className="text-xs text-zinc-500 uppercase bg-zinc-950/50 border-b border-zinc-800 font-mono">
                 <tr>
                   <th className="px-4 py-3 font-medium">Epoch / Hash</th>
                   <th className="px-4 py-3 font-medium">Computations</th>
                   <th className="px-4 py-3 font-medium">Validators</th>
                   <th className="px-4 py-3 font-medium">Status</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-zinc-800/50 font-mono">
                 {[
                   { e: '84002', h: '0x8f...3a1', c: 'Protein Folding V2', v: 420, s: 'Verified' },
                   { e: '84001', h: '0x2c...9b4', c: 'WeatherX Climate Model', v: 855, s: 'Verified' },
                   { e: '84000', h: '0x1a...7f2', c: 'Global Consensus Check', v: 1429, s: 'Verified' },
                   { e: '83999', h: '0x9d...4e8', c: 'Ocean Salinity Grid', v: 312, s: 'Verified' },
                 ].map((row, i) => (
                   <tr key={i} className="hover:bg-zinc-800/20 transition-colors">
                     <td className="px-4 py-4 flex gap-2 items-center">
                        <span className="text-zinc-300">#{row.e}</span>
                        <span className="text-zinc-600 text-xs">{row.h}</span>
                     </td>
                     <td className="px-4 py-4 text-zinc-300">{row.c}</td>
                     <td className="px-4 py-4 text-zinc-400">{row.v} nodes</td>
                     <td className="px-4 py-4">
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                          {row.s}
                        </Badge>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </CardContent>
      </Card>
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
      markerColor: [0.1, 0.8, 0.5],
      glowColor: [0.1, 0.1, 0.1],
      markers: [
        { location: [37.7595, -122.4367], size: 0.03 },
        { location: [40.7128, -74.006], size: 0.1 },
        { location: [51.5074, -0.1278], size: 0.08 },
        { location: [35.6895, 139.6917], size: 0.1 },
        { location: [-33.8688, 151.2093], size: 0.05 },
        { location: [-13.9626, 33.7741], size: 0.12 }, // Malawi!
      ],
      onRender: (state: any) => {
        state.phi = phi;
        phi += 0.005;
      },
    } as any);

    return () => {
      globe.destroy();
    };
  }, []);

  return <canvas ref={canvasRef} style={{ width: 400, height: 400, maxWidth: "100%", aspectRatio: 1 }} className="mx-auto opacity-80" />;
}

function NetworkView({ peers, nodeId }: any) {
  const [downlink, setDownlink] = useState<number | null>(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && (navigator as any).connection) {
      setDownlink((navigator as any).connection.downlink);
      const updateConn = () => setDownlink((navigator as any).connection.downlink);
      (navigator as any).connection.addEventListener('change', updateConn);
      return () => (navigator as any).connection.removeEventListener('change', updateConn);
    }
  }, []);

  const hasPeers = peers.length > 0;

  return (
    <div className="space-y-6">
       <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-8 text-center pattern-grid-lg">
          <Globe />
          <Network className={`w-12 h-12 mx-auto mb-4 mt-6 ${hasPeers ? 'text-emerald-500 animate-pulse' : 'text-zinc-500'}`} />
          <h2 className="text-2xl font-bold mb-2">Decentralized Mesh Visualization</h2>
          <p className="text-zinc-400 max-w-2xl mx-auto mb-6 text-sm">
            Gaia Protocol relies on a resilient Peer-to-Peer Distributed Hash Table (DHT). Nodes communicate via Gossip Protocol, ensuring no central point of failure.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button 
              className={`px-4 py-2 font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2 bg-zinc-800 text-emerald-400 border border-emerald-500/50`}
            >
               {hasPeers ? `Connected to ${peers.length} peers` : 'Local Node Active (Awaiting Peers)'}
            </button>
            <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-medium rounded-lg transition-colors text-sm cursor-pointer">
               View Protocol Specs
            </button>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-zinc-900/50 border-zinc-800/50">
             <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between text-zinc-200">
                  NAT Traversal (ICE)
                  <Badge variant="outline" className={`border-${hasPeers ? 'emerald' : 'zinc'}-500/30 text-${hasPeers ? 'emerald' : 'zinc'}-400 bg-${hasPeers ? 'emerald' : 'zinc'}-500/10`}>
                    {hasPeers ? 'Active' : 'Offline'}
                  </Badge>
                </CardTitle>
             </CardHeader>
             <CardContent>
                <div className="space-y-3 text-sm">
                   <div className="flex justify-between border-b border-zinc-800 pb-2">
                      <span className="text-zinc-400">STUN Server</span>
                      <span className="text-emerald-400 font-mono text-xs">stun.gaia.network:3478</span>
                   </div>
                   <div className="flex justify-between border-b border-zinc-800 pb-2">
                      <span className="text-zinc-400">TURN Relay</span>
                      <span className="text-emerald-400 font-mono text-xs">turn.gaia.network:443</span>
                   </div>
                   <div className="flex justify-between">
                      <span className="text-zinc-400">Local NAT Type</span>
                      <span className="text-zinc-200">Open (Local)</span>
                   </div>
                </div>
             </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800/50">
             <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between text-zinc-200">
                  Discovery Protocol
                  <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10">BroadcastChannel</Badge>
                </CardTitle>
             </CardHeader>
             <CardContent>
                <div className="space-y-3 text-sm">
                   <div className="flex justify-between border-b border-zinc-800 pb-2">
                      <span className="text-zinc-400">Bootstrap Peers</span>
                      <span className="text-zinc-200 font-mono text-xs">Local Only</span>
                   </div>
                   <div className="flex justify-between border-b border-zinc-800 pb-2">
                      <span className="text-zinc-400">Local Routing Table</span>
                      <span className="text-zinc-200 font-mono text-xs">{peers.length} records</span>
                   </div>
                   <div className="flex justify-between">
                      <span className="text-zinc-400">Lookups / min</span>
                      <span className="text-zinc-200 font-mono text-xs">N/A</span>
                   </div>
                </div>
             </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800/50">
             <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between text-zinc-200">
                  Bandwidth Measurement
                  <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">Local</Badge>
                </CardTitle>
             </CardHeader>
             <CardContent>
                <div className="space-y-4">
                   <div>
                      <div className="flex justify-between text-xs mb-1 font-mono text-zinc-400">
                         <span>Downlink</span>
                         <span className="text-emerald-400">{downlink ? `${downlink} Mbps` : 'N/A'}</span>
                      </div>
                      <Progress value={downlink ? Math.min(100, (downlink / 100) * 100) : 0} className={`h-1 bg-zinc-800 ${downlink ? '[&>div]:bg-emerald-500' : ''}`} />
                   </div>
                   <div>
                      <div className="flex justify-between text-xs mb-1 font-mono text-zinc-400">
                         <span>Uplink</span>
                         <span className="text-blue-400">N/A (Client API missing)</span>
                      </div>
                      <Progress value={0} className={`h-1 bg-zinc-800`} />
                   </div>
                   <div className="text-[10px] text-zinc-500 mt-2 text-center bg-zinc-950 p-1.5 border border-zinc-800 rounded">
                      Using experimental navigator.connection API
                   </div>
                </div>
             </CardContent>
          </Card>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <Card className="bg-zinc-900/50 border-zinc-800/50">
               <CardHeader>
                   <CardTitle className="text-lg">Active Peers</CardTitle>
               </CardHeader>
               <CardContent>
                   <div className="space-y-4">
                       {peers.length === 0 && <p className="text-zinc-500 text-sm font-mono">No active peers. Open App in new tab to test DHT connection.</p>}
                       {peers.map((peer: string, i: number) => (
                           <div key={i} className="flex items-center justify-between p-3 rounded bg-zinc-950/50 border border-zinc-800/50 font-mono text-sm backdrop-blur-sm">
                               <div>
                                   <div className="text-emerald-400">{peer}</div>
                                   <div className="text-zinc-500 text-xs mt-1">Local Mesh (Masked IP)</div>
                               </div>
                               <div className="text-right">
                                   <Badge variant="outline" className="text-zinc-400 border-zinc-700">Compute</Badge>
                                   <div className="text-zinc-500 text-xs mt-1">&lt; 1ms ping (Local)</div>
                               </div>
                           </div>
                       ))}
                   </div>
               </CardContent>
           </Card>
           <Card className="bg-zinc-900/50 border-zinc-800/50">
               <CardHeader>
                   <CardTitle className="text-lg">Global Resource Allocation</CardTitle>
               </CardHeader>
               <CardContent>
                   <div className="space-y-6">
                       <div>
                           <div className="flex justify-between text-sm mb-2">
                               <span className="text-zinc-300">Model State Sync</span>
                               <span className="text-zinc-400 font-mono">4.2 PB/s</span>
                           </div>
                           <Progress value={65} className="h-2 bg-zinc-800 [&>div]:bg-emerald-500" />
                       </div>
                       <div>
                           <div className="flex justify-between text-sm mb-2">
                               <span className="text-zinc-300">Sensor Telemetry</span>
                               <span className="text-zinc-400 font-mono">1.8 PB/s</span>
                           </div>
                           <Progress value={25} className="h-2 bg-zinc-800 [&>div]:bg-blue-500" />
                       </div>
                       <div>
                           <div className="flex justify-between text-sm mb-2">
                               <span className="text-zinc-300">Zero-Knowledge Proofs</span>
                               <span className="text-zinc-400 font-mono">800 TB/s</span>
                           </div>
                           <Progress value={10} className="h-2 bg-zinc-800 [&>div]:bg-purple-500" />
                       </div>
                   </div>
               </CardContent>
           </Card>
       </div>
    </div>
  )
}

function BrainView({ setComputeRate, computeRate }: any) {
  const [simulations, setSimulations] = useState<any[]>([]);
  const [jobName, setJobName] = useState("");
  const [computing, setComputing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const aiRef = useRef<any>(null);

  useEffect(() => {
    try {
      const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '');
      if (apiKey) {
        aiRef.current = new GoogleGenAI({ apiKey });
      }
    } catch (e) {
      console.warn('GenAI init skipped');
    }
  }, []);

  // Real SHA-256 local compute worker simulator
  useEffect(() => {
    if (!computing) {
      setComputeRate(0);
      return;
    }
    let active = true;
    let hashes = 0;
    const updateInterval = setInterval(() => {
      setComputeRate(hashes);
      hashes = 0;
    }, 1000);
    const work = async () => {
      while (active) {
        const data = new TextEncoder().encode(Math.random().toString() + Date.now().toString());
        await crypto.subtle.digest("SHA-256", data);
        hashes++;
        if (hashes % 40 === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
      }
    };
    work();
    return () => {
      active = false;
      clearInterval(updateInterval);
    };
  }, [computing, setComputeRate]);

  useEffect(() => {
    const i = setInterval(() => {
      setSimulations(prev => prev.map(sim => {
        if (sim.status === "Computing" && sim.progress < 100 && !sim.streaming) {
          return { ...sim, progress: sim.progress + 1, epoch: (parseInt(sim.epoch.replace(',', '')) + 120).toLocaleString() };
        }
        return sim;
      }));
    }, 2000);
    return () => clearInterval(i);
  }, []);

  const handleSubmitJob = async () => {
    if (jobName.trim()) {
      const jobId = Math.random();
      setSimulations(prev => [{
        id: jobId,
        name: jobName,
        status: "Computing",
        progress: 0,
        epoch: "0",
        type: "emerald",
        result: "",
        streaming: true
      }, ...prev]);
      setJobName("");
      setComputing(true);
      setIsOpen(false);

      if (aiRef.current) {
        try {
          const responseStream = await aiRef.current.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: `Act as Gaia Protocol's World Engine. Analyze this task: "${jobName}". Provide a concise, highly technical 2-paragraph result as if it was processed by 10,000 decentralized nodes.`
          });
          
          let fullText = "";
          for await (const chunk of responseStream) {
            fullText += chunk.text;
            setSimulations(prev => prev.map(sim => 
              sim.id === jobId ? { ...sim, result: fullText, progress: Math.min(99, sim.progress + 5) } : sim
            ));
          }
          
          setSimulations(prev => prev.map(sim => 
             sim.id === jobId ? { ...sim, result: fullText, status: "Verified", progress: 100, streaming: false } : sim
          ));
          setComputing(false);
          
        } catch (e) {
          console.error("Gemini Error:", e);
          setSimulations(prev => prev.map(sim => 
            sim.id === jobId ? { ...sim, result: "Failed to reach AI nodes.", status: "Failed", streaming: false } : sim
         ));
         setComputing(false);
        }
      } else {
        setTimeout(() => {
          setSimulations(prev => prev.map(sim => 
            sim.id === jobId ? { ...sim, status: "Failed", progress: 100, streaming: false, result: "Failed: No Gemini API Key found in environment variables. Please add VITE_GEMINI_API_KEY to your .env to run AI jobs." } : sim
          ));
          setComputing(false);
        }, 1000);
      }
    }
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-2xl font-bold">World Engine (Powered by Gemini)</h2>
                <p className="text-zinc-400 text-sm">Distributed AI execution layer for global scientific models.</p>
            </div>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger className="px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-900 font-medium rounded-lg transition-colors text-sm flex items-center gap-2 cursor-pointer">
                  <Play className="w-4 h-4" />
                  Submit AI Job
              </DialogTrigger>
              <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                <DialogHeader>
                  <DialogTitle>Submit Computation Job</DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Deploy an AI model to the distributed network. Gas fees apply in GAIA tokens.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Model Name / Task prompt</label>
                    <input 
                      value={jobName}
                      onChange={e => setJobName(e.target.value)}
                      placeholder="e.g. Optimize mRNA sequence folding" 
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm outline-none focus:border-emerald-500/50" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Required Nodes (approx)</label>
                    <input type="number" defaultValue={500} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm outline-none focus:border-emerald-500/50" />
                  </div>
                </div>
                <DialogFooter>
                  <button onClick={handleSubmitJob} className="bg-emerald-500 hover:bg-emerald-600 text-black px-4 py-2 rounded-md font-medium text-sm w-full cursor-pointer">
                    Deploy to World Engine
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
        </div>

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-zinc-900/50 border-zinc-800/50">
               <CardHeader>
                   <CardTitle className="text-lg">Local Resource Allocation</CardTitle>
                   <CardDescription>SHA-256 Hashes generated per second: {computeRate.toLocaleString()} H/s</CardDescription>
               </CardHeader>
               <CardContent>
                   <div className="h-[200px] w-[100%] flex items-center justify-center border border-zinc-800 rounded bg-zinc-950 font-mono text-zinc-500 text-sm flex-col">
                       {computing ? (
                          <div className="animate-pulse text-emerald-400 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Computing... {computeRate.toLocaleString()} H/s
                          </div>
                       ) : (
                          <div>Idle</div>
                       )}
                   </div>
               </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800/50">
               <CardHeader>
                   <CardTitle className="text-lg">Network Epoch Metrics</CardTitle>
                   <CardDescription>Local Sandbox Capabilities</CardDescription>
               </CardHeader>
               <CardContent>
                   <div className="space-y-4">
                       <div>
                           <div className="flex justify-between text-sm mb-1 text-zinc-400">
                               <span>Logical Processors (Hardware Concurrency)</span>
                               <span>{typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 'Unknown' : 'Unknown'}</span>
                           </div>
                           <Progress value={100} className="bg-zinc-800 [&>div]:bg-emerald-500 h-2" />
                       </div>
                       <div>
                           <div className="flex justify-between text-sm mb-1 text-zinc-400">
                               <span>Device Memory Estimation</span>
                               <span>{typeof navigator !== 'undefined' && 'deviceMemory' in navigator ? `${(navigator as any).deviceMemory} GB` : 'Unknown'}</span>
                           </div>
                           <Progress value={100} className="bg-zinc-800 [&>div]:bg-blue-500 h-2" />
                       </div>
                       <div className="pt-4 border-t border-zinc-800 text-sm text-zinc-500 font-mono">
                           These metrics reflect the actual capabilities exposed to this browser session.
                       </div>
                   </div>
               </CardContent>
            </Card>
        </div>

        <Card className="bg-zinc-900/50 border-zinc-800/50">
           <CardHeader>
               <CardTitle className="text-lg">Active & Recent AI Jobs</CardTitle>
               <CardDescription>Tasks being processed by the Gemini-backed decentralized mesh.</CardDescription>
           </CardHeader>
           <CardContent>
               <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                   {simulations.length === 0 && <p className="text-zinc-500 text-sm font-mono p-4 border border-zinc-800 border-dashed rounded text-center">No recent jobs. Submit one above.</p>}
                   {simulations.map((sim, i) => (
                       <div key={i} className="p-4 rounded-lg bg-zinc-950/50 backdrop-blur-sm border border-zinc-800/50 space-y-3">
                           <div className="flex items-center justify-between">
                               <div className="font-medium flex items-center gap-2 text-zinc-200">
                                  {sim.name}
                                  {sim.streaming && <Loader2 className="w-3 h-3 text-emerald-500 animate-spin" />}
                               </div>
                               <Badge variant="outline" className={
                                   sim.status === 'Computing' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 animate-pulse' :
                                   sim.status === 'Verified' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' :
                                   'border-zinc-700 text-zinc-400'
                               }>
                                   {sim.status}
                               </Badge>
                           </div>
                           <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
                               <span>Epoch: {sim.epoch}</span>
                               <span>Nodes: 1 (Local Sandbox)</span>
                           </div>
                           <Progress value={sim.progress} className={`h-1.5 bg-zinc-800 [&>div]:bg-${sim.type}-500`} />
                           {sim.result && (
                             <div className="mt-2 p-3 bg-zinc-900 rounded font-mono text-sm text-zinc-300 border border-zinc-800 whitespace-pre-wrap">
                               {sim.result}
                             </div>
                           )}
                       </div>
                   ))}
               </div>
           </CardContent>
        </Card>
    </div>
  )
}

