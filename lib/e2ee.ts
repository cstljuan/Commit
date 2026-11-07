import AsyncStorage from '@react-native-async-storage/async-storage';

import { getPublicKeys, hasKeys, openFromPeer, sealForPeer, verifyContent } from './crypto';
import { checkPin, isSealed, type PinState } from './e2eeCore';
import { supabase } from './supabase';
import { ideaRow } from './teamKeys';
import { vaultContent } from './vault';

// Pinned by account id, not username, so renaming cannot skip the key-change pause.
const PIN = 'commit.e2ee.pin2.';

/** `previous` keeps keys this person trusted before, so older messages still open after a new phone. */
type Pin = { key: string; verified: boolean; username: string; previous: string[] };

const readPin = async (peerId: string): Promise<Pin | null> => {
  const raw = await AsyncStorage.getItem(PIN + peerId).catch(() => null);
  try {
    const pin = raw ? (JSON.parse(raw) as Pin) : null;
    return pin ? { ...pin, previous: pin.previous ?? [] } : null;
  } catch {
    return null;
  }
};
const writePin = (peerId: string, pin: Pin) => AsyncStorage.setItem(PIN + peerId, JSON.stringify(pin)).catch(() => {});

export type ChatSecurity = {
  /** True when messages to this person are end-to-end encrypted right now. */
  sealed: boolean;
  /**
   * True only when plain text is allowed: first contact, and one side has no keys, which the
   * chat says out loud. Once a key is pinned, this chat never falls back to plain text.
   */
  plainAllowed: boolean;
  state: PinState | 'no-peer-key' | 'no-device-key' | 'lost-device-key' | 'error';
  verified: boolean;
  peerId: string | null;
  username: string;
  myKey: string | null;
  /** The key the server gives us now. Not trusted if it differs from the pinned one. */
  peerKey: string | null;
  /** Keys we trust for this person, newest first. Messages only open with these. */
  trustedKeys: string[];
};

const blocked = (username: string, state: ChatSecurity['state']): ChatSecurity => ({
  sealed: false, plainAllowed: false, state, verified: false, peerId: null, username, myKey: null, peerKey: null, trustedKeys: [],
});

/** Works out whether a chat can be encrypted, and pins the other person's key the first time. */
export async function chatSecurity(username: string): Promise<ChatSecurity> {
  try {
    // My key comes from this phone only. The server never decides whether I encrypt.
    const myKey = (await hasKeys()) ? (await getPublicKeys()).boxPublicKey : null;
    const { data, error } = await supabase.from('profiles').select('id, box_public_key').eq('username', username).maybeSingle();
    if (error) throw error;
    const peer = data as { id: string; box_public_key: string | null } | null;
    if (!peer) return blocked(username, 'error');
    const peerKey = peer.box_public_key;
    const pin = await readPin(peer.id);
    const trustedKeys = pin ? [pin.key, ...pin.previous] : peerKey ? [peerKey] : [];
    const base = { peerId: peer.id, username, myKey, peerKey, trustedKeys, verified: !!pin?.verified };
    const state = checkPin(pin?.key ?? null, peerKey);

    // A key that vanished or changed is treated as an attack until a person checks it.
    if (state === 'changed') return { ...base, sealed: false, plainAllowed: false, state, verified: false };
    if (!myKey) return { ...base, sealed: false, plainAllowed: !pin, state: pin ? 'lost-device-key' : 'no-device-key' };
    if (!peerKey) return { ...base, sealed: false, plainAllowed: true, state: 'no-peer-key' };
    if (state === 'new') await writePin(peer.id, { key: peerKey, verified: false, username, previous: [] });
    return { ...base, sealed: true, plainAllowed: false, state };
  } catch {
    // Could not check, so nothing is sent until it can.
    return blocked(username, 'error');
  }
}

/** The person compared numbers in person and they match. An older trusted key stays readable. */
export async function markVerified(security: ChatSecurity) {
  if (!security.peerId || !security.peerKey) return;
  const pin = await readPin(security.peerId);
  const previous = pin && pin.key !== security.peerKey ? [pin.key, ...pin.previous] : pin?.previous ?? [];
  await writePin(security.peerId, { key: security.peerKey, verified: true, username: security.username, previous });
}

/** Everyone whose key this phone has seen, for the Security Center. */
export async function listPins(): Promise<{ username: string; verified: boolean }[]> {
  const ids = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter((k) => k.startsWith(PIN));
  const pins = await Promise.all(ids.map((k) => readPin(k.slice(PIN.length))));
  return pins.filter((p): p is Pin => !!p).map((p) => ({ username: p.username, verified: p.verified }));
}

export const sealMessage = (text: string, matchId: string, security: ChatSecurity) => sealForPeer(text, matchId, security.peerKey as string);

/** `plain` marks a message stored without encryption inside a chat that is encrypted: anyone could have written it. */
export type Decoded = { body: string; cipher?: string; failed?: boolean; plain?: boolean };

/** Turns what the server stored into what the person reads. */
export async function decodeMessage(raw: string, mine: boolean, matchId: string, security: ChatSecurity | null): Promise<Decoded> {
  const encryptedChat = !!security && (security.sealed || security.trustedKeys.length > 0) && !security.plainAllowed;
  if (!isSealed(raw)) return encryptedChat ? { body: raw, plain: true } : { body: raw };
  if (!security?.myKey || !security.trustedKeys.length) return { body: 'Encrypted message. The keys are not on this phone.', cipher: raw, failed: true };
  for (const peer of security.trustedKeys) {
    try {
      return { body: await openFromPeer(raw, matchId, mine ? security.myKey : peer, peer), cipher: raw };
    } catch {
      // Try the next key this person trusted before.
    }
  }
  return { body: 'This message could not be verified, so it is hidden.', cipher: raw, failed: true };
}

/** Exactly what the database holds for a private idea, for the "what the server sees" view. */
export async function serverCopyOfIdea(projectId: string): Promise<string | null> {
  return (await ideaRow(projectId))?.idea_cipher ?? null;
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
