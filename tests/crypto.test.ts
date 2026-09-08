import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import {
  sha256Hex,
  leadingZeroBits,
  meetsDifficulty,
  mineChunk,
  verifyPow,
  merkleRoot,
  proveKnowledgeOfDiscreteLog,
  verifySchnorrProof,
  schnorrChallenge,
  modPow,
  randomSecretExponent,
  SCHNORR_G,
  SCHNORR_P,
  SCHNORR_Q,
} from '../shared/crypto.ts';

const nodeSha256 = (input: string) => createHash('sha256').update(input, 'utf8').digest('hex');

test('sha256Hex matches node:crypto for the published FIPS vectors', () => {
  assert.equal(sha256Hex(''), nodeSha256(''));
  assert.equal(sha256Hex('abc'), nodeSha256('abc'));
  assert.equal(
    sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  assert.equal(
    sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  );
});

test('sha256Hex matches node:crypto across block boundaries, unicode and randomness', () => {
  const cases = ['', 'a', 'ab'.repeat(31), 'ab'.repeat(32), 'ab'.repeat(55), 'ab'.repeat(56), 'ab'.repeat(63), 'ab'.repeat(64)];
  for (const c of cases) assert.equal(sha256Hex(c), nodeSha256(c), `mismatch at length ${c.length}`);
  for (const s of ['gaia://node/heartbeat', 'héllo wörld — 你好 🌍', 'x'.repeat(1000)]) {
    assert.equal(sha256Hex(s), nodeSha256(s));
  }
  for (let i = 0; i < 50; i++) {
    const s = randomBytes(1 + (i % 200)).toString('hex');
    assert.equal(sha256Hex(s), nodeSha256(s));
  }
});

test('leadingZeroBits counts the real prefix of the digest', () => {
  assert.equal(leadingZeroBits('0'.repeat(64)), 256);
  assert.equal(leadingZeroBits('00ff' + '0'.repeat(60)), 8);
  assert.equal(leadingZeroBits('0f' + '0'.repeat(62)), 4);
  assert.equal(leadingZeroBits('1' + '0'.repeat(63)), 3);
  assert.equal(leadingZeroBits('7' + '0'.repeat(63)), 1);
  assert.equal(leadingZeroBits('8' + '0'.repeat(63)), 0);
  assert.equal(leadingZeroBits('f' + '0'.repeat(63)), 0);
  assert.ok(meetsDifficulty('0000abcd' + '0'.repeat(56), 16));
  assert.ok(!meetsDifficulty('000abcd' + '0'.repeat(57), 16));
});

test('mineChunk finds real work and verifyPow accepts it', () => {
  const header = `gaia:ledger:${Date.now()}`;
  let nonce = 0;
  let solution = null;
  for (let round = 0; round < 50 && !solution; round++) {
    const chunk = mineChunk(header, 16, nonce, 250);
    nonce = chunk.nextNonce;
    solution = chunk.solution;
  }
  assert.ok(solution, 'expected a solution at difficulty 16');
  assert.equal(solution.hash, nodeSha256(`${header}|${solution.nonce}`));
  assert.ok(solution.leadingZeros >= 16);
  assert.ok(solution.attempts >= 1);
  assert.ok(solution.hashrate > 0, 'hashrate must be measured, not assumed');

  const verdict = verifyPow(solution);
  assert.equal(verdict.valid, true);
  assert.equal(verdict.recomputedHash, solution.hash);
});

test('verifyPow rejects every kind of forgery', () => {
  const header = 'gaia:test';
  const good = mineChunk(header, 12, 0, 2000).solution;
  assert.ok(good);

  assert.equal(verifyPow({ ...good, nonce: good.nonce + 1 }).valid, false);
  assert.equal(verifyPow({ ...good, hash: '0'.repeat(64) }).valid, false);
  assert.equal(verifyPow({ ...good, difficulty: good.difficulty + 12 }).valid, false);
  assert.equal(verifyPow({ ...good, header: header + '-tampered' }).valid, false);
  assert.equal(verifyPow({ ...good, hash: 'XYZ' }).valid, false);
  assert.equal(verifyPow({ ...good, nonce: -5 }).valid, false);
  assert.equal(verifyPow({ ...good, difficulty: 0 }).valid, false);
});

test('merkleRoot matches a reference built from node:crypto', () => {
  const leaves = ['block-1', 'block-2', 'block-3', 'block-4', 'block-5'];
  let level = leaves.map(nodeSha256);
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? level[i];
      next.push(nodeSha256(left + right));
    }
    level = next;
  }
  assert.equal(merkleRoot(leaves), level[0]);
  assert.equal(merkleRoot([]), '0'.repeat(64));
  // a single-leaf tree is just the hash of that leaf
  assert.equal(merkleRoot(['only']), nodeSha256('only'));
  assert.equal(merkleRoot(['a', 'b']), nodeSha256(nodeSha256('a') + nodeSha256('b')));
});

test('Schnorr proof verifies, and the verifier equation is the real one', () => {
  const x = randomSecretExponent();
  const label = 'gaia-node-1';
  const { proof, y } = proveKnowledgeOfDiscreteLog(x, label);

  assert.equal(modPow(SCHNORR_G, x, SCHNORR_P), y);
  const verdict = verifySchnorrProof(proof);
  assert.equal(verdict.valid, true, verdict.reason);
  assert.equal(verdict.equationHolds, true);
  assert.equal(verdict.challengeMatches, true);
  assert.equal(BigInt('0x' + verdict.recomputedChallenge), schnorrChallenge(label, y, BigInt('0x' + proof.t)));
  assert.equal(BigInt('0x' + verdict.lhs), BigInt('0x' + verdict.rhs));
});

test('Schnorr verification catches tampering with s, t, c or y', () => {
  const x = randomSecretExponent();
  const { proof } = proveKnowledgeOfDiscreteLog(x, 'label-a');

  const bump = (hex: string) => ((BigInt('0x' + hex) + 1n) % SCHNORR_Q).toString(16);

  assert.equal(verifySchnorrProof({ ...proof, s: bump(proof.s) }).valid, false);
  assert.equal(verifySchnorrProof({ ...proof, t: bump(proof.t) }).valid, false);
  assert.equal(verifySchnorrProof({ ...proof, c: bump(proof.c) }).valid, false);
  assert.equal(
    verifySchnorrProof({ ...proof, statement: { ...proof.statement, y: bump(proof.statement.y) } }).valid,
    false,
  );
  assert.equal(
    verifySchnorrProof({ ...proof, statement: { ...proof.statement, label: 'label-b' } }).valid,
    false,
  );
});

test('a proof for one statement does not transfer to another', () => {
  const { proof } = proveKnowledgeOfDiscreteLog(randomSecretExponent(), 'statement-one');
  const other = proveKnowledgeOfDiscreteLog(randomSecretExponent(), 'statement-two');
  assert.equal(verifySchnorrProof({ ...proof, statement: other.proof.statement }).valid, false);
});

test('Schnorr verification rejects malformed payloads', () => {
  assert.equal(verifySchnorrProof(undefined as any).valid, false);
  assert.equal(verifySchnorrProof({} as any).valid, false);
  assert.equal(
    verifySchnorrProof({ statement: { y: '0', label: 'x' }, t: '0', s: '0', c: '0', elapsedMs: 0 }).valid,
    false,
  );
});

test('group parameters are the RFC 3526 2048-bit MODP group', () => {
  assert.equal(SCHNORR_P.toString(16).length, 512);
  assert.equal(SCHNORR_Q, (SCHNORR_P - 1n) / 2n);

  const millerRabin = (n: bigint): boolean => {
    if (n < 2n) return false;
    const small = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];
    for (const s of small) {
      if (n === s) return true;
      if (n % s === 0n) return false;
    }
    let d = n - 1n, r = 0n;
    while (d % 2n === 0n) { d /= 2n; r++; }
    for (const a of small) {
      let x = modPow(a, d, n);
      if (x === 1n || x === n - 1n) continue;
      let composite = true;
      for (let i = 1n; i < r; i++) {
        x = (x * x) % n;
        if (x === n - 1n) { composite = false; break; }
      }
      if (composite) return false;
    }
    return true;
  };

  // p must be a safe prime: p prime and q = (p-1)/2 prime, otherwise the
  // Schnorr group order claim (and soundness) would not hold.
  assert.equal(millerRabin(SCHNORR_P), true, 'p is not prime');
  assert.equal(millerRabin(SCHNORR_Q), true, 'q = (p-1)/2 is not prime');
  for (const base of [2n, 3n, 5n, 7n]) {
    assert.equal(modPow(base, SCHNORR_P - 1n, SCHNORR_P), 1n);
  }
  // generator 2 must have order q in the subgroup used by the protocol
  assert.equal(modPow(SCHNORR_G, SCHNORR_Q, SCHNORR_P) === 1n, true);
});
