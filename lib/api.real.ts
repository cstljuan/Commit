// The real backend. Same names and shapes as lib/api.mock.ts (03-CONTRACTS.md, section 4).
// Security lives on the server: RLS and the SECURITY DEFINER functions in supabase/migrations.
// The client only ever holds the publishable key.

import type { RealtimeChannel } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { encryptForTeam, hasKeys } from './crypto';
import { supabase } from './supabase';
import { createTeamKey, shareTeamKey, storeOwnTeamKey } from './teamKeys';
import type {
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
} from './types';
import { appendVault, hashIdea } from './vault';

export const API_IS_MOCK = false;

const must = <T>(result: { data: T; error: { message: string; code?: string } | null }): T => {
  if (result.error) throw Object.assign(new Error(result.error.message), { code: result.error.code });
  return result.data;
};

const myId = async (): Promise<string> => {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Sign in first');
  return id;
};

// ---------- auth ----------

export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw error;
}

/** Demo accounts sign in this way, because email codes only reach verified inboxes for now. */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signInWithProvider(provider: 'github' | 'google'): Promise<void> {
  const redirectTo = makeRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new Error('Sign in was cancelled');
  const params = new URLSearchParams(result.url.split('#')[1] ?? '');
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) throw new Error('Sign in did not finish');
  const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
  if (sessionError) throw sessionError;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ---------- profile ----------

type ProfileRow = {
  id: string;
  username: string | null;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  primary_role: Role | null;
  level: Profile['level'] | null;
  occupation: Profile['occupation'] | null;
  skills: unknown;
  prompts: Profile['prompts'] | null;
  hours_per_week: number | null;
  timezone: string | null;
  women_only: boolean | null;
  reliability_score: number | null;
};

const PROFILE_COLUMNS =
  'id,username,name,avatar_url,bio,primary_role,level,occupation,skills,prompts,hours_per_week,timezone,women_only,reliability_score';

// Skills are stored as plain names or as { skill, level } objects.
const skillNames = (skills: unknown): string[] =>
  Array.isArray(skills) ? skills.map((s) => (typeof s === 'string' ? s : String((s as { skill?: string }).skill ?? ''))).filter(Boolean) : [];

export async function getMyProfile(): Promise<Profile | null> {
  const id = await myId();
  const row = must(await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle()) as ProfileRow | null;
  if (!row || !row.username) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    avatarUrl: row.avatar_url,
    bio: row.bio ?? '',
    role: row.primary_role ?? 'Backend',
    level: row.level ?? 'intermediate',
    occupation: row.occupation ?? 'student',
    skills: skillNames(row.skills),
    prompts: row.prompts ?? [],
    hoursPerWeek: row.hours_per_week,
    timezone: row.timezone,
    womenOnly: !!row.women_only,
    reliability: row.reliability_score ?? 70,
  };
}

export async function saveProfile(p: ProfileInput): Promise<void> {
  const id = await myId();
  const values = {
    username: p.username,
    name: p.name || p.username,
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
  };
  // Column grants do not allow writing id on update, so an upsert would be refused.
  const existing = must(await supabase.from('profiles').select('id').eq('id', id).maybeSingle());
  if (existing) must(await supabase.from('profiles').update(values).eq('id', id));
  else must(await supabase.from('profiles').insert({ id, ...values }));
}

// ---------- deck and swiping ----------

export async function getDeck(mode: Mode): Promise<Card[]> {
  return (must(await supabase.rpc('get_deck', { p_mode: mode })) as Card[] | null) ?? [];
}

export async function superCommitsLeft(): Promise<number> {
  return must(await supabase.rpc('super_commits_left')) as number;
}

export async function swipe(card: Card, direction: Direction, role?: Role): Promise<{ matched: boolean; match?: Match }> {
  const result = must(
    await supabase.rpc('record_swipe', {
      p_target_id: card.id,
      p_target_type: card.kind,
      p_project_id: card.kind === 'project' ? card.id : card.forProjectId,
      p_role: role ?? (card.kind === 'person' ? card.role : null),
      p_direction: direction,
    }),
  ) as { matched: boolean; matchId?: string };
  if (!result.matched || !result.matchId) return { matched: false };
  const match = (await getMatches()).find((m) => m.id === result.matchId);
  if (match) return { matched: true, match };
  return {
    matched: true,
    match: {
      id: result.matchId,
      projectId: card.kind === 'project' ? card.id : card.forProjectId,
      projectTitle: card.kind === 'project' ? card.title : undefined,
      role: role ?? (card.kind === 'person' ? card.role : 'Backend'),
      otherUsername: card.kind === 'project' ? card.ownerUsername : card.username,
      otherAvatarUrl: null,
      iCommitted: false,
      theyCommitted: false,
      isTeam: false,
    },
  };
}

export async function undoLastSwipe(): Promise<void> {
  must(await supabase.rpc('undo_last_swipe'));
}

export async function getInterested(): Promise<{ count: number; cards: Interested[] }> {
  const cards = (must(await supabase.rpc('get_interested')) as Interested[] | null) ?? [];
  return { count: cards.length, cards };
}

// ---------- matches and teams ----------

const usernames = async (ids: string[]): Promise<Map<string, { username: string; avatarUrl: string | null }>> => {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const rows = must(await supabase.from('profiles').select('id,username,name,avatar_url').in('id', unique)) as {
    id: string;
    username: string | null;
    name: string;
    avatar_url: string | null;
  }[];
  return new Map(rows.map((r) => [r.id, { username: r.username ?? r.name, avatarUrl: r.avatar_url }]));
};

export async function getMatches(): Promise<Match[]> {
  const me = await myId();
  const rows = must(
    await supabase
      .from('matches')
      .select('id,project_id,user_id,role,owner_committed,user_committed,created_at,projects(owner_id,title,type)')
      .order('created_at', { ascending: false }),
  ) as unknown as {
    id: string;
    project_id: string;
    user_id: string;
    role: Role;
    owner_committed: boolean;
    user_committed: boolean;
    projects: { owner_id: string; title: string; type: string | null } | null;
  }[];
  const otherOf = (r: (typeof rows)[number]) => (r.projects?.owner_id === me ? r.user_id : (r.projects?.owner_id ?? r.user_id));
  const people = await usernames(rows.map(otherOf));
  return rows.map((r) => {
    const iOwn = r.projects?.owner_id === me;
    const other = people.get(otherOf(r));
    return {
      id: r.id,
      projectId: r.project_id,
      projectTitle: r.projects?.type === 'hackathon' ? undefined : r.projects?.title,
      role: r.role,
      otherUsername: other?.username ?? 'builder',
      otherAvatarUrl: other?.avatarUrl ?? null,
      iCommitted: iOwn ? r.owner_committed : r.user_committed,
      theyCommitted: iOwn ? r.user_committed : r.owner_committed,
      isTeam: r.projects?.type === 'hackathon',
    };
  });
}

export async function commitToMatch(matchId: string): Promise<{ isTeam: boolean }> {
  const result = must(await supabase.rpc('commit_to_project', { p_match_id: matchId })) as { both: boolean; isTeam: boolean };
  if (result.both) {
    // The owner's phone wraps the team key for the new member. Retried when the team page opens.
    const me = await myId();
    const row = must(await supabase.from('matches').select('project_id,user_id,projects(owner_id)').eq('id', matchId).maybeSingle()) as unknown as {
      project_id: string;
      user_id: string;
      projects: { owner_id: string } | null;
    } | null;
    if (row && row.projects?.owner_id === me) await shareTeamKey(row.project_id, row.user_id).catch(() => {});
  }
  return { isTeam: result.isTeam };
}

export async function getTeam(projectId: string): Promise<Team> {
  const me = await myId();
  const project = must(await supabase.from('projects').select('title,type,owner_id').eq('id', projectId).single()) as {
    title: string;
    type: string | null;
    owner_id: string;
  };
  const members = must(
    await supabase.from('team_members').select('user_id,role,ownership').eq('project_id', projectId).eq('status', 'active'),
  ) as { user_id: string; role: Role; ownership: 'owner' | 'co-owner' | 'collaborator' }[];
  const profiles = must(
    await supabase
      .from('profiles')
      .select('id,username,name,avatar_url,reliability_score')
      .in('id', members.length ? members.map((m) => m.user_id) : [project.owner_id]),
  ) as { id: string; username: string | null; name: string; avatar_url: string | null; reliability_score: number | null }[];
  const roles = must(await supabase.rpc('project_role_counts', { p: projectId })) as RoleCount[];
  if (project.owner_id === me) {
    members.filter((m) => m.user_id !== me).forEach((m) => shareTeamKey(projectId, m.user_id).catch(() => {}));
  }
  return {
    projectId,
    title: project.title,
    isHackTeam: project.type === 'hackathon',
    roles,
    members: members.map((m) => {
      const p = profiles.find((x) => x.id === m.user_id);
      return {
        userId: m.user_id,
        username: p?.username ?? p?.name ?? 'builder',
        avatarUrl: p?.avatar_url ?? null,
        role: m.role,
        ownership: m.ownership,
        reliability: p?.reliability_score ?? 70,
      };
    }),
  };
}

// ---------- projects tab ----------

export async function getMyProjects(): Promise<MyProject[]> {
  const me = await myId();
  const memberOf = must(await supabase.from('team_members').select('project_id').eq('user_id', me).eq('status', 'active')) as { project_id: string }[];
  const owned = must(await supabase.from('projects').select('id').eq('owner_id', me).neq('type', 'hackathon')) as { id: string }[];
  const ids = [...new Set([...owned.map((p) => p.id), ...memberOf.map((m) => m.project_id)])];
  if (!ids.length) return [];
  const rows = must(
    await supabase
      .from('projects')
      .select('id,owner_id,title,short_pitch,type,visibility,idea_public,hidden,created_at')
      .in('id', ids)
      .order('created_at', { ascending: false }),
  ) as {
    id: string;
    owner_id: string;
    title: string;
    short_pitch: string;
    type: string | null;
    visibility: 'private' | 'public' | null;
    idea_public: string | null;
    hidden: boolean | null;
  }[];
  const visible = rows.filter((r) => !r.hidden && r.type !== 'hackathon');
  const members = must(
    await supabase.from('team_members').select('project_id,user_id,role').in('project_id', visible.map((r) => r.id)).eq('status', 'active'),
  ) as { project_id: string; user_id: string; role: Role }[];
  const people = await usernames([...members.map((m) => m.user_id), me]);
  return Promise.all(
    visible.map(async (r) => {
      const counts = must(await supabase.rpc('project_role_counts', { p: r.id })) as RoleCount[];
      const hash = must(await supabase.rpc('project_commit_hash', { p: r.id })) as string;
      const taken = members
        .filter((m) => m.project_id === r.id)
        .map((m) => ({ role: m.role, username: people.get(m.user_id)?.username ?? 'builder' }));
      const open = counts.flatMap((c) => Array.from({ length: Math.max(0, c.open) }, () => ({ role: c.role, username: null })));
      const seats = taken.length || r.owner_id !== me ? [...taken, ...open] : [{ role: 'PM' as Role, username: people.get(me)?.username ?? 'you' }, ...open];
      return {
        id: r.id,
        title: r.title,
        commitHash: hash,
        idea: r.idea_public ?? r.short_pitch,
        status: r.visibility !== 'public' ? ('private' as const) : open.length ? ('recruiting' as const) : ('building' as const),
        mine: r.owner_id === me,
        wantIn: 0,
        roles: seats,
      };
    }),
  );
}

// ---------- chat at match (plain text) ----------

export async function getMessages(matchId: string): Promise<ChatMessage[]> {
  const me = await myId();
  const rows = must(
    await supabase.from('match_messages').select('id,match_id,sender_id,body,created_at').eq('match_id', matchId).order('created_at'),
  ) as { id: string; match_id: string; sender_id: string; body: string; created_at: string }[];
  const people = await usernames(rows.map((r) => r.sender_id));
  return rows.map((r) => ({
    id: r.id,
    matchId: r.match_id,
    senderId: r.sender_id,
    senderUsername: people.get(r.sender_id)?.username ?? 'builder',
    body: r.body,
    createdAt: r.created_at,
    mine: r.sender_id === me,
  }));
}

export async function sendMessage(matchId: string, body: string): Promise<void> {
  const text = body.trim();
  if (!text) throw new Error('Message is empty');
  must(await supabase.from('match_messages').insert({ match_id: matchId, sender_id: await myId(), body: text }));
}

export function subscribeMessages(matchId: string, cb: (m: ChatMessage) => void): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`match:${matchId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_messages', filter: `match_id=eq.${matchId}` }, async (payload) => {
      const r = payload.new as { id: string; match_id: string; sender_id: string; body: string; created_at: string };
      const me = await myId();
      const people = await usernames([r.sender_id]);
      cb({ id: r.id, matchId: r.match_id, senderId: r.sender_id, senderUsername: people.get(r.sender_id)?.username ?? 'builder', body: r.body, createdAt: r.created_at, mine: r.sender_id === me });
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------- posting an idea ----------

/**
 * Order from 03-CONTRACTS section 5: hash, encrypt if private, create the project, store the team
 * key, append to the vault. The post_idea function (copy detection) is not deployed yet, so the
 * project row is written directly under RLS. When it lands, only the insert below changes.
 */
export async function postIdea(input: PostIdeaInput): Promise<{ projectId: string; commitHash: string }> {
  if (!input.title.trim() || !input.fullIdea.trim()) throw new Error('Title and idea are required');
  const owner = await myId();
  const ts = new Date().toISOString();
  const ideaHash = await hashIdea(ts, input.fullIdea);
  const isPrivate = input.visibility === 'private';
  const ready = await hasKeys();
  if (isPrivate && !ready) throw new Error('Set up your device keys before posting a private idea');

  const teamKey = isPrivate ? createTeamKey().key : null;
  const sealed = teamKey ? encryptForTeam(input.fullIdea, teamKey) : null;

  const project = must(
    await supabase
      .from('projects')
      .insert({
        owner_id: owner,
        title: input.title,
        short_pitch: input.teaser,
        type: input.type,
        visibility: input.visibility,
        theme: input.theme,
        timeframe: input.timeframe,
        github_url: input.githubUrl ?? null,
        women_only: input.womenOnly,
        idea_public: isPrivate ? null : input.fullIdea,
        idea_cipher: sealed?.ciphertext ?? null,
        idea_nonce: sealed?.nonce ?? null,
      })
      .select('id')
      .single(),
  ) as { id: string };

  if (input.roles.length) {
    must(await supabase.from('project_roles').insert(input.roles.map((r) => ({ project_id: project.id, role: r.role, level: r.level ?? null, slots_open: r.open }))));
  }
  if (teamKey) await storeOwnTeamKey(project.id, teamKey);

  // The vault needs this phone's registered keys. Without them the project still posts.
  let commitHash = ideaHash;
  if (ready) {
    const entry = await appendVault(project.id, ideaHash, ts).catch(() => null);
    if (entry) commitHash = entry.entry_hash;
  }
  return { projectId: project.id, commitHash };
}

// ---------- alerts and proof screens ----------

export async function getCopyAlerts(): Promise<CopyAlert[]> {
  const rows = must(
    await supabase.from('copy_alerts').select('id,original_project_id,similarity,created_at,projects(title)').order('created_at', { ascending: false }),
  ) as unknown as { id: string; original_project_id: string; similarity: number; created_at: string; projects: { title: string } | null }[];
  return rows.map((r) => ({ id: r.id, originalProjectId: r.original_project_id, originalTitle: r.projects?.title ?? 'your idea', similarity: r.similarity, createdAt: r.created_at }));
}

export function subscribeCopyAlerts(cb: (a: CopyAlert) => void): () => void {
  const channel = supabase
    .channel('copy-alerts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'copy_alerts' }, async () => {
      const [latest] = await getCopyAlerts();
      if (latest) cb(latest);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getEvalResults(): Promise<EvalRow[]> {
  const rows = must(await supabase.from('eval_results').select('id,threshold,precision,recall,chosen,created_at').order('threshold')) as {
    id: string;
    threshold: number;
    precision: number;
    recall: number;
    chosen: boolean;
    created_at: string;
  }[];
  return rows.map((r) => ({ id: r.id, threshold: r.threshold, precision: r.precision, recall: r.recall, chosen: r.chosen, createdAt: r.created_at }));
}

export function subscribeRedteamRuns(cb: (r: RedteamRun) => void): () => void {
  const channel = supabase
    .channel('redteam-runs')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'redteam_runs' }, (payload) => {
      const r = payload.new as { id: string; kind: 'oracle' | 'rls'; version: 'v1' | 'v2'; attempts: number; revealed: number; denied: number; details: unknown; created_at: string };
      cb({ id: r.id, kind: r.kind, version: r.version, attempts: r.attempts, revealed: r.revealed, denied: r.denied, details: r.details, createdAt: r.created_at });
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
