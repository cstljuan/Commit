// Real Supabase implementation of lib/api.ts (03-CONTRACTS.md, section 4).
// Matching, decks and commits run in SECURITY DEFINER functions (0006_matching.sql).
// Screens never import this file directly. They import '@/lib/api'.

import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from './supabase';
import { encryptForTeam } from './crypto';
import { createTeamKey, shareTeamKey, storeOwnTeamKey } from './teamKeys';
import { appendVault, hashIdea } from './vault';
import type {
  ActivityEvent,
  ScoreEvent,
  Card,
  ChatMessage,
  CopyAlert,
  Direction,
  EvalRow,
  Interested,
  Match,
  Mode,
  MyProject,
  PostIdeaInput,
  Profile,
  ProfileInput,
  RedteamRun,
  Role,
  RoleCount,
  Team,
  TeamMember,
} from './types';

WebBrowser.maybeCompleteAuthSession();

// ---------- helpers ----------

function fail(error: { message: string; code?: string } | null | undefined): void {
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Sign in first');
  return id;
}

const asRole = (r: unknown): Role => (r as Role) ?? 'Backend';

function skillsOf(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((s) => (typeof s === 'string' ? s : (s as { skill?: string })?.skill ?? '')).filter(Boolean);
}

// ---------- auth ----------

export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  fail(error);
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
  fail(error);
}

/** Demo fallback (handoff test 2): demo accounts sign in with a password. */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  fail(error);
}

/** Browser flow per F21. The exact redirect URL must be in Supabase's allowed list. */
/** Any email works, with no inbox needed once email confirmation is off for the project. */
export async function signUpWithPassword(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  fail(error);
  return { needsConfirmation: !data.session };
}

/** Which social sign-ins the project has switched on, so the login screen only offers working ones. */
export async function authProviders(): Promise<{ github: boolean; google: boolean }> {
  const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '' },
  });
  const json = (await res.json()) as { external?: { github?: boolean; google?: boolean } };
  return { github: !!json.external?.github, google: !!json.external?.google };
}

export async function signInWithProvider(provider: 'github' | 'google'): Promise<void> {
  const redirectTo = makeRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  fail(error);
  if (!data?.url) throw new Error('No sign-in URL returned');

  // An ephemeral session skips iOS's "wants to use ... to sign in" sheet.
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, { preferEphemeralSession: true });
  if (result.type !== 'success') throw new Error('Sign-in was cancelled');

  const url = new URL(result.url);
  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  url.searchParams.forEach((v, k) => params.set(k, v));
  const errorText = params.get('error_description') ?? params.get('error');
  if (errorText) throw new Error(errorText);

  const code = params.get('code');
  if (code) {
    const { error: e } = await supabase.auth.exchangeCodeForSession(code);
    fail(e);
    return;
  }
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) throw new Error('Sign-in did not return a session');
  const { error: e } = await supabase.auth.setSession({ access_token, refresh_token });
  fail(e);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  fail(error);
}

// ---------- profile ----------

type ProfileRow = {
  id: string; name: string; username: string | null; avatar_url: string | null; bio: string | null;
  primary_role: string | null; level: string | null; occupation: string | null; skills: unknown;
  prompts: unknown; hours_per_week: number | null; timezone: string | null; women_only: boolean | null;
  reliability_score: number | null;
};

function toProfile(r: ProfileRow): Profile {
  return {
    id: r.id,
    username: r.username ?? r.name,
    name: r.name,
    avatarUrl: r.avatar_url,
    bio: r.bio ?? '',
    role: asRole(r.primary_role),
    level: (r.level as Profile['level']) ?? 'intermediate',
    occupation: (r.occupation as Profile['occupation']) ?? 'student',
    skills: skillsOf(r.skills),
    prompts: Array.isArray(r.prompts) ? (r.prompts as Profile['prompts']) : [],
    hoursPerWeek: r.hours_per_week,
    timezone: r.timezone,
    womenOnly: !!r.women_only,
    reliability: r.reliability_score ?? 70,
  };
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: s } = await supabase.auth.getSession();
  const id = s.session?.user.id;
  if (!id) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  fail(error);
  return data ? toProfile(data as ProfileRow) : null;
}

/** Writes only client-editable columns. Reliability is server side only (F1). */
export async function saveProfile(p: ProfileInput): Promise<void> {
  const id = await uid();
  const { error } = await supabase.from('profiles').upsert(
    {
      id,
      name: p.name || p.username,
      username: p.username,
      avatar_url: p.avatarUrl,
      bio: p.bio,
      primary_role: p.role,
      level: p.level,
      occupation: p.occupation,
      skills: p.skills,
      prompts: p.prompts,
      hours_per_week: p.hoursPerWeek,
      timezone: p.timezone,
      women_only: p.womenOnly,
    },
    { onConflict: 'id' },
  );
  fail(error);
}

// ---------- deck and swiping ----------

export async function getDeck(mode: Mode): Promise<Card[]> {
  const { data, error } = await supabase.rpc('get_deck', { p_mode: mode });
  fail(error);
  return (data ?? []) as Card[];
}

export async function swipe(
  card: Card,
  direction: Direction,
  role?: Role,
): Promise<{ matched: boolean; match?: Match }> {
  const args =
    card.kind === 'project'
      ? { p_target_id: card.id, p_target_type: 'project', p_project_id: card.id }
      : { p_target_id: card.id, p_target_type: 'person', p_project_id: card.forProjectId };
  const { data, error } = await supabase.rpc('record_swipe', { ...args, p_role: role ?? null, p_direction: direction });
  fail(error);
  const res = data as { matched: boolean; matchId?: string };
  if (!res.matched || !res.matchId) return { matched: false };
  const match = (await getMatches()).find((m) => m.id === res.matchId);
  return { matched: true, match };
}

export async function undoLastSwipe(): Promise<void> {
  const { error } = await supabase.rpc('undo_last_swipe');
  fail(error);
}

export async function superCommitsLeft(): Promise<number> {
  const { data, error } = await supabase.rpc('super_commits_left');
  fail(error);
  return (data as number) ?? 0;
}

/** F5: the server returns role, level and super flag only. */
export async function getInterested(): Promise<{ count: number; cards: Interested[] }> {
  const { data, error } = await supabase.rpc('get_interested');
  fail(error);
  const cards = (data ?? []) as Interested[];
  return { count: cards.length, cards };
}

// ---------- matches and teams ----------

type MatchRow = {
  id: string; project_id: string; user_id: string; role: string | null;
  owner_committed: boolean; user_committed: boolean;
  project: { owner_id: string; type: string | null; title: string | null } | null;
};

export async function getMatches(): Promise<Match[]> {
  const me = await uid();
  const { data, error } = await supabase
    .from('matches')
    .select('id, project_id, user_id, role, owner_committed, user_committed, created_at, project:projects(owner_id, type, title)')
    .order('created_at', { ascending: false });
  fail(error);
  const rows = (data ?? []) as unknown as MatchRow[];

  const otherIds = [...new Set(rows.map((r) => (r.user_id === me ? r.project?.owner_id : r.user_id)).filter(Boolean))] as string[];
  const people = new Map<string, { username: string; avatarUrl: string | null }>();
  if (otherIds.length) {
    const { data: ps, error: e } = await supabase.from('profiles').select('id, username, name, avatar_url').in('id', otherIds);
    fail(e);
    for (const p of ps ?? []) people.set(p.id, { username: p.username ?? p.name, avatarUrl: p.avatar_url });
  }

  return rows.map((r) => {
    const iAmUser = r.user_id === me;
    const otherId = iAmUser ? r.project?.owner_id : r.user_id;
    const other = (otherId && people.get(otherId)) || { username: 'someone', avatarUrl: null };
    return {
      id: r.id,
      projectId: r.project_id,
      role: asRole(r.role),
      otherUsername: other.username,
      otherAvatarUrl: other.avatarUrl,
      projectTitle: r.project?.type === 'hackathon' ? undefined : r.project?.title ?? undefined,
      iCommitted: iAmUser ? r.user_committed : r.owner_committed,
      theyCommitted: iAmUser ? r.owner_committed : r.user_committed,
      isTeam: r.project?.type === 'hackathon',
    };
  });
}

export async function commitToMatch(matchId: string): Promise<{ isTeam: boolean }> {
  const { data, error } = await supabase.rpc('commit_to_project', { p_match_id: matchId });
  fail(error);
  const result = data as { both?: boolean; isTeam?: boolean } | null;
  if (result?.both) {
    // The owner's phone wraps the team key for the new member. Retried when the team page opens.
    const me = await uid();
    const { data: row } = await supabase.from('matches').select('project_id, user_id, project:projects(owner_id)').eq('id', matchId).maybeSingle();
    const m = row as unknown as { project_id: string; user_id: string; project: { owner_id: string } | null } | null;
    if (m && m.project?.owner_id === me) await shareTeamKey(m.project_id, m.user_id).catch(() => {});
  }
  return { isTeam: !!result?.isTeam };
}

export async function getTeam(projectId: string): Promise<Team> {
  const [{ data: project, error: pe }, { data: members, error: me }, { data: roles, error: re }] = await Promise.all([
    supabase.from('projects').select('id, title, type').eq('id', projectId).single(),
    supabase.from('team_members').select('user_id, role, ownership').eq('project_id', projectId).eq('status', 'active'),
    supabase.rpc('project_role_counts', { p: projectId }),
  ]);
  fail(pe);
  fail(me);
  fail(re);
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: ps, error: e } = ids.length
    ? await supabase.from('profiles').select('id, username, name, avatar_url, reliability_score').in('id', ids)
    : { data: [], error: null };
  fail(e);
  const byId = new Map((ps ?? []).map((p) => [p.id, p]));
  return {
    projectId,
    title: project!.title,
    isHackTeam: project!.type === 'hackathon',
    members: (members ?? []).map((m): TeamMember => {
      const p = byId.get(m.user_id);
      return {
        userId: m.user_id,
        username: p?.username ?? p?.name ?? 'member',
        avatarUrl: p?.avatar_url ?? null,
        role: asRole(m.role),
        ownership: m.ownership as TeamMember['ownership'],
        reliability: p?.reliability_score ?? 70,
      };
    }),
    roles: (roles ?? []) as RoleCount[],
  };
}

/** Projects tab: projects I own or joined. Hack shells and hidden posts are left out. */
export async function getMyProjects(): Promise<MyProject[]> {
  const me = await uid();
  const [{ data: memberOf, error: e1 }, { data: owned, error: e2 }] = await Promise.all([
    supabase.from('team_members').select('project_id').eq('user_id', me).eq('status', 'active'),
    supabase.from('projects').select('id').eq('owner_id', me),
  ]);
  fail(e1);
  fail(e2);
  const ids = [...new Set([...(owned ?? []).map((p) => p.id), ...(memberOf ?? []).map((m) => m.project_id)])];
  if (!ids.length) return [];

  const { data: rows, error: e3 } = await supabase
    .from('projects')
    .select('id, owner_id, title, short_pitch, type, visibility, idea_public, hidden, created_at')
    .in('id', ids)
    .order('created_at', { ascending: false });
  fail(e3);
  const visible = (rows ?? []).filter((r) => !r.hidden && r.type !== 'hackathon');
  if (!visible.length) return [];

  const { data: members, error: e4 } = await supabase
    .from('team_members')
    .select('project_id, user_id, role')
    .in('project_id', visible.map((r) => r.id))
    .eq('status', 'active');
  fail(e4);
  await Promise.all([...new Set((members ?? []).map((m) => m.user_id))].map(usernameOf));

  return Promise.all(
    visible.map(async (r): Promise<MyProject> => {
      const [{ data: counts }, { data: hash }] = await Promise.all([
        supabase.rpc('project_role_counts', { p: r.id }),
        supabase.rpc('project_commit_hash', { p: r.id }),
      ]);
      const taken = (members ?? [])
        .filter((m) => m.project_id === r.id)
        .map((m) => ({ role: asRole(m.role), username: usernames.get(m.user_id) ?? 'builder' }));
      const open = ((counts ?? []) as RoleCount[]).flatMap((c) =>
        Array.from({ length: Math.max(0, c.open) }, () => ({ role: c.role, username: null as string | null })),
      );
      return {
        id: r.id,
        title: r.title,
        commitHash: (hash as string) ?? '',
        idea: r.idea_public ?? r.short_pitch,
        status: r.visibility !== 'public' ? 'private' : open.length ? 'recruiting' : 'building',
        mine: r.owner_id === me,
        wantIn: 0,
        roles: [...taken, ...open],
      };
    }),
  );
}

// ---------- chat at match (plain text, labelled honestly in the UI) ----------

const usernames = new Map<string, string>();

async function usernameOf(id: string): Promise<string> {
  const cached = usernames.get(id);
  if (cached) return cached;
  const { data } = await supabase.from('profiles').select('username, name').eq('id', id).maybeSingle();
  const name = data?.username ?? data?.name ?? 'someone';
  usernames.set(id, name);
  return name;
}

type MessageRow = { id: string; match_id: string; sender_id: string; body: string; created_at: string };

async function toMessage(r: MessageRow, me: string): Promise<ChatMessage> {
  return {
    id: r.id,
    matchId: r.match_id,
    senderId: r.sender_id,
    senderUsername: await usernameOf(r.sender_id),
    body: r.body,
    createdAt: r.created_at,
    mine: r.sender_id === me,
  };
}

export async function getMessages(matchId: string): Promise<ChatMessage[]> {
  const me = await uid();
  const { data, error } = await supabase
    .from('match_messages')
    .select('id, match_id, sender_id, body, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });
  fail(error);
  return Promise.all(((data ?? []) as MessageRow[]).map((r) => toMessage(r, me)));
}

export async function sendMessage(matchId: string, body: string): Promise<void> {
  const text = body.trim();
  if (!text) throw new Error('Message is empty');
  const me = await uid();
  const { error } = await supabase.from('match_messages').insert({ match_id: matchId, sender_id: me, body: text });
  fail(error);
}

function subscribe<T>(name: string, table: string, filter: string | undefined, onRow: (row: T) => void): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`${name}:${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table, ...(filter ? { filter } : {}) }, (payload) =>
      onRow(payload.new as T),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeMessages(matchId: string, cb: (m: ChatMessage) => void): () => void {
  let me = '';
  uid().then((id) => (me = id)).catch(() => {});
  return subscribe<MessageRow>('messages', 'match_messages', `match_id=eq.${matchId}`, (row) => {
    toMessage(row, me).then(cb).catch(() => {});
  });
}

// ---------- projects ----------

/**
 * Fixed order (03-CONTRACTS.md, section 5, F9): hash, encrypt if private, post_idea, then
 * storeOwnTeamKey, appendVault, checkpoint. The full idea goes to post_idea only for the
 * embedding and is never stored in plain text when private.
 */
export async function postIdea(input: PostIdeaInput): Promise<{ projectId: string; commitHash: string }> {
  if (!input.title.trim() || !input.fullIdea.trim()) throw new Error('Title and idea are required');
  const ts = new Date().toISOString();
  const ideaHash = await hashIdea(ts, input.fullIdea);

  const isPrivate = input.visibility === 'private';
  const teamKey = isPrivate ? createTeamKey().key : null;
  const sealed = teamKey ? encryptForTeam(input.fullIdea, teamKey) : null;

  const { data, error } = await supabase.functions.invoke('post_idea', {
    body: {
      title: input.title,
      shortPitch: input.teaser,
      type: input.type,
      theme: input.theme,
      timeframe: input.timeframe,
      githubUrl: input.githubUrl ?? null,
      visibility: input.visibility,
      womenOnly: input.womenOnly,
      roles: input.roles,
      ideaCipher: sealed?.ciphertext ?? null,
      ideaNonce: sealed?.nonce ?? null,
      ideaPublic: isPrivate ? null : input.fullIdea,
      fullIdea: input.fullIdea,
    },
  });
  if (error) throw new Error(error.message || 'Could not post the idea');
  const projectId = (data as { projectId?: string })?.projectId;
  if (!projectId) throw new Error((data as { status?: string })?.status ?? 'Could not post the idea');

  if (teamKey) await storeOwnTeamKey(projectId, teamKey);
  const entry = await appendVault(projectId, ideaHash, ts);
  // The checkpoint signs the chain head. A failure here does not undo the post.
  await supabase.functions.invoke('checkpoint').catch(() => {});

  return { projectId, commitHash: entry.entry_hash.slice(0, 7) };
}

type AlertRow = { id: string; original_project_id: string; similarity: number; created_at: string; project?: { title: string } | null };

const toAlert = (r: AlertRow, title?: string): CopyAlert => ({
  id: r.id,
  originalProjectId: r.original_project_id,
  originalTitle: title ?? r.project?.title ?? 'Your project',
  similarity: r.similarity,
  createdAt: r.created_at,
});

export async function getCopyAlerts(): Promise<CopyAlert[]> {
  const { data, error } = await supabase
    .from('copy_alerts')
    .select('id, original_project_id, similarity, created_at, project:projects(title)')
    .order('created_at', { ascending: false });
  fail(error);
  return ((data ?? []) as unknown as AlertRow[]).map((r) => toAlert(r));
}

export function subscribeCopyAlerts(cb: (a: CopyAlert) => void): () => void {
  let stop = () => {};
  let cancelled = false;
  uid()
    .then((me) => {
      if (cancelled) return;
      stop = subscribe<AlertRow>('alerts', 'copy_alerts', `owner_id=eq.${me}`, async (row) => {
        const { data } = await supabase.from('projects').select('title').eq('id', row.original_project_id).maybeSingle();
        cb(toAlert(row, data?.title));
      });
    })
    .catch(() => {});
  return () => {
    cancelled = true;
    stop();
  };
}

// ---------- proof screens ----------

export async function getEvalResults(): Promise<EvalRow[]> {
  const { data, error } = await supabase
    .from('eval_results')
    .select('id, threshold, precision, recall, chosen, created_at')
    .order('threshold', { ascending: true });
  fail(error);
  return (data ?? []).map((r) => ({
    id: r.id, threshold: r.threshold, precision: r.precision, recall: r.recall, chosen: r.chosen, createdAt: r.created_at,
  }));
}

export function subscribeRedteamRuns(cb: (r: RedteamRun) => void): () => void {
  return subscribe<{
    id: string; kind: 'oracle' | 'rls'; version: 'v1' | 'v2'; attempts: number; revealed: number; denied: number;
    details: unknown; created_at: string;
  }>('redteam', 'redteam_runs', undefined, (r) =>
    cb({ id: r.id, kind: r.kind, version: r.version, attempts: r.attempts, revealed: r.revealed, denied: r.denied, details: r.details, createdAt: r.created_at }),
  );
}

// ---------- Who wants you, Hack needs, Activity, Score ----------

/**
 * Like or pass on a blurred card (F5). Identity is never sent before this. A like creates the match,
 * and the returned match carries the other person's username.
 */
export async function respondToInterested(swipeRef: string, like: boolean): Promise<{ matched: boolean; match?: Match }> {
  const { data, error } = await supabase.rpc('respond_interested', { p_swipe_ref: swipeRef, p_like: like });
  fail(error);
  const res = data as { matched: boolean; matchId?: string };
  if (!res.matched || !res.matchId) return { matched: false };
  return { matched: true, match: (await getMatches()).find((m) => m.id === res.matchId) };
}

/** Saves what the caller's hack team still needs. Creates the hidden team shell on first use. */
export async function setHackRoles(roles: { role: Role; open: number }[]): Promise<void> {
  const { error } = await supabase.rpc('ensure_hack_team', { p_roles: roles });
  fail(error);
}

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hour${s < 7200 ? '' : 's'} ago`;
  return `${Math.floor(s / 86400)} day${s < 172800 ? '' : 's'} ago`;
}

/** Newest first: matches, anonymous Super Commits, copy alerts, people joining my projects, my vault entries. */
export async function getActivity(): Promise<ActivityEvent[]> {
  const me = await uid();
  const [matches, alerts, { data: owned }, { data: vault }, interested] = await Promise.all([
    getMatches(),
    getCopyAlerts(),
    supabase.from('projects').select('id, title').eq('owner_id', me).neq('type', 'hackathon'),
    supabase.from('vault_log').select('seq, project_id, ts').eq('author_id', me).order('seq', { ascending: false }).limit(10),
    getInterested(),
  ]);
  const titles = new Map((owned ?? []).map((p) => [p.id, p.title]));
  const { data: matchTimes } = await supabase.from('matches').select('id, created_at').in('id', matches.map((m) => m.id));
  const matchAt = new Map((matchTimes ?? []).map((m) => [m.id, m.created_at as string]));
  const { data: joins } = titles.size
    ? await supabase.from('team_members').select('project_id, user_id, joined_at')
        .in('project_id', [...titles.keys()]).neq('user_id', me).eq('status', 'active')
    : { data: [] as { project_id: string; user_id: string; joined_at: string }[] };
  await Promise.all([...new Set((joins ?? []).map((j) => j.user_id))].map(usernameOf));

  const events: Omit<ActivityEvent, 'when'>[] = [
    ...alerts.map((a) => ({ id: `alert:${a.id}`, kind: 'alert' as const, seed: 'unknown', title: `Someone reworded ${a.originalTitle}`, createdAt: a.createdAt, href: '/alert' })),
    ...matches.map((m) => ({
      id: `match:${m.id}`, kind: 'match' as const, seed: m.otherUsername, title: `You matched with @${m.otherUsername}`,
      createdAt: matchAt.get(m.id) ?? new Date(0).toISOString(), href: `/chat/${m.id}`,
    })),
    ...(joins ?? []).map((j) => {
      const name = usernames.get(j.user_id) ?? 'someone';
      return { id: `team:${j.project_id}:${j.user_id}`, kind: 'team' as const, seed: name, title: `@${name} committed to ${titles.get(j.project_id) ?? 'your project'}`, createdAt: j.joined_at, href: `/project/${j.project_id}` };
    }),
    ...(vault ?? []).map((v) => ({ id: `commit:${v.seq}`, kind: 'commit' as const, seed: 'you', title: `${titles.get(v.project_id) ?? 'Your idea'} was committed to the vault`, createdAt: v.ts, href: '/commits' })),
  ];
  // Super Commits stay anonymous until you like back (F5).
  const supers = interested.cards.filter((c) => c.isSuper);
  if (supers.length) {
    events.push({ id: 'super', kind: 'super', seed: 'unknown', title: supers.length === 1 ? 'Someone sent you a Super Commit' : `${supers.length} people sent you a Super Commit`, createdAt: new Date().toISOString(), href: '/likes' });
  }
  return events
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((e) => ({ ...e, when: ago(e.createdAt) }));
}

/** Reliability history. Starts at 70; anything the log does not explain is labelled as seeded demo history. */
export async function getScoreEvents(): Promise<ScoreEvent[]> {
  const me = await uid();
  const [{ data: profile, error: e1 }, { data: rows, error: e2 }] = await Promise.all([
    supabase.from('profiles').select('reliability_score').eq('id', me).single(),
    supabase.from('reliability_events').select('label, delta, created_at').eq('user_id', me).order('created_at'),
  ]);
  fail(e1);
  fail(e2);
  const events: ScoreEvent[] = [{ label: 'Everyone starts here', delta: 70 }, ...(rows ?? []).map((r) => ({ label: r.label, delta: r.delta }))];
  const diff = (profile?.reliability_score ?? 70) - events.reduce((a, e) => a + e.delta, 0);
  if (diff !== 0) events.push({ label: 'Seeded demo history', delta: diff });
  return events;
}
