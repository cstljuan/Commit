// eval_embed: embeds eval items with the same gte-small model as post_idea, for scripts/eval/run.mts.
// Not for the app. Guarded by the EVAL_TOKEN server secret (set with supabase secrets set). Stores nothing.
// @ts-ignore Deno requires the .ts extension
import { embed } from '../post_idea/core.ts';

declare const Deno: { env: { get(name: string): string | undefined }; serve(h: (req: Request) => Response | Promise<Response>): void };

Deno.serve(async (req) => {
  const token = Deno.env.get('EVAL_TOKEN');
  if (!token || req.headers.get('x-eval-token') !== token) return new Response('forbidden', { status: 403 });
  const { texts } = (await req.json()) as { texts: string[] };
  if (!Array.isArray(texts) || texts.length > 100) return new Response('bad request', { status: 400 });
  const vectors: number[][] = [];
  for (const t of texts) vectors.push(await embed(String(t)));
  return new Response(JSON.stringify({ vectors }), { headers: { 'Content-Type': 'application/json' } });
});
