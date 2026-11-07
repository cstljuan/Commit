// The app's single entry point to the backend. Screens import from '@/lib/api' only.
// With Supabase values in .env this is the real backend. Without them, or with
// EXPO_PUBLIC_API=mock, it is the in-memory mock, so anyone can still run the app.
import * as mock from './api.mock';
import * as real from './api.real';
import { isSupabaseConfigured } from './supabase';

const useMock = !isSupabaseConfigured || process.env.EXPO_PUBLIC_API === 'mock';
const api = (useMock ? mock : real) as unknown as typeof real;

export const API_IS_MOCK = useMock;
export const {
  sendEmailCode,
  verifyEmailCode,
  signInWithPassword,
  signInWithProvider,
  signOut,
  getMyProfile,
  saveProfile,
  getDeck,
  superCommitsLeft,
  swipe,
  undoLastSwipe,
  getInterested,
  getMatches,
  commitToMatch,
  getTeam,
  getMyProjects,
  getMessages,
  sendMessage,
  subscribeMessages,
  postIdea,
  getCopyAlerts,
  subscribeCopyAlerts,
  getEvalResults,
  subscribeRedteamRuns,
} = api;
