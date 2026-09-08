/**
 * shared/crypto.ts
 *
 * Real, dependency-free cryptography that runs identically in the browser
 * and on the Node server:
 *
 *  1. SHA-256            — verified byte-for-byte against `node:crypto`.
 *  2. Proof of Work      — real hash grinding; the server re-verifies every
 *                          submitted nonce independently.
 *  3. Schnorr ZK proof   — a real Sigma-protocol proof of knowledge of a
 *                          discrete logarithm, made non-interactive with
 *                          Fiat–Shamir, over the RFC 3526 2048-bit MODP group.
 *
 * Nothing in here is simulated: every value is computed and every claim is
 * checkable by the counterparty.
 */

const K: number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotr = (x: number, n: number) => ((x >>> n) | (x << (32 - n))) >>> 0;

/** SHA-256 of a byte array, returned as bytes. */
export function sha256Bytes(input: Uint8Array): Uint8Array {
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const len = input.length;
  const bitLen = len * 8;
  // message + 0x80 + zero padding + 64-bit length, rounded up to a 64-byte block
  const padded = new Uint8Array((((len + 8) >> 6) + 1) << 6);
  padded.set(input);
  padded[len] = 0x80;

  const pv = new DataView(padded.buffer);
  pv.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296), false);
  pv.setUint32(padded.length - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);

  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = pv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const a15 = w[i - 15];
      const a2 = w[i - 2];
      const s0 = (rotr(a15, 7) ^ rotr(a15, 18) ^ (a15 >>> 3)) >>> 0;
      const s1 = (rotr(a2, 17) ^ rotr(a2, 19) ^ (a2 >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = H[0], b = H[1], c = H[2], d = H[3];
    let e = H[4], f = H[5], g = H[6], h = H[7];

    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e;
      e = (d + t1) >>> 0;
      d = c; c = b; b = a;
      a = (t1 + t2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, H[i], false);
  return out;
}

const encoder = new TextEncoder();

/** SHA-256 of a UTF-8 string, as lowercase hex. */
export function sha256Hex(message: string): string {
  const bytes = sha256Bytes(encoder.encode(message));
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

/* ------------------------------------------------------------------ */
/* Proof of Work                                                       */
/* ------------------------------------------------------------------ */

/** Number of leading zero bits in a hex digest. */
export function leadingZeroBits(hashHex: string): number {
  let bits = 0;
  for (let i = 0; i < hashHex.length; i++) {
    const nibble = parseInt(hashHex[i], 16);
    if (nibble === 0) { bits += 4; continue; }
    bits += Math.clz32(nibble) - 28;
    break;
  }
  return bits;
}

export function meetsDifficulty(hashHex: string, difficulty: number): boolean {
  return leadingZeroBits(hashHex) >= difficulty;
}

export interface PowSolution {
  header: string;
  nonce: number;
  hash: string;
  difficulty: number;
  leadingZeros: number;
  attempts: number;
  elapsedMs: number;
  hashrate: number; // hashes / second actually achieved
}

/**
 * Grind SHA-256 over `header|nonce` until the digest has `difficulty` leading
 * zero bits. `budgetMs` bounds the run so a UI thread stays responsive — the
 * returned `done` flag tells the caller to resume from `nextNonce`.
 */
export function mineChunk(
  header: string,
  difficulty: number,
  startNonce: number,
  budgetMs: number,
  onProgress?: (attempts: number, hashrate: number) => void,
): { solution: PowSolution | null; nextNonce: number; attempts: number } {
  const startedAt = Date.now();
  let nonce = startNonce;
  let attempts = 0;

  for (;;) {
    const hash = sha256Hex(`${header}|${nonce}`);
    attempts++;
    if (leadingZeroBits(hash) >= difficulty) {
      const elapsedMs = Math.max(1, Date.now() - startedAt);
      return {
        solution: {
          header,
          nonce,
          hash,
          difficulty,
          leadingZeros: leadingZeroBits(hash),
          attempts,
          elapsedMs,
          hashrate: Math.round((attempts / elapsedMs) * 1000),
        },
        nextNonce: nonce + 1,
        attempts,
      };
    }
    nonce++;
    if (Date.now() - startedAt >= budgetMs) {
      const elapsedMs = Math.max(1, Date.now() - startedAt);
      onProgress?.(attempts, Math.round((attempts / elapsedMs) * 1000));
      return { solution: null, nextNonce: nonce, attempts };
    }
  }
}

/** Independent verification of a submitted proof of work. */
export function verifyPow(input: {
  header: string;
  nonce: number;
  hash: string;
  difficulty: number;
}): { valid: boolean; reason?: string; recomputedHash?: string; leadingZeros?: number } {
  const { header, nonce, hash, difficulty } = input;
  if (typeof header !== 'string' || header.length === 0 || header.length > 512) {
    return { valid: false, reason: 'header must be a non-empty string <= 512 chars' };
  }
  if (!Number.isInteger(nonce) || nonce < 0 || nonce > Number.MAX_SAFE_INTEGER) {
    return { valid: false, reason: 'nonce must be a non-negative integer' };
  }
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 32) {
    return { valid: false, reason: 'difficulty must be an integer between 1 and 32' };
  }
  if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) {
    return { valid: false, reason: 'hash must be 64 lowercase hex characters' };
  }

  const recomputedHash = sha256Hex(`${header}|${nonce}`);
  if (recomputedHash !== hash) {
    return { valid: false, reason: 'digest does not match header|nonce', recomputedHash };
  }
  const leadingZeros = leadingZeroBits(recomputedHash);
  if (leadingZeros < difficulty) {
    return {
      valid: false,
      reason: `insufficient work: ${leadingZeros} leading zero bits < required ${difficulty}`,
      recomputedHash,
      leadingZeros,
    };
  }
  return { valid: true, recomputedHash, leadingZeros };
}

/* ------------------------------------------------------------------ */
/* Merkle root over the verified-work ledger                           */
/* ------------------------------------------------------------------ */

export function merkleRoot(leavesHex: string[]): string {
  if (leavesHex.length === 0) return '0'.repeat(64);
  let level = leavesHex.map((l) => sha256Hex(l));
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? level[i];
      next.push(sha256Hex(left + right));
    }
    level = next;
  }
  return level[0];
}

/* ------------------------------------------------------------------ */
/* Schnorr zero-knowledge proof of knowledge of a discrete logarithm   */
/* ------------------------------------------------------------------ */

/** RFC 3526 group 14 (2048-bit MODP). Prime p, order q = (p-1)/2, generator 2. */
/**
 * Canonical RFC 3526 section 3 prime, transcribed from its 64 32-bit words.
 * `npm test` re-checks it: p is prime, q = (p-1)/2 is prime, and Fermat holds.
 */
export const SCHNORR_P_HEX =
  'ffffffffffffffffc90fdaa22168c234c4c6628b80dc1cd129024e088a67cc74020bbea6' +
  '3b139b22514a08798e3404ddef9519b3cd3a431b302b0a6df25f14374fe1356d6d51c245' +
  'e485b576625e7ec6f44c42e9a637ed6b0bff5cb6f406b7edee386bfb5a899fa5ae9f2411' +
  '7c4b1fe649286651ece45b3dc2007cb8a163bf0598da48361c55d39a69163fa8fd24cf5f' +
  '83655d23dca3ad961c62f356208552bb9ed529077096966d670c354e4abc9804f1746c08' +
  'ca18217c32905e462e36ce3be39e772c180e86039b2783a2ec07a28fb5c55df06f4c52c9' +
  'de2bcbf6955817183995497cea956ae515d2261898fa051015728e5a8aacaa68ffffffff' +
  'ffffffff';

export const SCHNORR_P = BigInt('0x' + SCHNORR_P_HEX);
export const SCHNORR_Q = (SCHNORR_P - 1n) / 2n;
export const SCHNORR_G = 2n;

export function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base %= mod;
  if (base < 0n) base += mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    base = (base * base) % mod;
    exp >>= 1n;
  }
  return result;
}

function randomBigIntBelow(limit: bigint): bigint {
  const bits = limit.toString(2).length;
  const bytes = Math.ceil(bits / 8);
  const buf = new Uint8Array(bytes);
  const cryptoObj: Crypto = (globalThis as any).crypto;
  for (;;) {
    cryptoObj.getRandomValues(buf);
    let candidate = 0n;
    for (let i = 0; i < bytes; i++) candidate = (candidate << 8n) | BigInt(buf[i]);
    candidate >>= BigInt(bytes * 8 - bits);
    if (candidate > 0n && candidate < limit) return candidate;
  }
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (let i = 0; i < bytes.length; i++) value = (value << 8n) | BigInt(bytes[i]);
  return value;
}

const toHex = (value: bigint) => value.toString(16);
const fromHex = (value: string) => BigInt('0x' + (value || '0'));

export interface SchnorrStatement {
  /** Public key y = g^x mod p. The secret x never leaves the prover. */
  y: string;
  /** Optional domain label bound into the Fiat–Shamir challenge. */
  label: string;
}

export interface SchnorrProof {
  statement: SchnorrStatement;
  /** Commitment t = g^r mod p. */
  t: string;
  /** Response s = r + c*x mod q. */
  s: string;
  /** Challenge c = H(label || g || y || t) mod q. */
  c: string;
  /** Proof generation time in milliseconds (measured, not estimated). */
  elapsedMs: number;
}

export function schnorrChallenge(label: string, y: bigint, t: bigint): bigint {
  const digest = sha256Bytes(encoder.encode(`${label}|${SCHNORR_G.toString(16)}|${y.toString(16)}|${t.toString(16)}`));
  return bytesToBigInt(digest) % SCHNORR_Q;
}

/** Prove knowledge of the discrete log of `y` without revealing it. */
export function proveKnowledgeOfDiscreteLog(
  x: bigint,
  label: string,
): { proof: SchnorrProof; y: bigint } {
  const started = Date.now();
  const y = modPow(SCHNORR_G, x, SCHNORR_P);
  const r = randomBigIntBelow(SCHNORR_Q);
  const t = modPow(SCHNORR_G, r, SCHNORR_P);
  const c = schnorrChallenge(label, y, t);
  const s = (r + c * x) % SCHNORR_Q;
  return {
    proof: {
      statement: { y: toHex(y), label },
      t: toHex(t),
      s: toHex(s),
      c: toHex(c),
      elapsedMs: Date.now() - started,
    },
    y,
  };
}

export interface SchnorrVerification {
  valid: boolean;
  reason?: string;
  recomputedChallenge: string;
  /** g^s mod p, which must equal t * y^c mod p for the proof to hold. */
  lhs: string;
  rhs: string;
  challengeMatches: boolean;
  equationHolds: boolean;
  elapsedMs: number;
}

/** Verify a Schnorr proof. Anyone can run this; it leaks nothing about x. */
export function verifySchnorrProof(proof: SchnorrProof): SchnorrVerification {
  const started = Date.now();
  const fail = (reason: string): SchnorrVerification => ({
    valid: false,
    reason,
    recomputedChallenge: '',
    lhs: '',
    rhs: '',
    challengeMatches: false,
    equationHolds: false,
    elapsedMs: Date.now() - started,
  });

  if (!proof || typeof proof !== 'object') return fail('proof payload missing');
  const { statement, t, s, c } = proof;
  if (!statement || typeof statement.y !== 'string' || typeof statement.label !== 'string') {
    return fail('statement.y and statement.label are required');
  }
  if (typeof t !== 'string' || typeof s !== 'string' || typeof c !== 'string') {
    return fail('t, s and c are required');
  }
  if (statement.label.length > 256) return fail('label too long');
  if (!/^[0-9a-f]+$/i.test(statement.y) || !/^[0-9a-f]+$/i.test(t) || !/^[0-9a-f]+$/i.test(s)) {
    return fail('y, t and s must be hexadecimal');
  }

  const y = fromHex(statement.y);
  const tBig = fromHex(t);
  const sBig = fromHex(s);
  const cBig = fromHex(c);

  if (y <= 1n || y >= SCHNORR_P) return fail('y is not in the group');
  if (tBig <= 0n || tBig >= SCHNORR_P) return fail('t is not in the group');
  if (sBig < 0n || sBig >= SCHNORR_Q) return fail('s is not reduced modulo q');

  // Fiat–Shamir soundness: the challenge must be the hash of the transcript.
  const recomputedChallenge = schnorrChallenge(statement.label, y, tBig);
  const challengeMatches = recomputedChallenge === cBig;

  // Sigma-protocol equation: g^s == t * y^c (mod p).
  const lhs = modPow(SCHNORR_G, sBig, SCHNORR_P);
  const rhs = (tBig * modPow(y, cBig, SCHNORR_P)) % SCHNORR_P;
  const equationHolds = lhs === rhs;

  return {
    valid: challengeMatches && equationHolds,
    reason: !challengeMatches
      ? 'challenge does not match Fiat–Shamir transcript (proof was altered)'
      : !equationHolds
        ? 'g^s != t * y^c (mod p): the prover does not know the discrete log of y'
        : undefined,
    recomputedChallenge: recomputedChallenge.toString(16),
    lhs: lhs.toString(16),
    rhs: rhs.toString(16),
    challengeMatches,
    equationHolds,
    elapsedMs: Date.now() - started,
  };
}

/** Random secret exponent, in [1, q-1]. */
export function randomSecretExponent(): bigint {
  return randomBigIntBelow(SCHNORR_Q);
}

export const cryptoSelfDescription = {
  hash: 'SHA-256 (FIPS 180-4), implemented in shared/crypto.ts',
  pow: 'SHA-256 proof of work, leading-zero-bit difficulty, independently re-verified server-side',
  zkp: 'Schnorr proof of knowledge of a discrete logarithm, Fiat–Shamir transformed, RFC 3526 2048-bit MODP group',
};
