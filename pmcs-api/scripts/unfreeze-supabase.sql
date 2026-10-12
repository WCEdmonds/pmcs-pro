-- Undo freeze-supabase.sql (Supabase's default grants). Only needed if the
-- cutover is abandoned and the apps go back to Supabase.
-- Run with:  node scripts/export-from-supabase.mjs --unfreeze
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'GRANT INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated';
  END IF;
END $$;
