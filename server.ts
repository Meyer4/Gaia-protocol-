/**
 * Gaia Protocol — node server.
 *
 * Everything exposed here is real:
 *   • host telemetry read from the OS at request time
 *   • a live node registry driven by real browser heartbeats
 *   • proof-of-work submissions that are re-hashed and verified here
 *   • Schnorr zero-knowledge proofs verified against the RFC 3526 group
 *   • a real SQLite ledger, a real file browser and a real (shell-free) console
 *   • the live USGS seismic feed, proxied and cached
 *   • Gemini calls proxied so the API key never reaches the browser
 *
 * There is no `child_process` in this process and no randomly generated data.
 */
import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { bus, liveNodes, nodeCount, aggregateHashrate, registerNode, creditBlock, sweepStaleNodes, createRateLimiter } from './server/events.ts';
import { queries, DB_INFO } from './server/db.ts';
import { hostSnapshot, readProcessTable } from './server/system.ts';
import { executeConsoleCommand, CONSOLE_COMMANDS } from './server/console.ts';
import { listDirectory, readFilePreview, FileBrowserError, BROWSE_ROOTS } from './server/files.ts';
import { generate, generatePitch, aiStatus, chatSystemInstruction, PITCH_TARGETS, AiUnavailableError } from './server/ai.ts';
import { verifyPow, verifySchnorrProof, merkleRoot, cryptoSelfDescription } from './shared/crypto.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION = '1.0.0';
const startedAt = Date.now();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

/* ------------------------------------------------------------------ */
/* Cross-cutting: security headers, request log, error handling        */
/* ------------------------------------------------------------------ */

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const route = (req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path) || req.path;
    if (route.startsWith('/api/')) {
      queries.logRequest.run(req.method, route, res.statusCode, Date.now() - start);
    }
  });
  next();
});

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

setInterval(() => queries.pruneRequestLog.run(), 5 * 60 * 1000).unref();

const clientKey = (req: Request) =>
  (req.headers['x-forwarded-for']?.toString().split(',')[0] ?? req.socket.remoteAddress ?? 'unknown').trim();

/* ------------------------------------------------------------------ */
/* Live feed                                                           */
/* ------------------------------------------------------------------ */

const sseClients = new Set<Response>();

function broadcast(event: ReturnType<typeof bus.emitEvent>) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) client.write(payload);
}

bus.on('gaia', broadcast);

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  sseClients.add(res);
  bus.emitEvent('client.connected', `Live feed client connected (${sseClients.size} watching)`, 'info', {
    watching: sseClients.size,
  });

  // Replay real history so a freshly opened window is not blank.
  for (const event of bus.history(25).reverse()) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
  res.write(`: connected at ${new Date().toISOString()}\n\n`);

  const heartbeat = setInterval(() => res.write(`: keepalive ${Date.now()}\n\n`), 15_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
    bus.emitEvent('client.disconnected', `Live feed client disconnected (${sseClients.size} watching)`, 'info', {
      watching: sseClients.size,
    });
  });
});

/* ------------------------------------------------------------------ */
/* Status & registry                                                   */
/* ------------------------------------------------------------------ */

app.get('/api/health', async (_req, res) => {
  res.json({ status: 'ok', version: VERSION, uptimeSeconds: Math.round((Date.now() - startedAt) / 1000), timestamp: new Date().toISOString() });
});

app.get('/api/config', (_req, res) => {
  res.json({
    version: VERSION,
    ai: aiStatus(),
    crypto: cryptoSelfDescription,
    browseRoots: BROWSE_ROOTS,
    consoleCommands: Object.entries(CONSOLE_COMMANDS).map(([name, def]) => ({ name, summary: def.summary, usage: def.usage })),
    pitchTargets: Object.keys(PITCH_TARGETS),
    sensorFeed: {
      source: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
      proxiedBy: '/api/sensors/earthquakes',
      cacheSeconds: 60,
    },
  });
});

app.get('/api/status', async (_req, res) => {
  try {
    const host = await hostSnapshot();
    const ledger = queries.ledgerStats.get() as Record<string, number>;
    const zkp = queries.zkpStats.get() as Record<string, number>;
    const requests = queries.requestStats.get() as Record<string, number>;
    const hashes = (queries.allWorkHashes.all() as { hash: string }[]).map((r) => r.hash);

    res.json({
      generatedAt: new Date().toISOString(),
      version: VERSION,
      serverUptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      host,
      network: {
        liveNodes: nodeCount(),
        nodes: liveNodes(),
        aggregateHashrate: aggregateHashrate(),
        sseClients: sseClients.size,
        requestsServed: requests.served,
      },
      ledger: {
        blocks: ledger.blocks,
        attempts: ledger.attempts,
        maxDifficulty: ledger.max_difficulty,
        contributors: ledger.contributors,
        merkleRoot: merkleRoot(hashes),
      },
      zkp: { total: zkp.total, valid: zkp.valid, rejected: zkp.total - zkp.valid },
      database: DB_INFO,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/nodes', (_req, res) => {
  res.json({
    live: liveNodes(),
    count: nodeCount(),
    aggregateHashrate: aggregateHashrate(),
    ttlSeconds: 30,
  });
});

app.post('/api/nodes/heartbeat', (req, res) => {
  const id = String(req.body?.nodeId ?? '').trim().slice(0, 64);
  if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return res.status(400).json({ error: 'nodeId must be 1-64 chars of [A-Za-z0-9_-]' });
  }

  const { node, isNew } = registerNode({
    id,
    reportedHashrate: Number(req.body?.reportedHashrate) || 0,
    userAgent: String(req.headers['user-agent'] ?? 'unknown').slice(0, 200),
    remoteAddress: clientKey(req),
  });

  if (isNew) {
    queries.upsertNode.run(id, node.userAgent);
    bus.emitEvent('node.joined', `Node ${id} joined the network`, 'success', { nodeId: id, nodes: nodeCount() });
  } else {
    queries.upsertNode.run(id, node.userAgent);
  }

  res.json({ ok: true, node, liveNodes: nodeCount(), aggregateHashrate: aggregateHashrate() });
});

/* ------------------------------------------------------------------ */
/* Verifiable work                                                     */
/* ------------------------------------------------------------------ */

const workLimiter = createRateLimiter({ capacity: 20, refillPerSecond: 2 });

app.post('/api/work/submit', (req, res) => {
  const limit = workLimiter(clientKey(req));
  if (!limit.allowed) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return res.status(429).json({ error: 'rate limited', retryAfterMs: limit.retryAfterMs });
  }

  const { header, nonce, hash, difficulty, nodeId, attempts, elapsedMs, hashrate } = req.body ?? {};
  const verdict = verifyPow({ header, nonce, hash, difficulty });

  if (!verdict.valid) {
    bus.emitEvent('work.rejected', `Rejected proof of work from ${nodeId ?? 'unknown'}: ${verdict.reason}`, 'warn', {
      nodeId: nodeId ?? null,
      reason: verdict.reason,
    });
    return res.status(400).json({ accepted: false, verdict });
  }

  const node = String(nodeId ?? 'anonymous').trim().slice(0, 64) || 'anonymous';

  try {
    queries.insertVerifiedWork.run(
      header,
      nonce,
      difficulty,
      hash,
      verdict.leadingZeros ?? 0,
      node,
      Number(attempts) || 0,
      Number(elapsedMs) || 0,
      Number(hashrate) || 0,
    );
  } catch (error: any) {
    if (String(error.message).includes('UNIQUE')) {
      return res.status(409).json({ accepted: false, verdict: { valid: false, reason: 'this exact proof was already recorded (replay)' } });
    }
    throw error;
  }

  creditBlock(node);
  const stats = queries.ledgerStats.get() as Record<string, number>;
  const hashes = (queries.allWorkHashes.all() as { hash: string }[]).map((r) => r.hash);
  const root = merkleRoot(hashes);

  bus.emitEvent(
    'work.accepted',
    `Verified block #${stats.blocks} from node ${node} (difficulty ${difficulty}, ${verdict.leadingZeros} leading zero bits)`,
    'success',
    { nodeId: node, hash, difficulty, merkleRoot: root },
  );

  res.json({ accepted: true, verdict, blockNumber: stats.blocks, merkleRoot: root, totalBlocks: stats.blocks });
});

app.get('/api/ledger', (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '25'), 10) || 25));
  const stats = queries.ledgerStats.get() as Record<string, number>;
  const rows = queries.recentWork.all(limit);
  const hashes = (queries.allWorkHashes.all() as { hash: string }[]).map((r) => r.hash);
  res.json({ stats, blocks: rows, merkleRoot: merkleRoot(hashes) });
});

/* ------------------------------------------------------------------ */
/* Zero-knowledge proofs                                               */
/* ------------------------------------------------------------------ */

const zkpLimiter = createRateLimiter({ capacity: 20, refillPerSecond: 2 });

app.post('/api/zkp/verify', (req, res) => {
  const limit = zkpLimiter(clientKey(req));
  if (!limit.allowed) {
    return res.status(429).json({ error: 'rate limited', retryAfterMs: limit.retryAfterMs });
  }

  const proof = req.body?.proof;
  const result = verifySchnorrProof(proof);
  const label = String(proof?.statement?.label ?? 'unknown').slice(0, 120);

  try {
    queries.recordZkp.run(label, String(proof?.statement?.y ?? '').slice(0, 600), result.valid ? 1 : 0, result.reason ?? null, result.elapsedMs);
  } catch (error: any) {
    console.error('failed to record zkp verification', error);
  }

  bus.emitEvent(
    result.valid ? 'zkp.valid' : 'zkp.invalid',
    result.valid
      ? `Schnorr proof verified for label "${label}" in ${result.elapsedMs} ms`
      : `Schnorr proof REJECTED for label "${label}": ${result.reason}`,
    result.valid ? 'success' : 'error',
    { label, valid: result.valid, elapsedMs: result.elapsedMs },
  );

  res.json({ verification: result });
});

app.get('/api/zkp/log', (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  res.json({ stats: queries.zkpStats.get(), entries: queries.recentZkp.all(limit) });
});

/* ------------------------------------------------------------------ */
/* Console, files, processes                                           */
/* ------------------------------------------------------------------ */

const consoleLimiter = createRateLimiter({ capacity: 30, refillPerSecond: 5 });

app.post('/api/console/exec', async (req, res) => {
  const limit = consoleLimiter(clientKey(req));
  if (!limit.allowed) {
    return res.status(429).json({ error: 'rate limited', retryAfterMs: limit.retryAfterMs });
  }

  const command = String(req.body?.command ?? '');
  if (command.length > 500) return res.status(400).json({ error: 'command too long (max 500 chars)' });

  const result = await executeConsoleCommand(command, { nodeId: String(req.body?.nodeId ?? '') });
  if (result.command) {
    bus.emitEvent(
      result.error ? 'console.failed' : 'console.exec',
      `console: ${result.command} (${result.durationMs} ms)`,
      result.error ? 'warn' : 'info',
      { command: result.command, durationMs: result.durationMs },
    );
  }
  res.json(result);
});

app.get('/api/fs', async (req, res) => {
  try {
    res.json(await listDirectory(String(req.query.path ?? '.')));
  } catch (error: any) {
    res.status(error instanceof FileBrowserError ? 403 : 404).json({ error: error.message });
  }
});

app.get('/api/fs/read', async (req, res) => {
  try {
    res.json(await readFilePreview(String(req.query.path ?? '')));
  } catch (error: any) {
    const status = error instanceof FileBrowserError ? 403 : error?.code === 'ENOENT' ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
});

app.get('/api/system/processes', async (req, res) => {
  const limit = Math.min(60, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  const processes = await readProcessTable(limit);
  res.json({ processes, available: processes.length > 0, source: '/proc' });
});

/* ------------------------------------------------------------------ */
/* Real sensor data (USGS)                                             */
/* ------------------------------------------------------------------ */

const USGS_FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';
let sensorCache: { at: number; payload: any } | null = null;

app.get('/api/sensors/earthquakes', async (_req, res) => {
  if (sensorCache && Date.now() - sensorCache.at < 60_000) {
    return res.json({ ...sensorCache.payload, cached: true, cachedAt: new Date(sensorCache.at).toISOString() });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(USGS_FEED, { signal: controller.signal, headers: { 'user-agent': `gaia-protocol/${VERSION}` } });
    clearTimeout(timer);

    if (!response.ok) throw new Error(`USGS responded ${response.status}`);
    const payload = await response.json();
    const count = payload?.features?.length ?? 0;

    sensorCache = { at: Date.now(), payload };
    bus.emitEvent('sensor.refreshed', `Seismic feed refreshed: ${count} earthquakes in the last hour`, 'success', { count });
    res.json({ ...payload, cached: false, fetchedAt: new Date().toISOString() });
  } catch (error: any) {
    bus.emitEvent('sensor.failed', `Seismic feed unreachable from the server: ${error.message}`, 'warn', {
      error: error.message,
    });
    res.status(502).json({
      error: 'server could not reach the USGS feed',
      detail: error.message,
      fallback: USGS_FEED,
      hint: 'The browser can fetch the feed directly; the UI falls back to that automatically.',
    });
  }
});

/* ------------------------------------------------------------------ */
/* AI (proxied)                                                        */
/* ------------------------------------------------------------------ */

const aiLimiter = createRateLimiter({ capacity: 10, refillPerSecond: 0.5 });

function liveContextForPrompt(): string {
  const stats = queries.ledgerStats.get() as Record<string, number>;
  const zkp = queries.zkpStats.get() as Record<string, number>;
  return [
    `live nodes: ${nodeCount()}`,
    `aggregate reported hashrate: ${aggregateHashrate().toLocaleString()} H/s`,
    `verified proof-of-work blocks: ${stats.blocks} across ${stats.contributors} contributing node(s)`,
    `total hashes ground and verified: ${stats.attempts}`,
    `zero-knowledge proofs verified: ${zkp.valid} valid / ${zkp.total - zkp.valid} rejected`,
    `sensor feed: USGS magnitude feed, refreshed every 60 seconds`,
  ].join('\n');
}

app.post('/api/ai/chat', async (req, res) => {
  const limit = aiLimiter(clientKey(req));
  if (!limit.allowed) return res.status(429).json({ error: 'rate limited', retryAfterMs: limit.retryAfterMs });

  const message = String(req.body?.message ?? '').slice(0, 4000);
  const language = String(req.body?.language ?? 'English').slice(0, 40);
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-12) : [];

  if (!message.trim()) return res.status(400).json({ error: 'message is required' });

  const contents = [
    ...history
      .filter((h: any) => (h.role === 'user' || h.role === 'model') && typeof h.text === 'string')
      .map((h: any) => ({ role: h.role, parts: [{ text: h.text.slice(0, 4000) }] })),
    { role: 'user', parts: [{ text: message }] },
  ];

  try {
    const result = await generate({
      systemInstruction: `${chatSystemInstruction(language)}\n\nCurrent verified network state:\n${liveContextForPrompt()}`,
      contents,
      requestKey: typeof req.body?.apiKey === 'string' ? req.body.apiKey : undefined,
      purpose: 'chat',
    });
    bus.emitEvent('ai.chat', `Assistant answered a ${message.length}-character question using ${result.model}`, 'info', {
      model: result.model,
    });
    res.json({ text: result.text, model: result.model });
  } catch (error: any) {
    const status = error instanceof AiUnavailableError ? error.status : 500;
    res.status(status).json({ error: error.message, model: null });
  }
});

app.post('/api/ai/pitch', async (req, res) => {
  const limit = aiLimiter(clientKey(req));
  if (!limit.allowed) return res.status(429).json({ error: 'rate limited', retryAfterMs: limit.retryAfterMs });

  const target = String(req.body?.target ?? '');
  if (!PITCH_TARGETS[target]) {
    return res.status(400).json({ error: `unknown target. Valid targets: ${Object.keys(PITCH_TARGETS).join(', ')}` });
  }

  try {
    const result = await generatePitch(target, req.body?.settings ?? {}, liveContextForPrompt(), typeof req.body?.apiKey === 'string' ? req.body.apiKey : undefined);
    bus.emitEvent('ai.pitch', `Drafted a pitch for "${target}" using ${result.model}`, 'success', { target, model: result.model });
    res.json({ text: result.text, model: result.model, target });
  } catch (error: any) {
    const status = error instanceof AiUnavailableError ? error.status : 500;
    res.status(status).json({ error: error.message, model: null });
  }
});

app.get('/api/pitches', (_req, res) => {
  res.json({ success: true, pitches: queries.recentPitches.all(20) });
});

/* ------------------------------------------------------------------ */
/* Errors, then the app itself                                         */
/* ------------------------------------------------------------------ */

app.use('/api', (_req, res) => res.status(404).json({ error: 'unknown API route' }));

app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  bus.emitEvent('server.error', `Unhandled error: ${error?.message ?? error}`, 'error');
  console.error(error);
  if (!res.headersSent) res.status(500).json({ error: 'internal server error' });
});

async function startServer() {
  const PORT = Number(process.env.PORT ?? 3000);
  const HOST = process.env.HOST ?? '0.0.0.0';

  if (process.env.NODE_ENV !== 'production') {
    // Imported lazily so a production install can omit devDependencies entirely.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
    bus.emitEvent('server.mode', 'Vite dev middleware attached (hot reload enabled)', 'info');
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath, { index: 'index.html', maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  const server = app.listen(PORT, HOST, () => {
    const host = hostSummary();
    bus.emitEvent('server.started', `Gaia node v${VERSION} listening on ${HOST}:${PORT} (${host})`, 'success', {
      port: PORT,
      host: HOST,
      version: VERSION,
      database: DB_INFO.path,
    });
    console.log(`\n  Gaia Protocol v${VERSION}`);
    console.log(`  http://${HOST}:${PORT}   (database: ${DB_INFO.path})`);
    console.log(`  AI: ${aiStatus().configured ? `configured (${aiStatus().provider})` : 'no GEMINI_API_KEY — assistant reports this honestly'}\n`);
  });

  setInterval(sweepStaleNodes, 10_000).unref();

  const shutdown = (signal: string) => {
    bus.emitEvent('server.stopping', `Received ${signal}, closing sockets`, 'warn');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

function hostSummary() {
  return `${os.platform()}/${os.arch()}, ${os.cpus().length} cores, ${Math.round(os.totalmem() / 1024 ** 3)} GB`;
}

startServer().catch((error) => {
  console.error('Failed to start the Gaia node:', error);
  process.exit(1);
});
