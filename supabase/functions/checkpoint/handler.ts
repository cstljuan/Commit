export type Head = { seq: number; entry_hash: string };
export type Checkpoint = { last_seq: number; last_entry_hash: string; server_sig: string };
export type CheckpointDependencies = {
  authenticate(token: string): Promise<boolean>;
  readHead(): Promise<Head | null>;
  sign(content: string): string;
  insert(value: Checkpoint): Promise<void>;
};
/** The caller can trigger a checkpoint but cannot supply the row, sequence or hash being signed. */
export function createCheckpointHandler(deps: CheckpointDependencies) {
  return async (request: Request): Promise<Response> => {
    const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
    if (request.method !== 'POST') return json({ error: 'Use POST' }, 405);
    const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
    if (!token) return json({ error: 'Sign in first' }, 401);
    try {
      if (!await deps.authenticate(token)) return json({ error: 'Sign in first' }, 401);
      const head = await deps.readHead();
      if (!head) return json({ error: 'No vault entries yet' }, 409);
      if (!Number.isSafeInteger(head.seq) || head.seq < 1 || !/^[0-9a-f]{64}$/.test(head.entry_hash)) {
        return json({ error: 'Vault head is invalid' }, 409);
      }
      const checkpoint: Checkpoint = {
        last_seq: head.seq, last_entry_hash: head.entry_hash,
        server_sig: deps.sign(`${head.seq}|${head.entry_hash}`),
      };
      await deps.insert(checkpoint);
      return json(checkpoint);
    } catch {
      // Never leak JWTs, signing material, database errors or stack traces to callers.
      return json({ error: 'Checkpoint unavailable' }, 503);
    }
  };
}
