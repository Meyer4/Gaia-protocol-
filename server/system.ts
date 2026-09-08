/**
 * server/system.ts
 *
 * Real host telemetry. Every number here is read from the operating system at
 * request time — nothing is generated, estimated or randomly varied.
 */
import os from 'node:os';
import { statfs, readFile, readdir } from 'node:fs/promises';

export interface CpuSample {
  user: number;
  nice: number;
  sys: number;
  idle: number;
  irq: number;
}

function snapshotCpus(): CpuSample[] {
  return os.cpus().map((c) => ({ ...c.times }));
}

/** Real CPU utilisation measured from the delta between two /proc/stat reads. */
export async function measureCpuUsage(windowMs = 500): Promise<{ percent: number; perCore: number[] }> {
  const before = snapshotCpus();
  await new Promise((resolve) => setTimeout(resolve, windowMs));
  const after = snapshotCpus();

  const perCore: number[] = [];
  let totalBusy = 0;
  let totalAll = 0;

  for (let i = 0; i < after.length; i++) {
    const b = before[i] ?? { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 };
    const a = after[i];
    const busy = a.user - b.user + (a.nice - b.nice) + (a.sys - b.sys) + (a.irq - b.irq);
    const all = busy + (a.idle - b.idle);
    const pct = all > 0 ? (busy / all) * 100 : 0;
    perCore.push(Math.round(pct * 100) / 100);
    totalBusy += busy;
    totalAll += all;
  }

  return {
    percent: totalAll > 0 ? Math.round((totalBusy / totalAll) * 10000) / 100 : 0,
    perCore,
  };
}

export interface DiskUsage {
  path: string;
  totalGB: number;
  freeGB: number;
  availableGB: number;
  usedGB: number;
  usedPercent: number;
}

export async function measureDisk(target = process.cwd()): Promise<DiskUsage> {
  const stats = await statfs(target);
  const blockSize = stats.bsize as number;
  const total = (stats.blocks as number) * blockSize;
  const free = (stats.bfree as number) * blockSize;
  const available = (stats.bavail as number) * blockSize;
  const used = total - free;
  return {
    path: target,
    totalGB: round(total / 1024 ** 3),
    freeGB: round(free / 1024 ** 3),
    availableGB: round(available / 1024 ** 3),
    usedGB: round(used / 1024 ** 3),
    usedPercent: total > 0 ? Math.round((used / total) * 10000) / 100 : 0,
  };
}

export interface NetworkInterfaceSnapshot {
  name: string;
  addresses: { address: string; family: string; internal: boolean }[];
  rxBytes: number | null;
  txBytes: number | null;
}

/** Real interfaces plus real kernel byte counters from /sys/class/net. */
export async function measureNetworkInterfaces(): Promise<NetworkInterfaceSnapshot[]> {
  const interfaces = os.networkInterfaces();
  const out: NetworkInterfaceSnapshot[] = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    let rxBytes: number | null = null;
    let txBytes: number | null = null;
    try {
      const [rx, tx] = await Promise.all([
        readFile(`/sys/class/net/${name}/statistics/rx_bytes`, 'utf8'),
        readFile(`/sys/class/net/${name}/statistics/tx_bytes`, 'utf8'),
      ]);
      rxBytes = parseInt(rx.trim(), 10);
      txBytes = parseInt(tx.trim(), 10);
    } catch {
      // non-Linux platform: counters unavailable, reported as null (not faked)
    }
    out.push({
      name,
      addresses: (addrs ?? []).map((a) => ({ address: a.address, family: a.family, internal: a.internal })),
      rxBytes: Number.isFinite(rxBytes as number) ? rxBytes : null,
      txBytes: Number.isFinite(txBytes as number) ? txBytes : null,
    });
  }
  return out;
}

let previousNet: { at: number; rx: number; tx: number } | null = null;

/** Real throughput, derived from the delta of the kernel byte counters. */
export async function measureNetworkThroughput(): Promise<{ rxKBs: number; txKBs: number; windowMs: number } | null> {
  const ifaces = await measureNetworkInterfaces();
  let rx = 0;
  let tx = 0;
  for (const i of ifaces) {
    if (i.name === 'lo') continue;
    rx += i.rxBytes ?? 0;
    tx += i.txBytes ?? 0;
  }
  const now = Date.now();
  if (!previousNet || rx === 0) {
    previousNet = { at: now, rx, tx };
    return null;
  }
  const windowMs = Math.max(1, now - previousNet.at);
  const result = {
    rxKBs: Math.round(((rx - previousNet.rx) / 1024 / windowMs) * 1000 * 100) / 100,
    txKBs: Math.round(((tx - previousNet.tx) / 1024 / windowMs) * 1000 * 100) / 100,
    windowMs,
  };
  previousNet = { at: now, rx, tx };
  return result;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  state: string;
  rssMB: number | null;
  cpuPercent: number | null;
}

/** Real process table read from /proc — no shell, no `ps` binary. */
export async function readProcessTable(limit = 25): Promise<ProcessInfo[]> {
  let entries: string[];
  try {
    entries = await readdir('/proc');
  } catch {
    return [];
  }

  const hertz = 100; // USER_HZ on Linux; only used for the utime/stime share
  const processes: ProcessInfo[] = [];

  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = parseInt(entry, 10);
    try {
      const [stat, status, cmdline] = await Promise.all([
        readFile(`/proc/${pid}/stat`, 'utf8'),
        readFile(`/proc/${pid}/status`, 'utf8').catch(() => ''),
        readFile(`/proc/${pid}/cmdline`, 'utf8').catch(() => ''),
      ]);

      const closeParen = stat.lastIndexOf(')');
      const comm = stat.slice(stat.indexOf('(') + 1, closeParen);
      const fields = stat.slice(closeParen + 2).split(' ');
      const state = fields[0];
      const utime = parseInt(fields[11] ?? '0', 10);
      const stime = parseInt(fields[12] ?? '0', 10);

      const rssPages = parseInt(status.match(/VmRSS:\s+(\d+) kB/)?.[1] ?? '0', 10) || 0;
      const rssMB = rssPages > 0 ? Math.round((rssPages / 1024) * 100) / 100 : null;

      const uptimeSeconds = os.uptime();
      const cpuPercent =
        uptimeSeconds > 0 ? Math.round((((utime + stime) / hertz / uptimeSeconds) * 100) * 100) / 100 : null;

      processes.push({
        pid,
        name: cmdline.replace(/\0/g, ' ').trim().slice(0, 120) || comm,
        state,
        rssMB,
        cpuPercent,
      });
    } catch {
      // process vanished between readdir and read — skip it
    }
  }

  return processes
    .sort((a, b) => (b.rssMB ?? 0) - (a.rssMB ?? 0))
    .slice(0, limit);
}

export interface HostSnapshot {
  hostname: string;
  platform: NodeJS.Platform;
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
  disk: DiskUsage | null;
  network: NetworkInterfaceSnapshot[];
  throughput: { rxKBs: number; txKBs: number; windowMs: number } | null;
  user: string;
  pid: number;
  cwd: string;
}

/** One real snapshot of the machine the node is running on. */
export async function hostSnapshot(options: { cpu?: boolean } = {}): Promise<HostSnapshot> {
  const total = os.totalmem();
  const free = os.freemem();
  const [disk, network, throughput, cpu] = await Promise.all([
    measureDisk().catch(() => null),
    measureNetworkInterfaces(),
    measureNetworkThroughput(),
    options.cpu === false ? Promise.resolve(null) : measureCpuUsage().catch(() => null),
  ]);

  return {
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    release: os.release(),
    nodeVersion: process.version,
    cpuModel: os.cpus()[0]?.model?.trim() ?? 'unknown',
    cpuCores: os.cpus().length,
    loadAverage: os.loadavg().map((n) => Math.round(n * 100) / 100) as [number, number, number],
    cpuPercent: cpu?.percent ?? null,
    perCorePercent: cpu?.perCore ?? [],
    totalMemoryGB: round(total / 1024 ** 3),
    freeMemoryGB: round(free / 1024 ** 3),
    usedMemoryGB: round((total - free) / 1024 ** 3),
    memoryUsedPercent: Math.round(((total - free) / total) * 10000) / 100,
    hostUptimeSeconds: Math.round(os.uptime()),
    processUptimeSeconds: Math.round(process.uptime()),
    disk,
    network,
    throughput,
    user: os.userInfo().username,
    pid: process.pid,
    cwd: process.cwd(),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Formats seconds as "3d 4h 12m" — used by the console. */
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}
