/**
 * workers/miner.worker.ts
 *
 * Real proof-of-work miner running off the UI thread. It grinds SHA-256 over
 * `header|nonce` until the digest carries the requested number of leading zero
 * bits, reporting measured throughput as it goes. The nonce it finds is sent to
 * the server, which re-hashes and verifies it independently.
 */
import { mineChunk, type PowSolution } from '../shared/crypto.ts';

interface StartMessage {
  type: 'start';
  header: string;
  difficulty: number;
  startNonce: number;
}

interface StopMessage {
  type: 'stop';
}

type Message = StartMessage | StopMessage;

let running = false;

self.onmessage = (event: MessageEvent<Message>) => {
  const message = event.data;

  if (message.type === 'stop') {
    running = false;
    self.postMessage({ type: 'stopped' });
    return;
  }

  if (message.type === 'start') {
    if (running) return;
    running = true;

    const { header, difficulty, startNonce } = message;
    let nonce = startNonce;
    let totalAttempts = 0;
    const startedAt = Date.now();

    const step = () => {
      if (!running) return;

      const chunk = mineChunk(header, difficulty, nonce, 200, (attemptsInChunk, hashrate) => {
        self.postMessage({
          type: 'progress',
          attempts: totalAttempts + attemptsInChunk,
          hashrate,
          nonce,
          elapsedMs: Date.now() - startedAt,
        });
      });

      nonce = chunk.nextNonce;
      totalAttempts += chunk.attempts;

      if (chunk.solution) {
        running = false;
        const solution: PowSolution = chunk.solution;
        self.postMessage({
          type: 'solution',
          solution,
          totalAttempts,
          elapsedMs: Date.now() - startedAt,
        });
        return;
      }

      // yield to the event loop so `stop` can be observed between chunks
      setTimeout(step, 0);
    };

    step();
  }
};

export {};
