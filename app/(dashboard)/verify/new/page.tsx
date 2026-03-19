"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImageUploader } from "@/components/verification/image-uploader";
import { VideoRecorder } from "@/components/verification/video-recorder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Loader2 } from "lucide-react";

const USE_CASES = [
  { value: "room", label: "Room", emoji: "🛋️", description: "Bedroom, living space, studio" },
  { value: "property", label: "Property", emoji: "🏠", description: "House, apartment, unit" },
  { value: "car", label: "Vehicle", emoji: "🚗", description: "Car, truck, motorcycle" },
  { value: "item", label: "Item", emoji: "📦", description: "Electronics, furniture, goods" },
  { value: "generic", label: "General", emoji: "🔍", description: "Anything else" },
] as const;

const step1Schema = z.object({
  use_case: z.enum(["room", "property", "car", "item", "generic"]),
  title: z.string().min(1, "Title is required").max(120),
});

type Step1Values = z.infer<typeof step1Schema>;

type Step = 1 | 2 | 3 | 4;

export default function NewVerificationPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [capturedVideo, setCapturedVideo] = useState<Blob | null>(null);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: { use_case: "room" },
  });

  const selectedUseCase = watch("use_case");

  // Step 1: create the verification record
  async function onStep1Submit(values: Step1Values) {
    setSubmitting(true);
    const res = await fetch("/api/verifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ use_case: values.use_case, title: values.title }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Failed to create verification");
      return;
    }

    const data = await res.json();
    setVerificationId(data.id);
    setStep(2);
  }

  // Step 2 → 3: upload reference images
  async function uploadImages() {
    if (referenceImages.length < 3) {
      toast.error("Please upload at least 3 reference images");
      return;
    }
    if (!verificationId) return;

    setSubmitting(true);
    try {
      // iOS Safari is less reliable with many concurrent multipart uploads.
      // Upload sequentially to avoid intermittent "expected pattern" failures.
      for (const file of referenceImages) {
        await uploadMedia(file, "reference_image", verificationId);
      }
      setStep(3);
    } catch (e) {
      console.error("Reference upload failed:", e);
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  // Called by VideoRecorder when recording stops.
  function handleVideoCapture(blob: Blob, frames: string[]) {
    setCapturedVideo(blob);
    setCapturedFrames(frames);
  }

  // Step 3 → 4: upload frames + video, then trigger analysis
  async function uploadVideoAndAnalyze() {
    if (!capturedVideo || !verificationId) {
      toast.error("Please record a video first");
      return;
    }
    if (capturedFrames.length === 0) {
      toast.error("No frames were captured. Please re-record (hold for at least 1 second).");
      return;
    }

    setSubmitting(true);
    try {
      // Upload the video blob for in-app playback (best-effort — large files may exceed 4 MB limit).
      try {
        await uploadMedia(
          new File([capturedVideo], "capture.webm", { type: capturedVideo.type }),
          "captured_video",
          verificationId
        );
      } catch (e) {
        console.warn("Video upload skipped (file too large for playback):", e);
      }

      // Upload extracted frames sequentially — more reliable on iOS Safari.
      for (let i = 0; i < capturedFrames.length; i++) {
        const blob = dataURLtoBlob(capturedFrames[i]);
        await uploadMedia(
          new File([blob], `frame-${i}.jpg`, { type: "image/jpeg" }),
          "captured_frame",
          verificationId
        );
      }

      const res = await fetch(`/api/verifications/${verificationId}/analyze`, {
        method: "POST",
      });

      if (!res.ok) {
        let message = `Analysis failed (HTTP ${res.status})`;
        try {
          const contentType = res.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            const err = await res.json();
            message = err.detail ?? err.error ?? message;
          }
        } catch { /* ignore */ }
        throw new Error(message);
      }

      router.push(`/verify/${verificationId}`);
    } catch (e) {
      toast.error(String(e));
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {([1, 2, 3] as const).map((n) => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                step > n
                  ? "bg-neutral-900 text-white"
                  : step === n
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-200 text-neutral-500"
              }`}
            >
              {n}
            </div>
            {n < 3 && (
              <div className={`h-px w-8 ${step > n ? "bg-neutral-900" : "bg-neutral-200"}`} />
            )}
          </div>
        ))}
        <span className="ml-2 text-sm text-neutral-500">
          {step === 1 && "Choose type"}
          {step === 2 && "Reference images"}
          {step === 3 && "Record video"}
        </span>
      </div>

      {/* Step 1: type + title */}
      {step === 1 && (
        <form onSubmit={handleSubmit(onStep1Submit)} className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">New verification</h1>
            <p className="text-sm text-neutral-500 mt-1">
              What are you verifying?
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {USE_CASES.map((uc) => (
              <button
                key={uc.value}
                type="button"
                onClick={() => setValue("use_case", uc.value)}
                className={`rounded-lg border p-4 text-left transition-all ${
                  selectedUseCase === uc.value
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white hover:border-neutral-400"
                }`}
              >
                <div className="text-2xl mb-1">{uc.emoji}</div>
                <p className={`text-sm font-medium ${selectedUseCase === uc.value ? "text-white" : "text-neutral-900"}`}>
                  {uc.label}
                </p>
                <p className={`text-xs mt-0.5 ${selectedUseCase === uc.value ? "text-neutral-300" : "text-neutral-500"}`}>
                  {uc.description}
                </p>
              </button>
            ))}
          </div>
          {errors.use_case && (
            <p className="text-xs text-red-600">{errors.use_case.message}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. Studio apartment on Oak St"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-red-600">{errors.title.message}</p>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              Continue
              <ChevronRight size={16} />
            </Button>
          </div>
        </form>
      )}

      {/* Step 2: Reference images */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Reference images</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Upload 3–10 clear photos of the space or item. These are used for the
              similarity check.
            </p>
          </div>

          <ImageUploader onChange={setReferenceImages} maxImages={10} />

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
              <ChevronLeft size={16} />
              Back
            </Button>
            <Button onClick={uploadImages} disabled={submitting || referenceImages.length < 3} className="gap-2">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              Continue
              <ChevronRight size={16} />
            </Button>
          </div>

          {referenceImages.length > 0 && referenceImages.length < 3 && (
            <p className="text-xs text-neutral-500">
              Add at least {3 - referenceImages.length} more image{3 - referenceImages.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {/* Step 3: Record video */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Record verification video</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Record a real-time walkthrough of the space or item inside the app. Pre-recorded
              video uploads are not accepted.
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This video must be recorded right now, inside this app. It will be compared
            against your reference images.
          </div>

          <VideoRecorder onCapture={handleVideoCapture} maxSeconds={120} />

          {capturedFrames.length > 0 && (
            <p className="text-xs text-neutral-500">
              {capturedFrames.length} frame{capturedFrames.length !== 1 ? "s" : ""} captured for analysis
            </p>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)} className="gap-2" disabled={submitting}>
              <ChevronLeft size={16} />
              Back
            </Button>
            <Button
              onClick={uploadVideoAndAnalyze}
              disabled={submitting || !capturedVideo}
              className="gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  Submit &amp; analyze
                  <ChevronRight size={16} />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

async function uploadMedia(
  file: File,
  mediaType: string,
  verificationId: string
): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  form.append("media_type", mediaType);

  // Use absolute URL for Safari compatibility in some contexts.
  const base =
    typeof window !== "undefined" ? window.location.origin : "";
  const endpoint = base
    ? `${base}/api/verifications/${verificationId}/media`
    : `/api/verifications/${verificationId}/media`;

  const res = await fetch(endpoint, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    // Safely parse — server may return HTML (e.g. Next.js 500 page) not JSON.
    // WebKit throws SyntaxError from res.json() when body isn't valid JSON.
    let message = `Upload failed (HTTP ${res.status})`;
    try {
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const err = await res.json();
        message = err.error ?? message;
      } else {
        const text = await res.text();
        console.error("Upload error response (non-JSON):", res.status, text.slice(0, 500));
      }
    } catch {
      // ignore parse error — status code message is enough
    }
    throw new Error(message);
  }
}

/** Convert a data-URL (e.g. from canvas.toDataURL) to a Blob. */
function dataURLtoBlob(dataURL: string): Blob {
  const [header, data] = dataURL.split(",");
  const mimeType = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
}
