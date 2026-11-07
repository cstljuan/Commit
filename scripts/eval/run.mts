// Report card (handoff 9.3): how well copy detection separates rewrites from unrelated ideas.
//   npx tsx scripts/eval/run.mts
// Embeds every item with the deployed gte-small model (eval_embed), then for each rewrite and unrelated
// item finds its most similar seed. At each threshold 0.75 to 0.95 (0.01 steps):
//   true positive  = a rewrite whose top seed is its own original and scores above the threshold
//   false positive = an unrelated item above the threshold, or a rewrite flagged against the wrong seed
//   recall = TP / rewrites, precision = TP / (TP + FP)
// The best F1 is marked chosen. Results replace the eval_results table. Spanish is reported separately.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const env: Record<string, string> = {};
for (const line of readFileSync(join(here, '..', '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const URL = env.SUPABASE_URL;
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' };
if (!URL || !env.EVAL_TOKEN) throw new Error('scripts/.env needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and EVAL_TOKEN');

type Item = { id: string; text: string; rewriteOf?: string };
const data = JSON.parse(readFileSync(join(here, 'ideas.json'), 'utf8')) as { seeds: Item[]; rewrites: Item[]; unrelated: Item[] };
const SPANISH = new Set(['r16', 'r17', 'r18', 'r19', 'r20']);

// Small batches: the free plan's Edge worker runs out of compute on one 60-item call.
async function embedAll(items: Item[]): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  for (let i = 0; i < items.length; i += 10) {
    const batch = items.slice(i, i + 10);
    let res: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(URL + '/functions/v1/eval_embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eval-token': env.EVAL_TOKEN },
        body: JSON.stringify({ texts: batch.map((b) => b.text) }),
      });
      if (res.ok) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!res?.ok) throw new Error(`eval_embed ${res?.status}: ${await res?.text()}`);
    const { vectors } = (await res.json()) as { vectors: number[][] };
    batch.forEach((b, k) => out.set(b.id, vectors[k]));
  }
  return out;
}

// Vectors are normalized, so cosine similarity is the dot product.
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

const all = [...data.seeds, ...data.rewrites, ...data.unrelated];
const vec = await embedAll(all);

const best = (q: Item) => {
  let top = { seed: '', sim: -1 };
  for (const s of data.seeds) {
    const sim = dot(vec.get(q.id)!, vec.get(s.id)!);
    if (sim > top.sim) top = { seed: s.id, sim };
  }
  return top;
};
const rewrites = data.rewrites.map((r) => ({ ...r, ...best(r) }));
const unrelated = data.unrelated.map((u) => ({ ...u, ...best(u) }));

const rows: { threshold: number; precision: number; recall: number; f1: number; chosen: boolean }[] = [];
for (let k = 0; k <= 20; k++) {
  const t = Math.round((0.75 + k * 0.01) * 100) / 100;
  const tp = rewrites.filter((r) => r.sim > t && r.seed === r.rewriteOf).length;
  const fp = rewrites.filter((r) => r.sim > t && r.seed !== r.rewriteOf).length + unrelated.filter((u) => u.sim > t).length;
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp / rewrites.length;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  rows.push({ threshold: t, precision, recall, f1, chosen: false });
}
// Best F1; on a tie, the higher threshold (fewer false alarms).
const chosen = rows.reduce((a, b) => (b.f1 >= a.f1 ? b : a));
chosen.chosen = true;

console.log('threshold  precision  recall  f1');
for (const r of rows) console.log(`${r.threshold.toFixed(2)}       ${r.precision.toFixed(2)}       ${r.recall.toFixed(2)}    ${r.f1.toFixed(2)}${r.chosen ? '  <- chosen' : ''}`);
const es = rewrites.filter((r) => SPANISH.has(r.id));
const en = rewrites.filter((r) => !SPANISH.has(r.id));
const caught = (list: typeof rewrites) => list.filter((r) => r.sim > chosen.threshold && r.seed === r.rewriteOf).length;
console.log(`\nchosen threshold ${chosen.threshold}: English rewrites caught ${caught(en)}/${en.length}, Spanish ${caught(es)}/${es.length}, unrelated flagged ${unrelated.filter((u) => u.sim > chosen.threshold).length}/${unrelated.length}`);
console.log(`highest unrelated similarity ${Math.max(...unrelated.map((u) => u.sim)).toFixed(3)}, lowest English rewrite ${Math.min(...en.map((r) => r.sim)).toFixed(3)}`);

// Replace the stored results. eval_results only ever holds the latest run.
const del = await fetch(URL + '/rest/v1/eval_results?threshold=gte.0', { method: 'DELETE', headers: H });
if (!del.ok) throw new Error(`clear eval_results ${del.status}: ${await del.text()}`);
const ins = await fetch(URL + '/rest/v1/eval_results', {
  method: 'POST', headers: { ...H, Prefer: 'return=minimal' },
  body: JSON.stringify(rows.map(({ threshold, precision, recall, chosen }) => ({ threshold, precision, recall, chosen }))),
});
if (!ins.ok) throw new Error(`write eval_results ${ins.status}: ${await ins.text()}`);
console.log(`\nwrote ${rows.length} rows to eval_results. Set COPY_THRESHOLD=${chosen.threshold}`);
