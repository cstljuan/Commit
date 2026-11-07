import type { Card, PersonCard, ProjectCard } from './cardTypes';

// Synthetic demo data for building the deck. Replaced by getDeck(mode) from lib/api.ts.
const project = (p: Partial<ProjectCard> & Pick<ProjectCard, 'id' | 'title' | 'teaser'>): ProjectCard => ({
  kind: 'project',
  visibility: 'private',
  theme: 'Education',
  timeframe: 'Weekend',
  roles: [],
  ownerUsername: 'alice_ships',
  ownerReliability: 88,
  reason: 'Fills your backend gap',
  commitHash: 'a3f9c21',
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
  reliability: 80,
  reason: 'Fills your backend gap',
  isSuper: false,
  forProjectId: 'demo',
  ...p,
});

const normal: Card[] = [
  project({
    id: 'n1',
    title: 'AI study buddy',
    teaser: 'Turns your notes into quizzes that find what you keep forgetting.',
    roles: [
      { role: 'Backend', open: 1, filled: 0 },
      { role: 'Design', open: 1, filled: 1 },
    ],
  }),
  person({
    id: 'n2',
    username: 'ben_codes',
    role: 'Backend',
    skills: ['TypeScript', 'Postgres', 'Go'],
    prompts: [{ q: 'My 3 AM snack', a: 'Cold pizza and regret' }],
    reliability: 92,
  }),
  project({
    id: 'n3',
    title: 'Rent splitter',
    teaser: 'Fair rent for roommates, based on who actually gets the big room.',
    theme: 'Finance',
    timeframe: '1 month',
    visibility: 'public',
    isSuper: true,
    reason: 'Needs your exact stack',
    commitHash: '7be04d9',
    roles: [{ role: 'Frontend', open: 1, filled: 0 }],
  }),
  project({
    id: 'n4',
    title: 'Campus lost and found',
    teaser: 'Snap a photo of what you found, and it finds its owner.',
    theme: 'Community',
    reason: 'You both like mobile',
    commitHash: 'c19e7f0',
    roles: [
      { role: 'Mobile', open: 2, filled: 0 },
      { role: 'AI/ML', open: 1, filled: 0 },
      { role: 'Design', open: 1, filled: 0 },
    ],
  }),
];

const women: Card[] = [
  project({
    id: 'w1',
    title: 'Safe walk home',
    teaser: 'Walk with someone you trust, and a route that stays lit.',
    theme: 'Safety',
    reason: 'Fills your backend gap',
    commitHash: 'e40b2a6',
    roles: [
      { role: 'Backend', open: 1, filled: 0 },
      { role: 'Mobile', open: 1, filled: 1 },
    ],
  }),
  person({
    id: 'w2',
    username: 'priya_builds',
    role: 'AI/ML',
    skills: ['Python', 'PyTorch', 'Figma'],
    prompts: [{ q: 'Tabs or spaces', a: 'Whatever ships' }],
    reliability: 95,
    reason: 'You both follow health tech',
  }),
  project({
    id: 'w3',
    title: 'First PR club',
    teaser: 'Pairs first-time contributors with a mentor for their first merge.',
    theme: 'Education',
    timeframe: 'Semester',
    isSuper: true,
    reason: 'Needs your exact stack',
    commitHash: '21fd8c3',
    roles: [{ role: 'Frontend', open: 1, filled: 0 }],
  }),
];

const needs = (backend: number, design: number): PersonCard['rolesNeeded'] => [
  { role: 'Backend', open: backend, filled: 0 },
  { role: 'Design', open: design, filled: 0 },
];

const hack: Card[] = [
  person({
    id: 'h1',
    username: 'maya_builds',
    role: 'Frontend',
    skills: ['TypeScript', 'Postgres', 'Rust'],
    prompts: [{ q: 'Worst commit message', a: 'fix fix fix' }],
    reliability: 90,
    reason: 'fills: backend',
    rolesNeeded: needs(2, 1),
  }),
  person({
    id: 'h2',
    username: 'dev_ana',
    role: 'Design',
    level: 'advanced',
    occupation: 'working',
    skills: ['Figma', 'React', 'Motion'],
    prompts: [{ q: 'Tabs or spaces', a: 'Tabs. Fight me.' }],
    reliability: 84,
    reason: 'fills: design',
    rolesNeeded: needs(1, 0),
  }),
  person({
    id: 'h3',
    username: 'sam_ships',
    role: 'Security',
    level: 'beginner',
    skills: ['Python', 'Linux'],
    prompts: [{ q: 'My 3 AM snack', a: 'Vending machine roulette' }],
    reliability: 72,
    reason: 'fills: security',
    isSuper: true,
    rolesNeeded: needs(1, 1),
  }),
];

export const sampleDecks = { normal, women, hack };

/** Liking these sample cards makes a match, so the moment can be built before lib/api.ts lands. */
export const sampleMatches = new Set(['n2', 'n3', 'w2', 'w3', 'h1', 'h3']);

/** Same shape as the contract's Interested: role, level and super flag, no identity. */
export type Interested = { swipeRef: string; role: string; level: string; isSuper: boolean };

export const sampleInterested: Interested[] = [
  { swipeRef: 'i1', role: 'Backend', level: 'intermediate', isSuper: true },
  { swipeRef: 'i2', role: 'Backend', level: 'advanced', isSuper: false },
  { swipeRef: 'i3', role: 'Design', level: 'beginner', isSuper: false },
];

const REVEALS: Record<string, string> = { i1: 'ben_codes', i2: 'lena_ships', i3: 'kai_draws' };

export const sampleReveal = (item: Interested) => ({
  id: item.swipeRef,
  role: item.role,
  otherUsername: REVEALS[item.swipeRef] ?? 'builder',
});
