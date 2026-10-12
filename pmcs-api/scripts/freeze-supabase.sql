-- Freeze Supabase before the export: the apps (roles anon and authenticated)
-- can still read but no longer write, so the export is a consistent snapshot.
-- Run with:  node scripts/export-from-supabase.mjs --freeze
-- (or paste into the Supabase SQL editor). Undo with unfreeze-supabase.sql / --unfreeze.
-- Service-role callers (the old `signup` and `generate-da2404` edge functions)
-- bypass these grants; keep the freeze window short.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
-- Storage uploads/deletes go through RLS on storage.objects as the caller's role.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON storage.objects FROM anon, authenticated';
  END IF;
END $$;
