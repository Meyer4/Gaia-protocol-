import { useState } from 'react';
import { BadgeCheck, Fingerprint, FlaskConical, KeyRound, ShieldX, Timer } from 'lucide-react';
import {
  proveKnowledgeOfDiscreteLog,
  randomSecretExponent,
  type SchnorrProof,
  type SchnorrVerification,
} from '@/shared/crypto';
import { api } from '@/lib/api';
import { useNetwork } from '@/lib/network';
import { usePoll } from '@/lib/hooks';
import { Button, EmptyState, Mono, Note, Panel, Stat, ViewHeader } from './parts';

/**
 * A real zero-knowledge proof of knowledge of a discrete logarithm.
 *
 * The secret exponent x is generated in this browser and never leaves it. The
 * prover publishes y = g^x mod p plus a Fiat–Shamir Schnorr proof (t, s, c) over
 * the RFC 3526 2048-bit MODP group. The server re-derives the challenge and
 * checks g^s == t · y^c (mod p) — real verification, and it can be fooled only
 * by solving the discrete log.
 */
export function ZkpView() {
  const { nodeId } = useNetwork();
  const [secret, setSecret] = useState<bigint | null>(null);
  const [proof, setProof] = useState<SchnorrProof | null>(null);
  const [verification, setVerification] = useState<SchnorrVerification | null>(null);
  const [tampered, setTampered] = useState<SchnorrVerification | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const log = usePoll(() => api.zkpLog(15), 15_000);

  const prove = async () => {
    setBusy(true);
    setError(null);
    setVerification(null);
    setTampered(null);
    try {
      const x = randomSecretExponent();
      const label = `node-${nodeId}-${Date.now()}`;
      const { proof: generated } = proveKnowledgeOfDiscreteLog(x, label);
      setSecret(x);
      setProof(generated);

      const response = await api.verifyZkp(generated);
      setVerification(response.verification);
      log.refresh();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  const tamper = async () => {
    if (!proof) return;
    setBusy(true);
    try {
      // Flip the response s to a different valid-looking integer. The verifier
      // must reject it: this is a real negative test, not a mock.
      const forgedS = ((BigInt('0x' + proof.s) + 1n) % ((1n << 2048n) - 1n)).toString(16);
      const response = await api.verifyZkp({ ...proof, s: forgedS });
      setTampered(response.verification);
      log.refresh();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <ViewHeader
        icon={Fingerprint}
        title="Zero-Knowledge Trust Centre"
        subtitle="Schnorr proof of knowledge of a discrete log · Fiat–Shamir · RFC 3526 2048-bit MODP group"
        actions={
          <Button size="sm" onClick={prove} disabled={busy}>
            <KeyRound className="w-4 h-4" /> {busy ? 'Proving…' : 'Prove identity'}
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <Note tone="bad">{error}</Note>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Local proofs generated" value={proof ? 1 : 0} hint="secret stays in this tab" />
        <Stat
          label="Server verdict"
          value={verification ? (verification.valid ? 'VALID' : 'REJECTED') : '—'}
          tone={verification ? (verification.valid ? 'good' : 'bad') : 'default'}
          hint={verification ? `${verification.elapsedMs} ms server-side` : 'not verified yet'}
        />
        <Stat
          label="Tampered proof"
          value={tampered ? (tampered.valid ? 'ACCEPTED (!)' : 'REJECTED') : '—'}
          tone={tampered ? (tampered.valid ? 'bad' : 'good') : 'default'}
          hint="soundness check"
        />
        <Stat label="All-time verifications" value={log.data?.stats.total ?? '—'} hint={`${log.data?.stats.valid ?? 0} valid`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Statement & proof (public values only)">
          {!proof && <EmptyState>Generate a proof to see the public statement. The secret exponent is never transmitted.</EmptyState>}
          {proof && secret && (
            <div className="space-y-3 text-xs">
              <Field label="secret exponent x (NEVER sent — shown locally so you can audit)" value={secret.toString(16)} secret />
              <Field label="public key y = g^x mod p" value={proof.statement.y} />
              <Field label="statement label" value={proof.statement.label} />
              <Field label="commitment t = g^r mod p" value={proof.t} />
              <Field label="challenge c = H(label‖g‖y‖t) mod q" value={proof.c} />
              <Field label="response s = r + c·x mod q" value={proof.s} />
              <div className="flex items-center gap-2 text-zinc-500">
                <Timer className="w-3.5 h-3.5" />
                <Mono>proving took {proof.elapsedMs} ms in this browser</Mono>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Server verification">
          {!verification && <EmptyState>The server has not verified anything yet.</EmptyState>}
          {verification && (
            <div className="space-y-3">
              <Verdict valid={verification.valid} reason={verification.reason} />
              <dl className="space-y-1.5 text-xs">
                <CheckRow label="Challenge matches the Fiat–Shamir transcript" ok={verification.challengeMatches} />
                <CheckRow label="g^s ≡ t · y^c (mod p)" ok={verification.equationHolds} />
              </dl>
              <div className="rounded border border-zinc-800 p-2 bg-black/40">
                <Mono className="text-zinc-600 block">recomputed challenge</Mono>
                <Mono className="text-emerald-400/80">{verification.recomputedChallenge || '—'}</Mono>
              </div>
              <Mono className="text-zinc-600">verified in {verification.elapsedMs} ms on the server</Mono>
            </div>
          )}

          {proof && (
            <div className="mt-4 border-t border-zinc-800 pt-3">
              <Button variant="ghost" size="sm" onClick={tamper} disabled={busy}>
                <FlaskConical className="w-3.5 h-3.5" /> Send a tampered proof (soundness test)
              </Button>
              {tampered && (
                <div className="mt-3">
                  <Verdict valid={tampered.valid} reason={tampered.reason} negative />
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Verification log (server-side)">
          <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
            {(log.data?.entries ?? []).length === 0 && <EmptyState>No verifications recorded yet.</EmptyState>}
            {log.data?.entries.map((entry: any) => (
              <div key={entry.id} className="flex items-center gap-2 text-[11px]">
                {entry.valid ? <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" /> : <ShieldX className="w-3.5 h-3.5 text-rose-400" />}
                <Mono className={entry.valid ? 'text-emerald-300' : 'text-rose-300'}>{entry.valid ? 'VALID' : 'INVALID'}</Mono>
                <Mono className="text-zinc-500 truncate flex-1">{entry.label}</Mono>
                <Mono className="text-zinc-600">{entry.elapsed_ms} ms</Mono>
                <Mono className="text-zinc-600">{String(entry.verified_at).slice(11, 19)}</Mono>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Note tone="info">
          Why this is real: anyone holding <Mono>y</Mono> and the transcript can re-run the check, but producing a valid
          <Mono> (t, s, c)</Mono> without <Mono>x</Mono> requires solving the discrete logarithm in a 2048-bit prime-order subgroup. The
          soundness test above sends <Mono>s+1</Mono>; the server rejects it because <Mono>g^(s+1) ≠ t · y^c</Mono> and because the
          Fiat–Shamir challenge no longer matches the transcript.
        </Note>
      </div>
    </div>
  );
}

function Field({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold mb-1">{label}</div>
      <div className={`rounded border p-2 bg-black/40 ${secret ? 'border-amber-500/30' : 'border-zinc-800'}`}>
        <Mono className={secret ? 'text-amber-300' : 'text-emerald-400/80'}>{value.slice(0, 128)}{value.length > 128 ? '…' : ''}</Mono>
      </div>
    </div>
  );
}

function Verdict({ valid, reason, negative }: { valid: boolean; reason?: string; negative?: boolean }) {
  const good = negative ? !valid : valid;
  return (
    <div
      className={`rounded-md border px-3 py-2 text-xs flex items-start gap-2 ${
        good ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300' : 'border-rose-500/30 bg-rose-500/5 text-rose-300'
      }`}
    >
      {valid ? <BadgeCheck className="w-4 h-4 shrink-0" /> : <ShieldX className="w-4 h-4 shrink-0" />}
      <div>
        <div className="font-bold">{valid ? 'PROOF VALID' : 'PROOF REJECTED'}</div>
        {reason && <div className="text-[11px] opacity-80 mt-0.5">{reason}</div>}
      </div>
    </div>
  );
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd className={ok ? 'text-emerald-400 font-mono' : 'text-rose-400 font-mono'}>{ok ? 'PASS' : 'FAIL'}</dd>
    </div>
  );
}
