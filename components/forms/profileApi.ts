import * as api from '@/lib/api';


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

/** Onboarding's shape over the shared API. Fields this form does not edit keep their saved values. */
export async function getMyProfile(): Promise<Profile | null> {
  return api.getMyProfile();
}

export async function saveProfile(p: ProfileInput): Promise<void> {
  const current = await api.getMyProfile().catch(() => null);
  await api.saveProfile({
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
  });
}
