import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  Blocks,
  BookOpen,
  Briefcase,
  Code2,
  Fingerprint,
  Globe2,
  HardDrive,
  LayoutGrid,
  Menu,
  Minus,
  Monitor,
  Network as NetworkIcon,
  Radio,
  Search,
  Settings as SettingsIcon,
  Square,
  TerminalSquare,
  UserRound,
  X,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { NetworkProvider, useNetwork } from '@/lib/network';
import { formatHashrate, useSettings } from '@/lib/hooks';
import { AIAssistant } from './AIAssistant';
import { DashboardView } from '@/views/DashboardView';
import { MinerView } from '@/views/MinerView';
import { ZkpView } from '@/views/ZkpView';
import { SensorsView } from '@/views/SensorsView';
import { NetworkView } from '@/views/NetworkView';
import { ConsoleView } from '@/views/ConsoleView';
import { FilesView } from '@/views/FilesView';
import { CodeLabView } from '@/views/CodeLabView';
import { DiagnosticsView } from '@/views/DiagnosticsView';
import { SystemMonitorView } from '@/views/SystemMonitorView';
import { SettingsView } from '@/views/SettingsView';
import { OutreachView } from '@/views/OutreachView';
import { GuideView } from '@/views/GuideView';
import { PortfolioView } from '@/views/PortfolioView';
import { NetworkBackground } from '@/views/NetworkBackground';
import { cn } from '@/utils';

interface WindowState {
  id: string;
  title: string;
  icon: any;
  x: number;
  y: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
}

interface AppDefinition {
  id: string;
  label: string;
  description: string;
  icon: any;
  accent: string;
  render: () => React.ReactNode;
}

export default function App() {
  return (
    <NetworkProvider>
      <Desktop />
    </NetworkProvider>
  );
}

function Desktop() {
  const { t } = useTranslation();
  const { nodeId, miner, streamConnected, sensors, liveNodes, status } = useNetwork();
  const [settings, patchSettings] = useSettings();

  const [windows, setWindows] = useState<WindowState[]>([]);
  const [zTop, setZTop] = useState(10);
  const [startOpen, setStartOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [clock, setClock] = useState(new Date());
  const cascade = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const apps = useMemo<AppDefinition[]>(
    () => [
      { id: 'dashboard', label: t('Dashboard'), description: 'Live node, host and ledger overview', icon: Activity, accent: 'text-emerald-400', render: () => <DashboardView /> },
      { id: 'compute', label: t('Compute Engine'), description: 'Real proof-of-work mining, verified server-side', icon: Blocks, accent: 'text-emerald-400', render: () => <MinerView /> },
      { id: 'zkp', label: t('Zero-Knowledge Proofs'), description: 'Schnorr proofs verified by the server', icon: Fingerprint, accent: 'text-purple-400', render: () => <ZkpView /> },
      { id: 'sensors', label: t('Sensor Grid'), description: 'Live USGS seismic feed on a real map', icon: Globe2, accent: 'text-sky-400', render: () => <SensorsView /> },
      { id: 'network', label: t('Network'), description: 'Node registry, mesh peers and epicentres', icon: NetworkIcon, accent: 'text-emerald-400', render: () => <NetworkView /> },
      { id: 'console', label: t('Console'), description: 'Native read-only commands, no shell', icon: TerminalSquare, accent: 'text-emerald-400', render: () => <ConsoleView /> },
      { id: 'sysmon', label: t('System Monitor'), description: 'Kernel CPU, memory, disk and processes', icon: Monitor, accent: 'text-amber-400', render: () => <SystemMonitorView /> },
      { id: 'files', label: t('Files'), description: 'Real file browser over the node source', icon: HardDrive, accent: 'text-amber-400', render: () => <FilesView /> },
      { id: 'codelab', label: t('Code Lab'), description: 'JavaScript executed in an isolated worker', icon: Code2, accent: 'text-sky-400', render: () => <CodeLabView /> },
      { id: 'diagnostics', label: t('Net Diagnostics'), description: 'Real reachability and latency probes', icon: Radio, accent: 'text-sky-400', render: () => <DiagnosticsView /> },
      { id: 'outreach', label: t('Outreach'), description: 'AI drafts archived in the node database', icon: Briefcase, accent: 'text-emerald-400', render: () => <OutreachView settings={settings} /> },
      { id: 'guide', label: t('Guide'), description: 'What is real and what was removed', icon: BookOpen, accent: 'text-purple-400', render: () => <GuideView /> },
      { id: 'profile', label: t('Profile'), description: 'Creator identity and live node stats', icon: UserRound, accent: 'text-emerald-400', render: () => <PortfolioView settings={settings} /> },
      { id: 'settings', label: t('Settings'), description: 'Identity, language and AI provider', icon: SettingsIcon, accent: 'text-zinc-300', render: () => <SettingsView settings={settings} onChange={patchSettings} /> },
    ],
    [t, settings, patchSettings],
  );

  const openApp = useCallback(
    (app: AppDefinition) => {
      setStartOpen(false);
      setQuery('');

      setWindows((prev) => {
        const existing = prev.find((w) => w.id === app.id);
        const nextZ = zTop + 1;
        setZTop(nextZ);

        if (existing) {
          return prev.map((w) => (w.id === app.id ? { ...w, minimized: false, z: nextZ } : w));
        }

        const step = cascade.current++ % 6;
        return [
          ...prev,
          {
            id: app.id,
            title: app.label,
            icon: app.icon,
            x: 40 + step * 28,
            y: 24 + step * 24,
            z: nextZ,
            minimized: false,
            maximized: step === 0 && prev.length === 0,
          },
        ];
      });
    },
    [zTop],
  );

  // Open the dashboard once, on first load.
  useEffect(() => {
    if (windows.length === 0) {
      const dashboard = apps.find((app) => app.id === 'dashboard');
      if (dashboard) openApp(dashboard);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps.length]);

  const focusWindow = (id: string) => {
    const nextZ = zTop + 1;
    setZTop(nextZ);
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, z: nextZ, minimized: false } : w)));
  };

  const moveWindow = (id: string, x: number, y: number) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, x, y } : w)));
  };

  const patchWindow = (id: string, patch: Partial<WindowState>) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  };

  const closeWindow = (id: string) => setWindows((prev) => prev.filter((w) => w.id !== id));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStartOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return apps;
    return apps.filter((app) => `${app.label} ${app.description}`.toLowerCase().includes(needle));
  }, [apps, query]);

  return (
    <div className="h-screen w-screen overflow-hidden relative select-none bg-[#050505] text-zinc-100">
      <NetworkBackground />

      {/* Desktop icons */}
      <div className="absolute inset-0 z-10 p-5 pb-16 flex flex-col flex-wrap gap-4 items-start content-start overflow-y-auto custom-scrollbar">
        {apps.map((app) => (
          <button
            key={app.id}
            onDoubleClick={() => openApp(app)}
            onClick={() => openApp(app)}
            className="group w-[86px] flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <div className="w-11 h-11 rounded-lg bg-zinc-900/70 backdrop-blur border border-zinc-800 flex items-center justify-center group-hover:border-emerald-500/50 group-hover:bg-emerald-500/10 transition-all">
              <app.icon className={cn('w-5 h-5 text-zinc-400 group-hover:text-emerald-300', app.accent)} />
            </div>
            <span className="text-[10px] font-semibold text-zinc-400 group-hover:text-zinc-200 text-center leading-tight">{app.label}</span>
          </button>
        ))}
      </div>

      {/* Windows */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        {windows.map((win) => {
          const app = apps.find((candidate) => candidate.id === win.id);
          if (!app) return null;
          return (
            <AppWindow
              key={win.id}
              state={win}
              onFocus={() => focusWindow(win.id)}
              onClose={() => closeWindow(win.id)}
              onMinimize={() => patchWindow(win.id, { minimized: true })}
              onMaximize={() => patchWindow(win.id, { maximized: !win.maximized })}
              onMove={(x, y) => moveWindow(win.id, x, y)}
            >
              {app.render()}
            </AppWindow>
          );
        })}
      </div>

      {/* Taskbar */}
      <div className="absolute bottom-0 inset-x-0 h-12 z-[300] bg-zinc-950/85 backdrop-blur-md border-t border-zinc-800/70 flex items-center justify-between px-2 gap-2">
        <div className="flex items-center gap-1 h-full min-w-0 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setStartOpen((open) => !open)}
            className={cn('p-2 rounded-md hover:bg-zinc-800 transition-colors', startOpen && 'bg-zinc-800')}
            aria-label="Open the application menu"
          >
            <div className="w-7 h-7 rounded bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
              <LayoutGrid className="w-4 h-4 text-emerald-400" />
            </div>
          </button>

          <div className="h-6 w-px bg-zinc-800 mx-1 shrink-0" />

          {windows.map((win) => (
            <button
              key={win.id}
              onClick={() => (win.minimized ? focusWindow(win.id) : patchWindow(win.id, { minimized: true }))}
              className={cn(
                'h-9 px-3 flex items-center gap-2 rounded-md transition-all border-b-2 shrink-0',
                win.minimized ? 'border-transparent text-zinc-500' : 'border-emerald-500 bg-zinc-800/60 text-zinc-100',
              )}
            >
              <win.icon className="w-3.5 h-3.5" />
              <span className="text-xs font-medium hidden sm:block max-w-[120px] truncate">{win.title}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 px-2 shrink-0">
          <Indicator label={streamConnected ? 'stream live' : 'stream down'} ok={streamConnected} />
          <Indicator label={`${liveNodes} node(s)`} ok={liveNodes > 0} />
          <Indicator label={`${sensors.features.length} eq`} ok={sensors.features.length > 0 || Boolean(sensors.error)} warn={Boolean(sensors.error)} />
          <div className="hidden md:flex items-center gap-1.5 text-zinc-400 text-[11px] font-mono">
            <Zap className={cn('w-3.5 h-3.5', miner.running ? 'text-emerald-400' : 'text-zinc-600')} />
            {formatHashrate(miner.running ? miner.hashrate : 0)}
          </div>
          <div className="hidden lg:flex items-center gap-1.5 text-zinc-500 text-[11px] font-mono">
            <span className="text-emerald-500/70">{nodeId ? nodeId.slice(0, 8) : '—'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-300 text-[11px] font-mono">
            {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Start menu */}
      {startOpen && (
        <>
          <div className="fixed inset-0 z-[290]" onClick={() => setStartOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-14 left-2 w-[340px] z-[300] rounded-xl border border-zinc-800/70 bg-[#0a0a0c]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden"
          >
            <div className="p-4 border-b border-zinc-800/60 bg-gradient-to-br from-zinc-900 to-black flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <UserRound className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-zinc-100 truncate">{settings.userName}</div>
                <div className="text-[10px] text-emerald-500/70 font-mono uppercase tracking-widest truncate">{settings.jobTitle}</div>
              </div>
            </div>

            <div className="p-3 border-b border-zinc-800/40">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search applications…"
                  autoFocus
                  className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg py-2 pl-9 pr-3 text-xs text-zinc-200 outline-none focus:border-emerald-500/40"
                />
              </div>
            </div>

            <div className="p-2 max-h-[320px] overflow-y-auto custom-scrollbar">
              {filtered.length === 0 && <div className="p-4 text-center text-xs text-zinc-600">No application matches “{query}”.</div>}
              {filtered.map((app) => (
                <button
                  key={app.id}
                  onClick={() => openApp(app)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-emerald-500/5 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                    <app.icon className={cn('w-4 h-4', app.accent)} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-zinc-300">{app.label}</div>
                    <div className="text-[10px] text-zinc-600 truncate">{app.description}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-3 bg-black/40 border-t border-zinc-800/60 flex items-center justify-between">
              <span className="text-[9px] font-mono text-zinc-600 tracking-tight">
                GAIA NODE v{status?.version ?? '1.0.0'} · {status?.host.platform ?? '—'}/{status?.host.arch ?? '—'}
              </span>
              <button
                onClick={() => {
                  setWindows([]);
                  setStartOpen(false);
                }}
                className="text-[10px] text-zinc-500 hover:text-rose-400 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Close all
              </button>
            </div>
          </motion.div>
        </>
      )}

      <AIAssistant settings={settings} />

      {/* Mobile hint: the menu button doubles as navigation on small screens */}
      <button
        onClick={() => setStartOpen(true)}
        className="md:hidden fixed bottom-14 right-4 z-[300] p-3 rounded-full bg-zinc-900 border border-zinc-800 text-emerald-400"
        aria-label="Open the application menu"
      >
        <Menu className="w-5 h-5" />
      </button>
    </div>
  );
}

function Indicator({ label, ok, warn }: { label: string; ok: boolean; warn?: boolean }) {
  return (
    <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
      <span className={cn('w-1.5 h-1.5 rounded-full', warn ? 'bg-amber-400' : ok ? 'bg-emerald-400' : 'bg-rose-500')} />
      {label}
    </div>
  );
}

function AppWindow({
  state,
  children,
  onFocus,
  onClose,
  onMinimize,
  onMaximize,
  onMove,
}: {
  state: WindowState;
  children: React.ReactNode;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onMove: (x: number, y: number) => void;
}) {
  if (state.minimized) return null;

  const width = state.maximized ? 'calc(100vw - 16px)' : 'min(1080px, calc(100vw - 24px))';
  const height = state.maximized ? 'calc(100vh - 64px)' : 'min(720px, calc(100vh - 90px))';

  return (
    <motion.div
      drag={!state.maximized}
      dragMomentum={false}
      dragElastic={0}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1, x: state.maximized ? 0 : state.x, y: state.maximized ? 0 : state.y }}
      onDragEnd={(_event, info) => onMove(state.x + info.offset.x, state.y + info.offset.y)}
      onPointerDown={onFocus}
      className={cn(
        'absolute left-0 top-0 pointer-events-auto flex flex-col rounded-xl border border-zinc-800 bg-[#0a0a0c] shadow-[0_24px_60px_rgba(0,0,0,0.6)] overflow-hidden',
        state.maximized ? 'left-2 top-2' : '',
      )}
      style={{ zIndex: state.z, width, height }}
    >
      <header
        onDoubleClick={onMaximize}
        className="h-10 shrink-0 flex items-center justify-between px-3 bg-zinc-900/80 border-b border-zinc-800 cursor-move"
      >
        <div className="flex items-center gap-2 min-w-0">
          <state.icon className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 truncate">{state.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onMinimize} className="p-1.5 rounded hover:bg-zinc-800 transition-colors" aria-label="Minimise">
            <Minus className="w-3.5 h-3.5 text-zinc-500" />
          </button>
          <button onClick={onMaximize} className="p-1.5 rounded hover:bg-zinc-800 transition-colors" aria-label="Maximise">
            <Square className="w-3.5 h-3.5 text-zinc-500" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-rose-500/20 transition-colors group" aria-label="Close">
            <X className="w-3.5 h-3.5 text-zinc-500 group-hover:text-rose-400" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5">{children}</div>
    </motion.div>
  );
}
