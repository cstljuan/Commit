// The contract between the UI and the backend. Source of truth: 03-CONTRACTS.md, section 3.
// Changing a shape here means posting INTERFACE in agent-chat first, with the old and new shape.

export type Mode = 'normal' | 'women' | 'hack';
export type Role = 'Frontend' | 'Backend' | 'AI/ML' | 'Security' | 'Mobile' | 'Design' | 'PM' | 'Hardware'; // Tako's 8 arms
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Direction = 'left' | 'right' | 'super';
export type Occupation = 'student' | 'working';
export type Visibility = 'private' | 'public';

export const ROLES: Role[] = ['Frontend', 'Backend', 'AI/ML', 'Security', 'Mobile', 'Design', 'PM', 'Hardware'];

export type RoleCount = { role: Role; open: number; filled: number };
export type Prompt = { q: string; a: string };

export type PersonCard = {
  kind: 'person';
  id: string;
  username: string;
  avatarUrl: string | null;
  role: Role;
  level: Level;
  occupation: Occupation;
  skills: string[];
  prompts: Prompt[];
  reliability: number;
  reason: string;
  isSuper: boolean;
  rolesNeeded?: RoleCount[]; // hack mode only
  forProjectId: string; // the project or hack team this swipe counts for
  boxPublicKey?: string | null; // Critter seed. Null or missing: use username
};

export type ProjectCard = {
  kind: 'project';
  id: string;
  title: string;
  teaser: string;
  visibility: Visibility;
  fullIdea?: string; // public only
  theme: string;
  timeframe: string;
  githubUrl?: string;
  roles: RoleCount[];
  ownerUsername: string;
  ownerReliability: number;
  ownerBoxPublicKey?: string | null; // Critter seed. Null or missing: use ownerUsername
  reason: string;
  commitHash: string;
  isSuper: boolean;
};

export type Card = PersonCard | ProjectCard; // hack deck returns PersonCard only

export type Match = {
  id: string;
  projectId: string;
  role: Role;
  otherUsername: string;
  otherAvatarUrl: string | null;
  projectTitle?: string; // missing for hack teams
  iCommitted: boolean;
  theyCommitted: boolean;
  isTeam: boolean;
};

/** A project on the Projects tab. A seat with no username is open. */
export type MyProject = {
  id: string;
  title: string;
  commitHash: string;
  idea: string;
  status: 'recruiting' | 'building' | 'private';
  mine: boolean;
  wantIn: number;
  roles: { role: Role; username: string | null }[];
};

/** One row on the Activity screen. `seed` drives the Critter; 'unknown' when identity must stay hidden. */
export type ActivityEvent = {
  id: string;
  kind: 'match' | 'super' | 'alert' | 'team' | 'commit';
  seed: string;
  title: string;
  when: string; // relative, e.g. '4 min ago'
  createdAt: string; // ISO
  href: string;
};

/** One line on the Score screen. The deltas add up to the current reliability score. */
export type ScoreEvent = { label: string; delta: number };

/** Blurred card. MUST contain no identity. The server only sends identity on reveal. */
export type Interested = { swipeRef: string; role: Role; level: Level; isSuper: boolean };

// ---- Shapes used by lib/api.ts that section 3 names but does not spell out ----

export type Profile = {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  bio: string;
  role: Role;
  level: Level;
  occupation: Occupation;
  skills: string[]; // skills and programming languages
  prompts: Prompt[];
  hoursPerWeek: number | null;
  timezone: string | null;
  womenOnly: boolean; // read only, server-set (0009). Self-identification is not verified, so no self-serve switch
  reliability: number; // read only, the server owns it
};

/**
 * What the onboarding and profile screens can write. Reliability is server side only.
 * womenOnly stays in the type for compatibility but saveProfile ignores it (server-set only, 0009).
 */
export type ProfileInput = Omit<Profile, 'id' | 'reliability'>;

export type TeamMember = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: Role;
  ownership: 'owner' | 'co-owner' | 'collaborator';
  reliability: number;
};

export type Team = {
  projectId: string;
  title: string;
  isHackTeam: boolean;
  members: TeamMember[]; // max 4 for hack teams
  roles: RoleCount[];
};

/** Plain text chat that opens at match. Labelled honestly in the UI as not end to end encrypted. */
export type ChatMessage = {
  id: string;
  matchId: string;
  senderId: string;
  senderUsername: string;
  body: string;
  createdAt: string; // ISO
  mine: boolean;
};

export type PostIdeaInput = {
  title: string;
  teaser: string; // public short pitch shown on the card
  fullIdea: string; // encrypted if private; sent to the server only for the embedding, never stored in plain text when private
  visibility: Visibility;
  type: 'original' | 'practice' | 'hackathon';
  theme: string;
  timeframe: string; // 'weekend', '1 month', 'semester', 'ongoing'
  githubUrl?: string;
  roles: { role: Role; open: number; level?: Level }[];
  womenOnly: boolean; // only allowed for Women mode accounts; the server rejects it otherwise (0009)
};

export type CopyAlert = {
  id: string;
  originalProjectId: string;
  originalTitle: string;
  similarity: number; // 0 to 1
  createdAt: string; // ISO
};

export type EvalRow = {
  id: string;
  threshold: number;
  precision: number;
  recall: number;
  chosen: boolean;
  createdAt: string;
};

export type RedteamRun = {
  id: string;
  kind: 'oracle' | 'rls';
  version: 'v1' | 'v2';
  attempts: number;
  revealed: number;
  denied: number;
  details: unknown;
  createdAt: string;
};
