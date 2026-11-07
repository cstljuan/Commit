import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from 'tweetnacl-util';

/**
 * End-to-end encryption for match chat. Pure functions with no storage or network, so
 * scripts/test-e2ee.mts can test the real code. Run: npx tsx scripts/test-e2ee.mts
 *
 * A message is NaCl box (X25519, XSalsa20, Poly1305) with a fresh random nonce. The server stores
 * only `e2e1.<nonce>.<ciphertext>`. Box alone proves "one of us two wrote this", so the sealed
 * payload also names the match and the sender. That stops the server replaying a message in another
 * chat or reflecting your own message back as if the other person wrote it.
 *
 * What this does not hide: who talks to whom, when, and roughly how long each message is.
 * The server can also drop messages. It cannot read or forge them.
 */
export const SEALED_PREFIX = 'e2e1.';

type Payload = { m: string; f: string; t: string };

export const isSealed = (body: string) => body.startsWith(SEALED_PREFIX);

export const seal = (text: string, matchId: string, senderPublic: string, recipientPublic: string, senderSecret: Uint8Array): string => {
  const payload: Payload = { m: matchId, f: senderPublic, t: text };
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const box = nacl.box(decodeUTF8(JSON.stringify(payload)), nonce, decodeBase64(recipientPublic), senderSecret);
  return `${SEALED_PREFIX}${encodeBase64(nonce)}.${encodeBase64(box)}`;
};

/** Returns the text, or throws if it was tampered with, moved between chats, or reflected. */
export const open = (body: string, matchId: string, expectedSender: string, peerPublic: string, mySecret: Uint8Array): string => {
  if (!isSealed(body)) throw new Error('Not an encrypted message');
  const [nonce, box] = body.slice(SEALED_PREFIX.length).split('.');
  if (!nonce || !box) throw new Error('Malformed message');
  const plain = nacl.box.open(decodeBase64(box), decodeBase64(nonce), decodeBase64(peerPublic), mySecret);
  if (!plain) throw new Error('Could not decrypt');
  const payload = JSON.parse(encodeUTF8(plain)) as Payload;
  if (payload.m !== matchId) throw new Error('Message belongs to another chat');
  if (payload.f !== expectedSender) throw new Error('Message sender does not match');
  return payload.t;
};

const sortedKeys = (a: string, b: string) => [a, b].sort();

/**
 * The number both people compare, like Signal's safety numbers. Same on both phones, because the
 * keys are sorted first. A server that swapped a key to read messages would change this number.
 */
export const safetyNumber = (keyA: string, keyB: string): string[] => {
  const [first, second] = sortedKeys(keyA, keyB);
  let digest = nacl.hash(decodeUTF8(`commit-safety-v1|${first}|${second}`));
  for (let i = 0; i < 1024; i++) digest = nacl.hash(digest);
  const groups: string[] = [];
  for (let i = 0; i < 6; i++) {
    const value = (digest[i * 3] << 16) | (digest[i * 3 + 1] << 8) | digest[i * 3 + 2];
    groups.push(String(value % 100000).padStart(5, '0'));
  }
  return groups;
};

/** Shows both creatures in the same order on both phones. */
export const orderedPair = (keyA: string, keyB: string) => sortedKeys(keyA, keyB) as [string, string];

export type PinState = 'new' | 'same' | 'changed';

/** Trust on first use: remember the key seen first, and warn if it ever changes or disappears. */
export const checkPin = (pinned: string | null, current: string | null): PinState => {
  if (!pinned) return 'new';
  return pinned === current ? 'same' : 'changed';
};
