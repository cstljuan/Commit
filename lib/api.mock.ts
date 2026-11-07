// In-memory mock of lib/api.ts. Same function names, same shapes (03-CONTRACTS.md, section 4).
// UI lanes build against this until the real Supabase functions land.
// All data is synthetic. Avatars are null so the UI shows illustrated placeholders, never real photos.

import { demoProjects } from './demoData';
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
  PersonCard,
  Profile,
  ProfileInput,
  PostIdeaInput,
  ProjectCard,
  RedteamRun,
  Role,
  RoleCount,
  Team,
  TeamMember,
} from './types';

/** True while this file backs lib/api.ts. Chat bots and the sign-in gate read it. The real API exports false. */
export const API_IS_MOCK = true;

// ---------- helpers ----------

const LATENCY_MS = 250;
const wait = <T>(value: T, ms = LATENCY_MS): Promise<T> => new Promise((r) => setTimeout(() => r(value), ms));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
let idCounter = 1000;
const newId = (prefix: string) => `${prefix}_${++idCounter}`;
const fakeHash = () =>
  Array.from({ length: 7 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
const nowIso = () => new Date().toISOString();

const roles = (...r: [Role, number, number][]): RoleCount[] => r.map(([role, open, filled]) => ({ role, open, filled }));

const project = (p: Partial<ProjectCard> & Pick<ProjectCard, 'id' | 'title' | 'teaser' | 'ownerUsername'>): ProjectCard => ({
  kind: 'project',
  visibility: 'private',
  theme: 'Education',
  timeframe: 'weekend',
  roles: [],
  ownerReliability: 80,
  ownerBoxPublicKey: null,
  reason: 'Needs your skills',
  commitHash: fakeHash(),
  isSuper: false,
  ...p,
});

const person = (p: Partial<PersonCard> & Pick<PersonCard, 'id' | 'username' | 'role'>): PersonCard => ({
  kind: 'person',
  avatarUrl: null,
  level: 'intermediate',
  occupation: 'student',
  skills: [],
  prompts: [],
  reliability: 75,
  reason: 'Fills your gap',
  isSuper: false,
  forProjectId: 'p_bob_main',
  boxPublicKey: null,
  ...p,
});

// ---------- the signed-in demo user ----------

const ME_ID = 'u_bob';

let me: Profile | null = {
  id: ME_ID,
  username: 'bob_builds',
  name: 'Bob',
  avatarUrl: null,
  bio: 'Backend person who likes shipping on weekends.',
  role: 'Backend',
  level: 'intermediate',
  occupation: 'student',
  skills: ['TypeScript', 'Postgres', 'Python', 'Supabase'],
  prompts: [
    { q: 'Worst commit message', a: 'fix fix fix' },
    { q: 'I will not shut up about', a: 'Row level security' },
  ],
  hoursPerWeek: 10,
  timezone: 'America/New_York',
  womenOnly: false,
  reliability: 82,
};

// ---------- seed decks ----------

const normalDeck: Card[] = [
  // Demo rule: Alice's project is always first in Bob's deck, for the judge swipe.
  project({
    id: 'p_alice_tutor',
    title: 'Pocket Tutor',
    teaser: 'Turns your lecture notes into quizzes that target what you keep forgetting.',
    ownerUsername: 'alice_ships',
    ownerReliability: 91,
    theme: 'Education',
    timeframe: 'weekend',
    roles: roles(['Backend', 1, 0], ['Design', 1, 1], ['AI/ML', 1, 0]),
    reason: 'Fills their backend gap',
    commitHash: 'a3f9c21',
    isSuper: true,
  }),
  project({
    id: 'p_greenroute',
    title: 'GreenRoute',
    teaser: 'Bike commute planner that picks the route with the cleanest air.',
    visibility: 'public',
    fullIdea:
      'GreenRoute pulls open air quality sensor data and city bike lane maps, then scores each route by exposure, not just distance. Riders get a daily commute suggestion and a weekly lungs report.',
    ownerUsername: 'miguel_maps',
    ownerReliability: 77,
    theme: 'Climate',
    timeframe: '1 month',
    githubUrl: 'https://github.com/example/greenroute',
    roles: roles(['Mobile', 1, 0], ['Backend', 1, 0]),
    reason: 'Needs a backend dev, you are one',
  }),
  person({
    id: 'u_priya',
    username: 'priya_pixels',
    role: 'Design',
    level: 'advanced',
    occupation: 'working',
    skills: ['Figma', 'Motion', 'Design systems'],
    prompts: [
      { q: 'My toxic trait', a: 'Redoing the icon set at 3 AM' },
      { q: 'Green flag in a teammate', a: 'Names their layers' },
    ],
    reliability: 94,
    reason: 'Your project has no designer',
  }),
  project({
    id: 'p_shelfie',
    title: 'Shelfie',
    teaser: 'Snap your pantry, get three dinners you can make tonight.',
    ownerUsername: 'dana_dev',
    ownerReliability: 68,
    theme: 'Food',
    timeframe: 'weekend',
    roles: roles(['AI/ML', 1, 0], ['Frontend', 1, 0]),
    reason: 'Short timeframe matches your hours',
  }),
  person({
    id: 'u_kenji',
    username: 'kenji_kernels',
    role: 'Security',
    level: 'intermediate',
    skills: ['Rust', 'Threat modeling', 'CTFs'],
    prompts: [{ q: 'I will not shut up about', a: 'Timing attacks' }],
    reliability: 85,
    reason: 'Strong reliability, open hours',
  }),
  project({
    id: 'p_studyjams',
    title: 'StudyJams',
    teaser: 'Lo-fi study rooms where your friends can see you are actually working.',
    ownerUsername: 'ola_audio',
    ownerReliability: 72,
    theme: 'Social',
    timeframe: 'semester',
    roles: roles(['Frontend', 2, 1], ['Backend', 1, 0]),
    reason: 'Needs your skills',
  }),
  person({
    id: 'u_sam',
    username: 'sam_ships_ml',
    role: 'AI/ML',
    level: 'beginner',
    skills: ['Python', 'PyTorch', 'Jupyter'],
    prompts: [{ q: 'Worst commit message', a: 'it works now dont touch' }],
    reliability: 70,
    reason: 'Learning fast, wants a practice project',
  }),
  project({
    id: 'p_lostfound',
    title: 'Campus Lost and Found',
    teaser: 'Report a lost item, get pinged when someone finds something that looks like it.',
    visibility: 'public',
    fullIdea:
      'Students post found items with a photo. An image model matches them against lost reports and notifies the owner, who verifies with a detail only they would know.',
    ownerUsername: 'lee_lens',
    ownerReliability: 80,
    theme: 'Campus',
    timeframe: '1 month',
    roles: roles(['Mobile', 1, 0], ['AI/ML', 1, 0]),
    reason: 'Fills their backend gap',
  }),
];

const womenDeck: Card[] = [
  project({
    id: 'p_cyclesafe',
    title: 'CycleSafe',
    teaser: 'Period tracker where your data never leaves your phone.',
    ownerUsername: 'nina_nodes',
    ownerReliability: 89,
    theme: 'Health',
    timeframe: '1 month',
    roles: roles(['Security', 1, 0], ['Mobile', 1, 0]),
    reason: 'Needs your backend skills',
    isSuper: true,
  }),
  person({
    id: 'u_zara',
    username: 'zara_zaps',
    role: 'Frontend',
    level: 'advanced',
    skills: ['React Native', 'Reanimated', 'TypeScript'],
    prompts: [{ q: 'My toxic trait', a: 'Animating the loading spinner' }],
    reliability: 90,
    reason: 'Your team has no frontend yet',
  }),
  project({
    id: 'p_mentormatch',
    title: 'MentorMatch',
    teaser: 'Pairs first year CS students with seniors who took the same classes.',
    visibility: 'public',
    fullIdea:
      'Seniors list classes they aced and hours they can give. First years get matched by class and schedule, with a 20 minute first call template so nobody has to plan it.',
    ownerUsername: 'aisha_algo',
    ownerReliability: 83,
    theme: 'Education',
    timeframe: 'semester',
    roles: roles(['Backend', 1, 0], ['PM', 1, 1]),
    reason: 'Needs a backend dev, you are one',
  }),
  person({
    id: 'u_mei',
    username: 'mei_makes',
    role: 'Hardware',
    level: 'intermediate',
    occupation: 'working',
    skills: ['Arduino', 'C++', '3D printing'],
    prompts: [{ q: 'Best thing I soldered', a: 'A plant that texts me when it is thirsty' }],
    reliability: 78,
    reason: 'Rare skill on this deck',
  }),
  person({
    id: 'u_fatima',
    username: 'fatima_figma',
    role: 'Design',
    level: 'beginner',
    skills: ['Figma', 'Illustration'],
    prompts: [{ q: 'Green flag in a teammate', a: 'Says the scary thing early' }],
    reliability: 74,
    reason: 'Wants a first real project',
  }),
];

const HACK_TEAM_ID = 'p_bob_hack';

const hackDeck: Card[] = [
  person({
    id: 'u_rio',
    username: 'rio_rebases',
    role: 'Frontend',
    level: 'advanced',
    skills: ['React', 'Expo', 'Tailwind'],
    prompts: [{ q: 'git blame says', a: 'it was me, it is always me' }],
    reliability: 88,
    reason: 'Your team needs 1 Frontend',
    rolesNeeded: roles(['Backend', 1, 0], ['Design', 1, 0]),
    forProjectId: HACK_TEAM_ID,
    isSuper: true,
  }),
  person({
    id: 'u_tess',
    username: 'tess_tensors',
    role: 'AI/ML',
    level: 'intermediate',
    skills: ['Python', 'LangChain', 'FastAPI'],
    prompts: [{ q: 'Hackathon fuel', a: 'Cold brew and spite' }],
    reliability: 81,
    reason: 'Your team needs 1 AI/ML',
    rolesNeeded: roles(['Backend', 2, 0]),
    forProjectId: HACK_TEAM_ID,
  }),
  person({
    id: 'u_omar',
    username: 'omar_ops',
    role: 'Security',
    level: 'advanced',
    occupation: 'working',
    skills: ['Pentesting', 'Go', 'Docker'],
    prompts: [{ q: 'Sleep schedule this weekend', a: 'git stash' }],
    reliability: 93,
    reason: 'High reliability, fills Security',
    rolesNeeded: roles(['Frontend', 1, 0], ['Design', 1, 0]),
    forProjectId: HACK_TEAM_ID,
  }),
  person({
    id: 'u_lina',
    username: 'lina_layouts',
    role: 'Design',
    level: 'intermediate',
    skills: ['Figma', 'Prototyping'],
    prompts: [{ q: 'Merge conflict style', a: 'Accept both, cry later' }],
    reliability: 76,
    reason: 'Your team needs 1 Design',
    rolesNeeded: roles(['Backend', 1, 0], ['Mobile', 1, 0]),
    forProjectId: HACK_TEAM_ID,
  }),
  person({
    id: 'u_dev',
    username: 'dev_null',
    role: 'Mobile',
    level: 'beginner',
    skills: ['Swift', 'Kotlin'],
    prompts: [{ q: 'First hackathon?', a: 'Yes, be nice' }],
    reliability: 70,
    reason: 'Your team needs 1 Mobile',
    rolesNeeded: roles(['Frontend', 1, 0], ['AI/ML', 1, 0]),
    forProjectId: HACK_TEAM_ID,
  }),
];

const decks: Record<Mode, Card[]> = { normal: normalDeck, women: womenDeck, hack: hackDeck };

// Cards whose owner (or person) already swiped right on Bob. A right swipe on these makes a match.
const likesMe = new Set(['p_alice_tutor', 'u_priya', 'p_cyclesafe', 'u_rio', 'u_omar']);

// ---------- mutable mock state ----------

type SwipeRecord = { card: Card; direction: Direction; role?: Role; matchId?: string };
const swiped = new Set<string>();
const swipeHistory: SwipeRecord[] = [];
let superUsedOn: string | null = null; // date string, 1 per day

let matches: Match[] = [
  {
    id: 'm_seed_1',
    projectId: 'p_bob_main',
    role: 'Design',
    otherUsername: 'jules_jpeg',
    otherAvatarUrl: null,
    iCommitted: true,
    theyCommitted: false,
    isTeam: false,
  },
];

const messages: Record<string, ChatMessage[]> = {
  m_seed_1: [
    {
      id: 'msg_1',
      matchId: 'm_seed_1',
      senderId: 'u_jules',
      senderUsername: 'jules_jpeg',
      body: 'Hi! I love the idea. What does the first screen look like in your head?',
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      mine: false,
    },
  ],
};
const messageListeners: Record<string, Set<(m: ChatMessage) => void>> = {};

const interested: Interested[] = [
  { swipeRef: 'sr_1', role: 'Design', level: 'advanced', isSuper: true },
  { swipeRef: 'sr_2', role: 'AI/ML', level: 'intermediate', isSuper: false },
  { swipeRef: 'sr_3', role: 'Frontend', level: 'beginner', isSuper: false },
];

const copyAlerts: CopyAlert[] = [];
const copyListeners = new Set<(a: CopyAlert) => void>();
const redteamListeners = new Set<(r: RedteamRun) => void>();

const evalRows: EvalRow[] = (() => {
  // Illustrative curve only. The real numbers come from scripts/eval/run.ts.
  const rows: EvalRow[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = Math.round((0.75 + i * 0.01) * 100) / 100;
    const precision = Math.min(1, 0.62 + i * 0.02);
    const recall = Math.max(0.3, 1 - i * 0.033);
    rows.push({ id: `ev_${i}`, threshold: t, precision, recall, chosen: false, createdAt: nowIso() });
  }
  let best = rows[0];
  const f1 = (r: EvalRow) => (2 * r.precision * r.recall) / (r.precision + r.recall);
  for (const r of rows) if (f1(r) > f1(best)) best = r;
  best.chosen = true;
  return rows;
})();

// ---------- auth ----------

export async function sendEmailCode(email: string): Promise<void> {
  if (!email.includes('@')) throw new Error('Enter a valid email');
  return wait(undefined);
}

export async function verifyEmailCode(_email: string, code: string): Promise<void> {
  if (!/^\d{6}$/.test(code)) throw new Error('The code is 6 digits');
  return wait(undefined);
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  if (!email.includes('@') || !password) throw new Error('Enter your email and password');
  return wait(undefined);
}

export async function signInWithProvider(_provider: 'github' | 'google'): Promise<void> {
  return wait(undefined, 600);
}

export async function signInWithPassword(email: string, _password: string): Promise<void> {
  if (!email.includes('@')) throw new Error('Enter a valid email');
  return wait(undefined);
}

export async function signUpWithPassword(email: string, _password: string): Promise<{ needsConfirmation: boolean }> {
  if (!email.includes('@')) throw new Error('Enter a valid email');
  return wait({ needsConfirmation: false });
}

export async function authProviders(): Promise<{ github: boolean; google: boolean }> {
  return { github: true, google: true };
}

export async function signOut(): Promise<void> {
  return wait(undefined);
}

// ---------- profile ----------

export async function getMyProfile(): Promise<Profile | null> {
  return wait(me ? clone(me) : null);
}

export async function saveProfile(p: ProfileInput): Promise<void> {
  me = { ...p, id: ME_ID, reliability: me?.reliability ?? 70 };
  return wait(undefined);
}

// ---------- deck and swiping ----------

export async function getDeck(mode: Mode): Promise<Card[]> {
  const deck = decks[mode].filter((c) => !swiped.has(c.id));
  // Super cards float up, otherwise keep the seeded (deterministic) order.
  const sorted = [...deck.filter((c) => c.isSuper), ...deck.filter((c) => !c.isSuper)];
  return wait(clone(sorted));
}

export async function superCommitsLeft(): Promise<number> {
  return wait(superUsedOn === new Date().toDateString() ? 0 : 1);
}

export async function swipe(
  card: Card,
  direction: Direction,
  role?: Role,
): Promise<{ matched: boolean; match?: Match }> {
  if (direction === 'super') {
    const today = new Date().toDateString();
    if (superUsedOn === today) throw new Error('No Super Commits left today');
    superUsedOn = today;
  }
  swiped.add(card.id);
  const record: SwipeRecord = { card, direction, role };
  swipeHistory.push(record);

  if (direction !== 'left' && likesMe.has(card.id)) {
    const isTeam = card.kind === 'person' && card.forProjectId === HACK_TEAM_ID;
    const match: Match = {
      id: newId('m'),
      projectId: card.kind === 'project' ? card.id : card.forProjectId,
      role: role ?? (card.kind === 'person' ? card.role : card.roles.find((r) => r.open > r.filled)?.role ?? 'Backend'),
      otherUsername: card.kind === 'project' ? card.ownerUsername : card.username,
      otherAvatarUrl: card.kind === 'person' ? card.avatarUrl : null,
      iCommitted: false,
      theyCommitted: false,
      isTeam,
    };
    matches = [match, ...matches];
    messages[match.id] = [];
    record.matchId = match.id;
    return wait({ matched: true, match: clone(match) });
  }
  return wait({ matched: false });
}

export async function undoLastSwipe(): Promise<void> {
  const last = swipeHistory[swipeHistory.length - 1];
  if (!last) return wait(undefined);
  if (last.matchId) throw new Error('You already matched, so this swipe cannot be undone');
  swipeHistory.pop();
  swiped.delete(last.card.id);
  if (last.direction === 'super') superUsedOn = null;
  return wait(undefined);
}

export async function getInterested(): Promise<{ count: number; cards: Interested[] }> {
  return wait({ count: interested.length, cards: clone(interested) });
}

// ---------- matches and teams ----------

export async function getMatches(): Promise<Match[]> {
  return wait(clone(matches));
}

export async function commitToMatch(matchId: string): Promise<{ isTeam: boolean }> {
  const m = matches.find((x) => x.id === matchId);
  if (!m) throw new Error('Match not found');
  m.iCommitted = true;
  // In the mock the other side commits right away so the full flow can be tested.
  m.theyCommitted = true;
  return wait({ isTeam: m.isTeam });
}

export async function getTeam(projectId: string): Promise<Team> {
  const committed = matches.filter((m) => m.projectId === projectId && m.iCommitted && m.theyCommitted);
  const isHackTeam = projectId === HACK_TEAM_ID;
  const owner: TeamMember = {
    userId: ME_ID,
    username: me?.username ?? 'bob_builds',
    avatarUrl: null,
    role: 'Backend',
    ownership: 'owner',
    reliability: me?.reliability ?? 70,
  };
  return wait<Team>({
    projectId,
    title: isHackTeam ? 'Bob and friends' : 'Bob main project',
    isHackTeam,
    members: [
      owner,
      ...committed.map((m): TeamMember => ({
        userId: `u_${m.otherUsername}`,
        username: m.otherUsername,
        avatarUrl: m.otherAvatarUrl,
        role: m.role,
        ownership: 'collaborator',
        reliability: 80,
      })),
    ].slice(0, isHackTeam ? 4 : undefined),
    roles: roles(['Backend', 1, 1], ['Design', 1, committed.some((m) => m.role === 'Design') ? 1 : 0], ['Frontend', 1, 0]),
  });
}

export async function getMyProjects(): Promise<MyProject[]> {
  return wait(demoProjects);
}

export async function getMyProjects(): Promise<MyProject[]> {
  return wait(demoProjects);
}

// ---------- chat at match (plain text) ----------

export async function getMessages(matchId: string): Promise<ChatMessage[]> {
  return wait(clone(messages[matchId] ?? []));
}

export async function sendMessage(matchId: string, body: string): Promise<void> {
  const text = body.trim();
  if (!text) throw new Error('Message is empty');
  const msg: ChatMessage = {
    id: newId('msg'),
    matchId,
    senderId: ME_ID,
    senderUsername: me?.username ?? 'bob_builds',
    body: text,
    createdAt: nowIso(),
    mine: true,
  };
  (messages[matchId] ??= []).push(msg);
  messageListeners[matchId]?.forEach((cb) => cb(clone(msg)));
  return wait(undefined);
}

export function subscribeMessages(matchId: string, cb: (m: ChatMessage) => void): () => void {
  (messageListeners[matchId] ??= new Set()).add(cb);
  return () => {
    messageListeners[matchId]?.delete(cb);
  };
}

// ---------- projects ----------

export async function postIdea(input: PostIdeaInput): Promise<{ projectId: string; commitHash: string }> {
  if (!input.title.trim() || !input.fullIdea.trim()) throw new Error('Title and idea are required');
  const projectId = newId('p');
  const commitHash = fakeHash();
  // Demo: an idea mentioning "quiz" looks like Alice's Pocket Tutor, so Alice gets a copy alert.
  if (/quiz/i.test(input.fullIdea)) {
    const alert: CopyAlert = {
      id: newId('ca'),
      originalProjectId: 'p_alice_tutor',
      originalTitle: 'Pocket Tutor',
      similarity: 0.91,
      createdAt: nowIso(),
    };
    copyAlerts.unshift(alert);
    setTimeout(() => copyListeners.forEach((cb) => cb(clone(alert))), 800);
  }
  return wait({ projectId, commitHash }, 700);
}

export async function getCopyAlerts(): Promise<CopyAlert[]> {
  return wait(clone(copyAlerts));
}

export function subscribeCopyAlerts(cb: (a: CopyAlert) => void): () => void {
  copyListeners.add(cb);
  return () => {
    copyListeners.delete(cb);
  };
}

// ---------- proof screens ----------

export async function getEvalResults(): Promise<EvalRow[]> {
  return wait(clone(evalRows));
}

export function subscribeRedteamRuns(cb: (r: RedteamRun) => void): () => void {
  redteamListeners.add(cb);
  return () => {
    redteamListeners.delete(cb);
  };
}

/** Mock only: lets the Lab screens be built before the attack scripts exist. Labelled simulated. */
export function __emitMockRedteamRun(kind: 'oracle' | 'rls', version: 'v1' | 'v2'): void {
  const run: RedteamRun =
    kind === 'oracle'
      ? {
          id: newId('rt'),
          kind,
          version,
          attempts: version === 'v1' ? 40 : 3,
          revealed: version === 'v1' ? 7 : 0,
          denied: version === 'v1' ? 0 : 37,
          details: { simulated: true },
          createdAt: nowIso(),
        }
      : { id: newId('rt'), kind, version, attempts: 12, revealed: 0, denied: 12, details: { simulated: true }, createdAt: nowIso() };
  redteamListeners.forEach((cb) => cb(clone(run)));
}
