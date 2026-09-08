/**
 * lib/hooks.ts — the real plumbing shared by the views.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GaiaEvent } from './api';

/* ------------------------------------------------------------------ */
/* Node identity                                                       */
/* ------------------------------------------------------------------ */

const NODE_KEY = 'gaia_node_id';

/** A stable per-browser node id, generated with the platform CSPRNG. */
export function useNodeId(): string {
  const [id, setId] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem(NODE_KEY);
    if (stored) {
      setId(stored);
      return;
    }
    const webCrypto = globalThis.crypto;
    const fresh = webCrypto?.randomUUID
      ? webCrypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(NODE_KEY, fresh);
    setId(fresh);
  }, []);

  return id;
}

/* ------------------------------------------------------------------ */
/* Server-sent events                                                  */
/* ------------------------------------------------------------------ */

export function useEventStream(onEvent: (event: GaiaEvent) => void, enabled = true) {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    let source: EventSource | null = null;
    let retry: number | undefined;

    const connect = () => {
      source = new EventSource('/api/stream');
      source.onopen = () => setConnected(true);
      source.onmessage = (message) => {
        try {
          handler.current(JSON.parse(message.data));
        } catch {
          /* ignore malformed frames */
        }
      };
      source.onerror = () => {
        setConnected(false);
        source?.close();
        retry = window.setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      if (retry) window.clearTimeout(retry);
      source?.close();
      setConnected(false);
    };
  }, [enabled]);

  return connected;
}

/* ------------------------------------------------------------------ */
/* Polling                                                             */
/* ------------------------------------------------------------------ */

export interface PollState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  lastUpdated: string | null;
  refresh: () => void;
}

export function usePoll<T>(fetcher: () => Promise<T>, intervalMs: number, enabled = true): PollState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const fn = useRef(fetcher);
  fn.current = fetcher;

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fn.current();
      setData(result);
      setError(null);
      setLastUpdated(new Date().toISOString());
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    run();
    const timer = window.setInterval(run, intervalMs);
    return () => window.clearInterval(timer);
  }, [run, intervalMs, enabled]);

  return { data, error, loading, lastUpdated, refresh: run };
}

/* ------------------------------------------------------------------ */
/* Settings (persisted locally, including an optional Gemini key)      */
/* ------------------------------------------------------------------ */

export interface Settings {
  userName: string;
  jobTitle: string;
  userPhone1: string;
  userPhone2: string;
  language: string;
  geminiKey: string;
  telemetryConsent: boolean;
}

const SETTINGS_KEY = 'gaia_settings_v2';

export const defaultSettings: Settings = {
  userName: 'George Meya',
  jobTitle: 'Founder & Architect, Gaia Protocol',
  userPhone1: '+265 991593725',
  userPhone2: '+265 883991420',
  language: 'en-US',
  geminiKey: '',
  telemetryConsent: true,
};

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const patch = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  return [settings, patch];
}

/* ------------------------------------------------------------------ */
/* Browser-to-browser mesh over BroadcastChannel                       */
/* ------------------------------------------------------------------ */

/**
 * Real peer discovery between Gaia tabs/windows on the same machine. This is
 * genuine message passing (not decoration); the UI describes it as a local
 * mesh because that is exactly what it is.
 */
export function useMeshPeers(nodeId: string) {
  const [peers, setPeers] = useState<{ id: string; lastSeen: number }[]>([]);

  useEffect(() => {
    if (!nodeId) return;
    const channel = new BroadcastChannel('gaia-mesh-v2');

    const announce = () => channel.postMessage({ type: 'hello', sender: nodeId, at: Date.now() });

    channel.onmessage = (event) => {
      const { type, sender, target } = event.data ?? {};
      if (!sender || sender === nodeId) return;

      if (type === 'hello') {
        setPeers((prev) => [...prev.filter((p) => p.id !== sender), { id: sender, lastSeen: Date.now() }]);
        channel.postMessage({ type: 'hello-ack', sender: nodeId, target: sender, at: Date.now() });
      } else if (type === 'hello-ack' && target === nodeId) {
        setPeers((prev) => [...prev.filter((p) => p.id !== sender), { id: sender, lastSeen: Date.now() }]);
      } else if (type === 'bye') {
        setPeers((prev) => prev.filter((p) => p.id !== sender));
      }
    };

    announce();
    const hello = window.setInterval(announce, 5000);
    const expiry = window.setInterval(() => {
      const cutoff = Date.now() - 15_000;
      setPeers((prev) => prev.filter((p) => p.lastSeen >= cutoff));
    }, 5000);

    const bye = () => channel.postMessage({ type: 'bye', sender: nodeId });
    window.addEventListener('beforeunload', bye);

    return () => {
      window.clearInterval(hello);
      window.clearInterval(expiry);
      window.removeEventListener('beforeunload', bye);
      bye();
      channel.close();
    };
  }, [nodeId]);

  return peers;
}

/* ------------------------------------------------------------------ */
/* Heartbeat to the server registry                                    */
/* ------------------------------------------------------------------ */

export function useNodeHeartbeat(nodeId: string, reportedHashrate: number, enabled = true) {
  const [error, setError] = useState<string | null>(null);
  const [liveNodes, setLiveNodes] = useState(0);
  const rate = useRef(reportedHashrate);
  rate.current = reportedHashrate;

  useEffect(() => {
    if (!nodeId || !enabled) return;
    let cancelled = false;

    const beat = async () => {
      try {
        const response = await fetch('/api/nodes/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeId, reportedHashrate: rate.current }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error ?? `${response.status}`);
        if (!cancelled) {
          setLiveNodes(payload.liveNodes ?? 0);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? String(err));
      }
    };

    beat();
    const timer = window.setInterval(beat, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [nodeId, enabled]);

  return { error, liveNodes };
}

/* ------------------------------------------------------------------ */
/* Misc formatting                                                     */
/* ------------------------------------------------------------------ */

export function formatHashrate(hashesPerSecond: number): string {
  if (!Number.isFinite(hashesPerSecond) || hashesPerSecond <= 0) return '0 H/s';
  const units = ['H/s', 'KH/s', 'MH/s', 'GH/s'];
  let value = hashesPerSecond;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unit]}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

export function relativeTime(iso: string | number): string {
  const then = typeof iso === 'number' ? iso : Date.parse(iso);
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
