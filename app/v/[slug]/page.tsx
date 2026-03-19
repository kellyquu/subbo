import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getVerificationBySlug } from "@/lib/db";
import { ShieldCheck, Calendar, Hash } from "lucide-react";

const USE_CASE_LABEL: Record<string, string> = {
  room: "Room",
  property: "Property",
  car: "Vehicle",
  item: "Item",
  generic: "General",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const verification = await getVerificationBySlug(slug);
  if (!verification) return { title: "Verification not found" };

  return {
    title: `Verified by Subbo · ${verification.title ?? USE_CASE_LABEL[verification.use_case]}`,
    description: `Verification record for ${verification.title ?? USE_CASE_LABEL[verification.use_case]}. Verified by Subbo.`,
  };
}

export default async function PublicVerificationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const verification = await getVerificationBySlug(slug);

  if (!verification || verification.status !== "complete") return notFound();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  function getPublicUrl(path: string) {
    return `${supabaseUrl}/storage/v1/object/public/verification-media/${path}`;
  }

  const referenceImages = verification.media.filter(
    (m) => m.media_type === "reference_image"
  );
  const capturedVideo = verification.media.find(
    (m) => m.media_type === "captured_video"
  );

  const score = verification.result?.similarity_score ?? 0;
  const scoreLevel = score >= 80 ? "high" : score >= 60 ? "moderate" : "low";

  const scoreConfig = {
    high: { label: "High similarity", color: "text-green-700 bg-green-50 border-green-200" },
    moderate: { label: "Moderate similarity", color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
    low: { label: "Low similarity", color: "text-red-700 bg-red-50 border-red-200" },
  }[scoreLevel];

  const formattedDate = new Date(verification.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Top bar */}
      <div className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-semibold text-neutral-900">
            Subbo
          </Link>
          <span className="text-xs text-neutral-400">Public verification</span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
        {/* Trust header */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0">
              <ShieldCheck size={22} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                Verified by Subbo
              </p>
              <h1 className="text-xl font-bold text-neutral-900">
                {verification.title ?? `${USE_CASE_LABEL[verification.use_case]} verification`}
              </h1>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-neutral-100">
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <Hash size={14} className="text-neutral-400" />
              <span className="font-mono text-xs">{verification.id.slice(0, 12)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <Calendar size={14} className="text-neutral-400" />
              {formattedDate}
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <span className="text-neutral-400 text-xs">Type</span>
              {USE_CASE_LABEL[verification.use_case]}
            </div>
          </div>
        </div>

        {/* Score */}
        {verification.result && (
          <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-3">
            <h2 className="font-semibold text-neutral-900">Similarity result</h2>
            <div className={`inline-flex items-center gap-3 rounded-lg border px-4 py-2.5 ${scoreConfig.color}`}>
              <span className="text-2xl font-bold">{score}</span>
              <div>
                <p className="font-medium text-sm">{scoreConfig.label}</p>
                <p className="text-xs opacity-70">out of 100</p>
              </div>
            </div>
            {verification.result.summary && (
              <p className="text-sm text-neutral-600">{verification.result.summary}</p>
            )}
          </div>
        )}

        {/* Reference images */}
        {referenceImages.length > 0 && (
          <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
            <h2 className="font-semibold text-neutral-900">Reference images</h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {referenceImages.map((m) => (
                <div
                  key={m.id}
                  className="relative aspect-square rounded-md overflow-hidden bg-neutral-100"
                >
                  <Image
                    src={getPublicUrl(m.storage_path)}
                    alt="Reference"
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
              This video was recorded in real time inside the Subbo app — not uploaded from a file.
            </p>
          </div>
        )}

        {/* What was checked */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-3">
          <h2 className="font-semibold text-neutral-900">What was verified</h2>
          <ul className="space-y-2 text-sm text-neutral-600">
            <li className="flex items-start gap-2">
              <ShieldCheck size={15} className="text-neutral-400 mt-0.5 shrink-0" />
              Reference images were uploaded before the video was recorded
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck size={15} className="text-neutral-400 mt-0.5 shrink-0" />
              Video was captured in real time inside the Subbo app
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck size={15} className="text-neutral-400 mt-0.5 shrink-0" />
              A similarity check was run between the reference images and captured video
            </li>
          </ul>
          <p className="text-xs text-neutral-400 border-t border-neutral-100 pt-3">
            Subbo&apos;s verification is a trust signal, not a guarantee. It indicates that a
            real-time video was recorded and compared against the provided reference images.
          </p>
        </div>

        {/* Subbo CTA */}
        <div className="text-center py-4 space-y-2">
          <p className="text-sm text-neutral-500">Powered by Subbo</p>
          <Link
            href="/signup"
            className="text-sm font-medium text-neutral-900 underline underline-offset-2"
          >
            Create your own verification →
          </Link>
        </div>
      </div>
    </div>
  );
}
