import { createClient } from "@/lib/supabase/client";

const BUCKET = "verification-media";

export function getPublicUrl(storagePath: string): string {
  const supabase = createClient();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function uploadFile(
  file: File | Blob,
  path: string,
  contentType?: string
): Promise<string> {
  const supabase = createClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

export async function deleteFile(storagePath: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

export function buildStoragePath(
  userId: string,
  verificationId: string,
  filename: string
): string {
  return `${userId}/${verificationId}/${filename}`;
}
