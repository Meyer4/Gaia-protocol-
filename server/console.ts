/**
 * server/console.ts
 *
 * The "terminal" in the UI is a real console, but it is not a shell. Each
 * command is implemented directly against the OS, the database and the node
 * registry, so there is nothing to inject into: no `exec`, no argument
 * interpolation into a command line, no way to reach a binary.
 */
import os from 'node:os';
import { hostSnapshot, readProcessTable, formatUptime, measureDisk, measureNetworkInterfaces } from './system.ts';
import { listDirectory, readFilePreview, BROWSE_ROOTS, FileBrowserError } from './files.ts';
import { queries, DB_INFO } from './db.ts';
import { liveNodes, aggregateHashrate, nodeCount, bus } from './events.ts';
import { merkleRoot } from '../shared/crypto.ts';

export interface ConsoleResult {
  output: string;
  error: boolean;
  command: string;
  durationMs: number;
}

interface CommandContext {
  nodeId?: string;
}

type Handler = (args: string[], ctx: CommandContext) => Promise<string>;

export const CONSOLE_COMMANDS: Record<string, { summary: string; usage: string; run: Handler }> = {
  help: {
    summary: 'List the available commands',
    usage: 'help',
    run: async () =>
      [
        'Gaia node console — read-only, executed natively (no shell).',
        '',
        ...Object.entries(CONSOLE_COMMANDS).map(
          ([name, def]) => `${name.padEnd(10)} ${def.summary.padEnd(46)} ${def.usage}`,
        ),
      ].join('\n'),
  },

  whoami: {
    summary: 'User the node process runs as',
    usage: 'whoami',
    run: async () => {
      const info = os.userInfo();
      return `${info.username} (uid=${process.getuid?.() ?? 'n/a'} gid=${process.getgid?.() ?? 'n/a'})`;
    },
  },

  hostname: {
    summary: 'Node hostname',
    usage: 'hostname',
    run: async () => os.hostname(),
  },

  uname: {
    summary: 'Kernel, platform and architecture',
    usage: 'uname',
    run: async () =>
      `${os.type()} ${os.hostname()} ${os.release()} ${os.version()} ${process.arch} node ${process.version}`,
  },

  uptime: {
    summary: 'Host and process uptime with real load averages',
    usage: 'uptime',
    run: async () => {
      const [a, b, c] = os.loadavg();
      return [
        `host up ${formatUptime(os.uptime())}`,
        `process up ${formatUptime(process.uptime())} (pid ${process.pid})`,
        `load average: ${a.toFixed(2)}, ${b.toFixed(2)}, ${c.toFixed(2)}`,
      ].join('\n');
    },
  },

  date: {
    summary: 'Current server time',
    usage: 'date',
    run: async () => new Date().toUTCString(),
  },

  free: {
    summary: 'Real memory usage of the host',
    usage: 'free',
    run: async () => {
      const total = os.totalmem();
      const free = os.freemem();
      const used = total - free;
      const mb = (n: number) => Math.round(n / 1024 / 1024);
      return [
        '                 total        used        free',
        `Mem:      ${String(mb(total)).padStart(9)}  ${String(mb(used)).padStart(9)}  ${String(mb(free)).padStart(9)}`,
        `(values in MiB, read from the kernel at ${new Date().toISOString()})`,
      ].join('\n');
    },
  },

  df: {
    summary: 'Real disk usage of the data volume',
    usage: 'df',
    run: async () => {
      const disk = await measureDisk();
      return [
        `Filesystem mounted at ${disk.path}`,
        `total ${disk.totalGB} GB   used ${disk.usedGB} GB (${disk.usedPercent}%)   available ${disk.availableGB} GB`,
      ].join('\n');
    },
  },

  ps: {
    summary: 'Process table read from /proc',
    usage: 'ps [limit]',
    run: async (args) => {
      const limit = Math.min(60, Math.max(1, parseInt(args[0] ?? '20', 10) || 20));
      const rows = await readProcessTable(limit);
      if (rows.length === 0) return 'No /proc on this platform — process table unavailable (not simulated).';
      return [
        'PID      RSS(MB)  CPU%  S  COMMAND',
        ...rows.map((p) =>
          [
            String(p.pid).padEnd(8),
            String(p.rssMB ?? '-').padEnd(8),
            String(p.cpuPercent ?? '-').padEnd(5),
            p.state.padEnd(2),
            p.name.slice(0, 90),
          ].join(' '),
        ),
      ].join('\n');
    },
  },

  ifconfig: {
    summary: 'Real network interfaces and kernel byte counters',
    usage: 'ifconfig',
    run: async () => {
      const ifaces = await measureNetworkInterfaces();
      return ifaces
        .map((i) =>
          [
            `${i.name}:`,
            ...i.addresses.map((a) => `    inet${a.family === 'IPv6' ? '6' : ''} ${a.address}${a.internal ? ' (internal)' : ''}`),
            `    rx_bytes ${i.rxBytes ?? 'n/a'}   tx_bytes ${i.txBytes ?? 'n/a'}`,
          ].join('\n'),
        )
        .join('\n');
    },
  },

  ls: {
    summary: 'List a directory inside the browsable roots',
    usage: 'ls [path]',
    run: async (args) => {
      const listing = await listDirectory(args[0] ?? '.');
      if (listing.entries.length === 0) return `(empty directory: ${listing.path})`;
      return listing.entries
        .map((e) => `${e.isDirectory ? 'd' : '-'}  ${String(e.size).padStart(9)}  ${e.modified.slice(0, 19).replace('T', ' ')}  ${e.name}`)
        .join('\n');
    },
  },

  cat: {
    summary: 'Read a text file inside the browsable roots',
    usage: 'cat <path>',
    run: async (args) => {
      if (!args[0]) throw new FileBrowserError('usage: cat <path>');
      const file = await readFilePreview(args[0]);
      return file.truncated ? `${file.content}\n… truncated (${file.size} bytes total)` : file.content;
    },
  },

  nodes: {
    summary: 'Live nodes currently heartbeating',
    usage: 'nodes',
    run: async () => {
      const list = liveNodes();
      if (list.length === 0) return 'No nodes are heartbeating right now.';
      return [
        'NODE        HASHRATE      BLOCKS  LAST SEEN           USER AGENT',
        ...list.map((n) =>
          [
            n.id.padEnd(11),
            `${n.reportedHashrate.toLocaleString()} H/s`.padEnd(13),
            String(n.blocksAccepted).padEnd(7),
            new Date(n.lastSeen).toISOString().slice(11, 19).padEnd(19),
            n.userAgent.slice(0, 60),
          ].join(' '),
        ),
        '',
        `aggregate reported hashrate: ${aggregateHashrate().toLocaleString()} H/s across ${list.length} node(s)`,
      ].join('\n');
    },
  },

  ledger: {
    summary: 'Verified proof-of-work ledger and its Merkle root',
    usage: 'ledger [limit]',
    run: async (args) => {
      const limit = Math.min(50, Math.max(1, parseInt(args[0] ?? '10', 10) || 10));
      const stats = queries.ledgerStats.get() as Record<string, number>;
      const rows = queries.recentWork.all(limit) as Record<string, any>[];
      const hashes = (queries.allWorkHashes.all() as { hash: string }[]).map((r) => r.hash);
      const root = merkleRoot(hashes);

      return [
        `blocks verified: ${stats.blocks}   total hashes ground: ${stats.attempts}   contributors: ${stats.contributors}`,
        `merkle root:     ${root}`,
        '',
        ...rows.map(
          (r) =>
            `#${String(r.id).padStart(4)}  diff ${String(r.difficulty).padStart(2)}  ${r.hash.slice(0, 24)}…  node ${r.node_id}  ${r.verified_at.slice(11, 19)}`,
        ),
      ].join('\n');
    },
  },

  proofs: {
    summary: 'Zero-knowledge proof verification log',
    usage: 'proofs [limit]',
    run: async (args) => {
      const limit = Math.min(50, Math.max(1, parseInt(args[0] ?? '10', 10) || 10));
      const stats = queries.zkpStats.get() as Record<string, number>;
      const rows = queries.recentZkp.all(limit) as Record<string, any>[];
      return [
        `verifications: ${stats.total}   valid: ${stats.valid}   rejected: ${stats.total - stats.valid}`,
        '',
        ...rows.map(
          (r) =>
            `#${String(r.id).padStart(4)}  ${r.valid ? 'VALID  ' : 'INVALID'}  label=${r.label}  y=${String(r.y).slice(0, 16)}…  ${r.elapsed_ms}ms  ${r.reason ?? ''}`,
        ),
      ].join('\n');
    },
  },

  events: {
    summary: 'Most recent real server events',
    usage: 'events [limit]',
    run: async (args) => {
      const limit = Math.min(100, Math.max(1, parseInt(args[0] ?? '20', 10) || 20));
      const rows = bus.history(limit);
      if (rows.length === 0) return 'No events recorded yet.';
      return rows.map((e) => `${e.at.slice(11, 23)}  [${e.severity.toUpperCase().padEnd(7)}] ${e.type.padEnd(20)} ${e.message}`).join('\n');
    },
  },

  status: {
    summary: 'One-line summary of the node and its host',
    usage: 'status',
    run: async () => {
      const host = await hostSnapshot();
      const stats = queries.ledgerStats.get() as Record<string, number>;
      return [
        `host      ${host.hostname} (${host.platform}/${host.arch}) kernel ${host.release}`,
        `cpu       ${host.cpuCores} cores, load ${host.loadAverage.join(' ')}`,
        `memory    ${host.usedMemoryGB}/${host.totalMemoryGB} GB (${host.memoryUsedPercent}%)`,
        `nodes     ${nodeCount()} live, hashrate ${aggregateHashrate().toLocaleString()} H/s`,
        `ledger    ${stats.blocks} verified blocks`,
        `database  ${DB_INFO.path}`,
        `roots     ${BROWSE_ROOTS.join(', ')}`,
      ].join('\n');
    },
  },

  clear: {
    summary: 'Clear the console screen (handled client-side)',
    usage: 'clear',
    run: async () => '\u0000CLEAR',
  },
};

export async function executeConsoleCommand(rawCommand: string, ctx: CommandContext = {}): Promise<ConsoleResult> {
  const started = Date.now();
  const trimmed = (rawCommand ?? '').trim();

  if (!trimmed) {
    return { output: '', error: false, command: '', durationMs: 0 };
  }

  const [name, ...args] = trimmed.split(/\s+/);
  const handler = CONSOLE_COMMANDS[name];

  if (!handler) {
    return {
      output: `gaia: command not found: ${name}\nType 'help' for the list of real commands this console implements.`,
      error: true,
      command: name,
      durationMs: Date.now() - started,
    };
  }

  try {
    const output = await handler.run(args, ctx);
    return { output, error: false, command: name, durationMs: Date.now() - started };
  } catch (error: any) {
    const message = error?.code === 'ENOENT' ? 'no such file or directory' : error?.message ?? String(error);
    return { output: `${name}: ${message}`, error: true, command: name, durationMs: Date.now() - started };
  }
}
