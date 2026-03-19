-- Migration: add captured_frame to verification_media.media_type check constraint
-- Run this in the Supabase SQL editor.

-- 1. Drop the existing check constraint (name may vary; find it first if needed).
--    In most Supabase projects the constraint is named after the table+column.
--    If the constraint has a different name, replace accordingly.
ALTER TABLE public.verification_media
  DROP CONSTRAINT IF EXISTS verification_media_media_type_check;

-- 2. Re-add with the new allowed value.
ALTER TABLE public.verification_media
  ADD CONSTRAINT verification_media_media_type_check
  CHECK (media_type IN ('reference_image', 'captured_video', 'derived_thumbnail', 'captured_frame'));

-- No RLS/policy changes needed: existing policies on verification_media
-- use verification_id ownership, which covers all media_type values.

-- 3. Add missing INSERT policy on verification_results.
--    Without this, the analyze route cannot write results (500 error).
CREATE POLICY "Users can insert results for their own verifications"
ON public.verification_results
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.verifications v
    JOIN public.users u ON u.id = v.owner_user_id
    WHERE v.id = verification_id
      AND u.auth_id = auth.uid()
  )
);
