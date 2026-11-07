// The app's single entry point to the backend. Screens import from '@/lib/api' only.
// For now this re-exports the mock, so the UI can wire up today. The real Supabase
// functions replace these one by one with the same names and shapes (03-CONTRACTS.md, section 4).
export * from './api.mock';
