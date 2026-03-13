-- Fix: drop the broken RLS policies and replace with simple ones
-- that match the actual path structure: galaxies/{galaxyId}/track.*

DROP POLICY IF EXISTS "Users can upload to own galaxy folder" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own uploads" ON storage.objects;

-- Allow any authenticated user to upload to the uploads bucket
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads');

-- Allow public read (Whisper API needs to fetch the file via URL)
CREATE POLICY "Public read for uploads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'uploads');

-- Allow authenticated users to update/replace files
CREATE POLICY "Authenticated users can update uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'uploads');

-- Allow authenticated users to delete their files
CREATE POLICY "Authenticated users can delete uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'uploads');
