import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getUserByAuthId } from "@/lib/db";
import { runAnalysis } from "@/services/verification-analysis";
import type { UseCase } from "@/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await createClient();

  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appUser = await getUserByAuthId(user.id);
  if (!appUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Load verification (ownership check via RLS)
  const { data: verification, error: verError } = await db
    .from("verifications")
    .select("*")
    .eq("id", id)
    .eq("owner_user_id", appUser.id)
    .single();

  if (verError || !verification) {
    return NextResponse.json({ error: "Verification not found" }, { status: 404 });
  }

  if (verification.status === "complete") {
    return NextResponse.json({ error: "Already analyzed" }, { status: 409 });
  }

  // Mark as processing
  await db
    .from("verifications")
    .update({ status: "processing" })
    .eq("id", id);

  // Load media
  const { data: media } = await db
    .from("verification_media")
    .select("*")
    .eq("verification_id", id);

  const referenceImagePaths = (media ?? [])
    .filter((m) => m.media_type === "reference_image")
    .map((m) => m.storage_path);

  const capturedFramePaths = (media ?? [])
    .filter((m) => m.media_type === "captured_frame")
    .map((m) => m.storage_path);

  const capturedVideoPaths = (media ?? [])
    .filter((m) => m.media_type === "captured_video")
    .map((m) => m.storage_path);

  if (referenceImagePaths.length === 0 || (capturedFramePaths.length === 0 && capturedVideoPaths.length === 0)) {
    await db
      .from("verifications")
      .update({ status: "failed" })
      .eq("id", id);
    return NextResponse.json(
      { error: "Missing reference images or captured frames" },
      { status: 422 }
    );
  }

  // Diagnostic: confirm service role key is loaded (log length only, not value)
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log("[analyze] SUPABASE_SERVICE_ROLE_KEY defined:", !!svcKey, "length:", svcKey?.length ?? 0);

  try {
    const result = await runAnalysis({
      referenceImagePaths,
      capturedVideoPaths,
      capturedFramePaths,
      useCase: verification.use_case as UseCase,
    });

    // Insert result — try service client first (bypasses RLS), fall back to
    // the authenticated user client if the service key isn't available.
    const svcKeyAvailable = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const insertDb = svcKeyAvailable ? createServiceClient() : db;
    const { error: insertError } = await insertDb
      .from("verification_results")
      .insert({
        verification_id: id,
        similarity_score: result.similarity_score,
        summary: result.summary,
        metadata: result.metadata,
      });

    if (insertError) {
      throw new Error(`Failed to save result: ${insertError.message}`);
    }

    // Create public share if not exists
    let slug: string;
    const { data: existingShare } = await db
      .from("public_verification_shares")
      .select("public_slug")
      .eq("verification_id", id)
      .single();

    if (existingShare) {
      slug = existingShare.public_slug;
    } else {
      // Generate unique slug
      let attempts = 0;
      do {
        slug = generateSlug();
        const { data: conflict } = await db
          .from("public_verification_shares")
          .select("id")
          .eq("public_slug", slug)
          .single();
        if (!conflict) break;
        attempts++;
      } while (attempts < 5);

      await db.from("public_verification_shares").insert({
        verification_id: id,
        public_slug: slug!,
        is_active: true,
      });
    }

    // Mark complete
    await db
      .from("verifications")
      .update({ status: "complete" })
      .eq("id", id);

    return NextResponse.json({ slug }, { status: 200 });
  } catch (err) {
    await db
      .from("verifications")
      .update({ status: "failed" })
      .eq("id", id);
    return NextResponse.json(
      { error: "Analysis failed", detail: String(err) },
      { status: 500 }
    );
  }
}

function generateSlug(): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let slug = "";
  for (let i = 0; i < 8; i++) {
    slug += chars[Math.floor(Math.random() * chars.length)];
  }
  return slug;
}
