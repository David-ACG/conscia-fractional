-- Create storage bucket for meeting recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meeting-recordings',
  'meeting-recordings',
  false,
  524288000,  -- 500MB
  ARRAY['audio/webm', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/x-m4a', 'video/mp4', 'video/webm', 'video/quicktime']
);

-- RLS: authenticated users can upload to their own folder
CREATE POLICY "Users can upload own recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'meeting-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS: users can read own recordings
CREATE POLICY "Users can read own recordings"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'meeting-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS: users can delete own recordings
CREATE POLICY "Users can delete own recordings"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'meeting-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
