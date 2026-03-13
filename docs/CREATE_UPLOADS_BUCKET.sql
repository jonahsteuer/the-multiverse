-- Create the uploads storage bucket for track files (MP3/WAV/M4A)
-- Run this in Supabase SQL editor

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  true,                           -- public so Whisper API can fetch the URL
  52428800,                       -- 50MB limit
  ARRAY['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/flac', 'audio/ogg', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/flac', 'audio/ogg', 'video/mp4'];

-- Allow authenticated users to upload to their own galaxy folder
CREATE POLICY "Users can upload to own galaxy folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access (needed for Whisper API to fetch the file)
CREATE POLICY "Public read access for uploads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'uploads');

-- Allow users to update/replace their own files
CREATE POLICY "Users can update own uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
