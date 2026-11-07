import AsyncStorage from '@react-native-async-storage/async-storage';

import { getPublicKeys, openFromPeer, sealForPeer, verifyContent } from './crypto';
import { checkPin, isSealed, type PinState } from './e2eeCore';
import { supabase } from './supabase';
import { getDeviceKeyState, vaultContent } from './vault';

const PIN = 'commit.e2ee.pin.';

type Pin = { key: string; verified: boolean };

const readPin = async (username: string): Promise<Pin | null> => {
  const raw = await AsyncStorage.getItem(PIN + username).catch(() => null);
  try {
    return raw ? (JSON.parse(raw) as Pin) : null;
  } catch {
    return null;
  }
};
const writePin = (username: string, pin: Pin) => AsyncStorage.setItem(PIN + username, JSON.stringify(pin)).catch(() => {});

export type ChatSecurity = {
  /** True when messages to this person are end-to-end encrypted right now. */
  sealed: boolean;
  state: PinState | 'no-peer-key' | 'no-device-key';
  verified: boolean;
  myKey: string | null;
  /** The key the server gives us now. Not trusted if it differs from the pinned one. */
  peerKey: string | null;
  /** The key we pinned first. Old messages keep opening with it, and a swapped key cannot read or forge. */
  trustedKey: string | null;
};

const peerKeyOf = async (username: string): Promise<string | null> => {
  const { data } = await supabase.from('profiles').select('box_public_key').eq('username', username).maybeSingle();
  return (data as { box_public_key: string | null } | null)?.box_public_key ?? null;
};

/** Works out whether a chat can be encrypted, and pins the other person's key the first time. */
export async function chatSecurity(username: string): Promise<ChatSecurity> {
  const device = await getDeviceKeyState().catch(() => 'new' as const);
  const myKey = device === 'ready' ? (await getPublicKeys()).boxPublicKey : null;
  const peerKey = await peerKeyOf(username);
  const pin = await readPin(username);
  const state = checkPin(pin?.key ?? null, peerKey);

  // A key that vanished or changed is treated as an attack until a person checks it.
  const trustedKey = pin?.key ?? null;
  if (state === 'changed') return { sealed: false, state, verified: false, myKey, peerKey, trustedKey };
  if (!myKey) return { sealed: false, state: 'no-device-key', verified: !!pin?.verified, myKey, peerKey, trustedKey };
  if (!peerKey) return { sealed: false, state: 'no-peer-key', verified: false, myKey, peerKey, trustedKey };
  if (state === 'new') await writePin(username, { key: peerKey, verified: false });
  return { sealed: true, state, verified: !!pin?.verified, myKey, peerKey, trustedKey: peerKey };
}

/** The person compared numbers and they match. */
export const markVerified = (username: string, key: string) => writePin(username, { key, verified: true });

/** Everyone whose key this phone has seen, for the Security Center. */
export async function listPins(): Promise<{ username: string; verified: boolean }[]> {
  const names = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter((k) => k.startsWith(PIN));
  const pins = await Promise.all(names.map(async (k) => ({ username: k.slice(PIN.length), pin: await readPin(k.slice(PIN.length)) })));
  return pins.map((p) => ({ username: p.username, verified: !!p.pin?.verified }));
}

export const sealMessage = (text: string, matchId: string, security: ChatSecurity) => sealForPeer(text, matchId, security.peerKey as string);

export type Decoded = { body: string; cipher?: string; failed?: boolean };

/** Turns what the server stored into what the person reads. Old plain messages pass through. */
export async function decodeMessage(raw: string, mine: boolean, matchId: string, security: ChatSecurity | null): Promise<Decoded> {
  if (!isSealed(raw)) return { body: raw };
  const peer = security?.trustedKey;
  if (!security?.myKey || !peer) return { body: 'Encrypted message. The keys are not on this phone.', cipher: raw, failed: true };
  try {
    return { body: await openFromPeer(raw, matchId, mine ? security.myKey : peer, peer), cipher: raw };
  } catch {
    return { body: 'This message could not be verified, so it is hidden.', cipher: raw, failed: true };
  }
}

/** Exactly what the database holds for a private idea, for the "what the server sees" view. */
export async function serverCopyOfIdea(projectId: string): Promise<string | null> {
  const { data } = await supabase.from('projects').select('idea_cipher').eq('id', projectId).maybeSingle();
  return (data as { idea_cipher: string | null } | null)?.idea_cipher ?? null;
}

export type ProofReceipt = {
  seq: number;
  ideaHash: string;
  ts: string;
  entryHash: string;
  prevHash: string;
  signature: string;
  signedByRightKey: boolean;
};

export async function proofFor(projectId: string): Promise<ProofReceipt | null> {
  const { data } = await supabase.from('vault_log').select('*').eq('project_id', projectId).order('seq', { ascending: false }).limit(1).maybeSingle();
  const row = data as { seq: number; idea_hash: string; ts: string; entry_hash: string; prev_hash: string; author_sig: string; author_id: string; project_id: string } | null;
  if (!row) return null;
  const { data: keys } = await supabase.rpc('vault_signing_keys');
  const key = ((keys ?? []) as { author_id: string; sign_public_key: string | null }[]).find((k) => k.author_id === row.author_id)?.sign_public_key;
  return {
    seq: row.seq,
    ideaHash: row.idea_hash,
    ts: row.ts,
    entryHash: row.entry_hash,
    prevHash: row.prev_hash,
    signature: row.author_sig,
    signedByRightKey: !!key && verifyContent(vaultContent(row.project_id, row.author_id, row.idea_hash, row.ts), row.author_sig, key),
  };
}
