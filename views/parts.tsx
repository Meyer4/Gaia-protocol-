/**
 * views/parts.tsx — small shared UI pieces used across the console views.
 */
import React from 'react';
import { AlertTriangle, CheckCircle2, Info, RefreshCw, XCircle } from 'lucide-react';
import { cn } from '@/utils';

export function ViewHeader({ icon: Icon, title, subtitle, actions }: { icon: any; title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <Icon className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-100">{title}</h2>
          {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone = 'default' }: { label: string; value: React.ReactNode; hint?: string; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  const toneClass =
    tone === 'good' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : tone === 'bad' ? 'text-rose-400' : 'text-zinc-100';
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{label}</div>
      <div className={cn('text-2xl font-bold mt-1 font-mono tabular-nums', toneClass)}>{value}</div>
      {hint && <div className="text-[10px] text-zinc-600 mt-1">{hint}</div>}
    </div>
  );
}

export function Panel({ title, children, className, right }: { title?: string; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <section className={cn('rounded-lg border border-zinc-800 bg-zinc-950/60 overflow-hidden', className)}>
      {title && (
        <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/70 bg-zinc-900/40">
          <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{title}</h3>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('font-mono text-xs text-zinc-400 break-all', className)}>{children}</span>;
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  type?: 'button' | 'submit';
  className?: string;
}) {
  const variants = {
    primary: 'bg-emerald-500 text-black hover:bg-emerald-400 font-bold',
    ghost: 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-emerald-500/40 hover:text-emerald-300',
    danger: 'bg-rose-600 text-white hover:bg-rose-500 font-bold',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Note({ tone = 'info', children }: { tone?: 'info' | 'good' | 'warn' | 'bad'; children: React.ReactNode }) {
  const tones = {
    info: { cls: 'border-sky-500/30 bg-sky-500/5 text-sky-300', Icon: Info },
    good: { cls: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300', Icon: CheckCircle2 },
    warn: { cls: 'border-amber-500/30 bg-amber-500/5 text-amber-300', Icon: AlertTriangle },
    bad: { cls: 'border-rose-500/30 bg-rose-500/5 text-rose-300', Icon: XCircle },
  };
  const { cls, Icon } = tones[tone];
  return (
    <div className={cn('flex items-start gap-2 rounded-md border px-3 py-2 text-xs', cls)}>
      <Icon className="w-4 h-4 shrink-0 mt-px" />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function RefreshButton({ onClick, label = 'Refresh', busy }: { onClick: () => void; label?: string; busy?: boolean }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={busy}>
      <RefreshCw className={cn('w-3.5 h-3.5', busy && 'animate-spin')} />
      {label}
    </Button>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-zinc-600 py-6 text-center">{children}</div>;
}
