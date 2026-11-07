import type { SupabaseClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import { generateKeys, hasKeys, getPublicKeys, signContent, verifyContent } from './crypto';

export type VaultEntry = {
  seq: number; project_id: string; author_id: string; idea_hash: string; ts: string;
  author_sig: string; prev_hash: string; entry_hash: string;
};
export type VaultCheckpoint = { last_seq: number; last_entry_hash: string; server_sig: string };
export type Verification = { seq: number; ok: boolean; reason?: string };
// Set to the public key of the deployed checkpoint signer, never a value returned by the API.
export const SERVER_SIGNING_PUBLIC_KEY = 'BeyaY0GUYeyJnFrVc2h7P87aKq/kFVWoOGKfC2uu8tI=';
let client: SupabaseClient | undefined;
export function configureCyberClient(value: SupabaseClient): void { client = value; }
export function getCyberClient(): SupabaseClient {
  if (!client) throw new Error('Cyber client unavailable. Call configureCyberClient(supabase) first.');
  return client;
}
export async function cyberUser(): Promise<string> {
  const { data, error } = await getCyberClient().auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in first');
  return data.user.id;
}
export const sha256 = (value: string): Promise<string> => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
export const vaultContent = (projectId: string, authorId: string, ideaHash: string, ts: string): string =>
  `${projectId}|${authorId}|${ideaHash}|${new Date(ts).toISOString()}`;
export function hashIdea(ts: string, idea: string): Promise<string> {
  return sha256(`${new Date(ts).toISOString()}::${idea}`);
}
export async function appendVault(projectId: string, ideaHash: string, ts: string): Promise<VaultEntry> {
  const authorId = await cyberUser();
  const { data: profile, error: profileError } = await getCyberClient().from('profiles')
    .select('sign_public_key').eq('id', authorId).single();
  if (profileError) throw profileError;
  if (profile.sign_public_key !== (await getPublicKeys()).signPublicKey) throw new Error('This account uses different device keys');
  const { data, error } = await getCyberClient().rpc('append_vault_entry', {
    p_project: projectId, p_idea_hash: ideaHash, p_ts: new Date(ts).toISOString(),
    p_sig: await signContent(vaultContent(projectId, authorId, ideaHash, ts)),
  });
  if (error) throw error;
  if (!data) throw new Error('Vault append returned no entry');
  return data as VaultEntry;
}
/** Pure verifier also used by local tamper tests. A checkpoint must anchor an existing row (F15). */
export async function verifyVaultSnapshot(rows: VaultEntry[], publicKeys: Record<string, string>, checkpoint: VaultCheckpoint | null,
  serverPublicKey = SERVER_SIGNING_PUBLIC_KEY): Promise<Verification[]> {
  const results: Verification[] = [];
  let previous = '0'.repeat(64);
  let previousSeq = 0;
  let broken = false;
  for (const row of rows) {
    let reason: string | undefined;
    try {
      const content = vaultContent(row.project_id, row.author_id, row.idea_hash, row.ts);
      if (!Number.isSafeInteger(row.seq) || row.seq <= previousSeq || row.prev_hash !== previous || broken) reason = 'chain broken';
      else if (await sha256(`${content}|${previous}`) !== row.entry_hash) reason = 'entry edited';
      else if (!publicKeys[row.author_id] || !verifyContent(content, row.author_sig, publicKeys[row.author_id])) reason = 'signature invalid';
    } catch { reason = 'entry edited'; }
    results.push({ seq: row.seq, ok: !reason, ...(reason ? { reason } : {}) });
    broken ||= Boolean(reason);
    previous = row.entry_hash;
    previousSeq = row.seq;
  }
  if (checkpoint) {
    const anchored = rows.find(row => row.seq === checkpoint.last_seq);
    if (!serverPublicKey || !anchored || anchored.entry_hash !== checkpoint.last_entry_hash ||
      !verifyContent(`${checkpoint.last_seq}|${checkpoint.last_entry_hash}`, checkpoint.server_sig, serverPublicKey)) {
      results.push({ seq: checkpoint.last_seq, ok: false, reason: 'checkpoint invalid' });
    }
  } else {
    results.push({ seq: rows.at(-1)?.seq ?? 0, ok: false, reason: 'checkpoint unavailable' });
  }
  return results;
}
async function readAll(table: string, columns: string, order: string) {
  const rows: Record<string, any>[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await getCyberClient().from(table).select(columns).order(order).range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}
export async function verifyChain(): Promise<Verification[]> {
  // Fetch the checkpoint first: concurrent appends after it are a valid uncheckpointed tail.
  const { data: checkpoints, error } = await getCyberClient().from('vault_checkpoints')
    .select('last_seq,last_entry_hash,server_sig').order('last_seq', { ascending: false }).limit(1);
  if (error) throw error;
  const rows = await readAll('vault_log', '*', 'seq') as VaultEntry[];
  const { data: signingKeys, error: signingError } = await getCyberClient().rpc('vault_signing_keys');
  if (signingError) throw signingError;
  const publicKeys: Record<string, string> = {};
  for (const key of signingKeys ?? []) {
    if (key.sign_public_key) publicKeys[key.author_id] = key.sign_public_key;
  }
  return verifyVaultSnapshot(rows, publicKeys, checkpoints?.[0] ?? null);
}

export type DeviceKeyState = 'ready' | 'new' | 'register' | 'other-device';
export async function getDeviceKeyState(): Promise<DeviceKeyState> {
  const id = await cyberUser();
  const { data, error } = await getCyberClient().from('profiles').select('box_public_key,sign_public_key').eq('id', id).single();
  if (error) throw error;
  const local = await hasKeys();
  if (data.box_public_key || data.sign_public_key) {
    if (!local) return 'other-device';
    const keys = await getPublicKeys();
    return keys.boxPublicKey === data.box_public_key && keys.signPublicKey === data.sign_public_key ? 'ready' : 'other-device';
  }
  return local ? 'register' : 'new';
}
export async function registerDeviceKeys(): Promise<void> {
  const id = await cyberUser();
  const state = await getDeviceKeyState();
  if (state === 'ready') return;
  if (state === 'other-device') throw new Error("This account's keys are on another device. Open Commit there.");
  const keys = await generateKeys();
  const { data, error } = await getCyberClient().from('profiles').update({
    box_public_key: keys.boxPublicKey, sign_public_key: keys.signPublicKey,
  }).eq('id', id).is('box_public_key', null).is('sign_public_key', null).select('id');
  if (error) throw error;
  if (!data?.length && await getDeviceKeyState() !== 'ready') throw new Error('Account keys changed. Use the original device.');
}
