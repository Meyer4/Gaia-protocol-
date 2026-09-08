import { Activity, Cpu, Gauge, HardDrive, MemoryStick, RefreshCw, ServerCog } from 'lucide-react';
import { useNetwork } from '@/lib/network';
import { usePoll, relativeTime } from '@/lib/hooks';
import { api, type ProcessInfo } from '@/lib/api';
import { Button, EmptyState, Mono, Note, Panel, Stat, ViewHeader } from './parts';
import { cn } from '@/utils';

function Bar({ percent, tone = 'emerald' }: { percent: number; tone?: 'emerald' | 'amber' | 'rose' }) {
  const colour = percent > 90 ? 'bg-rose-500' : percent > 70 ? 'bg-amber-400' : tone === 'emerald' ? 'bg-emerald-400' : 'bg-amber-400';
  return (
    <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
      <div className={cn('h-full transition-all duration-500', colour)} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

/**
 * Real kernel telemetry: CPU utilisation measured from two /proc/stat reads,
 * memory from the kernel, disk from statfs, and a process table read straight
 * out of /proc — no `ps` binary, no shell, no invented numbers.
 */
export function SystemMonitorView() {
  const { status, refreshStatus } = useNetwork();
  const processes = usePoll<{ processes: ProcessInfo[]; available: boolean }>(() => api.processes(25), 5000);

  const host = status?.host;

  return (
    <div>
      <ViewHeader
        icon={Activity}
        title="System Monitor"
        subtitle={host ? `${host.hostname} · ${host.platform}/${host.arch} · kernel ${host.release}` : 'Reading host metrics…'}
        actions={
          <Button variant="ghost" size="sm" onClick={() => { refreshStatus(); processes.refresh(); }}>
            <RefreshCw className="w-3.5 h-3.5" /> Re-read
          </Button>
        }
      />

      {!processes.data?.available && (
        <div className="mb-4">
          <Note tone="warn">
            /proc is not available on this host ({host?.platform ?? 'unknown platform'}), so the process table is empty. Nothing is
            substituted for it.
          </Note>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat
          label="CPU utilisation"
          value={host?.cpuPercent != null ? `${host.cpuPercent}%` : '—'}
          hint={`${host?.cpuCores ?? '—'} cores · load ${host?.loadAverage.join(' / ') ?? '—'}`}
          tone={host && host.cpuPercent != null && host.cpuPercent > 85 ? 'warn' : 'default'}
        />
        <Stat
          label="Memory"
          value={`${host?.usedMemoryGB ?? '—'} GB`}
          hint={`${host?.memoryUsedPercent ?? '—'}% of ${host?.totalMemoryGB ?? '—'} GB`}
        />
        <Stat
          label="Disk used"
          value={`${host?.disk?.usedPercent ?? '—'}%`}
          hint={`${host?.disk?.availableGB ?? '—'} GB available of ${host?.disk?.totalGB ?? '—'} GB`}
        />
        <Stat
          label="Host uptime"
          value={host ? formatDuration(host.hostUptimeSeconds) : '—'}
          hint={`server process ${formatDuration(status?.serverUptimeSeconds ?? 0)}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="CPU" className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-3">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <div className="flex-1">
              <div className="flex justify-between text-[11px] text-zinc-500 mb-1">
                <span>{host?.cpuModel ?? 'reading /proc/stat…'}</span>
                <Mono>{host?.cpuPercent != null ? `${host.cpuPercent}%` : '—'}</Mono>
              </div>
              <Bar percent={host?.cpuPercent ?? 0} />
            </div>
          </div>

          {host?.perCorePercent && host.perCorePercent.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {host.perCorePercent.map((percent: number, index: number) => (
                <div key={index}>
                  <div className="flex justify-between text-[10px] text-zinc-600 mb-0.5">
                    <span>core {index}</span>
                    <Mono>{percent}%</Mono>
                  </div>
                  <Bar percent={percent} />
                </div>
              ))}
            </div>
          ) : (
            <Mono className="text-zinc-600">per-core breakdown not included in this snapshot</Mono>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded border border-zinc-800 p-2">
              <Mono className="text-zinc-600 block">memory</Mono>
              <div className="flex items-center gap-2 mt-1">
                <MemoryStick className="w-4 h-4 text-sky-400" />
                <Mono className="text-zinc-300">
                  {host?.usedMemoryGB ?? '—'} / {host?.totalMemoryGB ?? '—'} GB ({host?.freeMemoryGB ?? '—'} GB free)
                </Mono>
              </div>
              <div className="mt-2">
                <Bar percent={host?.memoryUsedPercent ?? 0} />
              </div>
            </div>
            <div className="rounded border border-zinc-800 p-2">
              <Mono className="text-zinc-600 block">disk</Mono>
              <div className="flex items-center gap-2 mt-1">
                <HardDrive className="w-4 h-4 text-amber-400" />
                <Mono className="text-zinc-300">
                  {host?.disk?.usedGB ?? '—'} / {host?.disk?.totalGB ?? '—'} GB
                </Mono>
              </div>
              <div className="mt-2">
                <Bar percent={host?.disk?.usedPercent ?? 0} />
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Interfaces & throughput">
          <div className="space-y-3">
            {host?.throughput ? (
              <div className="flex items-center gap-3 rounded border border-zinc-800 p-2">
                <Gauge className="w-4 h-4 text-emerald-400" />
                <div className="text-[11px]">
                  <div className="text-zinc-400">
                    ↓ {host.throughput.rxKBs} KB/s · ↑ {host.throughput.txKBs} KB/s
                  </div>
                  <Mono className="text-zinc-600">measured over {host.throughput.windowMs} ms from kernel counters</Mono>
                </div>
              </div>
            ) : (
              <Mono className="text-zinc-600">throughput needs two reads — it appears on the next poll</Mono>
            )}

            {host?.network.map((iface) => (
              <div key={iface.name} className="rounded border border-zinc-800 p-2">
                <div className="flex items-center justify-between">
                  <Mono className="text-zinc-300">{iface.name}</Mono>
                  <Mono className="text-zinc-600">
                    {iface.rxBytes != null ? `rx ${formatGB(iface.rxBytes)} · tx ${formatGB(iface.txBytes ?? 0)}` : 'no kernel counters'}
                  </Mono>
                </div>
                <div className="mt-1 space-y-0.5">
                  {iface.addresses.map((address, index) => (
                    <Mono key={index} className="text-zinc-500 block">
                      {address.family} {address.address}
                      {address.internal ? ' (internal)' : ''}
                    </Mono>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel
          title="Process table (from /proc)"
          right={
            <div className="flex items-center gap-2">
              <Mono className="text-zinc-600">{processes.lastUpdated ? relativeTime(processes.lastUpdated) : '—'}</Mono>
              <RefreshCw className={cn('w-3 h-3 text-zinc-600', processes.loading && 'animate-spin')} />
            </div>
          }
        >
          {processes.error && <Note tone="warn">{processes.error}</Note>}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="text-zinc-600 text-left border-b border-zinc-800">
                  <th className="py-1 pr-3 font-bold">PID</th>
                  <th className="py-1 pr-3 font-bold">RSS</th>
                  <th className="py-1 pr-3 font-bold">CPU%</th>
                  <th className="py-1 pr-3 font-bold">S</th>
                  <th className="py-1 font-bold">COMMAND</th>
                </tr>
              </thead>
              <tbody>
                {processes.data?.processes.map((process) => (
                  <tr key={process.pid} className="border-b border-zinc-900 hover:bg-white/[0.02]">
                    <td className="py-1 pr-3 text-zinc-500">{process.pid}</td>
                    <td className="py-1 pr-3 text-zinc-400">{process.rssMB != null ? `${process.rssMB} MB` : '—'}</td>
                    <td className="py-1 pr-3 text-zinc-400">{process.cpuPercent ?? '—'}</td>
                    <td className="py-1 pr-3 text-emerald-400">{process.state}</td>
                    <td className="py-1 text-zinc-300 truncate max-w-[420px]">{process.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {processes.data?.processes.length === 0 && <EmptyState>No processes could be read from /proc on this platform.</EmptyState>}
          </div>
          <div className="mt-2 flex items-center gap-2 text-zinc-600">
            <ServerCog className="w-3.5 h-3.5" />
            <Mono>pid {host?.pid ?? '—'} · user {host?.user ?? '—'} · cwd {host?.cwd ?? '—'}</Mono>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function formatGB(bytes: number) {
  if (bytes > 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes > 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDuration(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [d ? `${d}d` : '', h ? `${h}h` : '', m ? `${m}m` : '', `${s}s`].filter(Boolean).join(' ');
}
