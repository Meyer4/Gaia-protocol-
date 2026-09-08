import { Ban, Hammer, Play, Square } from 'lucide-react';
import { useNetwork } from '@/lib/network';
import { miner as minerController } from '@/lib/miner';
import { formatHashrate } from '@/lib/hooks';
import { api, type LedgerResponse } from '@/lib/api';
import { usePoll } from '@/lib/hooks';
import { Button, EmptyState, Mono, Note, Panel, Stat, ViewHeader } from './parts';
import { cn } from '@/utils';

const DIFFICULTIES = [
  { bits: 16, label: '16 bits — a few thousand hashes' },
  { bits: 18, label: '18 bits — quick' },
  { bits: 20, label: '20 bits — about a million hashes' },
  { bits: 22, label: '22 bits — several million hashes' },
  { bits: 24, label: '24 bits — slow, real work' },
];

/**
 * Distributed compute, for real: this browser grinds SHA-256 until the digest
 * carries the requested number of leading zero bits, then the server re-hashes
 * `header|nonce` from scratch and only records the block if the work checks
 * out. Nothing here is a random number generator dressed up as mining.
 */
export function MinerView() {
  const { miner, nodeId } = useNetwork();
  const ledger = usePoll<LedgerResponse>(() => api.ledger(10), 10_000);

  return (
    <div>
      <ViewHeader
        icon={Hammer}
        title="Compute Engine"
        subtitle={`Node ${nodeId} · SHA-256 proof of work, verified independently by the server`}
        actions={
          miner.running ? (
            <Button variant="danger" size="sm" onClick={() => minerController.stop()}>
              <Square className="w-3.5 h-3.5" /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={() => minerController.start()}>
              <Play className="w-3.5 h-3.5" /> Start mining
            </Button>
          )
        }
      />

      <MinerControls />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Measured hashrate" value={formatHashrate(miner.hashrate)} hint="hashes per second, timed locally" tone={miner.running ? 'good' : 'default'} />
        <Stat label="Hashes this block" value={miner.attempts.toLocaleString()} hint={miner.running ? `difficulty ${miner.difficulty}` : 'idle'} />
        <Stat label="Session average" value={formatHashrate(miner.averageHashrate)} hint={`${miner.totalAttempts.toLocaleString()} hashes total`} />
        <Stat
          label="Accepted / rejected"
          value={`${miner.accepted.length} / ${miner.rejected.length}`}
          hint="server verdicts"
          tone={miner.rejected.length > 0 ? 'warn' : 'good'}
        />
      </div>

      {miner.error && (
        <div className="mb-4">
          <Note tone="bad">{miner.error}</Note>
        </div>
      )}

      {!miner.supported && <Note tone="warn">Web Workers are unavailable in this browser, so real mining cannot run here.</Note>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Work accepted by the server" right={<Mono>{miner.blocksMined} block(s)</Mono>}>
          <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
            {miner.accepted.length === 0 && (
              <EmptyState>No blocks accepted yet. Start mining — each solution is hashed again on the server before it counts.</EmptyState>
            )}
            {miner.accepted.map((work) => (
              <div key={work.id} className="rounded border border-emerald-500/20 bg-emerald-500/5 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-emerald-300 font-bold">
                    {work.blockNumber ? `block #${work.blockNumber}` : 'accepted'} · difficulty {work.difficulty}
                  </span>
                  <Mono className="text-zinc-500">{work.attempts.toLocaleString()} hashes · {work.elapsedMs} ms</Mono>
                </div>
                <Mono className="text-[10px] text-emerald-400/80 block mt-1">{work.hash}</Mono>
                {work.merkleRoot && <Mono className="text-[10px] text-zinc-600 block mt-0.5">ledger root {work.merkleRoot.slice(0, 32)}…</Mono>}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Server-side ledger (last 10)">
          <div className="space-y-1.5 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
            {ledger.error && <Note tone="warn">{ledger.error}</Note>}
            {ledger.data?.blocks.length === 0 && <EmptyState>The ledger is empty.</EmptyState>}
            {ledger.data?.blocks.map((block) => (
              <div key={block.id} className="flex items-center gap-2 text-[11px]">
                <span className="text-zinc-500 font-mono w-8">#{block.id}</span>
                <span className="text-zinc-400 font-mono w-10">d{block.difficulty}</span>
                <Mono className="text-emerald-400/80 flex-1 truncate">{block.hash}</Mono>
                <Mono className="text-zinc-600">{block.node_id}</Mono>
              </div>
            ))}
          </div>
          {ledger.data && (
            <div className="mt-3 border-t border-zinc-800 pt-2">
              <Mono className="text-[10px] text-zinc-600 block">merkle root of all verified work</Mono>
              <Mono className="text-[10px] text-emerald-400 break-all">{ledger.data.merkleRoot}</Mono>
            </div>
          )}
        </Panel>
      </div>

      {miner.rejected.length > 0 && (
        <div className="mt-4">
          <Panel title="Rejections">
            <div className="space-y-1">
              {miner.rejected.map((item, index) => (
                <div key={index} className="flex items-start gap-2 text-[11px]">
                  <Ban className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-px" />
                  <span className="text-rose-300">{item.reason}</span>
                  <Mono className="text-zinc-600 ml-auto">{item.at.slice(11, 19)}</Mono>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      <div className="mt-4">
        <Note tone="info">
          Verification path: this browser finds a nonce such that <Mono>SHA-256(header|nonce)</Mono> has
          <strong className="text-emerald-300"> {miner.difficulty} leading zero bits</strong>. The server recomputes the digest with its own
          SHA-256, rejects replays via a <Mono>UNIQUE(header, nonce)</Mono> constraint, and only then writes the block to SQLite.
        </Note>
      </div>
    </div>
  );
}

function MinerControls() {
  const { miner } = useNetwork();

  return (
    <Panel title="Miner" className="mb-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[220px]">
          <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold block mb-1.5">Difficulty (leading zero bits)</label>
          <select
            value={miner.difficulty}
            disabled={miner.running}
            onChange={(event) => minerController.setDifficulty(Number(event.target.value))}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50 disabled:opacity-50"
          >
            {DIFFICULTIES.map((option) => (
              <option key={option.bits} value={option.bits}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={miner.running ? 'danger' : 'primary'}
            onClick={() => (miner.running ? minerController.stop() : minerController.start())}
          >
            {miner.running ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {miner.running ? 'Stop mining' : 'Start mining'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => minerController.reset()}
            disabled={miner.running}
          >
            Reset session
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
        <div className="rounded border border-zinc-800 p-2">
          <Mono className="text-zinc-600 block">current block header</Mono>
          <Mono className={cn('block mt-1', miner.running && 'text-emerald-400')}>{miner.header || '—'}</Mono>
        </div>
        <div className="rounded border border-zinc-800 p-2">
          <Mono className="text-zinc-600 block">status</Mono>
          <span className={cn('text-xs font-bold', miner.running ? 'text-emerald-400' : 'text-zinc-500')}>
            {miner.running ? (miner.submitting ? 'SUBMITTING FOR VERIFICATION' : 'GRINDING') : 'IDLE'}
          </span>
        </div>
        <div className="rounded border border-zinc-800 p-2">
          <Mono className="text-zinc-600 block">elapsed</Mono>
          <span className="text-xs font-mono text-zinc-300">{(miner.elapsedMs / 1000).toFixed(1)} s</span>
        </div>
      </div>
    </Panel>
  );
}
