/**
 * TEMPORARY local stub of the profile part of lib/api.ts (03-CONTRACTS.md, section 4).
 * Swap for a re-export once shahd-agent lands lib/types.ts and lib/api.mock.ts.
 * The types below mirror 03-CONTRACTS.md section 2 and 3 and should move to lib/types.ts.
 */

export type Role = 'Frontend' | 'Backend' | 'AI/ML' | 'Security' | 'Mobile' | 'Design' | 'PM' | 'Hardware';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Prompt = { q: string; a: string };

export type ProfileInput = {
  username: string;
  bio: string; // the profile tagline, matches Profile.bio in lib/types.ts
  role: Role | null;
  level: Level | null;
  occupation: 'student' | 'working' | null;
  skills: string[];
  prompts: Prompt[];
  avatarUrl: string | null;
};

export type Profile = ProfileInput & { id: string; reliability: number };

let saved: Profile | null = null;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getMyProfile(): Promise<Profile | null> {
  await wait(200);
  return saved;
}

export async function saveProfile(p: ProfileInput): Promise<void> {
  await wait(500);
  if (p.username.toLowerCase() === 'taken') throw new Error('duplicate key value violates unique constraint');
  saved = { ...p, id: 'me', reliability: saved?.reliability ?? 100 };
}
