import React, { useEffect, useRef, useState } from 'react';
import { CornerDownLeft, TerminalSquare, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useNetwork } from '@/lib/network';
import { Button, Mono, Note, ViewHeader } from './parts';
import { cn } from '@/utils';

interface Line {
  kind: 'input' | 'output' | 'system' | 'error';
  text: string;
}

/**
 * A real console. Every command is implemented natively on the server against
 * the OS, the SQLite ledger and the node registry — there is no shell behind
 * it, so nothing typed here can be turned into a process.
 */
export function ConsoleView() {
  const { nodeId } = useNetwork();
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLines([
      { kind: 'system', text: `Gaia node console — connected to ${location.host}` },
      { kind: 'system', text: `node id ${nodeId || '(pending)'} · ${new Date().toUTCString()}` },
      { kind: 'system', text: "Commands are executed natively on the server; there is no shell. Type 'help'." },
      { kind: 'system', text: '' },
    ]);
  }, [nodeId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  const run = async (raw: string) => {
    const command = raw.trim();
    if (!command || busy) return;

    setHistory((prev) => [command, ...prev].slice(0, 50));
    setCursor(-1);
    setLines((prev) => [...prev, { kind: 'input', text: `gaia:${nodeId || 'node'}:~$ ${command}` }]);
    setInput('');

    if (command === 'clear') {
      setLines([]);
      return;
    }

    setBusy(true);
    try {
      const result = await api.exec(command, nodeId);
      if (result.output === '\u0000CLEAR') {
        setLines([]);
        return;
      }
      setLines((prev) => [...prev, { kind: result.error ? 'error' : 'output', text: result.output }]);
    } catch (error: any) {
      setLines((prev) => [...prev, { kind: 'error', text: `console unreachable: ${error?.message ?? error}` }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      void run(input);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.min(history.length - 1, cursor + 1);
      if (next >= 0) {
        setCursor(next);
        setInput(history[next]);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = cursor - 1;
      setCursor(next);
      setInput(next >= 0 ? history[next] : '');
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[520px]">
      <ViewHeader
        icon={TerminalSquare}
        title="Node Console"
        subtitle="Read-only, native execution — no shell, no subprocesses"
        actions={
          <Button variant="ghost" size="sm" onClick={() => setLines([])}>
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </Button>
        }
      />

      <div className="mb-3">
        <Note tone="info">
          Try: <Mono>status</Mono>, <Mono>nodes</Mono>, <Mono>ledger</Mono>, <Mono>proofs</Mono>, <Mono>ps</Mono>, <Mono>free</Mono>,{' '}
          <Mono>df</Mono>, <Mono>ifconfig</Mono>, <Mono>ls</Mono>, <Mono>cat README.md</Mono>, <Mono>events</Mono>.
        </Note>
      </div>

      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        className="flex-1 rounded-lg border border-zinc-800 bg-black p-4 font-mono text-xs overflow-y-auto custom-scrollbar cursor-text"
      >
        {lines.map((line, index) => (
          <div
            key={index}
            className={cn(
              'whitespace-pre-wrap break-words leading-relaxed',
              line.kind === 'input' && 'text-emerald-400 font-bold',
              line.kind === 'output' && 'text-zinc-300',
              line.kind === 'system' && 'text-zinc-500',
              line.kind === 'error' && 'text-rose-400',
            )}
          >
            {line.text || '\u00a0'}
          </div>
        ))}

        <div className="flex items-center gap-2 pt-1">
          <span className="text-emerald-500 font-bold whitespace-nowrap">gaia:{nodeId || 'node'}:~$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={busy}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent outline-none text-emerald-300 caret-emerald-400 placeholder:text-zinc-700"
            placeholder={busy ? 'running…' : 'type a command'}
          />
          <CornerDownLeft className="w-3.5 h-3.5 text-zinc-700" />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {['status', 'nodes', 'ledger', 'proofs', 'ps 10', 'free', 'df', 'ifconfig', 'ls', 'events 10', 'help'].map((command) => (
          <button
            key={command}
            onClick={() => void run(command)}
            className="text-[10px] font-mono px-2 py-1 rounded border border-zinc-800 text-zinc-500 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors"
          >
            {command}
          </button>
        ))}
      </div>
    </div>
  );
}
