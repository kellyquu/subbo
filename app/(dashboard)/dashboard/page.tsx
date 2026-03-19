import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserByAuthId, getVerificationsByOwner } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { VerificationCard } from "@/components/verification/verification-card";
import { Plus } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const appUser = await getUserByAuthId(user.id);
  if (!appUser) return null;

  const verifications = await getVerificationsByOwner(appUser.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Verifications</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {verifications.length === 0
              ? "No verifications yet."
              : `${verifications.length} verification${verifications.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link href="/verify/new">
          <Button className="gap-2">
            <Plus size={16} />
            New verification
          </Button>
        </Link>
      </div>

      {verifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <p className="text-neutral-500 text-sm mb-4">
            You haven&apos;t created any verifications yet.
          </p>
          <Link href="/verify/new">
            <Button variant="outline">Create your first verification</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {verifications.map((v) => (
            <VerificationCard key={v.id} verification={v} />
          ))}
        </div>
      )}
    </div>
  );
}
