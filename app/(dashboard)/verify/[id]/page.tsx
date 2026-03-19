import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { getUserByAuthId, getVerificationWithDetails } from "@/lib/db";
import { ScoreBadge } from "@/components/verification/score-badge";
import { ShareSnippet } from "@/components/verification/share-snippet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, ArrowLeft } from "lucide-react";

const USE_CASE_LABEL: Record<string, string> = {
  room: "Room",
  property: "Property",
  car: "Vehicle",
  item: "Item",
  generic: "General",
};

export default async function VerificationResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return notFound();

  const appUser = await getUserByAuthId(user.id);
  if (!appUser) return notFound();

  const verification = await getVerificationWithDetails(id);
  if (!verification || verification.owner_user_id !== appUser.id) return notFound();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  function getPublicUrl(path: string) {
    return `${supabaseUrl}/storage/v1/object/public/verification-media/${path}`;
  }

  const referenceImages = verification.media.filter(
    (m) => m.media_type === "reference_image"
  );
  const capturedVideo = verification.media.find(
    (m) => m.media_type === "captured_video"
  );

  const isComplete = verification.status === "complete";
  const isProcessing = verification.status === "processing" || verification.status === "pending";
  const isFailed = verification.status === "failed";

  const formattedDate = new Date(verification.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900">
        <ArrowLeft size={14} />
        Dashboard
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-neutral-900">
              {verification.title ?? `${USE_CASE_LABEL[verification.use_case]} verification`}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{USE_CASE_LABEL[verification.use_case]}</Badge>
              <span className="text-sm text-neutral-500">{formattedDate}</span>
              <span className="text-xs font-mono text-neutral-400">{verification.id.slice(0, 8)}</span>
            </div>
          </div>

          <div>
            {isComplete && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                Complete
              </span>
            )}
            {isProcessing && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 animate-pulse">
                Processing…
              </span>
            )}
            {isFailed && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                Failed
              </span>
            )}
          </div>
        </div>

        {/* Result */}
        {isComplete && verification.result && (
          <div className="pt-2 space-y-3 border-t border-neutral-100">
            <ScoreBadge score={verification.result.similarity_score ?? 0} />
            <p className="text-sm text-neutral-700">{verification.result.summary}</p>
          </div>
        )}

        {isProcessing && (
          <div className="pt-2 border-t border-neutral-100">
            <p className="text-sm text-neutral-500">
              Analysis is in progress. Refresh this page in a moment.
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => {}}>
              Refresh
            </Button>
          </div>
        )}

        {isFailed && (
          <div className="pt-2 border-t border-neutral-100">
            <p className="text-sm text-red-600">
              Analysis failed. Please check that you uploaded reference images and recorded
              a video, then try again.
            </p>
          </div>
        )}
      </div>

      {/* Reference images */}
      {referenceImages.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
          <h2 className="font-semibold text-neutral-900">Reference images</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {referenceImages.map((m) => (
              <div key={m.id} className="relative aspect-square rounded-md overflow-hidden bg-neutral-100">
                <Image
                  src={getPublicUrl(m.storage_path)}
                  alt="Reference image"
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Captured video */}
      {capturedVideo && (
        <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
          <h2 className="font-semibold text-neutral-900">Recorded in-app video</h2>
          <video
            src={getPublicUrl(capturedVideo.storage_path)}
            controls
            className="w-full rounded-lg bg-neutral-900"
          />
          <p className="text-xs text-neutral-400">
            Recorded inside Subbo · not an uploaded file
          </p>
        </div>
      )}

      {/* Share */}
      {isComplete && verification.share?.public_slug && (
        <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-neutral-900">Share this verification</h2>
            <Link
              href={`/v/${verification.share.public_slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900"
            >
              <ExternalLink size={13} />
              View public page
            </Link>
          </div>
          <ShareSnippet slug={verification.share.public_slug} />
        </div>
      )}
    </div>
  );
}
