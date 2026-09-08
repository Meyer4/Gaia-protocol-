/**
 * lib/network.tsx
 *
 * One provider that owns the real network state — server status, the SSE event
 * feed, the USGS sensor feed, local mesh peers and the node heartbeat — so
 * every window in the console reads the same live numbers.
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { api, fetchEarthquakes, type GaiaEvent, type StatusResponse } from './api';
import { useEventStream, useMeshPeers, useNodeId, useNodeHeartbeat, usePoll } from './hooks';
import { miner, useMiner } from './miner';

export interface SensorState {
  features: any[];
  source: 'proxy' | 'direct' | null;
  fetchedAt: string | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

interface NetworkState {
  nodeId: string;
  status: StatusResponse | null;
  statusError: string | null;
  statusLoading: boolean;
  statusUpdatedAt: string | null;
  refreshStatus: () => void;
  events: GaiaEvent[];
  streamConnected: boolean;
  sensors: SensorState;
  peers: { id: string; lastSeen: number }[];
  heartbeatError: string | null;
  liveNodes: number;
  miner: ReturnType<typeof useMiner>;
  clearEvents: () => void;
}

const NetworkContext = createContext<NetworkState | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const nodeId = useNodeId();
  const minerState = useMiner();
  const [events, setEvents] = useState<GaiaEvent[]>([]);

  const status = usePoll(useCallback(() => api.status(), []), 5000, Boolean(nodeId));
  const sensors = usePoll(useCallback(() => fetchEarthquakes(), []), 60_000);
  const peers = useMeshPeers(nodeId);
  const streamConnected = useEventStream(
    useCallback((event: GaiaEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, 200));
    }, []),
    true,
  );
  const heartbeat = useNodeHeartbeat(nodeId, minerState.running ? minerState.hashrate : 0, Boolean(nodeId));

  // The miner reports its real measured hashrate into the heartbeat.
  const minerRef = useRef(minerState);
  minerRef.current = minerState;
  React.useEffect(() => {
    miner.setNodeId(nodeId);
  }, [nodeId]);

  const value = useMemo<NetworkState>(
    () => ({
      nodeId,
      status: status.data,
      statusError: status.error,
      statusLoading: status.loading,
      statusUpdatedAt: status.lastUpdated,
      refreshStatus: status.refresh,
      events,
      streamConnected,
      sensors: {
        features: sensors.data?.features ?? [],
        source: sensors.data?.source ?? null,
        fetchedAt: sensors.data?.fetchedAt ?? null,
        error: sensors.error,
        loading: sensors.loading,
        refresh: sensors.refresh,
      },
      peers,
      heartbeatError: heartbeat.error,
      liveNodes: heartbeat.liveNodes,
      miner: minerState,
      clearEvents: () => setEvents([]),
    }),
    [nodeId, status.data, status.error, status.lastUpdated, status.refresh, events, streamConnected, sensors, peers, heartbeat.error, heartbeat.liveNodes, minerState],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork(): NetworkState {
  const context = useContext(NetworkContext);
  if (!context) throw new Error('useNetwork must be used inside <NetworkProvider>');
  return context;
}
