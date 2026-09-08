import React, { useState } from 'react';
import { Bot, Database, KeyRound, Languages, Save, Trash2, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNetwork } from '@/lib/network';
import type { Settings } from '@/lib/hooks';
import { api, type ConfigResponse } from '@/lib/api';
import { usePoll } from '@/lib/hooks';
import { Button, Mono, Note, Panel, ViewHeader } from './parts';

export function SettingsView({ settings, onChange }: { settings: Settings; onChange: (patch: Partial<Settings>) => void }) {
  const { i18n } = useTranslation();
  const { nodeId, status } = useNetwork();
  const config = usePoll<ConfigResponse>(() => api.config(), 30_000);
  const [keyDraft, setKeyDraft] = useState(settings.geminiKey);
  const [saved, setSaved] = useState(false);

  const aiConfigured = Boolean(config.data?.ai.configured) || Boolean(settings.geminiKey.trim());

  return (
    <div>
      <ViewHeader icon={UserRound} title="Settings" subtitle="Identity, language and the optional AI key. Stored in this browser only." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Identity">
          <div className="space-y-3">
            <Field label="Display name">
              <input
                value={settings.userName}
                onChange={(event) => onChange({ userName: event.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50"
              />
            </Field>
            <Field label="Role / title">
              <input
                value={settings.jobTitle}
                onChange={(event) => onChange({ jobTitle: event.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone 1">
                <input
                  value={settings.userPhone1}
                  onChange={(event) => onChange({ userPhone1: event.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50"
                />
              </Field>
              <Field label="Phone 2">
                <input
                  value={settings.userPhone2}
                  onChange={(event) => onChange({ userPhone2: event.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50"
                />
              </Field>
            </div>
            <Mono className="text-zinc-600 block">
              These values are only inserted into outreach drafts you generate. node id: {nodeId}
            </Mono>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Language">
            <div className="flex items-center gap-2 mb-3">
              <Languages className="w-4 h-4 text-emerald-400" />
              <Mono>Interface language (assistant speech follows the assistant's own selector)</Mono>
            </div>
            <select
              value={i18n.language}
              onChange={(event) => {
                void i18n.changeLanguage(event.target.value);
                onChange({ language: event.target.value });
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
            </select>
          </Panel>

          <Panel title="AI provider">
            <div className="space-y-3">
              <Note tone={aiConfigured ? 'good' : 'warn'}>
                {config.data?.ai.note ?? 'Checking provider configuration…'}
              </Note>

              <Field label="Gemini API key (optional, kept in this browser)">
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={keyDraft}
                    onChange={(event) => setKeyDraft(event.target.value)}
                    placeholder="AIza…"
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      onChange({ geminiKey: keyDraft.trim() });
                      setSaved(true);
                      window.setTimeout(() => setSaved(false), 2000);
                    }}
                  >
                    <Save className="w-3.5 h-3.5" /> {saved ? 'Saved' : 'Save'}
                  </Button>
                  {settings.geminiKey && (
                    <Button variant="ghost" size="sm" onClick={() => { setKeyDraft(''); onChange({ geminiKey: '' }); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </Field>

              <Mono className="text-zinc-600 block">
                The key is sent with your own requests to this node's proxy and is never written to disk on the server. A server-side
                GEMINI_API_KEY always takes precedence.
              </Mono>

              <div className="rounded border border-zinc-800 p-2 bg-black/40 text-[11px]">
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                  <Mono className="text-zinc-400">resolved model</Mono>
                </div>
                <Mono className="text-emerald-300 block">{config.data?.ai.model ?? 'not resolved yet (first call resolves it)'}</Mono>
                <Mono className="text-zinc-600 block mt-1">candidates: {config.data?.ai.candidates.join(' → ')}</Mono>
                <Mono className="text-zinc-600 block">{config.data?.ai.provider}</Mono>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-4">
        <Panel title="Runtime">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
            <Info label="Database" value={status?.database.path ?? '—'} sub={status?.database.engine} />
            <Info label="Node id" value={nodeId || '—'} sub="stored in localStorage" />
            <Info label="Version" value={config.data?.version ?? '—'} sub={`hash: ${config.data?.crypto.hash ?? ''}`} />
          </div>

          <div className="mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                localStorage.removeItem('gaia_settings_v2');
                localStorage.removeItem('gaia_node_id');
                window.location.reload();
              }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Reset local identity and settings
            </Button>
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Note tone="info">
          <Bot className="inline w-3.5 h-3.5 mr-1" />
          Nothing in this app fabricates a response. When the AI provider is unavailable the assistant says so, and the server returns the
          upstream error verbatim.
        </Note>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-zinc-800 p-2">
      <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold flex items-center gap-1.5">
        <Database className="w-3 h-3" /> {label}
      </div>
      <div className="text-zinc-300 font-mono break-all mt-0.5">{value}</div>
      {sub && <Mono className="text-zinc-600 block mt-0.5">{sub}</Mono>}
    </div>
  );
}

