// The app's single entry point to the backend. Screens import from '@/lib/api' only.
// With EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env, every call goes to the
// real Supabase project (lib/api.real.ts). Without them the app runs on the in-memory mock
// (lib/api.mock.ts), so a checkout with no .env still opens. Same names and shapes either way.

import * as mock from './api.mock';
import * as real from './api.real';
import { isSupabaseConfigured } from './supabase';

const impl = isSupabaseConfigured ? real : mock;

/** True while the mock backs this file. Chat bots and the sign-in gate read it. */
export const API_IS_MOCK = !isSupabaseConfigured;

// auth
export const sendEmailCode: typeof real.sendEmailCode = (...a) => impl.sendEmailCode(...a);
export const verifyEmailCode: typeof real.verifyEmailCode = (...a) => impl.verifyEmailCode(...a);
export const signInWithPassword: typeof real.signInWithPassword = (...a) => impl.signInWithPassword(...a);
export const signInWithProvider: typeof real.signInWithProvider = (...a) => impl.signInWithProvider(...a);
export const signOut: typeof real.signOut = (...a) => impl.signOut(...a);

// profile
export const getMyProfile: typeof real.getMyProfile = (...a) => impl.getMyProfile(...a);
export const saveProfile: typeof real.saveProfile = (...a) => impl.saveProfile(...a);

// deck and swiping
export const getDeck: typeof real.getDeck = (...a) => impl.getDeck(...a);
export const swipe: typeof real.swipe = (...a) => impl.swipe(...a);
export const undoLastSwipe: typeof real.undoLastSwipe = (...a) => impl.undoLastSwipe(...a);
export const superCommitsLeft: typeof real.superCommitsLeft = (...a) => impl.superCommitsLeft(...a);
export const getInterested: typeof real.getInterested = (...a) => impl.getInterested(...a);

// matches and teams
export const getMatches: typeof real.getMatches = (...a) => impl.getMatches(...a);
export const commitToMatch: typeof real.commitToMatch = (...a) => impl.commitToMatch(...a);
export const getTeam: typeof real.getTeam = (...a) => impl.getTeam(...a);

// chat at match (plain text)
export const getMessages: typeof real.getMessages = (...a) => impl.getMessages(...a);
export const sendMessage: typeof real.sendMessage = (...a) => impl.sendMessage(...a);
export const subscribeMessages: typeof real.subscribeMessages = (...a) => impl.subscribeMessages(...a);

// projects
export const postIdea: typeof real.postIdea = (...a) => impl.postIdea(...a);
export const getCopyAlerts: typeof real.getCopyAlerts = (...a) => impl.getCopyAlerts(...a);
export const subscribeCopyAlerts: typeof real.subscribeCopyAlerts = (...a) => impl.subscribeCopyAlerts(...a);

// proof screens
export const getEvalResults: typeof real.getEvalResults = (...a) => impl.getEvalResults(...a);
export const subscribeRedteamRuns: typeof real.subscribeRedteamRuns = (...a) => impl.subscribeRedteamRuns(...a);
