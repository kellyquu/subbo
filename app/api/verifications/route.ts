import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserByAuthId } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  use_case: z.enum(["room", "property", "car", "item", "generic"]),
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appUser = await getUserByAuthId(user.id);
  if (!appUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await db
    .from("verifications")
    .insert({
      owner_user_id: appUser.id,
      verification_type: "standard",
      use_case: parsed.data.use_case,
      title: parsed.data.title ?? null,
      description: parsed.data.description ?? null,
      status: "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
