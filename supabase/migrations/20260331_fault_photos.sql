-- Migration: Fault Photos Storage
-- Creates fault-photos bucket and adds photo_urls column to faults table
-- Date: 2026-03-31

BEGIN;

-- 1. Create storage bucket for fault photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('fault-photos', 'fault-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload fault photos
CREATE POLICY "Authenticated users can upload fault photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fault-photos');

-- Allow public read access (dashboard viewers)
CREATE POLICY "Public read access for fault photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'fault-photos');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete fault photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'fault-photos');

-- 2. Add photo_urls column to faults table
ALTER TABLE faults
  ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}';

COMMIT;
