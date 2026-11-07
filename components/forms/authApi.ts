/**
 * TEMPORARY local stub of the auth part of lib/api.ts (03-CONTRACTS.md, section 4).
 * Same signatures. Swap the body of this file for a re-export once shahd-agent lands
 * lib/api.mock.ts or lib/api.ts:
 *
 *   export { sendEmailCode, verifyEmailCode, signInWithProvider } from '@/lib/api';
 *
 * Stub behaviour, for testing every state: code 123456 works, 000000 is expired,
 * anything else is wrong. An email containing "fail" makes sending fail.
 */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendEmailCode(email: string): Promise<void> {
  await wait(500);
  if (email.includes('fail')) throw new Error('Could not send the code');
}

export async function verifyEmailCode(_email: string, code: string): Promise<void> {
  await wait(500);
  if (code === '000000') throw Object.assign(new Error('Token has expired'), { code: 'otp_expired' });
  if (code !== '123456') throw Object.assign(new Error('Invalid token'), { code: 'invalid_otp' });
}

export async function signInWithProvider(_provider: 'github' | 'google'): Promise<void> {
  await wait(700);
}
