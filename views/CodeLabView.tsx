import { useEffect, useRef, useState } from 'react';
import { Code2, Play, Square, TimerReset } from 'lucide-react';
import { Button, Mono, Note, Panel, ViewHeader } from './parts';
import { cn } from '@/utils';

const SAMPLES: Record<string, string> = {
  'Proof of work': `// Real work: grind SHA-256 until the digest has 16 leading zero bits.
// gaia.* is the same cryptography the node uses, bundled into this worker.
const header = 'gaia:codelab:' + Date.now();
const result = gaia.mineChunk(header, 16, 0, 5000);

if (result.solution) {
  console.log('nonce      ', result.solution.nonce);
  console.log('hash       ', result.solution.hash);
  console.log('zero bits  ', gaia.leadingZeroBits(result.solution.hash));
  console.log('attempts   ', result.solution.attempts);
  console.log('hashrate   ', Math.round(result.solution.hashrate).toLocaleString(), 'H/s');
} else {
  console.log('no solution within the time budget; resume at nonce', result.nextNonce);
}

result.solution ? result.solution.hash : null;`,
  'Statistics': `const samples = Array.from({ length: 2000 }, (_, i) => Math.sin(i / 13) * 50 + i % 7);
const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;

console.log('n        ', samples.length);
console.log('mean     ', mean.toFixed(4));
console.log('std dev  ', Math.sqrt(variance).toFixed(4));
console.log('min/max  ', Math.min(...samples).toFixed(2), Math.max(...samples).toFixed(2));

{ mean, standardDeviation: Math.sqrt(variance) };`,
  'Async / await': `// Async code really runs; the worker awaits it and reports the result.
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (let i = 1; i <= 3; i++) {
  await wait(200);
  console.log('tick', i, 'at', new Date().toISOString().slice(11, 23));
}

'done after 600 ms of real waiting';`,
  'Infinite loop (cancelled)': `// The runner is killed by the host after the time limit, which is the only
// honest way to stop a loop like this.
let n = 0;
while (true) { n++; }
n;`,
};

interface LogLine {
  level: 'log' | 'info' | 'warn' | 'error' | 'return';
  text: string;
}

/**
 * Real code execution. The script runs in a dedicated worker with its console
 * piped back here; the time limit is enforced by terminating the worker.
 */
export function CodeLabView() {
  const [code, setCode] = useState(SAMPLES['Proof of work']);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [timeLimit, setTimeLimit] = useState(5000);
  const workerRef = useRef<Worker | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [lines]);

  const stop = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
    setLines((prev) => [...prev, { level: 'error', text: `terminated by the host after the ${timeLimit} ms limit` }]);
  };

  const run = () => {
    workerRef.current?.terminate();
    setLines([]);
    setElapsedMs(null);
    setRunning(true);

    const startedAt = performance.now();
    const worker = new Worker(new URL('../workers/runner.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    const timeout = window.setTimeout(() => {
      if (workerRef.current === worker) stop();
    }, timeLimit);

    worker.onmessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'log') {
        setLines((prev) => [...prev.slice(-500), { level: message.level, text: message.text }]);
        return;
      }
      if (message.type === 'done') {
        window.clearTimeout(timeout);
        setElapsedMs(performance.now() - startedAt);
        setRunning(false);
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = (error) => {
      window.clearTimeout(timeout);
      setLines((prev) => [...prev, { level: 'error', text: error.message || 'worker crashed' }]);
      setRunning(false);
      setElapsedMs(performance.now() - startedAt);
      worker.terminate();
      workerRef.current = null;
    };

    worker.postMessage({ code });
  };

  return (
    <div className="flex flex-col h-full min-h-[520px]">
      <ViewHeader
        icon={Code2}
        title="Code Lab"
        subtitle="JavaScript executed for real in an isolated worker, with the console piped back"
        actions={
          <>
            <select
              value={timeLimit}
              onChange={(event) => setTimeLimit(Number(event.target.value))}
              className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-300"
            >
              <option value={2000}>2 s limit</option>
              <option value={5000}>5 s limit</option>
              <option value={15000}>15 s limit</option>
            </select>
            {running ? (
              <Button variant="danger" size="sm" onClick={stop}>
                <Square className="w-3.5 h-3.5" /> Terminate
              </Button>
            ) : (
              <Button size="sm" onClick={run}>
                <Play className="w-3.5 h-3.5" /> Run
              </Button>
            )}
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {Object.keys(SAMPLES).map((name) => (
          <button
            key={name}
            onClick={() => setCode(SAMPLES[name])}
            className={cn(
              'text-[11px] px-2 py-1 rounded border transition-colors',
              code === SAMPLES[name]
                ? 'border-emerald-500/50 text-emerald-300 bg-emerald-500/10'
                : 'border-zinc-800 text-zinc-500 hover:border-zinc-700',
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="mb-3">
        <Note tone="info">
          Sandbox: no DOM, no <Mono>window</Mono>, no network — but the real <Mono>gaia.sha256Hex</Mono>, <Mono>gaia.mineChunk</Mono> and{' '}
          <Mono>gaia.leadingZeroBits</Mono> are injected, so you can reproduce the node's proof of work here.
        </Note>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
        <Panel title="Editor">
          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            spellCheck={false}
            className="w-full h-[320px] bg-black/60 border border-zinc-800 rounded-md p-3 font-mono text-xs text-zinc-300 outline-none focus:border-emerald-500/40 resize-none custom-scrollbar"
          />
        </Panel>

        <Panel
          title="Output"
          right={
            <span className="flex items-center gap-2">
              {elapsedMs != null && <Mono className="text-zinc-600">{elapsedMs.toFixed(0)} ms</Mono>}
              {running && <TimerReset className="w-3.5 h-3.5 animate-spin text-emerald-400" />}
            </span>
          }
        >
          <div ref={outputRef} className="h-[320px] overflow-auto custom-scrollbar rounded-md bg-black/60 border border-zinc-800 p-3 font-mono text-xs">
            {lines.length === 0 && <span className="text-zinc-600">Run the script to see real output.</span>}
            {lines.map((line, index) => (
              <div
                key={index}
                className={cn(
                  'whitespace-pre-wrap break-words',
                  line.level === 'error' && 'text-rose-400',
                  line.level === 'warn' && 'text-amber-300',
                  line.level === 'return' && 'text-emerald-400',
                  (line.level === 'log' || line.level === 'info') && 'text-zinc-300',
                )}
              >
                {line.level === 'return' ? '← ' : ''}
                {line.text}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
