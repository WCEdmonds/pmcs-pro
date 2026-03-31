-- Create storage bucket for TM PDFs and allow public read access

INSERT INTO storage.buckets (id, name, public)
VALUES ('tm-documents', 'tm-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read TM PDFs (public documents, no auth required)
CREATE POLICY "Public read access for TM documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'tm-documents');

-- Allow authenticated users to upload (for admin use)
CREATE POLICY "Authenticated users can upload TM documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tm-documents');
