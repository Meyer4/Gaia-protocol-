/**
 * lib/miner.ts
 *
 * A singleton controller for the real proof-of-work miner. It owns the worker,
 * measures actual throughput, submits each solution to the server for
 * independent verification and publishes the result. Views subscribe to it
 * with `useSyncExternalStore`, so the miner keeps running when its window is
 * closed and every view agrees on the same numbers.
 */
import { useSyncExternalStore } from 'react';
import { api } from './api';

export interface AcceptedWork {
  id: string;
  hash: string;
  difficulty: number;
  leadingZeros: number;
  attempts: number;
  elapsedMs: number;
  hashrate: number;
  blockNumber?: number;
  merkleRoot?: string;
  acceptedAt: string;
}

export interface RejectedWork {
  reason: string;
  hash: string;
  at: string;
}

export interface MinerState {
  running: boolean;
  supported: boolean;
  difficulty: number;
  header: string;
  attempts: number;
  hashrate: number;
  elapsedMs: number;
  blocksMined: number;
  totalAttempts: number;
  averageHashrate: number;
  accepted: AcceptedWork[];
  rejected: RejectedWork[];
  submitting: boolean;
  error: string | null;
  startedAt: string | null;
}

const initialState: MinerState = {
  running: false,
  supported: typeof Worker !== 'undefined',
  difficulty: 18,
  header: '',
  attempts: 0,
  hashrate: 0,
  elapsedMs: 0,
  blocksMined: 0,
  totalAttempts: 0,
  averageHashrate: 0,
  accepted: [],
  rejected: [],
  submitting: false,
  error: null,
  startedAt: null,
};

class MinerController {
  private state: MinerState = initialState;
  private listeners = new Set<() => void>();
  private worker: Worker | null = null;
  private sessionStartedAt = 0;
  private nodeId = 'anonymous';

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private set(patch: Partial<MinerState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  setNodeId(nodeId: string) {
    if (nodeId) this.nodeId = nodeId;
  }

  setDifficulty(difficulty: number) {
    this.set({ difficulty });
  }

  start(difficulty: number = this.state.difficulty) {
    if (this.state.running) return;
    if (!this.state.supported) {
      this.set({ error: 'This browser cannot run the miner: Web Workers are unavailable.' });
      return;
    }

    const header = `gaia:${this.nodeId}:${Date.now()}:${Math.floor(crypto.getRandomValues(new Uint32Array(1))[0]).toString(16)}`;
    this.sessionStartedAt = Date.now();
    this.set({
      running: true,
      difficulty,
      header,
      attempts: 0,
      hashrate: 0,
      elapsedMs: 0,
      error: null,
      startedAt: new Date().toISOString(),
    });

    this.worker = new Worker(new URL('../workers/miner.worker.ts', import.meta.url), { type: 'module' });

    this.worker.onmessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === 'progress') {
        this.set({
          attempts: message.attempts,
          hashrate: message.hashrate,
          elapsedMs: message.elapsedMs,
        });
        return;
      }

      if (message.type === 'solution') {
        void this.submit(message.solution, message.totalAttempts, message.elapsedMs);
        return;
      }

      if (message.type === 'stopped') {
        this.set({ running: false });
      }
    };

    this.worker.onerror = (error) => {
      this.set({ running: false, error: `miner worker failed: ${error.message}` });
    };

    this.worker.postMessage({ type: 'start', header, difficulty, startNonce: 0 });
  }

  stop() {
    this.worker?.postMessage({ type: 'stop' });
    this.worker?.terminate();
    this.worker = null;
    this.set({ running: false });
  }

  reset() {
    this.stop();
    this.set({ ...initialState, difficulty: this.state.difficulty, supported: this.state.supported });
  }

  /** Sends the real solution to the server, which re-verifies it from scratch. */
  private async submit(solution: any, totalAttempts: number, elapsedMs: number) {
    this.set({ submitting: true, error: null });

    try {
      const response = await api.submitWork({
        header: solution.header,
        nonce: solution.nonce,
        hash: solution.hash,
        difficulty: solution.difficulty,
        nodeId: this.nodeId,
        attempts: totalAttempts,
        elapsedMs,
        hashrate: solution.hashrate,
      });

      if (response.accepted) {
        const record: AcceptedWork = {
          id: `${solution.header}:${solution.nonce}`,
          hash: solution.hash,
          difficulty: solution.difficulty,
          leadingZeros: solution.leadingZeros,
          attempts: totalAttempts,
          elapsedMs,
          hashrate: solution.hashrate,
          blockNumber: response.blockNumber,
          merkleRoot: response.merkleRoot,
          acceptedAt: new Date().toISOString(),
        };

        const accepted = [record, ...this.state.accepted].slice(0, 50);
        const blocksMined = this.state.blocksMined + 1;
        const total = this.state.totalAttempts + totalAttempts;
        const sessionSeconds = Math.max(1, (Date.now() - this.sessionStartedAt) / 1000);

        this.set({
          accepted,
          blocksMined,
          totalAttempts: total,
          averageHashrate: Math.round(total / sessionSeconds),
          submitting: false,
        });

        // immediately keep mining the next block
        if (this.state.running) {
          const header = `gaia:${this.nodeId}:${Date.now()}:${Math.floor(crypto.getRandomValues(new Uint32Array(1))[0]).toString(16)}`;
          this.set({ header, attempts: 0 });
          this.worker?.postMessage({ type: 'start', header, difficulty: this.state.difficulty, startNonce: 0 });
        }
        return;
      }

      this.set({
        rejected: [
          { reason: response.verdict?.reason ?? 'rejected by the server', hash: solution.hash, at: new Date().toISOString() },
          ...this.state.rejected,
        ].slice(0, 20),
        submitting: false,
      });
    } catch (error: any) {
      this.set({
        rejected: [
          { reason: error?.message ?? 'submission failed', hash: solution.hash, at: new Date().toISOString() },
          ...this.state.rejected,
        ].slice(0, 20),
        submitting: false,
        error: error?.message ?? 'submission failed',
      });
    }
  }
}

export const miner = new MinerController();

export function useMiner(): MinerState {
  return useSyncExternalStore(miner.subscribe, miner.getSnapshot, miner.getSnapshot);
}

