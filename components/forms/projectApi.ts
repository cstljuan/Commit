import * as api from '@/lib/api';

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

export async function postIdea(input: PostIdeaInput): Promise<{ projectId: string; commitHash: string }> {
  return api.postIdea({
    title: input.title,
    teaser: input.teaser || input.idea.slice(0, 120),
    fullIdea: input.idea,
    visibility: input.visibility,
    type: 'original',
    theme: input.theme,
    timeframe: input.timeframe,
    githubUrl: input.githubUrl,
    roles: input.roles.map((r) => ({ role: r.role, open: r.count, level: r.level })),
    womenOnly: false,
  });
}
