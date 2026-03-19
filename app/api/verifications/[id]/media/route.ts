import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserByAuthId } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await createClient();

  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appUser = await getUserByAuthId(user.id);
  if (!appUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Verify ownership
  const { data: verification } = await db
    .from("verifications")
    .select("id")
    .eq("id", id)
    .eq("owner_user_id", appUser.id)
    .single();

  if (!verification) {
    return NextResponse.json({ error: "Verification not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const mediaType = formData.get("media_type") as string | null;

  if (!file || !mediaType) {
    return NextResponse.json({ error: "file and media_type required" }, { status: 400 });
  }

  const allowed = ["reference_image", "captured_video", "captured_frame", "derived_thumbnail"];
  if (!allowed.includes(mediaType)) {
    return NextResponse.json({ error: "Invalid media_type" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const filename = `${mediaType}_${Date.now()}.${ext}`;
  const storagePath = `${appUser.id}/${id}/${filename}`;

  const { error: uploadError } = await db.storage
    .from("verification-media")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: mediaRecord, error: insertError } = await db
    .from("verification_media")
    .insert({
      verification_id: id,
      media_type: mediaType,
      storage_path: storagePath,
      uploaded_by: appUser.id,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(mediaRecord, { status: 201 });
}
