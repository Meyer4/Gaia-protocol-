import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Globe2, MapPin, RefreshCw } from 'lucide-react';
import { useNetwork } from '@/lib/network';
import { Button, EmptyState, Mono, Note, Panel, Stat, ViewHeader } from './parts';
import { cn } from '@/utils';

const TILE_SOURCES = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    label: 'CARTO dark',
  },
  osm: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    label: 'OpenStreetMap',
  },
} as const;

type TileKey = keyof typeof TILE_SOURCES;

function magnitudeColour(mag: number): string {
  if (mag >= 6) return '#ff3366';
  if (mag >= 5) return '#fb923c';
  if (mag >= 4) return '#facc15';
  if (mag >= 2.5) return '#00ffcc';
  return '#38bdf8';
}

/**
 * Real environmental sensor data: the USGS magnitude feed for the last hour,
 * rendered on a real slippy map. No key is required and nothing is generated.
 */
export function SensorsView() {
  const { sensors } = useNetwork();
  const [selected, setSelected] = useState<any>(null);
  const [filter, setFilter] = useState(0);
  const [tileSource, setTileSource] = useState<TileKey>('dark');

  const visible = useMemo(
    () => sensors.features.filter((f: any) => (f.properties?.mag ?? 0) >= filter),
    [sensors.features, filter],
  );

  const strongest = useMemo(
    () => visible.reduce((max: any, f: any) => (!max || (f.properties?.mag ?? 0) > (max.properties?.mag ?? 0) ? f : max), null),
    [visible],
  );

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const onSelect = useRef(setSelected);
  onSelect.current = setSelected;

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      worldCopyJump: true,
      preferCanvas: true,
      zoomControl: true,
    });

    const source = TILE_SOURCES[tileSource];
    tileRef.current = L.tileLayer(source.url, { attribution: source.attribution, maxZoom: 19, subdomains: 'abcd' }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(mapRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapInstance.current = null;
      layerRef.current = null;
      tileRef.current = null;
    };
    // the map is created once; tile swaps and markers are handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    const source = TILE_SOURCES[tileSource];
    if (tileRef.current) map.removeLayer(tileRef.current);
    tileRef.current = L.tileLayer(source.url, { attribution: source.attribution, maxZoom: 19, subdomains: 'abcd' }).addTo(map);
  }, [tileSource]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();

    for (const feature of visible) {
      const [lng, lat, depth] = feature.geometry?.coordinates ?? [];
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      const mag = feature.properties?.mag ?? 0;

      const marker = L.circleMarker([lat, lng], {
        radius: Math.max(4, Math.min(18, mag * 3)),
        color: magnitudeColour(mag),
        weight: 1.5,
        fillColor: magnitudeColour(mag),
        fillOpacity: 0.35,
      });

      marker.bindPopup(
        `<div style="font-family:monospace;font-size:11px">
           <div style="color:#00ffcc;font-weight:700">M ${mag.toFixed(1)}</div>
           <div>${feature.properties?.place ?? ''}</div>
           <div style="color:#71717a">depth ${typeof depth === 'number' ? depth.toFixed(1) : '—'} km</div>
           <div style="color:#71717a">${new Date(feature.properties?.time ?? 0).toUTCString()}</div>
         </div>`,
      );
      marker.on('click', () => onSelect.current(feature));
      marker.addTo(layer);
    }
  }, [visible]);

  return (
    <div>
      <ViewHeader
        icon={Globe2}
        title="Environmental Sensor Grid"
        subtitle="USGS magnitude feed, last hour — proxied through the node when it can reach it, fetched directly otherwise"
        actions={
          <>
            <select
              value={tileSource}
              onChange={(event) => setTileSource(event.target.value as TileKey)}
              className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-300 outline-none"
            >
              {Object.entries(TILE_SOURCES).map(([key, source]) => (
                <option key={key} value={key}>
                  {source.label}
                </option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={sensors.refresh} disabled={sensors.loading}>
              <RefreshCw className={cn('w-3.5 h-3.5', sensors.loading && 'animate-spin')} /> Refresh
            </Button>
          </>
        }
      />

      {sensors.error && (
        <div className="mb-4">
          <Note tone="warn">
            Sensor feed error: {sensors.error}
            {sensors.features.length > 0 && ' The last successful read is still displayed below.'}
          </Note>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Events (last hour)" value={sensors.features.length} hint={sensors.source ? `via ${sensors.source}` : 'loading'} />
        <Stat label="Shown on map" value={visible.length} hint={`magnitude ≥ ${filter}`} />
        <Stat
          label="Strongest"
          value={strongest ? `M ${strongest.properties?.mag?.toFixed(1)}` : '—'}
          tone={strongest && strongest.properties?.mag >= 5 ? 'warn' : 'default'}
          hint={strongest?.properties?.place ?? ''}
        />
        <Stat
          label="Last read"
          value={sensors.fetchedAt ? new Date(sensors.fetchedAt).toLocaleTimeString() : '—'}
          hint="refreshes every 60 s"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel className="lg:col-span-2" title="Map" right={<Mono>{visible.length} markers</Mono>}>
          <div ref={mapRef} className="h-[420px] w-full rounded-md overflow-hidden border border-zinc-800" />
        </Panel>

        <Panel
          title="Events"
          right={
            <select
              value={filter}
              onChange={(event) => setFilter(Number(event.target.value))}
              className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-300"
            >
              <option value={0}>All magnitudes</option>
              <option value={2.5}>M ≥ 2.5</option>
              <option value={4}>M ≥ 4.0</option>
              <option value={5}>M ≥ 5.0</option>
            </select>
          }
        >
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
            {visible.length === 0 && <EmptyState>No events match this filter.</EmptyState>}
            {visible.map((feature: any) => (
              <button
                key={feature.id}
                onClick={() => setSelected(feature)}
                className={cn(
                  'w-full text-left rounded border px-2 py-1.5 transition-colors',
                  selected?.id === feature.id ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/60',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold" style={{ color: magnitudeColour(feature.properties?.mag ?? 0) }}>
                    M {feature.properties?.mag?.toFixed(1) ?? '—'}
                  </span>
                  <Mono className="text-zinc-600">{new Date(feature.properties?.time ?? 0).toISOString().slice(11, 16)}Z</Mono>
                </div>
                <div className="text-[11px] text-zinc-400 truncate">{feature.properties?.place ?? 'unknown'}</div>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {selected && (
        <div className="mt-4">
          <Panel title="Event detail">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <Detail label="Magnitude" value={`${selected.properties?.mag ?? '—'} (${selected.properties?.magType ?? '—'})`} />
              <Detail label="Place" value={selected.properties?.place ?? '—'} />
              <Detail label="Depth" value={`${selected.geometry?.coordinates?.[2] ?? '—'} km`} />
              <Detail label="Time (UTC)" value={new Date(selected.properties?.time ?? 0).toUTCString()} />
              <Detail label="Coordinates" value={`${selected.geometry?.coordinates?.[1]?.toFixed(4)}, ${selected.geometry?.coordinates?.[0]?.toFixed(4)}`} />
              <Detail label="Felt reports" value={String(selected.properties?.felt ?? 0)} />
              <Detail label="Alert level" value={selected.properties?.alert ?? 'none'} />
              <Detail label="Tsunami" value={selected.properties?.tsunami ? 'flagged' : 'no'} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <a
                href={selected.properties?.url ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                <MapPin className="w-3.5 h-3.5" /> Open the USGS event page
              </a>
              <Mono className="text-zinc-600">id {selected.id}</Mono>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-800 p-2">
      <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">{label}</div>
      <div className="text-zinc-200 mt-0.5 break-words">{value}</div>
    </div>
  );
}
