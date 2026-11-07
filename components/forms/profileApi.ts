import * as api from '@/lib/api';


export type { Role } from '@/lib/types';
import type { Role } from '@/lib/types';
export type Occupation = 'student' | 'working' | 'both';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Prompt = { q: string; a: string };

export type ProfileInput = {
  username: string;
  bio: string; // the profile tagline, matches Profile.bio in lib/types.ts
  role: Role | null;
  level: Level | null;
  occupation: Occupation | null;
  skills: string[];
  prompts: Prompt[];
  avatarUrl: string | null;
};

export type Profile = ProfileInput & { id: string; reliability: number };

/** Onboarding's shape over the shared API. Fields this form does not edit keep their saved values. */
export async function getMyProfile(): Promise<Profile | null> {
  return api.getMyProfile();
}

export async function saveProfile(p: ProfileInput): Promise<void> {
  const current = await api.getMyProfile().catch(() => null);
  const row = {
    name: current?.name ?? p.username,
    hoursPerWeek: current?.hoursPerWeek ?? null,
    timezone: current?.timezone ?? null,
    womenOnly: current?.womenOnly ?? false,
    username: p.username,
    avatarUrl: p.avatarUrl,
    bio: p.bio,
    role: p.role ?? current?.role ?? 'Backend',
    level: p.level ?? current?.level ?? 'intermediate',
    occupation: p.occupation ?? current?.occupation ?? 'student',
    skills: p.skills,
    prompts: p.prompts,
  };
  try {
    await api.saveProfile(row as Parameters<typeof api.saveProfile>[0]);
  } catch (e) {
    // 'both' needs migration 0015. Until it runs, save student instead of failing the whole profile.
    if (row.occupation === 'both' && /occupation/i.test(String((e as Error)?.message))) await api.saveProfile({ ...row, occupation: 'student' } as Parameters<typeof api.saveProfile>[0]);
    else throw e;
  }
}
