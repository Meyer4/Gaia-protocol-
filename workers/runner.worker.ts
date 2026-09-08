/**
 * workers/runner.worker.ts
 *
 * Real JavaScript execution in an isolated worker. The console is piped back to
 * the UI, the completion value is reported, and the main thread can terminate
 * this worker to enforce a hard time limit — so a runaway loop is actually
 * stopped rather than just ignored.
 */

import { leadingZeroBits, mineChunk, sha256Hex } from '../shared/crypto.ts';

type Level = 'log' | 'info' | 'warn' | 'error' | 'return';

/** Real utilities handed to sandboxed code — no network, no DOM, no eval of eval. */
const gaia = { sha256Hex, mineChunk, leadingZeroBits };

function format(value: any, depth = 0): string {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack ?? ''}`;
  if (typeof value === 'object') {
    if (depth > 2) return '[Object]';
    try {
      return JSON.stringify(
        value,
        (_key, inner) => (typeof inner === 'bigint' ? `${inner}n` : inner),
        2,
      );
    } catch {
      return String(value);
    }
  }
  return String(value);
}

const send = (level: Level, args: any[]) => {
  self.postMessage({ type: 'log', level, text: args.map((a) => format(a)).join(' ') });
};

const sandboxConsole = {
  log: (...args: any[]) => send('log', args),
  info: (...args: any[]) => send('info', args),
  warn: (...args: any[]) => send('warn', args),
  error: (...args: any[]) => send('error', args),
  debug: (...args: any[]) => send('log', args),
};

self.onmessage = async (event: MessageEvent<{ code: string }>) => {
  const { code } = event.data;

  try {
    // eslint-disable-next-line no-new-func
    const factory = new Function('console', 'gaia', 'self', 'window', 'document', `"use strict";\n${code}`);
    const result = factory(sandboxConsole, gaia, undefined, undefined, undefined);

    if (result && typeof (result as any).then === 'function') {
      const awaited = await result;
      if (awaited !== undefined) send('return', [awaited]);
    } else if (result !== undefined) {
      send('return', [result]);
    }
  } catch (error: any) {
    send('error', [error]);
  }

  self.postMessage({ type: 'done' });
};

export {};
