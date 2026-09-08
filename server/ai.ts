/**
 * server/ai.ts
 *
 * Real Gemini calls, proxied so the API key never ships to the browser.
 *
 * The repository this was forked from pinned `gemini-1.5-flash`, which Google
 * shut down on 2025-09-29 — every request to it now returns 404. Instead of
 * hard-coding a model that will be retired again, the server walks an ordered
 * candidate list, remembers the first one that actually answered, and reports
 * the resolved model back to the client. Failures are surfaced verbatim; the
 * server never invents a reply.
 */
import { GoogleGenAI } from '@google/genai';
import { bus } from './events.ts';
import { queries } from './db.ts';
import { randomUUID } from 'node:crypto';

const DEFAULT_MODELS = 'gemini-3.8-flash,gemini-3.7-flash,gemini-3.5-flash,gemini-2.5-flash';

export function modelCandidates(): string[] {
  const configured = process.env.GEMINI_MODEL || process.env.GEMINI_MODELS || DEFAULT_MODELS;
  return configured
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}

let resolvedModel: string | null = process.env.GEMINI_MODEL ? process.env.GEMINI_MODEL.trim() : null;

export function aiStatus() {
  const configured = Boolean(process.env.GEMINI_API_KEY);
  return {
    configured,
    provider: 'Google Gemini (generativelanguage.googleapis.com)',
    model: resolvedModel,
    candidates: modelCandidates(),
    note: configured
      ? 'Server-side API key present.'
      : 'No GEMINI_API_KEY on the server. Add one to .env, or paste a key into Settings and it will be sent per request.',
  };
}

function resolveApiKey(requestKey?: string): string | null {
  const fromEnv = process.env.GEMINI_API_KEY;
  if (fromEnv) return fromEnv;
  if (requestKey && requestKey.trim().length > 10) return requestKey.trim();
  return null;
}

interface GenerateArgs {
  systemInstruction: string;
  contents: any;
  requestKey?: string;
  purpose: 'chat' | 'pitch';
}

interface GenerateResult {
  text: string;
  model: string;
}

export class AiUnavailableError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AiUnavailableError';
    this.status = status;
  }
}

function isModelRetired(error: any): boolean {
  const status = error?.status ?? error?.code ?? error?.httpStatusCode;
  const message = String(error?.message ?? error ?? '').toLowerCase();
  return (
    status === 404 ||
    message.includes('is not found') ||
    message.includes('not supported') ||
    message.includes('unsupported_model') ||
    message.includes('models/unknown')
  );
}

/** Calls Gemini, falling back across model candidates when one is retired. */
export async function generate(args: GenerateArgs): Promise<GenerateResult> {
  const apiKey = resolveApiKey(args.requestKey);
  if (!apiKey) {
    throw new AiUnavailableError(
      'No Gemini API key available. Set GEMINI_API_KEY on the server or provide one in Settings.',
      503,
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const order = resolvedModel
    ? [resolvedModel, ...modelCandidates().filter((m) => m !== resolvedModel)]
    : modelCandidates();

  let lastError: any = null;

  for (const model of order) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: args.contents,
        config: { systemInstruction: args.systemInstruction },
      });

      const text = typeof response.text === 'string' ? response.text : '';
      if (!text.trim()) {
        throw new Error('the model returned an empty response');
      }

      if (resolvedModel !== model) {
        resolvedModel = model;
        bus.emitEvent('ai.model', `Gemini model resolved to ${model}`, 'success', { model });
      }
      return { text, model };
    } catch (error: any) {
      lastError = error;
      const retired = isModelRetired(error);
      bus.emitEvent(
        'ai.error',
        `Gemini call failed on ${model}: ${error?.message ?? error}`,
        retired ? 'warn' : 'error',
        { model, retired },
      );
      if (!retired) break; // an auth/network/rate error will not be fixed by another model
    }
  }

  throw new AiUnavailableError(
    `Gemini request failed: ${lastError?.message ?? lastError}`,
    lastError?.status === 401 || lastError?.status === 403 ? 401 : 502,
  );
}

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

export function chatSystemInstruction(language: string) {
  return [
    'You are Gaia, the operations assistant for a Gaia Protocol node.',
    'You answer questions about the live state of the node: verified proof-of-work blocks,',
    'Schnorr zero-knowledge proof verification, host telemetry, the USGS seismic feed and the node registry.',
    'Be precise and never invent telemetry values you were not given.',
    `Respond in the user's preferred language: ${language || 'English'}.`,
    'Keep answers short enough to be spoken aloud by a text-to-speech engine.',
  ].join(' ');
}

export interface PitchSettings {
  userName?: string;
  jobTitle?: string;
  userPhone1?: string;
  userPhone2?: string;
}

export const PITCH_TARGETS: Record<string, string> = {
  dept_of_energy:
    'Department of Energy / government scientific research body that needs high-capacity compute for climate and seismic modelling.',
  depin_vc: 'DePIN (decentralised physical infrastructure) venture capitalist evaluating utility networks.',
  ai_enterprise:
    'Enterprise AI company that wants to cut model training and inference cost by using decentralised idle compute.',
  weather_org: 'Global weather and disaster-response organisation that needs unified real-time sensor data.',
  intern_web3: 'Software engineering internship at a Web3 / DePIN protocol company.',
  intern_software: 'General software engineering internship at a fast-moving startup.',
  job_fullstack: 'Full-stack distributed systems developer role at a large technology company.',
  job_google: 'Software engineering or distributed systems role at Google.',
  job_openai: 'Software engineer, AI infrastructure or distributed training, at OpenAI.',
  job_anthropic: 'Systems engineering role at Anthropic working with large compute clusters.',
  job_cloudflare: 'Systems or edge computing engineer at Cloudflare.',
  job_meta: 'Software engineer, infrastructure or Reality Labs, at Meta.',
  job_palantir: 'Forward deployed software engineer / distributed systems architect at Palantir.',
};

export function buildPitchPrompt(target: string, settings: PitchSettings, liveContext: string) {
  const userName = settings.userName || 'George Meya';
  const jobTitle = settings.jobTitle || 'Founder & Architect';
  const phones = [settings.userPhone1, settings.userPhone2].filter(Boolean).join(' / ');
  const persona = PITCH_TARGETS[target] ?? PITCH_TARGETS.ai_enterprise;
  const isApplication = target.startsWith('intern_') || target.startsWith('job_');

  const body = isApplication
    ? `Write a job application email / cover letter of 3-4 paragraphs.\nI am ${userName}, the creator of Gaia Protocol: a node network that runs real SHA-256 proof of work in the browser, verifies every submission server-side, and proves node identity with Schnorr zero-knowledge proofs over the RFC 3526 2048-bit group. The stack is React 19, TypeScript, Vite, Express and SQLite.\nI want the reader to value this project and my skills in distributed systems, cryptography, AI and full-stack engineering.\nStart with 'Dear Hiring Manager,' or 'Dear Recruiting Team,' and sign off as '${userName}'${phones ? ` with the phone numbers ${phones}` : ''}.`
    : `Write a short email pitch of 3-4 paragraphs offering access to the Gaia Protocol node network: verifiable distributed compute, real environmental sensor data and zero-knowledge identity.\nStart with 'Dear [Name/Title],' guessing the most likely title for the persona, and sign off as '${userName}, ${jobTitle}, Gaia Protocol'${phones ? ` with the phone numbers ${phones}` : ''}.`;

  return `${body}\n\nTarget persona: ${persona}\n\nLive network facts you may cite (do not invent others):\n${liveContext}`;
}

export async function generatePitch(
  target: string,
  settings: PitchSettings,
  liveContext: string,
  requestKey?: string,
) {
  const result = await generate({
    systemInstruction: 'You are an expert pitch writer and career advisor writing on behalf of the user. Be concrete, avoid hype, never fabricate metrics.',
    contents: buildPitchPrompt(target, settings, liveContext),
    requestKey,
    purpose: 'pitch',
  });

  queries.insertPitch.run(randomUUID(), target, result.text, result.model);
  return result;
}
