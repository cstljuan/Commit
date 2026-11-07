/**
 * Synthetic data for building screens before lib/api.ts and lib/vault.ts land.
 * Screens that show numbers from here carry a visible "Sample data" label. Never present
 * these as measured results. Replace each with the real source named beside it.
 */
import type { Role } from '@/components/deck/cardTypes';

export const LAB = {
  bg: '#0F0F14',
  card: '#1C1C24',
  line: '#2C2C38',
  primary: '#22D3EE',
  accent: '#E879F9',
  text: '#E5E7EB',
  muted: '#9CA3AF',
  ok: '#00D2A0',
  bad: '#FF6B6B',
  mono: 'JetBrainsMono_400Regular',
  monoBold: 'JetBrainsMono_700Bold',
  display: 'BricolageGrotesque_800ExtraBold',
};

export type DemoMatch = {
  id: string;
  username: string;
  role: Role;
  project: string;
  iCommitted: boolean;
  theyCommitted: boolean;
  lastLine: string;
};

// Real source: getMatches()
export const demoMatches: DemoMatch[] = [
  { id: 'm1', username: 'ben_codes', role: 'Backend', project: 'AI study buddy', iCommitted: false, theyCommitted: true, lastLine: 'I can start on the schema tonight' },
  { id: 'm2', username: 'priya_builds', role: 'AI/ML', project: 'AI study buddy', iCommitted: true, theyCommitted: false, lastLine: 'Tabs or spaces, be honest' },
  { id: 'm3', username: 'dev_ana', role: 'Design', project: 'Rent splitter', iCommitted: true, theyCommitted: true, lastLine: 'Sent you the first screens' },
];

// Real source: getTeam(projectId), readIdea(projectId)
export const demoTeam = {
  id: 'p1',
  title: 'AI study buddy',
  commitHash: 'a3f9c21d8e07b6f4',
  idea: 'Upload your notes and it builds a quiz that keeps asking what you got wrong until you stop getting it wrong. It tracks what you forget and when, so a study session starts where you are weakest.',
  roles: [
    { role: 'Frontend' as Role, username: 'you' },
    { role: 'Backend' as Role, username: 'ben_codes' },
    { role: 'AI/ML' as Role, username: 'priya_builds' },
    { role: 'Design' as Role, username: null },
  ],
};

export type DemoMessage = { id: string; mine: boolean; body: string };

// Real source: getMessages(matchId), subscribeMessages(matchId)
export const demoMessages: DemoMessage[] = [
  { id: '1', mine: false, body: 'Saw you need backend. I can start on the schema tonight.' },
  { id: '2', mine: true, body: 'Perfect. Have you used Supabase?' },
  { id: '3', mine: false, body: 'A few times. Row level security and all.' },
];

export const demoIcebreakers = (username: string) => [
  `Worst commit message you ever wrote, @${username}?`,
  'What would you build first?',
  'How many hours can you give this week?',
];

// Real source: verifyChain() from lib/vault.ts
export type ChainRow = { seq: number; hash: string; ok: boolean; reason?: string };
export const demoChainGood: ChainRow[] = [
  { seq: 1, hash: 'a3f9c21', ok: true },
  { seq: 2, hash: '7be04d9', ok: true },
  { seq: 3, hash: 'c19e7f0', ok: true },
  { seq: 4, hash: 'e40b2a6', ok: true },
  { seq: 5, hash: '21fd8c3', ok: true },
];
export const demoChainBroken: ChainRow[] = demoChainGood.map((row) =>
  row.seq === 3 ? { ...row, ok: false, reason: 'entry edited' } : row,
);

// Real source: redteam_runs, kind oracle. Placeholder values, not measurements.
export const demoOracle = { attempts: 40, v1Revealed: 23, v2Revealed: 0, v2RateLimited: 37 };

// Real source: eval_results. Placeholder curve, not a measurement.
export const demoEval = {
  chosen: 0.86,
  points: [
    { threshold: 0.75, precision: 0.62, recall: 0.98 },
    { threshold: 0.78, precision: 0.7, recall: 0.97 },
    { threshold: 0.81, precision: 0.79, recall: 0.95 },
    { threshold: 0.84, precision: 0.87, recall: 0.93 },
    { threshold: 0.86, precision: 0.92, recall: 0.9 },
    { threshold: 0.89, precision: 0.95, recall: 0.8 },
    { threshold: 0.92, precision: 0.98, recall: 0.65 },
    { threshold: 0.95, precision: 1, recall: 0.45 },
  ],
};

// Real source: redteam_runs, kind rls. The attack list is real, the results are not yet.
export const demoAttacks = [
  "Read another team's messages",
  "Read another user's team keys",
  'Read idea embeddings',
  'Call match_projects directly',
  'Set my own reliability score',
  "Update someone else's profile",
  'Insert into the vault log',
  'Edit a vault log row',
  'Add myself to a team',
  'Commit to a role with 0 slots',
  "Read someone else's copy alerts",
  "Post in a team I'm not on",
  'Read Women-only profiles',
];

export type DemoCommit = { hash: string; message: string; when: string; kind: 'idea' | 'team' | 'merge' };

// Real source: vault_log and team_members for this user.
export const demoCommits: DemoCommit[] = [
  { hash: 'a3f9c21', message: 'Posted AI study buddy', when: 'Tonight, 10:41 PM', kind: 'idea' },
  { hash: '7be04d9', message: 'Matched with @ben_codes as Backend', when: 'Tonight, 11:02 PM', kind: 'team' },
  { hash: 'c19e7f0', message: 'Matched with @priya_builds as AI/ML', when: 'Tonight, 11:20 PM', kind: 'team' },
  { hash: 'e40b2a6', message: 'Merged into team AI study buddy', when: 'Tonight, 11:34 PM', kind: 'merge' },
  { hash: '21fd8c3', message: 'Posted Rent splitter', when: 'Last night, 9:15 PM', kind: 'idea' },
];

// Real source: copy_alerts. Placeholder similarity, not a measurement.
export const demoAlert = { similarity: 93, yours: 'Tonight, 10:41 PM', theirs: 'Tonight, 11:47 PM', hash: 'a3f9c21d8e07b6f4' };

// Real source: getPublicProfile(id).
export const demoPeople: Record<string, { role: string; level: string; occupation: string; score: number; skills: string[]; prompts: { q: string; a: string }[] }> = {
  ben_codes: { role: 'Backend', level: 'intermediate', occupation: 'student', score: 92, skills: ['TypeScript', 'Postgres', 'Go'], prompts: [{ q: 'My 3 AM snack', a: 'Cold pizza and regret' }, { q: 'Worst commit message', a: 'asdf' }] },
  priya_builds: { role: 'AI/ML', level: 'advanced', occupation: 'student', score: 95, skills: ['Python', 'PyTorch', 'Figma'], prompts: [{ q: 'Tabs or spaces', a: 'Whatever ships' }] },
  dev_ana: { role: 'Design', level: 'advanced', occupation: 'working', score: 84, skills: ['Figma', 'React', 'Motion'], prompts: [{ q: 'Tabs or spaces', a: 'Tabs. Fight me.' }] },
};
