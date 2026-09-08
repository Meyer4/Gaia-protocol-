import { useEffect, useState } from 'react';
import { Activity, Cpu, Database, HardDrive, Network as NetworkIcon, Radio, ShieldCheck, Zap } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNetwork } from '@/lib/network';
import { formatHashrate, relativeTime } from '@/lib/hooks';
import { Button, EmptyState, Mono, Note, Panel, RefreshButton, Stat, ViewHeader } from './parts';

/**
 * Real overview: host telemetry, the live node registry, the verified work
 * ledger and the event stream. Every figure comes from /api/status or from
 * measurements taken in this browser.
 */
export function DashboardView() {
  const { status, statusError, statusLoading, statusUpdatedAt, refreshStatus, events, streamConnected, sensors, peers, miner, nodeId } = useNetwork();
  const [series, setSeries] = useState<{ at: string; hashrate: number; blocks: number }[]>([]);

  useEffect(() => {
    setSeries((prev) =>
      [
        ...prev,
        {
          at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          hashrate: status?.network.aggregateHashrate ?? 0,
          blocks: status?.ledger.blocks ?? 0,
        },
      ].slice(-30),
    );
  }, [status?.generatedAt]);

  const host = status?.host;

  return (
    <div>
      <ViewHeader
        icon={Activity}
        title="Node Overview"
        subtitle={status ? `Host ${host?.hostname} · node ${nodeId} · updated ${relativeTime(statusUpdatedAt ?? status.generatedAt)}` : 'Waiting for the first status read…'}
        actions={<RefreshButton onClick={refreshStatus} busy={statusLoading} />}
      />

      {statusError && (
        <div className="mb-4">
          <Note tone="bad">The node could not be reached: {statusError}</Note>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat
          label="Local hashrate"
          value={formatHashrate(miner.hashrate)}
          hint={miner.running ? `mining at difficulty ${miner.difficulty}` : 'miner idle'}
          tone={miner.running ? 'good' : 'default'}
        />
        <Stat label="Blocks you verified" value={miner.blocksMined} hint={`${miner.accepted.length} accepted this session`} tone="good" />
        <Stat
          label="Network nodes"
          value={status?.network.liveNodes ?? '—'}
          hint={`${peers.length} local mesh peer(s), ${status?.network.sseClients ?? 0} feed watchers`}
        />
        <Stat label="Ledger blocks" value={status?.ledger.blocks ?? '—'} hint={`${status?.ledger.contributors ?? 0} contributor(s)`} />
        <Stat label="CPU" value={host?.cpuPercent != null ? `${host.cpuPercent}%` : '—'} hint={`load ${host?.loadAverage.join(' / ') ?? '—'}`} />
        <Stat
          label="Memory"
          value={`${host?.usedMemoryGB ?? '—'} GB`}
          hint={`${host?.memoryUsedPercent ?? '—'}% of ${host?.totalMemoryGB ?? '—'} GB`}
        />
        <Stat
          label="Disk"
          value={`${host?.disk?.usedPercent ?? '—'}%`}
          hint={`${host?.disk?.availableGB ?? '—'} GB free of ${host?.disk?.totalGB ?? '—'} GB`}
        />
        <Stat
          label="ZK proofs"
          value={`${status?.zkp.valid ?? '—'}`}
          hint={`${status?.zkp.rejected ?? 0} rejected`}
          tone={status && status.zkp.rejected > 0 ? 'warn' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel
          title="Aggregate network hashrate (H/s)"
          className="lg:col-span-2"
          right={<Mono>{formatHashrate(status?.network.aggregateHashrate ?? 0)}</Mono>}
        >
          <div className="h-[200px]">
            {series.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="hashrateFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00ffcc" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#00ffcc" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="at" tick={{ fill: '#52525b', fontSize: 10 }} minTickGap={40} />
                  <YAxis tick={{ fill: '#52525b', fontSize: 10 }} width={70} tickFormatter={(v) => formatHashrate(Number(v))} />
                  <Tooltip
                    contentStyle={{ background: '#0a0a0c', border: '1px solid #27272a', fontSize: 11 }}
                    labelStyle={{ color: '#a1a1aa' }}
                    formatter={(value: any) => [formatHashrate(Number(value)), 'hashrate']}
                  />
                  <Area type="monotone" dataKey="hashrate" stroke="#00ffcc" fill="url(#hashrateFill)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState>Collecting real samples… the chart plots one point every five seconds.</EmptyState>
            )}
          </div>
        </Panel>

        <Panel
          title="Live event stream"
          right={
            <span className={`text-[10px] font-mono ${streamConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
              {streamConnected ? 'SSE connected' : 'SSE offline'}
            </span>
          }
        >
          <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
            {events.length === 0 && <EmptyState>No events yet.</EmptyState>}
            {events.slice(0, 30).map((event, index) => (
              <div key={`${event.at}-${index}`} className="border-l-2 pl-2 py-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      event.severity === 'error'
                        ? 'bg-rose-500'
                        : event.severity === 'warn'
                          ? 'bg-amber-400'
                          : event.severity === 'success'
                            ? 'bg-emerald-400'
                            : 'bg-zinc-600'
                    }`}
                  />
                  <Mono className="text-zinc-600">{event.at.slice(11, 19)}</Mono>
                  <Mono className="text-zinc-500">{event.type}</Mono>
                </div>
                <div className="text-[11px] text-zinc-400 leading-snug">{event.message}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Panel title="Verified work ledger" right={<Mono>merkle {status?.ledger.merkleRoot.slice(0, 16) ?? '—'}…</Mono>}>
          <dl className="space-y-2 text-xs">
            <Row icon={ShieldCheck} label="Blocks verified by the server" value={String(status?.ledger.blocks ?? '—')} />
            <Row icon={Zap} label="Hashes ground and checked" value={(status?.ledger.attempts ?? 0).toLocaleString()} />
            <Row icon={Cpu} label="Highest difficulty accepted" value={String(status?.ledger.maxDifficulty ?? '—')} />
            <Row icon={Database} label="Storage engine" value={status?.database.engine ?? '—'} />
          </dl>
          <div className="mt-3">
            <Mono className="text-[10px] text-zinc-600">merkle root</Mono>
            <div className="mt-1 rounded bg-black/50 border border-zinc-800 p-2">
              <Mono className="text-[10px] text-emerald-400">{status?.ledger.merkleRoot ?? '—'}</Mono>
            </div>
          </div>
        </Panel>

        <Panel title="Host & runtime">
          <dl className="space-y-2 text-xs">
            <Row icon={Cpu} label="CPU" value={host ? `${host.cpuModel} (${host.cpuCores} cores)` : '—'} />
            <Row icon={HardDrive} label="Kernel" value={host ? `${host.platform}/${host.arch} ${host.release}` : '—'} />
            <Row icon={NetworkIcon} label="Node.js" value={host?.nodeVersion ?? '—'} />
            <Row
              icon={Radio}
              label="Throughput"
              value={
                status?.host.throughput
                  ? `↓ ${status.host.throughput.rxKBs} KB/s · ↑ ${status.host.throughput.txKBs} KB/s`
                  : 'measuring…'
              }
            />
            <Row icon={Database} label="Database file" value={status?.database.path ?? '—'} />
            <Row icon={Activity} label="Server uptime" value={`${status?.serverUptimeSeconds ?? 0}s`} />
          </dl>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" size="sm" onClick={refreshStatus}>
              Re-read host metrics
            </Button>
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Seismic sensor feed" right={<Mono>{sensors.source ? `${sensors.source} · ${sensors.features.length} events` : 'loading…'}</Mono>}>
          {sensors.error ? (
            <Note tone="warn">{sensors.error}</Note>
          ) : (
            <div className="space-y-1 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
              {sensors.features.slice(0, 12).map((feature: any) => (
                <div key={feature.id} className="flex items-center justify-between gap-4 text-[11px]">
                  <span className="text-zinc-400 truncate">{feature.properties?.place ?? 'unknown location'}</span>
                  <span className="font-mono text-emerald-400 shrink-0">M {feature.properties?.mag?.toFixed(1) ?? '—'}</span>
                  <Mono className="text-zinc-600 shrink-0">{new Date(feature.properties?.time).toISOString().slice(11, 19)}</Mono>
                </div>
              ))}
              {sensors.features.length === 0 && !sensors.loading && <EmptyState>The feed returned no earthquakes in the last hour.</EmptyState>}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="flex items-center gap-2 text-zinc-500 shrink-0">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </dt>
      <dd className="text-zinc-300 text-right font-mono break-all">{value}</dd>
    </div>
  );
}
