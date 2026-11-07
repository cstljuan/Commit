// Edge cases for lib/e2eeCore.ts. Run: npx tsx scripts/tests/e2ee-edge.mts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

import { checkPin, isSealed, open, orderedPair, safetyNumber, seal, SEALED_PREFIX } from '../../lib/e2eeCore.ts';

const person = () => {
  const keys = nacl.box.keyPair();
  return { pub: naclUtil.encodeBase64(keys.publicKey), secret: keys.secretKey };
};
const alice = person();
const bob = person();
const MATCH = 'match-1';
const roundTrip = (text: string) => {
  const body = seal(text, MATCH, alice.pub, bob.pub, alice.secret);
  return open(body, MATCH, alice.pub, alice.pub, bob.secret);
};

test('empty text round trips', () => {
  assert.equal(roundTrip(''), '');
});

test('unicode, emoji and combining marks round trip', () => {
  for (const t of ['café über', '\u{1F419}\u{1F680}\u{1F468}‍\u{1F469}‍\u{1F467}', '你好，世界', 'é', 'a\u0000b', '‮rtl']) {
    assert.equal(roundTrip(t), t);
  }
});

test('text with quotes, backslashes and newlines round trips', () => {
  const t = 'say "hi"\\ \n\ttab {"m":"x","f":"y","t":"z"}';
  assert.equal(roundTrip(t), t);
});

test('5000 character text round trips', () => {
  const t = 'x'.repeat(5000);
  assert.equal(roundTrip(t), t);
  const u = '\u{1F419}'.repeat(2500);
  assert.equal(roundTrip(u), u);
});

test('output has prefix, exactly two base64 segments and is isSealed', () => {
  const body = seal('hi', MATCH, alice.pub, bob.pub, alice.secret);
  assert.ok(body.startsWith(SEALED_PREFIX));
  const parts = body.slice(SEALED_PREFIX.length).split('.');
  assert.equal(parts.length, 2);
  assert.equal(naclUtil.decodeBase64(parts[0]).length, nacl.box.nonceLength);
});

test('isSealed is prefix only and case sensitive', () => {
  assert.ok(isSealed('e2e1.'));
  assert.ok(!isSealed('E2E1.x'));
  assert.ok(!isSealed(' e2e1.x'));
  assert.ok(!isSealed(''));
});

test('malformed payload "e2e1." is rejected as malformed', () => {
  assert.throws(() => open('e2e1.', MATCH, alice.pub, alice.pub, bob.secret), /Malformed/);
});

test('malformed payload "e2e1.abc" (no ciphertext) is rejected as malformed', () => {
  assert.throws(() => open('e2e1.abc', MATCH, alice.pub, alice.pub, bob.secret), /Malformed/);
});

test('empty nonce or empty box is rejected', () => {
  assert.throws(() => open('e2e1..abc', MATCH, alice.pub, alice.pub, bob.secret), /Malformed/);
  assert.throws(() => open('e2e1.abc.', MATCH, alice.pub, alice.pub, bob.secret), /Malformed/);
});

test('bad base64 throws instead of returning text', () => {
  assert.throws(() => open('e2e1.!!!.???', MATCH, alice.pub, alice.pub, bob.secret));
  assert.throws(() => open('e2e1.@@@@.@@@@', MATCH, alice.pub, alice.pub, bob.secret));
});

test('valid base64 of the wrong length throws', () => {
  const short = naclUtil.encodeBase64(new Uint8Array(5));
  assert.throws(() => open(`e2e1.${short}.${short}`, MATCH, alice.pub, alice.pub, bob.secret));
});

test('extra dots in garbage payloads throw', () => {
  assert.throws(() => open('e2e1.a.b.c', MATCH, alice.pub, alice.pub, bob.secret));
  assert.throws(() => open('e2e1....', MATCH, alice.pub, alice.pub, bob.secret));
});

test('a real message with a trailing ".extra" segment is rejected (no ignored trailing data)', () => {
  const body = seal('hello', MATCH, alice.pub, bob.pub, alice.secret);
  assert.throws(() => open(`${body}.extra`, MATCH, alice.pub, alice.pub, bob.secret));
});

test('a truncated real message throws', () => {
  const body = seal('hello there', MATCH, alice.pub, bob.pub, alice.secret);
  assert.throws(() => open(body.slice(0, body.length - 10), MATCH, alice.pub, alice.pub, bob.secret));
});

test('swapping nonce and ciphertext segments throws', () => {
  const body = seal('hello', MATCH, alice.pub, bob.pub, alice.secret);
  const [n, c] = body.slice(SEALED_PREFIX.length).split('.');
  assert.throws(() => open(`${SEALED_PREFIX}${c}.${n}`, MATCH, alice.pub, alice.pub, bob.secret));
});

test('a bad public key size throws', () => {
  assert.throws(() => seal('hi', MATCH, alice.pub, naclUtil.encodeBase64(new Uint8Array(5)), alice.secret));
});

test('match id with dots and unicode is bound correctly', () => {
  const id = 'm.1.\u{1F419}';
  const body = seal('x', id, alice.pub, bob.pub, alice.secret);
  assert.equal(open(body, id, alice.pub, alice.pub, bob.secret), 'x');
  assert.throws(() => open(body, 'm.1.', alice.pub, alice.pub, bob.secret), /another chat/);
});

test('ciphertext length grows with the text (documented leak), not constant', () => {
  const a = seal('a', MATCH, alice.pub, bob.pub, alice.secret).length;
  const b = seal('a'.repeat(500), MATCH, alice.pub, bob.pub, alice.secret).length;
  assert.ok(b > a);
});

test('safety number is always 6 groups of exactly 5 digits (200 random key pairs)', () => {
  for (let i = 0; i < 200; i++) {
    const groups = safetyNumber(person().pub, person().pub);
    assert.equal(groups.length, 6);
    for (const g of groups) assert.match(g, /^\d{5}$/);
  }
});

test('safety number works for identical keys and arbitrary strings, and is deterministic', () => {
  const g = safetyNumber(alice.pub, alice.pub);
  assert.deepEqual(g, safetyNumber(alice.pub, alice.pub));
  for (const x of g) assert.match(x, /^\d{5}$/);
  for (const x of safetyNumber('', 'not a key')) assert.match(x, /^\d{5}$/);
});

test('safety number differs when either key differs, and between pairs', () => {
  const carol = person();
  assert.notDeepEqual(safetyNumber(alice.pub, bob.pub), safetyNumber(alice.pub, carol.pub));
  assert.notDeepEqual(safetyNumber(alice.pub, bob.pub), safetyNumber(bob.pub, carol.pub));
});

test('orderedPair is sorted and idempotent', () => {
  const [a, b] = orderedPair(bob.pub, alice.pub);
  assert.ok(a <= b);
  assert.deepEqual(orderedPair(a, b), [a, b]);
  assert.deepEqual(orderedPair('x', 'x'), ['x', 'x']);
});

test('checkPin edge cases', () => {
  assert.equal(checkPin(null, null), 'new');
  assert.equal(checkPin('', 'k'), 'new');
  assert.equal(checkPin('k', 'k'), 'same');
  assert.equal(checkPin('k', 'K'), 'changed');
  assert.equal(checkPin('k', null), 'changed');
});
