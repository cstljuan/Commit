// One command to put the hosted project back in the exact demo state.
//   npx tsx scripts/seed/reset-demo.mts
// Idempotent: run it as often as you like (before the demo, after QA runs, after a rehearsal).
//
// What it does, in order:
//   1. Removes QA accounts (emails ending @qa-commit.dev, created by the e2e and red-team workstreams):
//      their projects (unless they have vault entries, F3), swipes, matches, chat rows, then the auth users.
//   2. Makes sure Alice and Bob have NO device keys, so each phone goes through the keys screen once.
//      Keys cannot be changed once set (trigger preserve_profile_keys, F11), so if an account has keys and
//      no vault entries, the auth user is deleted and recreated with the same email and password
//      (the profile cascades; the user id changes, which is fine). With vault entries it reports and stops there.
//   3. Runs the seed (scripts/seed/seed.mts): demo-domain reset, then profiles, projects, swipes,
//      the copy alert and Bob's sample match.
//   4. Signs in as Bob and Alice with the publishable key (like the app) and prints a YES/NO checklist.
// Never touches an account outside @qa-commit.dev and @commit-demo.dev.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { DEMO_DOMAIN, projects as seedProjects, sampleMatch, copyRewrite } from './data.mts';
import { api, env, inList, reset, rest, seed } from './seed.mts';

const QA_DOMAIN = 'qa-commit.dev';

type AuthUser = { id: string; email: string };

async function authUsers(): Promise<AuthUser[]> {
  const out: AuthUser[] = [];
  for (let page = 1; page < 50; page++) {
    const j = await api(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const list = j.users ?? [];
    out.push(...list.map((u: any) => ({ id: u.id, email: String(u.email ?? '') })));
    if (list.length < 200) break;
  }
  return out;
}

const local = (email: string) => email.split('@')[0];

/** Deletes chat rows written by these users (sender_id has no cascade and would block the auth delete). */
async function dropChatRows(ids: string[]) {
  if (!ids.length) return;
  await rest(`match_messages?sender_id=${inList(ids)}`, { method: 'DELETE' });
  await rest(`messages?sender_id=${inList(ids)}`, { method: 'DELETE' });
}

// ---------- 1. QA cleanup ----------

async function cleanupQa(all: AuthUser[]) {
  const qa = all.filter((u) => u.email.toLowerCase().endsWith('@' + QA_DOMAIN));
  if (!qa.length) {
    console.log('qa: no @qa-commit.dev accounts found');
    return;
  }
  const ids = qa.map((u) => u.id);
  const owned: { id: string; title: string; owner_id: string }[] = await rest(`projects?select=id,title,owner_id&owner_id=${inList(ids)}`);
  let lockedProjects = new Set<string>();
  if (owned.length) {
    const v = await rest(`vault_log?select=project_id&project_id=${inList(owned.map((p) => p.id))}`);
    lockedProjects = new Set(v.map((r: any) => r.project_id));
  }
  const authored = await rest(`vault_log?select=author_id&author_id=${inList(ids)}`);
  const vaultAuthors = new Set<string>(authored.map((r: any) => r.author_id));

  await dropChatRows(ids);
  await rest(`swipes?swiper_id=${inList(ids)}`, { method: 'DELETE' });
  await rest(`swipes?target_id=${inList(ids)}`, { method: 'DELETE' });
  await rest(`matches?user_id=${inList(ids)}`, { method: 'DELETE' });
  const deletable = owned.filter((p) => !lockedProjects.has(p.id)).map((p) => p.id);
  if (deletable.length) await rest(`projects?id=${inList(deletable)}`, { method: 'DELETE' });

  let deleted = 0;
  for (const u of qa) {
    const keepsProject = owned.some((p) => p.owner_id === u.id && lockedProjects.has(p.id));
    if (vaultAuthors.has(u.id) || keepsProject) {
      console.log(`qa: KEPT ${local(u.email)}@${QA_DOMAIN}: has vault entries (F3, vault rows cannot be deleted)`);
      continue;
    }
    try {
      await api(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' });
      deleted++;
    } catch (e) {
      console.log(`qa: could not delete ${local(u.email)}@${QA_DOMAIN}: ${(e as Error).message}`);
    }
  }
  console.log(`qa: deleted ${deleted} of ${qa.length} QA account(s), ${deletable.length} project(s)` +
    (lockedProjects.size ? `, skipped ${lockedProjects.size} project(s) with vault entries (F3): ` +
      owned.filter((p) => lockedProjects.has(p.id)).map((p) => p.title).join(', ') : ''));
}

// ---------- 2. Demo accounts start with no device keys ----------

async function clearDemoKeys(all: AuthUser[]) {
  const demo = [
    { label: 'Alice', email: env.DEMO_ALICE_EMAIL, password: env.DEMO_ALICE_PASSWORD },
    { label: 'Bob', email: env.DEMO_BOB_EMAIL, password: env.DEMO_BOB_PASSWORD },
  ];
  for (const d of demo) {
    if (!d.email || !d.password) throw new Error(`scripts/.env needs DEMO_${d.label.toUpperCase()}_EMAIL and _PASSWORD`);
    if (!d.email.endsWith('@' + DEMO_DOMAIN)) throw new Error(`${d.label} is not on the demo domain, refusing to touch it`);
    const u = all.find((x) => x.email.toLowerCase() === d.email.toLowerCase());
    if (!u) {
      console.log(`keys: ${d.label} has no account yet, the seed creates it without keys`);
      continue;
    }
    const [p] = await rest(`profiles?select=box_public_key,sign_public_key&id=eq.${u.id}`);
    if (!p?.box_public_key && !p?.sign_public_key) {
      console.log(`keys: ${d.label} has no device keys, nothing to do`);
      continue;
    }
    const byAuthor = await rest(`vault_log?select=seq&author_id=eq.${u.id}`);
    const owned: { id: string }[] = await rest(`projects?select=id&owner_id=eq.${u.id}`);
    const onProjects = owned.length ? await rest(`vault_log?select=seq&project_id=${inList(owned.map((x) => x.id))}`) : [];
    if (byAuthor.length || onProjects.length) {
      console.log(`keys: ${d.label} HAS device keys and ${byAuthor.length + onProjects.length} vault entr(ies). ` +
        'Vault rows cannot be deleted (F3) and keys cannot be replaced (F11), so the account was left as is. ' +
        'Use a fresh demo email for this account, or ask the backend owner.');
      continue;
    }
    // Recreate the auth user: profile, projects, swipes, matches and alerts cascade.
    await dropChatRows([u.id]);
    await api(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' });
    await api('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email: d.email, password: d.password, email_confirm: true }),
    });
    console.log(`keys: ${d.label} had device keys and no vault entries, account recreated with the same email and password (new id, no keys)`);
  }
}

// ---------- 4. Checklist, verified through the publishable key ----------

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in failed for ${local(email)}: ${error.message}`);
  return c;
}

async function checklist(copyProjectId: string): Promise<boolean> {
  const rows: [string, boolean, string][] = [];
  const check = async (label: string, fn: () => Promise<[boolean, string]>) => {
    try {
      const [ok, note] = await fn();
      rows.push([label, ok, note]);
    } catch (e) {
      rows.push([label, false, (e as Error).message]);
    }
  };

  const bob = await signedIn(env.DEMO_BOB_EMAIL, env.DEMO_BOB_PASSWORD);
  const alice = await signedIn(env.DEMO_ALICE_EMAIL, env.DEMO_ALICE_PASSWORD);
  const bobId = (await bob.auth.getUser()).data.user!.id;
  const aliceId = (await alice.auth.getUser()).data.user!.id;

  const keysOf = async (c: SupabaseClient, id: string): Promise<[boolean, string]> => {
    const { data, error } = await c.from('profiles').select('box_public_key, sign_public_key').eq('id', id).single();
    if (error) throw error;
    return [!data.box_public_key && !data.sign_public_key, `box ${data.box_public_key ? 'set' : 'null'}, sign ${data.sign_public_key ? 'set' : 'null'}`];
  };
  await check('Alice has no device keys (keys screen on first sign in)', () => keysOf(alice, aliceId));
  await check('Bob has no device keys (keys screen on first sign in)', () => keysOf(bob, bobId));

  await check('Bob: Who wants you has 3 cards, exactly 1 Super Commit', async () => {
    const { data, error } = await bob.rpc('get_interested');
    if (error) throw error;
    const cards = (data ?? []) as { isSuper: boolean }[];
    const supers = cards.filter((c) => c.isSuper).length;
    return [cards.length === 3 && supers === 1, `${cards.length} cards, ${supers} super`];
  });

  const { data: deck, error: deckErr } = await bob.rpc('get_deck', { p_mode: 'normal' });
  const bobDeck = (deck ?? []) as { id: string; title?: string; ownerUsername?: string }[];
  await check('Bob: Pocket Tutor (alice_ships) is first in the Normal deck', async () => {
    if (deckErr) throw deckErr;
    const first = bobDeck[0];
    return [first?.title === 'Pocket Tutor' && first?.ownerUsername === 'alice_ships',
      `first card: ${first?.title ?? 'none'} by ${first?.ownerUsername ?? '?'} (${bobDeck.length} cards)`];
  });

  await check('Alice already liked Bob for Pocket Tutor (Bob right swipe matches)', async () => {
    const { data: tutor } = await alice.from('projects').select('id').eq('owner_id', aliceId).eq('title', 'Pocket Tutor');
    if (!tutor?.length) return [false, 'Pocket Tutor not found'];
    const { data, error } = await alice.from('swipes').select('direction')
      .eq('swiper_id', aliceId).eq('target_id', bobId).eq('project_id', tutor[0].id).eq('direction', 'right');
    if (error) throw error;
    const { data: bobSwipes } = await bob.from('swipes').select('id').eq('swiper_id', bobId);
    return [(data?.length ?? 0) === 1 && (bobSwipes?.length ?? 0) === 0,
      `alice like: ${data?.length ?? 0}, bob swipes so far: ${bobSwipes?.length ?? 0}`];
  });

  await check('Alice: copy alert on Pocket Tutor', async () => {
    const { data, error } = await alice.from('copy_alerts').select('similarity, project:projects(title)');
    if (error) throw error;
    const onTutor = (data ?? []).filter((a: any) => a.project?.title === 'Pocket Tutor');
    return [onTutor.length === 1, `${onTutor.length} alert(s) on Pocket Tutor` +
      (onTutor[0] ? `, similarity ${Number(onTutor[0].similarity).toFixed(3)}` : '')];
  });

  await check(`Copy rewrite "${copyRewrite.title}" is hidden and in no deck`, async () => {
    const { data } = await bob.from('projects').select('hidden').eq('id', copyProjectId).maybeSingle();
    const { data: aDeck } = await alice.rpc('get_deck', { p_mode: 'normal' });
    const inDeck = bobDeck.some((c) => c.id === copyProjectId)
      || ((aDeck ?? []) as { id: string }[]).some((c) => c.id === copyProjectId);
    return [data?.hidden === true && !inDeck, `hidden ${data?.hidden}, in a deck: ${inDeck}`];
  });

  await check('Women projects Courtside and Sublet Sync are normal posts (in Women deck, not in Normal)', async () => {
    const womenTitles = seedProjects.filter((p) => p.womenOnly).map((p) => p.title);
    const { data, error } = await bob.from('projects').select('title, women_only, hidden').in('title', womenTitles);
    if (error) throw error;
    // Bob is not a Women mode member, so RLS hides them from him: that is the correct result.
    const leaked = bobDeck.filter((c) => womenTitles.includes(c.title ?? '')).length + (data?.length ?? 0);
    // Seen from a Women mode member (synthetic zara), they are in the Women deck.
    const zara = await signedIn(`zara@${DEMO_DOMAIN}`, env.SEED_USER_PASSWORD);
    const { data: wDeck, error: wErr } = await zara.rpc('get_deck', { p_mode: 'women' });
    if (wErr) throw wErr;
    const seen = ((wDeck ?? []) as { title?: string }[]).filter((c) => womenTitles.includes(c.title ?? '')).map((c) => c.title);
    return [leaked === 0 && womenTitles.every((t) => seen.includes(t)),
      `in zara's Women deck: ${seen.join(', ') || 'none'}; visible to Bob: ${leaked}`];
  });

  await check(`Bob: Matches tab has the sample match with ${sampleMatch.owner} and a short chat`, async () => {
    const { data, error } = await bob.from('matches').select('id, user_id, project:projects(title, owner_id)');
    if (error) throw error;
    const m = (data ?? []).find((r: any) => r.project?.title === sampleMatch.title);
    if (!m) return [false, `${data?.length ?? 0} match(es), sample not found`];
    const { data: owner } = await bob.from('profiles').select('username').eq('id', (m as any).project.owner_id).single();
    const { data: msgs, error: mErr } = await bob.from('match_messages').select('id').eq('match_id', m.id);
    if (mErr) throw mErr;
    return [(data?.length ?? 0) >= 1 && (msgs?.length ?? 0) === sampleMatch.chat.length,
      `${data?.length} match(es), with ${owner?.username}, ${msgs?.length ?? 0} messages`];
  });

  await Promise.all([bob.auth.signOut(), alice.auth.signOut()]);

  console.log('\nDemo checklist (verified signed in as Bob and Alice with the publishable key)');
  for (const [label, ok, note] of rows) console.log(`  ${ok ? 'YES' : 'NO '}  ${label}  (${note})`);
  const allOk = rows.every((r) => r[1]);
  console.log(allOk ? '\nAll YES: demo state is ready.' : '\nSome items are NO: see above.');
  return allOk;
}

// ---------- run ----------

console.log('reset-demo: start');
const all = await authUsers();
await cleanupQa(all);
await clearDemoKeys(await authUsers());
await reset();
const seeded = await seed();
const ok = await checklist(seeded.copyProjectId);
process.exitCode = ok ? 0 : 1;
