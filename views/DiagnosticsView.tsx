import { useCallback, useState } from 'react';
import { Radio, RefreshCw, Wifi } from 'lucide-react';
import { useNetwork } from '@/lib/network';
import { Button, EmptyState, Mono, Note, Panel, Stat, ViewHeader } from './parts';
import { cn } from '@/utils';

/**
 * Real network diagnostics. Each probe is an actual fetch from this browser,
 * and the phase timings (DNS lookup, TCP connect, TLS, time-to-first-byte) are
 * read back from the Resource Timing API — the browser's own measurements.
 *
 * This replaces the previous "nmap" panel, which shelled out to a scanner on
 * the server against arbitrary targets: that was both unusable in a sandbox and
 * an open invitation to abuse someone else's bandwidth.
 */

interface ProbeTarget {
  id: string;
  label: string;
  url: string;
  purpose: string;
}

const TARGETS: ProbeTarget[] = [
  { id: 'self', label: 'This node', url: '/api/health', purpose: 'Round-trip to the Gaia server through the same origin' },
  { id: 'usgs', label: 'USGS seismic feed', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson', purpose: 'Sensor data source' },
  { id: 'tiles', label: 'Map tiles (CARTO)', url: 'https://a.basemaps.cartocdn.com/dark_all/2/1/1.png', purpose: 'Basemap tiles for the sensor grid' },
  { id: 'gemini', label: 'Gemini API host', url: 'https://generativelanguage.googleapis.com/', purpose: 'AI provider reachability' },
  { id: 'github', label: 'GitHub API', url: 'https://api.github.com/', purpose: 'General egress check' },
];

interface ProbeResult {
  target: ProbeTarget;
  ok: boolean;
  status: number | null;
  totalMs: number;
  dnsMs: number | null;
  connectMs: number | null;
  tlsMs: number | null;
  ttfbMs: number | null;
  bytes: number | null;
  error: string | null;
  at: string;
}

export function DiagnosticsView() {
  const { status } = useNetwork();
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [running, setRunning] = useState(false);

  const probe = useCallback(async (target: ProbeTarget): Promise<ProbeResult> => {
    const absolute = new URL(target.url, window.location.origin).href;
    performance.clearResourceTimings?.();
    const started = performance.now();

    try {
      const response = await fetch(absolute, { cache: 'no-store', mode: target.id === 'self' ? 'same-origin' : 'cors' });
      const totalMs = performance.now() - started;
      const entry = performance.getEntriesByName(absolute).pop() as PerformanceResourceTiming | undefined;

      return {
        target,
        ok: response.ok,
        status: response.status,
        totalMs,
        dnsMs: entry && entry.domainLookupEnd > entry.domainLookupStart ? entry.domainLookupEnd - entry.domainLookupStart : null,
        connectMs: entry && entry.connectEnd > entry.connectStart ? entry.connectEnd - entry.connectStart : null,
        tlsMs: entry && entry.secureConnectionStart > 0 ? entry.connectEnd - entry.secureConnectionStart : null,
        ttfbMs: entry && entry.responseStart > entry.requestStart ? entry.responseStart - entry.requestStart : null,
        bytes: entry?.encodedBodySize ?? null,
        error: null,
        at: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        target,
        ok: false,
        status: null,
        totalMs: performance.now() - started,
        dnsMs: null,
        connectMs: null,
        tlsMs: null,
        ttfbMs: null,
        bytes: null,
        error: error?.message ?? String(error),
        at: new Date().toISOString(),
      };
    }
  }, []);

  const runAll = async () => {
    setRunning(true);
    const next: ProbeResult[] = [];
    for (const target of TARGETS) {
      next.push(await probe(target));
      setResults([...next]);
    }
    setRunning(false);
  };

  const reachable = results.filter((r) => r.ok).length;
  const median = results.length
    ? [...results].filter((r) => r.ok).sort((a, b) => a.totalMs - b.totalMs)[Math.floor(results.filter((r) => r.ok).length / 2)]?.totalMs
    : null;

  return (
    <div>
      <ViewHeader
        icon={Radio}
        title="Network Diagnostics"
        subtitle="Live reachability and latency probes measured in this browser against the services Gaia actually depends on"
        actions={
          <Button size="sm" onClick={runAll} disabled={running}>
            <RefreshCw className={cn('w-4 h-4', running && 'animate-spin')} /> {running ? 'Probing…' : 'Run all probes'}
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Reachable" value={`${reachable} / ${TARGETS.length}`} tone={reachable === TARGETS.length ? 'good' : reachable === 0 ? 'bad' : 'warn'} />
        <Stat label="Median round-trip" value={median != null ? `${median.toFixed(0)} ms` : '—'} hint="successful probes only" />
        <Stat label="Local interface" value={status?.host.network.find((n) => !n.addresses.some((a) => a.internal))?.name ?? '—'} hint="as seen by the node" />
        <Stat
          label="Node egress"
          value={status?.host.throughput ? `${status.host.throughput.txKBs} KB/s` : '—'}
          hint="kernel tx counter delta"
        />
      </div>

      <div className="mb-4">
        <Note tone="info">
          Probes run from <strong>your browser</strong>, not from the server, so they describe the path a real client takes. Cross-origin
          probes need CORS to expose timing detail — when a host does not, the browser still reports the HTTP status and total time, and
          the phase columns stay empty rather than guessed.
        </Note>
      </div>

      <Panel title="Probe results">
        {results.length === 0 && <EmptyState>No probes run yet.</EmptyState>}
        <div className="space-y-2">
          {results.map((result) => (
            <div
              key={result.target.id}
              className={cn(
                'rounded border p-3',
                result.ok ? 'border-emerald-500/25 bg-emerald-500/[0.04]' : 'border-rose-500/25 bg-rose-500/[0.04]',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wifi className={cn('w-4 h-4', result.ok ? 'text-emerald-400' : 'text-rose-400')} />
                  <span className="text-sm font-bold text-zinc-200">{result.target.label}</span>
                  <Mono className="text-zinc-600">{result.target.url}</Mono>
                </div>
                <div className="flex items-center gap-3">
                  <Mono className={result.ok ? 'text-emerald-400' : 'text-rose-400'}>
                    {result.status != null ? `HTTP ${result.status}` : result.error ? 'FAILED' : 'UNKNOWN'}
                  </Mono>
                  <Mono className="text-zinc-300">{result.totalMs.toFixed(0)} ms</Mono>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-[10px]">
                <Phase label="DNS" value={result.dnsMs} />
                <Phase label="TCP connect" value={result.connectMs} />
                <Phase label="TLS" value={result.tlsMs} />
                <Phase label="TTFB" value={result.ttfbMs} />
                <Phase label="Body" value={result.bytes != null ? result.bytes / 1024 : null} unit="KB" />
              </div>

              {result.error && <Mono className="text-rose-300 block mt-2">{result.error}</Mono>}
              <Mono className="text-zinc-600 block mt-1">{result.target.purpose}</Mono>
            </div>
          ))}
        </div>
      </Panel>

      {status && (
        <div className="mt-4">
          <Panel title="Server-side interfaces (read by the node)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {status.host.network.map((iface) => (
                <div key={iface.name} className="rounded border border-zinc-800 p-2">
                  <div className="flex justify-between">
                    <Mono className="text-zinc-300">{iface.name}</Mono>
                    <Mono className="text-zinc-600">
                      {iface.rxBytes != null ? `rx ${Math.round((iface.rxBytes / 1024 ** 2) * 10) / 10} MB` : 'no counters'}
                    </Mono>
                  </div>
                  {iface.addresses.map((address, index) => (
                    <Mono key={index} className="text-zinc-500 block">
                      {address.address} ({address.family})
                    </Mono>
                  ))}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

function Phase({ label, value, unit = 'ms' }: { label: string; value: number | null; unit?: string }) {
  return (
    <div className="rounded bg-black/40 border border-zinc-800 px-2 py-1">
      <div className="text-zinc-600 uppercase tracking-wider">{label}</div>
      <div className={cn('font-mono', value != null ? 'text-zinc-300' : 'text-zinc-700')}>
        {value != null ? `${value.toFixed(value < 10 ? 1 : 0)} ${unit}` : 'n/a'}
      </div>
    </div>
  );
}
