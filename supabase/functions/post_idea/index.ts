// post_idea (v2, the fixed version): rate limited, reveals nothing about other ideas.
// @ts-ignore Deno requires the .ts extension
import { handle } from './core.ts';

declare const Deno: { serve(h: (req: Request) => Response | Promise<Response>): void };

Deno.serve((req) => handle(req, 'v2'));
