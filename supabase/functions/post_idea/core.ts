// Shared logic for post_idea (v2, fixed) and post_idea_v1 (vulnerable on purpose, for the oracle demo).
// The full idea arrives only so the embedding can be computed in memory. It is never stored when private.
// Deno resolves pinned npm imports; the Expo TypeScript resolver does not.
// @ts-ignore Deno npm specifier
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

// Deno runtime global, declared so the app's tsc pass accepts this file.
declare const Deno: { env: { get(name: string): string | undefined }; serve(h: (req: Request) => Response | Promise<Response>): void };

const THRESHOLD = Number(Deno.env.get('COPY_THRESHOLD') ?? '0.88'); // replace with the eval-chosen value
const EXEMPT = new Set((Deno.env.get('RATE_LIMIT_EXEMPT') ?? '').split(',').map((s: string) => s.trim()).filter(Boolean));
const ROLES = new Set(['Frontend', 'Backend', 'AI/ML', 'Security', 'Mobile', 'Design', 'PM', 'Hardware']);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Body = {
  title?: string; shortPitch?: string; type?: string; theme?: string; timeframe?: string; githubUrl?: string | null;
  visibility?: 'private' | 'public'; womenOnly?: boolean; hidden?: boolean;
  roles?: { role: string; open?: number; level?: string }[];
  ideaCipher?: string | null; ideaNonce?: string | null; fullIdea?: string;
};

// @ts-ignore Supabase global in the Edge runtime
const session = new Supabase.ai.Session('gte-small');

export async function embed(text: string): Promise<number[]> {
  const out = await session.run(text, { mean_pool: true, normalize: true });
  return Array.from(out as ArrayLike<number>);
}

export async function handle(req: Request, version: 'v1' | 'v2'): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ status: 'method_not_allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ status: 'unauthorized' }, 401);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ status: 'bad_request', message: 'Body must be JSON' }, 400);
  }
  const title = body.title?.trim();
  const pitch = body.shortPitch?.trim();
  const idea = body.fullIdea?.trim();
  const visibility = body.visibility === 'public' ? 'public' : 'private';
  if (!title || !pitch || !idea) return json({ status: 'bad_request', message: 'title, shortPitch and fullIdea are required' }, 400);
  if (title.length > 120 || pitch.length > 400 || idea.length > 5000) return json({ status: 'bad_request', message: 'Too long' }, 400);
  if (visibility === 'private' && (!body.ideaCipher || !body.ideaNonce)) {
    return json({ status: 'bad_request', message: 'Private ideas must be encrypted on the phone' }, 400);
  }

  // v2: 3 posts per hour per account. v1 has no limit, which is part of the demo.
  if (version === 'v2' && !EXEMPT.has(user.id)) {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from('post_attempts').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).gte('created_at', since);
    if ((count ?? 0) >= 3) return json({ status: 'rate_limited' }, 429);
  }

  const embedding = await embed(idea);

  // F12: never match the poster's own projects, or an attacker's earlier guesses inflate the count.
  const { data: similar, error: simError } = await admin.rpc('match_projects', {
    query_embedding: JSON.stringify(embedding), match_threshold: THRESHOLD, match_count: 10,
  });
  if (simError) return json({ status: 'error', message: 'similarity check failed' }, 500);
  const top = (similar as { project_id: string; owner_id: string; similarity: number }[] | null)
    ?.find((s) => s.owner_id !== user.id);

  const { data: project, error } = await userClient.from('projects').insert({
    owner_id: user.id, title, short_pitch: pitch,
    type: ['original', 'practice', 'hackathon'].includes(body.type ?? '') ? body.type : 'original',
    field: body.theme ?? null, theme: body.theme ?? null, timeframe: body.timeframe ?? null,
    github_url: body.githubUrl ?? null, visibility, women_only: !!body.womenOnly, hidden: !!body.hidden,
    idea_public: visibility === 'public' ? idea : null,
    idea_cipher: visibility === 'private' ? body.ideaCipher : null,
    idea_nonce: visibility === 'private' ? body.ideaNonce : null,
  }).select('id').single();
  if (error) return json({ status: 'error', message: error.message }, 400);

  const roles = (body.roles ?? []).filter((r) => ROLES.has(r.role)).slice(0, 8)
    .map((r) => ({ project_id: project.id, role: r.role, level: r.level ?? null, slots_open: Math.max(0, Math.min(10, r.open ?? 1)) }));
  if (roles.length) await userClient.from('project_roles').insert(roles);
  const { data: me } = await admin.from('profiles').select('primary_role').eq('id', user.id).maybeSingle();
  await admin.from('team_members').insert({ project_id: project.id, user_id: user.id, role: me?.primary_role ?? 'PM', ownership: 'owner' });
  await admin.from('idea_embeddings').insert({ project_id: project.id, embedding: JSON.stringify(embedding) });
  // Only v2 posts count toward v2's rate limit, so the oracle demo's v1 run does not use up v2's budget.
  if (version === 'v2') await admin.from('post_attempts').insert({ user_id: user.id, max_similarity: top?.similarity ?? 0 });

  if (top) {
    // One alert per copier per original (unique index in 0007). A repeat is ignored.
    await admin.from('copy_alerts').upsert(
      { owner_id: top.owner_id, original_project_id: top.project_id, similarity: top.similarity, copier_id: user.id },
      { onConflict: 'original_project_id,copier_id', ignoreDuplicates: true },
    );
  }

  if (version === 'v2') {
    // The poster learns nothing about other ideas.
    return json({ projectId: project.id, status: 'submitted' });
  }
  // v1, vulnerable on purpose: tells the poster which private idea theirs resembles.
  let similarTitle: string | null = null;
  if (top) {
    const { data: p } = await admin.from('projects').select('title').eq('id', top.project_id).maybeSingle();
    similarTitle = p?.title ?? null;
  }
  return json({ projectId: project.id, similarTo: top?.project_id ?? null, similarTitle, similarity: top?.similarity ?? null });
}
