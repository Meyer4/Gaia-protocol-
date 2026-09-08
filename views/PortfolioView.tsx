import { Github, Mail, UserRound } from 'lucide-react';
import { useNetwork } from '@/lib/network';
import { formatHashrate } from '@/lib/hooks';
import type { Settings } from '@/lib/hooks';
import { Mono, Panel, Stat, ViewHeader } from './parts';

export function PortfolioView({ settings }: { settings: Settings }) {
  const { status, miner, nodeId } = useNetwork();

  return (
    <div>
      <ViewHeader icon={UserRound} title={settings.userName} subtitle={settings.jobTitle} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Profile">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-24 h-24 rounded-full bg-zinc-950 border-2 border-emerald-500/30 flex items-center justify-center">
              <UserRound className="w-12 h-12 text-emerald-500/60" />
            </div>
            <div>
              <div className="text-lg font-bold text-zinc-100">{settings.userName}</div>
              <div className="text-xs text-emerald-400">{settings.jobTitle}</div>
            </div>
            <div className="space-y-1.5 w-full">
              <a
                href="https://github.com/Meyer4"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-zinc-800 text-xs text-zinc-300 hover:border-emerald-500/40 transition-colors"
              >
                <Github className="w-4 h-4" /> github.com/Meyer4
              </a>
              <a
                href="mailto:gmeya2041@gmail.com"
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-zinc-800 text-xs text-zinc-300 hover:border-emerald-500/40 transition-colors"
              >
                <Mail className="w-4 h-4" /> gmeya2041@gmail.com
              </a>
            </div>
            {(settings.userPhone1 || settings.userPhone2) && (
              <div className="text-[11px] text-zinc-500 font-mono">
                {[settings.userPhone1, settings.userPhone2].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        </Panel>

        <Panel title="This node, live" className="lg:col-span-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Your node id" value={nodeId.slice(0, 8) || '—'} hint="stable per browser" />
            <Stat label="Your hashrate" value={formatHashrate(miner.hashrate)} hint={miner.running ? 'mining now' : 'idle'} />
            <Stat label="Blocks you verified" value={miner.blocksMined} hint="accepted by the server" />
            <Stat label="Network blocks" value={status?.ledger.blocks ?? '—'} hint={`${status?.ledger.contributors ?? 0} contributor(s)`} />
          </div>

          <div className="mt-4 space-y-2 text-xs text-zinc-400 leading-relaxed">
            <p>
              Gaia Protocol is a node console for a decentralised compute network. This deployment is the working MVP: real proof of work
              verified server-side, real Schnorr zero-knowledge identity proofs, real host telemetry, the live USGS seismic feed, a real
              file browser and a shell-free console.
            </p>
            <p>
              Stack: React 19, TypeScript, Vite, Tailwind, Express and the SQLite engine built into Node.js. The cryptography is shared
              between browser and server from a single module and covered by <Mono>npm test</Mono>.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
