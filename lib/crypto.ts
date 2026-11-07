import 'react-native-get-random-values';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import * as SecureStore from 'expo-secure-store';

import { open as openSealed, seal } from './e2eeCore';

const BUNDLE = 'commit_keys_v1';
const BOX_SK = 'commit_box_sk';
const SIGN_SK = 'commit_sign_sk';
type Keys = { box: string; sign: string };
let pending: Promise<PublicKeys> | undefined;
export type PublicKeys = { boxPublicKey: string; signPublicKey: string };

async function loadKeys(): Promise<Keys | null> {
  const bundle = await SecureStore.getItemAsync(BUNDLE);
  if (bundle) {
    const keys: Keys = JSON.parse(bundle);
    nacl.box.keyPair.fromSecretKey(decodeBase64(keys.box));
    nacl.sign.keyPair.fromSecretKey(decodeBase64(keys.sign));
    return keys;
  }
  const [box, sign] = await Promise.all([
    SecureStore.getItemAsync(BOX_SK), SecureStore.getItemAsync(SIGN_SK),
  ]);
  if (Boolean(box) !== Boolean(sign)) throw new Error('Incomplete device keys. Do not regenerate.');
  if (!box || !sign) return null;
  nacl.box.keyPair.fromSecretKey(decodeBase64(box));
  nacl.sign.keyPair.fromSecretKey(decodeBase64(sign));
  return { box, sign };
}
export async function hasKeys(): Promise<boolean> { return (await loadKeys()) !== null; }
async function keys(): Promise<Keys> {
  const value = await loadKeys();
  if (!value) throw new Error('No key on this device');
  return value;
}
export async function getPublicKeys(): Promise<PublicKeys> {
  const value = await keys();
  return {
    boxPublicKey: encodeBase64(nacl.box.keyPair.fromSecretKey(decodeBase64(value.box)).publicKey),
    signPublicKey: encodeBase64(nacl.sign.keyPair.fromSecretKey(decodeBase64(value.sign)).publicKey),
  };
}
/** Idempotent and serialized: onboarding never replaces a signing identity. */
export function generateKeys(): Promise<PublicKeys> {
  if (!pending) pending = (async () => {
    if (await hasKeys()) return getPublicKeys();
    const box = nacl.box.keyPair();
    const sign = nacl.sign.keyPair();
    await SecureStore.setItemAsync(BUNDLE, JSON.stringify({
      box: encodeBase64(box.secretKey), sign: encodeBase64(sign.secretKey),
    }), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    return getPublicKeys();
  })().finally(() => { pending = undefined; });
  return pending;
}
export async function signContent(content: string): Promise<string> {
  return encodeBase64(nacl.sign.detached(decodeUTF8(content), decodeBase64((await keys()).sign)));
}
export function verifyContent(content: string, signature: string, publicKey: string): boolean {
  try { return nacl.sign.detached.verify(decodeUTF8(content), decodeBase64(signature), decodeBase64(publicKey)); }
  catch { return false; }
}
export const newTeamKey = (): string => encodeBase64(nacl.randomBytes(nacl.secretbox.keyLength));
export function encryptForTeam(text: string, key: string): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  return { ciphertext: encodeBase64(nacl.secretbox(decodeUTF8(text), nonce, decodeBase64(key))), nonce: encodeBase64(nonce) };
}
export function decryptForTeam(ciphertext: string, nonce: string, key: string): string {
  const value = nacl.secretbox.open(decodeBase64(ciphertext), decodeBase64(nonce), decodeBase64(key));
  if (!value) throw new Error('Decryption failed');
  return encodeUTF8(value);
}
export async function wrapTeamKeyFor(publicKey: string, key: string) {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  return { encrypted_team_key: encodeBase64(nacl.box(decodeBase64(key), nonce, decodeBase64(publicKey), decodeBase64((await keys()).box))), nonce: encodeBase64(nonce) };
}
export async function unwrapTeamKey(encrypted: string, nonce: string, senderPublicKey: string): Promise<string> {
  const value = nacl.box.open(decodeBase64(encrypted), decodeBase64(nonce), decodeBase64(senderPublicKey), decodeBase64((await keys()).box));
  if (!value || value.length !== nacl.secretbox.keyLength) throw new Error('Could not unwrap team key');
  return encodeBase64(value);
}
/** Seals a chat message for one person. The secret key stays in this file. See lib/e2eeCore.ts. */
export async function sealForPeer(text: string, matchId: string, peerPublicKey: string): Promise<string> {
  const secret = decodeBase64((await keys()).box);
  const mine = encodeBase64(nacl.box.keyPair.fromSecretKey(secret).publicKey);
  return seal(text, matchId, mine, peerPublicKey, secret);
}
export async function openFromPeer(body: string, matchId: string, expectedSender: string, peerPublicKey: string): Promise<string> {
  return openSealed(body, matchId, expectedSender, peerPublicKey, decodeBase64((await keys()).box));
}
