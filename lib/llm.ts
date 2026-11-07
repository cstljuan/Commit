/**
 * An optional local model, the same pattern as Amulith at Knight Hacks: llama.cpp (or anything
 * that speaks the same chat API, such as Ollama) running on our own laptop on the same Wi-Fi.
 *
 * Set EXPO_PUBLIC_LLM_URL=http://<laptop-ip>:8080 in .env. With no URL, or if the laptop stops
 * answering, chat falls back to the replies built into lib/chatbot.ts, so a demo never hangs.
 */
const URL_BASE = process.env.EXPO_PUBLIC_LLM_URL?.replace(/\/$/, '');
const MODEL = process.env.EXPO_PUBLIC_LLM_MODEL ?? 'local';
const TIMEOUT_MS = 12000;
const RETRY_AFTER_MS = 60000;

export type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string };

let downUntil = 0;

export const llmConfigured = () => !!URL_BASE;

/** True when the next reply will try the local model. */
export const llmAvailable = () => !!URL_BASE && Date.now() >= downUntil;

const clean = (text: string) =>
  text
    .trim()
    .replace(/^["']|["']$/g, '')
    // House style: no em dashes, even from the model.
    .replace(/\s*—\s*/g, ', ')
    .slice(0, 400);

/** Returns the model's reply, or null so the caller uses a built-in reply instead. */
export async function askLocalModel(messages: LlmMessage[]): Promise<string | null> {
  if (!llmAvailable()) return null;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${URL_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, max_tokens: 120, temperature: 0.7, stream: false }),
      signal: abort.signal,
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const json = await res.json();
    const text = clean(json?.choices?.[0]?.message?.content ?? '');
    if (!text) throw new Error('empty reply');
    return text;
  } catch {
    // Wi-Fi moved or the laptop slept. Stop waiting on it for a while.
    downUntil = Date.now() + RETRY_AFTER_MS;
    return null;
  } finally {
    clearTimeout(timer);
  }
}
