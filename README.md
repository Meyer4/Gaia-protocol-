# Gaia Protocol — Node Console

A working MVP of the Gaia Protocol node: a browser console for a decentralised compute
network where **every number on screen is measured, verified or fetched** — nothing is
simulated.

* **Verifiable compute** — the browser grinds real SHA-256 proof of work; the server
  re-hashes every submission and only records it if the work checks out.
* **Real zero-knowledge proofs** — Schnorr proofs of knowledge of a discrete logarithm
  over the RFC 3526 2048-bit MODP group, generated in the browser and verified server-side.
* **Real telemetry** — CPU, memory, disk, throughput and the process table are read from
  the kernel at request time.
* **Real sensor data** — the live USGS seismic feed on a real slippy map.
* **A real console** — 18 commands implemented natively against the OS, the SQLite
  ledger and the node registry. There is no `child_process` in the server.

---

## Quick start

```bash
npm install
npm run build      # build the browser bundle into dist/
npm start          # serve dist/ + the API on http://localhost:3000
```

For development with hot reload (Vite middleware inside Express):

```bash
npm run dev
```

Node.js **22.5 or newer** is required — the persistence layer uses the SQLite engine built
into Node (`node:sqlite`), so there is nothing to compile.

### Optional: AI assistant

The assistant and the outreach studio call Google Gemini **through the server**, so the key
never ships to the browser. Without a key both features say so plainly instead of inventing
a reply.

```bash
cp .env.example .env      # then set GEMINI_API_KEY
```

You can also paste a key into **Settings** at runtime; it stays in that browser and is sent
only with your own requests.

---

## What is real (and how to check)

| Feature | Source of truth |
| --- | --- |
| Proof of work | Browser grinds `SHA-256(header|nonce)`; server recomputes and rejects replays via `UNIQUE(header, nonce)` |
| Zero-knowledge proofs | Schnorr/Fiat–Shamir; server re-derives the challenge and checks `g^s ≡ t·y^c (mod p)` |
| Host telemetry | `/proc/stat` deltas, `os` memory, `statfs`, `/sys/class/net` counters, `/proc` process table |
| Node registry | Real HTTP heartbeats every 10 s, 30 s expiry |
| Live feed | Server-Sent Events carrying only real occurrences (connections, verifications, rejections, errors) |
| Sensor grid | USGS magnitude feed (proxied with a 60 s cache, fetched directly by the browser if the node has no egress) |
| Ledger | SQLite via `node:sqlite`, with a Merkle root over every verified block |

### Removed simulation

The previous version of this project faked most of its data. Gone:

* `activeNodes: Math.random() * 500 + 1200`, a hard-coded `15.4 PetaFLOPS`, `99.99%` uptime
  and a permanent `Low` threat level → replaced by real heartbeats and measurements.
* An SSE endpoint emitting invented log lines on a timer → replaced by real events.
* A "ZK proof" panel that was a button incrementing a counter → real Schnorr proofs.
* A "World Engine" setting hashrate to `Math.random() * 100000` → a real miner with
  measured throughput.
* `POST /api/terminal/exec`, which ran user input through a shell with `curl`, `python3` and
  `node` allowlisted — arbitrary code execution on the host — plus a `root@kali` prompt that
  was never true. Replaced by a shell-free native console and a scoped file browser.
* `better-sqlite3`, whose native build fails on machines without a compiler toolchain.
* `gemini-1.5-flash`, which Google shut down on 2025-09-29 (every request 404s). The server
  now walks a model candidate list and reports the model that actually answered.

See the **Guide** window in the app for the same list at runtime.

---

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness, version, uptime |
| GET | `/api/config` | Provider status, crypto description, console command list |
| GET | `/api/status` | Full real snapshot: host, network, ledger, ZK stats |
| GET | `/api/stream` | Server-Sent Events — real events only |
| GET/POST | `/api/nodes`, `/api/nodes/heartbeat` | Live node registry |
| POST | `/api/work/submit` | Submit proof of work for independent verification |
| GET | `/api/ledger` | Verified blocks, stats and Merkle root |
| POST | `/api/zkp/verify` | Verify a Schnorr proof |
| GET | `/api/zkp/log` | Verification history |
| POST | `/api/console/exec` | Run one of the 18 native read-only commands |
| GET | `/api/fs`, `/api/fs/read` | Scoped file browser (text files ≤ 256 KB) |
| GET | `/api/system/processes` | Process table from `/proc` |
| GET | `/api/sensors/earthquakes` | USGS feed, cached 60 s |
| POST | `/api/ai/chat`, `/api/ai/pitch` | Proxied Gemini calls |

Every mutating endpoint is rate limited per client IP.

## Security notes

* No shell, no `child_process`, no argument interpolation into a command line.
* The file browser resolves paths against an explicit root allowlist and checks **every**
  path segment, so `.git/config`, `.env`, `node_modules` and `../` traversals are refused.
* `GEMINI_API_KEY` is never injected into the browser bundle (no `define` block in
  `vite.config.ts`).
* The browser sandbox for Code Lab has no DOM, no `window` and no network; runaway scripts
  are terminated by the host.

## Tests

```bash
npm test          # cryptography: SHA-256 vs node:crypto + FIPS vectors, PoW accept/reject,
                  # Schnorr soundness, Merkle root, group parameters
npm run test:ui   # bundles the real app with esbuild, mounts it in jsdom against a running
                  # node and asserts the DOM shows the node's real hostname, ledger and files
npm run lint      # tsc --noEmit under strict mode
```

`test:ui` needs the server running: start it, then run the tests.

## Deployment

This app needs a Node.js runtime (the API and the SQLite ledger are part of it), so a
static host alone will not work. Any Node host is fine:

```bash
npm ci && npm run build && npm start     # honours PORT and HOST
```

Set `GEMINI_API_KEY` for the AI features, `GAIA_DATA_DIR` to choose where `gaia.db` lives,
and `GAIA_BROWSE_ROOTS` (path-delimiter separated) to change what the file browser may read.

## Layout

```
server.ts              Express app, routes, SSE, static serving
server/system.ts       real kernel telemetry
server/console.ts      the 18 native console commands
server/files.ts        scoped file browser
server/db.ts           node:sqlite schema and prepared statements
server/events.ts       event bus, node registry, rate limiter
server/ai.ts           Gemini proxy with model fallback
shared/crypto.ts       SHA-256, proof of work, Schnorr ZK (browser + server)
lib/                   API client, hooks, network provider, miner controller
views/                 one file per window
workers/               miner and code-runner workers
tests/                 cryptography unit tests + jsdom integration tests
```

## Contact

Created by [George Meya](https://github.com/Meyer4) — gmeya2041@gmail.com
