/**
 * Database access helpers — server-side only.
 * All queries go through here to keep SQL out of page/API components.
 */

import { createClient } from "@/lib/supabase/server";
import type {
  Verification,
  VerificationMedia,
  VerificationResult,
  PublicVerificationShare,
  VerificationWithDetails,
  User,
  Profile,
} from "@/types";

// ── Users ──────────────────────────────────────────────────────────────────

export async function getUserByAuthId(authId: string): Promise<User | null> {
  const db = await createClient();
  const { data } = await db
    .from("users")
    .select("*")
    .eq("auth_id", authId)
    .single();
  return data;
}

export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const db = await createClient();
  const { data } = await db
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();
  return data;
}

// ── Verifications ──────────────────────────────────────────────────────────

export async function getVerificationsByOwner(
  ownerUserId: string
): Promise<Verification[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("verifications")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getVerificationById(
  id: string
): Promise<Verification | null> {
  const db = await createClient();
  const { data } = await db
    .from("verifications")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export async function getVerificationWithDetails(
  id: string
): Promise<VerificationWithDetails | null> {
  const db = await createClient();

  const { data: verification } = await db
    .from("verifications")
    .select("*")
    .eq("id", id)
    .single();

  if (!verification) return null;

  const [mediaRes, resultRes, shareRes] = await Promise.all([
    db
      .from("verification_media")
      .select("*")
      .eq("verification_id", id)
      .order("created_at"),
    db
      .from("verification_results")
      .select("*")
      .eq("verification_id", id)
      .single(),
    db
      .from("public_verification_shares")
      .select("*")
      .eq("verification_id", id)
      .single(),
  ]);

  // Get owner profile
  const { data: owner } = await db
    .from("users")
    .select("id")
    .eq("id", verification.owner_user_id)
    .single();

  let profile: Pick<Profile, "full_name" | "avatar_url"> | null = null;
  if (owner) {
    const { data: p } = await db
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("user_id", owner.id)
      .single();
    profile = p;
  }

  return {
    ...verification,
    media: mediaRes.data ?? [],
    result: resultRes.data ?? null,
    share: shareRes.data ?? null,
    profile,
  };
}

// ── Public share lookup (no auth required) ─────────────────────────────────

export async function getVerificationBySlug(
  slug: string
): Promise<VerificationWithDetails | null> {
  const db = await createClient();

  const { data: share } = await db
    .from("public_verification_shares")
    .select("*")
    .eq("public_slug", slug)
    .eq("is_active", true)
    .single();

  if (!share) return null;

  return getVerificationWithDetails(share.verification_id);
}

// ── Slug helpers ───────────────────────────────────────────────────────────

export function generateSlug(): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let slug = "";
  for (let i = 0; i < 8; i++) {
    slug += chars[Math.floor(Math.random() * chars.length)];
  }
  return slug;
}
