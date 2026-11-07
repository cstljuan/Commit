// post_idea_v1: VULNERABLE ON PURPOSE, for the copy-oracle demo (handoff 9.2).
// No rate limit, and the response names the private idea the post resembles.
// @ts-ignore Deno requires the .ts extension
import { handle } from '../post_idea/core.ts';

declare const Deno: { serve(h: (req: Request) => Response | Promise<Response>): void };

Deno.serve((req) => handle(req, 'v1'));
