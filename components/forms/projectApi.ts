/**
 * TEMPORARY local stub of postIdea from lib/api.ts (03-CONTRACTS.md, section 4).
 * Swap for a re-export once shahd-agent lands lib/api.mock.ts or lib/api.ts.
 */
import type { Level, Role } from './profileApi';

export type RoleNeed = { role: Role; level: Level; count: number };

export type PostIdeaInput = {
  title: string;
  visibility: 'private' | 'public';
  teaser: string; // shown on the card; for public projects this is the start of the idea
  idea: string; // full idea; encrypted when private
  theme: string;
  roles: RoleNeed[];
  githubUrl?: string;
  timeframe: string;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function postIdea(input: PostIdeaInput): Promise<{ projectId: string; commitHash: string }> {
  await wait(900);
  if (input.title.toLowerCase().includes('fail')) throw new Error('post_idea failed');
  const hex = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return { projectId: `p_${Date.now()}`, commitHash: hex };
}
