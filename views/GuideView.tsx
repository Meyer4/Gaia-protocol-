import { BookOpen, CheckCircle2, XCircle } from 'lucide-react';
import { api, type ConfigResponse } from '@/lib/api';
import { usePoll } from '@/lib/hooks';
import { Mono, Note, Panel, ViewHeader } from './parts';

const REAL: { title: string; body: string }[] = [
  {
    title: 'Proof of work is ground here and verified there',
    body: 'A worker in your browser hashes SHA-256(header|nonce) until the digest carries the chosen number of leading zero bits. The server recomputes that digest with its own SHA-256 implementation, refuses replays through a UNIQUE(header, nonce) constraint, and only then writes the block to SQLite.',
  },
  {
    title: 'Zero-knowledge proofs are actual Schnorr proofs',
    body: 'A secret exponent x is generated locally. The prover publishes y = g^x mod p and a Fiat–Shamir Schnorr transcript (t, s, c) over the RFC 3526 2048-bit MODP group. The server re-derives the challenge and checks g^s ≡ t·y^c (mod p). The soundness button sends s+1 and the server rejects it.',
  },
  {
    title: 'Host telemetry comes from the kernel',
    body: 'CPU utilisation is the delta between two /proc/stat reads, memory comes from the kernel, disk usage from statfs, throughput from the interface byte counters, and the process table is read out of /proc — no ps binary and no shell anywhere in the server.',
  },
  {
    title: 'Sensor data is the live USGS feed',
    body: 'Earthquakes come from the USGS magnitude feed for the last hour, proxied by the node with a 60-second cache and fetched directly by your browser if the node cannot reach it. Map tiles are real slippy-map tiles.',
  },
  {
    title: 'The console is native, not a shell',
    body: 'Each command is implemented directly against the OS, the database and the node registry. There is no child_process in the server process, so nothing typed into the console can become a subprocess.',
  },
];

const REMOVED: { title: string; body: string }[] = [
  {
    title: 'Random "active nodes" and PetaFLOPS counters',
    body: 'The old /api/network/stats returned Math.random() * 500 + 1200 nodes, a hard-coded "15.4 PetaFLOPS", "99.99%" uptime and a permanent "Low" threat level. Node counts now come from real heartbeats and hashrate from real measurements.',
  },
  {
    title: 'A synthetic event stream',
    body: 'The SSE endpoint used to emit invented log lines ("Detected seismic anomaly in Region 4", "New peer joined the mesh") on a timer. The stream now carries only real occurrences: connections, heartbeats, verifications, rejections, errors.',
  },
  {
    title: 'The ZK proof counter',
    body: 'The ZK panel was a button that incremented a number. It has been replaced by real Schnorr proofs verified by the server.',
  },
  {
    title: 'The "World Engine" random hashrate',
    body: 'It set the hashrate to Math.floor(Math.random() * 100000) once a second. The compute engine now reports measured hashes per second from an actual miner.',
  },
  {
    title: 'A remote shell on the server',
    body: '/api/terminal/exec ran user input through a shell with an allowlist of binaries that included curl, python3 and node — arbitrary code execution on the host. It is gone, along with the "root@kali" prompt that was never true.',
  },
];

export function GuideView() {
  const config = usePoll<ConfigResponse>(() => api.config(), 60_000);

  return (
    <div>
      <ViewHeader
        icon={BookOpen}
        title="How this node works"
        subtitle="What is real, what was removed, and how to check it yourself"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="What is real">
          <div className="space-y-3">
            {REAL.map((item) => (
              <div key={item.title} className="rounded border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-zinc-200">{item.title}</div>
                    <p className="text-xs text-zinc-400 leading-relaxed mt-1">{item.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="What was removed (it was simulated)">
          <div className="space-y-3">
            {REMOVED.map((item) => (
              <div key={item.title} className="rounded border border-rose-500/20 bg-rose-500/[0.04] p-3">
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-zinc-200">{item.title}</div>
                    <p className="text-xs text-zinc-400 leading-relaxed mt-1">{item.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Cryptography in use">
          <dl className="space-y-2 text-xs">
            <Row label="Hashing" value={config.data?.crypto.hash ?? '—'} />
            <Row label="Proof of work" value={config.data?.crypto.pow ?? '—'} />
            <Row label="Zero-knowledge" value={config.data?.crypto.zkp ?? '—'} />
          </dl>
          <div className="mt-3">
            <Note tone="info">
              The SHA-256 implementation is checked against <Mono>node:crypto</Mono> and the FIPS 180-4 test vectors by{' '}
              <Mono>npm test</Mono>, along with proof-of-work acceptance/rejection and Schnorr soundness.
            </Note>
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Console commands implemented on the server">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {(config.data?.consoleCommands ?? []).map((command) => (
              <div key={command.name} className="flex items-center gap-2 text-[11px]">
                <Mono className="text-emerald-400 w-24 shrink-0">{command.usage}</Mono>
                <span className="text-zinc-500">{command.summary}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-zinc-800/60 pb-2">
      <dt className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">{label}</dt>
      <dd className="text-zinc-300">{value}</dd>
    </div>
  );
}
