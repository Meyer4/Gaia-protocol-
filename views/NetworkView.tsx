import { useEffect, useMemo, useRef } from 'react';
import createGlobe from 'cobe';
import { Network as NetworkIcon, Radio, Server, Users } from 'lucide-react';
import { useNetwork } from '@/lib/network';
import { formatHashrate, relativeTime } from '@/lib/hooks';
import { EmptyState, Mono, Note, Panel, Stat, ViewHeader } from './parts';

/**
 * The globe plots real coordinates from the USGS feed — no hard-coded pins.
 * The node list is the server's real heartbeat registry, and the peer list is
 * real BroadcastChannel discovery between Gaia tabs on this machine.
 */
export function NetworkView() {
  const { sensors, status, peers, nodeId, liveNodes } = useNetwork();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markersRef = useRef<{ location: [number, number]; size: number }[]>([]);

  const markers = useMemo(() => {
    return sensors.features
      .map((feature: any) => {
        const [lng, lat] = feature.geometry?.coordinates ?? [];
        const mag = feature.properties?.mag ?? 0;
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        return { location: [lat, lng] as [number, number], size: Math.min(0.12, 0.02 + mag * 0.012) };
      })
      .filter(Boolean)
      .slice(0, 60) as { location: [number, number]; size: number }[];
  }, [sensors.features]);

  markersRef.current = markers;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let phi = 0;
    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: 520,
      height: 520,
      phi: 0,
      theta: 0,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 18000,
      mapBrightness: 5,
      baseColor: [0.12, 0.12, 0.14],
      markerColor: [0, 1, 0.8],
      glowColor: [0.03, 0.12, 0.12],
      markers: [],
      onRender: (state: any) => {
        state.phi = phi;
        phi += 0.0035;
        state.markers = markersRef.current;
      },
    } as any);

    return () => globe.destroy();
  }, []);

  const nodes = status?.network.nodes ?? [];

  return (
    <div>
      <ViewHeader
        icon={NetworkIcon}
        title="Network Topology"
        subtitle={`${liveNodes} node(s) heartbeating · ${peers.length} local mesh peer(s) · ${markers.length} live sensor coordinates`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Registered nodes" value={liveNodes} hint="heartbeat every 10 s, 30 s TTL" tone="good" />
        <Stat label="Local mesh peers" value={peers.length} hint="BroadcastChannel between tabs" />
        <Stat label="Aggregate hashrate" value={formatHashrate(status?.network.aggregateHashrate ?? 0)} hint="sum of reported rates" />
        <Stat label="Feed watchers" value={status?.network.sseClients ?? 0} hint="open SSE connections" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Global sensor coordinates">
          <div className="flex justify-center">
            <canvas ref={canvasRef} className="w-[260px] h-[260px]" />
          </div>
          <Mono className="text-zinc-600 block text-center mt-2">
            {markers.length > 0 ? `${markers.length} real epicentres from the USGS hour feed` : 'waiting for the sensor feed'}
          </Mono>
        </Panel>

        <div className="space-y-4">
          <Panel title="Node registry (server-side)">
            <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
              {nodes.length === 0 && <EmptyState>No nodes are heartbeating right now.</EmptyState>}
              {nodes.map((node) => (
                <div
                  key={node.id}
                  className="flex items-center justify-between gap-3 rounded border border-zinc-800 px-2 py-1.5 bg-zinc-950/60"
                >
                  <div className="flex items-center gap-2">
                    <Server className={`w-3.5 h-3.5 ${node.id === nodeId ? 'text-emerald-400' : 'text-zinc-600'}`} />
                    <Mono className="text-zinc-300">{node.id}</Mono>
                    {node.id === nodeId && <span className="text-[9px] uppercase tracking-widest text-emerald-500">you</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Mono className="text-emerald-400">{formatHashrate(node.reportedHashrate)}</Mono>
                    <Mono className="text-zinc-600">{node.blocksAccepted} blocks</Mono>
                    <Mono className="text-zinc-600">{relativeTime(node.lastSeen)}</Mono>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Local mesh peers">
            <div className="space-y-2">
              {peers.length === 0 && (
                <EmptyState>
                  Open this console in a second tab to see a real peer appear — discovery uses BroadcastChannel between browser contexts.
                </EmptyState>
              )}
              {peers.map((peer) => (
                <div key={peer.id} className="flex items-center justify-between rounded border border-zinc-800 px-2 py-1.5 bg-zinc-950/60">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-sky-400" />
                    <Mono className="text-zinc-300">{peer.id}</Mono>
                  </div>
                  <Mono className="text-zinc-600">{relativeTime(peer.lastSeen)}</Mono>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-4">
        <Note tone="info">
          <Radio className="inline w-3.5 h-3.5 mr-1" />
          What is real here: the registry above is populated by HTTP heartbeats your browser sends every 10 seconds, and entries expire
          after 30 seconds without one. Mesh peers are discovered through genuine <Mono>BroadcastChannel</Mono> messaging, so it shows
          Gaia tabs on <em>this</em> machine — not a fabricated worldwide peer count.
        </Note>
      </div>
    </div>
  );
}
