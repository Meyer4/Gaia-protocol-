/**
 * lib/api.ts — typed client for the real backend.
 *
 * Every function here hits a real endpoint. Errors are thrown with the
 * server's own message so the UI can show what actually happened instead of
 * papering over it.
 */

export interface HostSnapshot {
  hostname: string;
  platform: string;
  arch: string;
  release: string;
  nodeVersion: string;
  cpuModel: string;
  cpuCores: number;
  loadAverage: [number, number, number];
  cpuPercent: number | null;
  perCorePercent: number[];
  totalMemoryGB: number;
  freeMemoryGB: number;
  usedMemoryGB: number;
  memoryUsedPercent: number;
  hostUptimeSeconds: number;
  processUptimeSeconds: number;
  disk: { path: string; totalGB: number; freeGB: number; availableGB: number; usedGB: number; usedPercent: number } | null;
  network: { name: string; addresses: { address: string; family: string; internal: boolean }[]; rxBytes: number | null; txBytes: number | null }[];
  throughput: { rxKBs: number; txKBs: number; windowMs: number } | null;
  user: string;
  pid: number;
  cwd: string;
}

export interface LiveNode {
  id: string;
  firstSeen: string;
  lastSeen: number;
  reportedHashrate: number;
  blocksAccepted: number;
  userAgent: string;
  remoteAddress: string;
}

export interface StatusResponse {
  generatedAt: string;
  version: string;
  serverUptimeSeconds: number;
  host: HostSnapshot;
  network: { liveNodes: number; nodes: LiveNode[]; aggregateHashrate: number; sseClients: number; requestsServed: number };
  ledger: { blocks: number; attempts: number; maxDifficulty: number; contributors: number; merkleRoot: string };
  zkp: { total: number; valid: number; rejected: number };
  database: { path: string; engine: string };
}

export interface GaiaEvent {
  at: string;
  type: string;
  severity: 'info' | 'success' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

export interface ConfigResponse {
  version: string;
  ai: { configured: boolean; provider: string; model: string | null; candidates: string[]; note: string };
  crypto: { hash: string; pow: string; zkp: string };
  browseRoots: string[];
  consoleCommands: { name: string; summary: string; usage: string }[];
  pitchTargets: string[];
  sensorFeed: { source: string; proxiedBy: string; cacheSeconds: number };
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  readable: boolean;
}

export interface DirectoryListing {
  root: string;
  path: string;
  parent: string | null;
  entries: FileEntry[];
}

export interface FilePreview {
  path: string;
  size: number;
  truncated: boolean;
  content: string;
  modified: string;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  state: string;
  rssMB: number | null;
  cpuPercent: number | null;
  perCorePercent: number[];
}

export interface VerifiedBlock {
  id: number;
  header: string;
  nonce: number;
  difficulty: number;
  hash: string;
  leading_zeros: number;
  node_id: string;
  attempts: number;
  elapsed_ms: number;
  hashrate: number;
  verified_at: string;
}

export interface LedgerResponse {
  stats: { blocks: number; attempts: number; max_difficulty: number; contributors: number };
  blocks: VerifiedBlock[];
  merkleRoot: string;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { error: text.slice(0, 500) };
  }

  if (!response.ok) {
    throw new Error(payload?.error ?? `${response.status} ${response.statusText}`);
  }
  return payload as T;
}

export const api = {
  health: () => call<{ status: string; version: string; uptimeSeconds: number }>('/api/health'),
  config: () => call<ConfigResponse>('/api/config'),
  status: () => call<StatusResponse>('/api/status'),
  nodes: () => call<{ live: LiveNode[]; count: number; aggregateHashrate: number }>('/api/nodes'),
  heartbeat: (nodeId: string, reportedHashrate: number) =>
    call<{ ok: boolean; node: LiveNode; liveNodes: number }>('/api/nodes/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ nodeId, reportedHashrate }),
    }),
  submitWork: (body: {
    header: string;
    nonce: number;
    hash: string;
    difficulty: number;
    nodeId: string;
    attempts: number;
    elapsedMs: number;
    hashrate: number;
  }) =>
    call<{ accepted: boolean; verdict: any; blockNumber?: number; merkleRoot?: string }>('/api/work/submit', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  ledger: (limit = 25) => call<LedgerResponse>(`/api/ledger?limit=${limit}`),
  verifyZkp: (proof: unknown) =>
    call<{ verification: any }>('/api/zkp/verify', { method: 'POST', body: JSON.stringify({ proof }) }),
  zkpLog: (limit = 20) => call<{ stats: { total: number; valid: number }; entries: any[] }>(`/api/zkp/log?limit=${limit}`),
  exec: (command: string, nodeId?: string) =>
    call<{ output: string; error: boolean; command: string; durationMs: number }>('/api/console/exec', {
      method: 'POST',
      body: JSON.stringify({ command, nodeId }),
    }),
  listDir: (p: string) => call<DirectoryListing>(`/api/fs?path=${encodeURIComponent(p)}`),
  readFile: (p: string) => call<FilePreview>(`/api/fs/read?path=${encodeURIComponent(p)}`),
  processes: (limit = 20) => call<{ processes: ProcessInfo[]; available: boolean }>(`/api/system/processes?limit=${limit}`),
  earthquakesProxied: () => call<any>('/api/sensors/earthquakes'),
  chat: (body: { message: string; language: string; history: { role: string; text: string }[]; apiKey?: string }) =>
    call<{ text: string; model: string }>('/api/ai/chat', { method: 'POST', body: JSON.stringify(body) }),
  pitch: (body: { target: string; settings: Record<string, string>; apiKey?: string }) =>
    call<{ text: string; model: string; target: string }>('/api/ai/pitch', { method: 'POST', body: JSON.stringify(body) }),
  pitches: () => call<{ success: boolean; pitches: any[] }>('/api/pitches'),
};

/**
 * Real seismic data with an honest fallback chain: try the server proxy first
 * (it caches for 60 s), then the USGS feed directly from the browser. If both
 * fail the caller gets the real error — never placeholder earthquakes.
 */
export async function fetchEarthquakes(): Promise<{ features: any[]; source: 'proxy' | 'direct'; fetchedAt: string }> {
  const USGS = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';

  try {
    const proxied = await api.earthquakesProxied();
    if (Array.isArray(proxied.features)) {
      return { features: proxied.features, source: 'proxy', fetchedAt: new Date().toISOString() };
    }
    throw new Error('proxy returned no features');
  } catch (proxyError: any) {
    const response = await fetch(USGS, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`USGS feed returned ${response.status}; server proxy said: ${proxyError.message}`);
    }
    const direct = await response.json();
    return { features: direct.features ?? [], source: 'direct', fetchedAt: new Date().toISOString() };
  }
}
