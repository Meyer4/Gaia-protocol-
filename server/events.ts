/**
 * server/events.ts
 *
 * The event bus behind the live feed and the SSE stream. Only real things
 * happen here: a socket opened, a heartbeat arrived, a proof of work was
 * verified, a request was served, a sensor poll completed. There is no
 * generator producing synthetic chatter.
 */
import { EventEmitter } from 'node:events';

export type EventSeverity = 'info' | 'success' | 'warn' | 'error';

export interface GaiaEvent {
  at: string;
  type: string;
  severity: EventSeverity;
  message: string;
  data?: Record<string, unknown>;
}

class GaiaEventBus extends EventEmitter {
  private recent: GaiaEvent[] = [];

  emitEvent(type: string, message: string, severity: EventSeverity = 'info', data?: Record<string, unknown>) {
    const event: GaiaEvent = { at: new Date().toISOString(), type, severity, message, data };
    this.recent = [event, ...this.recent].slice(0, 100);
    this.emit('gaia', event);
    return event;
  }

  history(limit = 50): GaiaEvent[] {
    return this.recent.slice(0, limit);
  }
}

export const bus = new GaiaEventBus();
bus.setMaxListeners(200);

/* ------------------------------------------------------------------ */
/* Live node registry (heartbeat based)                                */
/* ------------------------------------------------------------------ */

export interface LiveNode {
  id: string;
  firstSeen: string;
  lastSeen: number;
  reportedHashrate: number;
  blocksAccepted: number;
  userAgent: string;
  remoteAddress: string;
}

const HEARTBEAT_TTL_MS = 30_000;
const nodes = new Map<string, LiveNode>();

export function registerNode(input: {
  id: string;
  reportedHashrate?: number;
  userAgent?: string;
  remoteAddress?: string;
}): { node: LiveNode; isNew: boolean } {
  const existing = nodes.get(input.id);
  const now = Date.now();

  if (existing) {
    existing.lastSeen = now;
    existing.reportedHashrate = Math.max(0, Math.floor(input.reportedHashrate ?? 0));
    existing.userAgent = input.userAgent ?? existing.userAgent;
    existing.remoteAddress = input.remoteAddress ?? existing.remoteAddress;
    return { node: existing, isNew: false };
  }

  const node: LiveNode = {
    id: input.id,
    firstSeen: new Date(now).toISOString(),
    lastSeen: now,
    reportedHashrate: Math.max(0, Math.floor(input.reportedHashrate ?? 0)),
    blocksAccepted: 0,
    userAgent: input.userAgent ?? 'unknown',
    remoteAddress: input.remoteAddress ?? 'unknown',
  };
  nodes.set(input.id, node);
  return { node, isNew: true };
}

export function creditBlock(nodeId: string) {
  const node = nodes.get(nodeId);
  if (node) node.blocksAccepted += 1;
}

export function liveNodes(): LiveNode[] {
  const cutoff = Date.now() - HEARTBEAT_TTL_MS;
  return [...nodes.values()].filter((n) => n.lastSeen >= cutoff).sort((a, b) => b.lastSeen - a.lastSeen);
}

export function nodeCount() {
  return liveNodes().length;
}

export function aggregateHashrate() {
  return liveNodes().reduce((sum, n) => sum + n.reportedHashrate, 0);
}

/** Emits a real event for every node whose heartbeat has actually lapsed. */
export function sweepStaleNodes() {
  const cutoff = Date.now() - HEARTBEAT_TTL_MS;
  let removed = 0;
  for (const [id, node] of nodes) {
    if (node.lastSeen < cutoff) {
      nodes.delete(id);
      removed++;
      bus.emitEvent('node.expired', `Node ${id} stopped sending heartbeats and left the registry`, 'warn', {
        nodeId: id,
        lastSeen: new Date(node.lastSeen).toISOString(),
      });
    }
  }
  return removed;
}

/* ------------------------------------------------------------------ */
/* Rate limiting (real, per client key)                                */
/* ------------------------------------------------------------------ */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export function createRateLimiter({ capacity, refillPerSecond }: { capacity: number; refillPerSecond: number }) {
  const buckets = new Map<string, Bucket>();

  return function consume(key: string): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const bucket = buckets.get(key) ?? { tokens: capacity, updatedAt: now };
    const elapsed = (now - bucket.updatedAt) / 1000;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerSecond);
    bucket.updatedAt = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      buckets.set(key, bucket);
      return { allowed: true, retryAfterMs: 0 };
    }

    buckets.set(key, bucket);
    return { allowed: false, retryAfterMs: Math.ceil(((1 - bucket.tokens) / refillPerSecond) * 1000) };
  };
}

export const NODE_TTL_MS = HEARTBEAT_TTL_MS;
