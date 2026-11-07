// Same shapes as 03-CONTRACTS.md, section 3. Delete this file and import from
// lib/types.ts once shahd-agent lands it.
export type Role = 'Frontend' | 'Backend' | 'AI/ML' | 'Security' | 'Mobile' | 'Design' | 'PM' | 'Hardware';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Direction = 'left' | 'right' | 'super';

export type RoleCount = { role: Role; open: number; filled: number };
export type Prompt = { q: string; a: string };

export type PersonCard = {
  kind: 'person';
  id: string;
  username: string;
  avatarUrl: string | null;
  role: Role;
  level: Level;
  occupation: 'student' | 'working';
  skills: string[];
  prompts: Prompt[];
  reliability: number;
  reason: string;
  isSuper: boolean;
  rolesNeeded?: RoleCount[];
  forProjectId: string;
};

export type ProjectCard = {
  kind: 'project';
  id: string;
  title: string;
  teaser: string;
  visibility: 'private' | 'public';
  fullIdea?: string;
  theme: string;
  timeframe: string;
  githubUrl?: string;
  roles: RoleCount[];
  ownerUsername: string;
  ownerReliability: number;
  reason: string;
  commitHash: string;
  isSuper: boolean;
};

export type Card = PersonCard | ProjectCard;
