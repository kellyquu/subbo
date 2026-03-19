/**
 * Verification Analysis Service
 *
 * This module is the isolated boundary for CV/similarity analysis.
 * The current implementation uses lightweight mock scoring.
 *
 * TO PLUG IN A REAL MODEL:
 * Replace the `runAnalysis` function body with a call to:
 *   - A Python microservice (e.g. FastAPI + CLIP/ORB/SSIM)
 *   - A cloud Vision API (Google Vision, AWS Rekognition)
 *   - A serverless inference endpoint (Replicate, Modal, Hugging Face)
 *
 * The interface (AnalysisInput → AnalysisOutput) stays the same.
 */

import type { AnalysisInput, AnalysisOutput } from "@/types";

/**
 * Primary entry point. Call this after media is uploaded.
 * Returns a similarity score (0–100) and a human-readable summary.
 */
export async function runAnalysis(input: AnalysisInput): Promise<AnalysisOutput> {
  // ── MOCK IMPLEMENTATION ────────────────────────────────────────────────────
  // Simulates lightweight analysis with realistic-looking randomness.
  // Replace this entire block with a real model call.

  await simulateLatency();

  const score = mockSimilarityScore(input);
  const summary = buildSummary(score, input.useCase);

  return {
    similarity_score: score,
    summary,
    metadata: {
      engine: "mock-v1",
      reference_count: input.referenceImagePaths.length,
      video_count: input.capturedVideoPaths.length,
      use_case: input.useCase,
      analyzed_at: new Date().toISOString(),
    },
  };
  // ── END MOCK ───────────────────────────────────────────────────────────────
}

// ---------------------------------------------------------------------------
// Mock helpers — not intended for production use
// ---------------------------------------------------------------------------

function simulateLatency(): Promise<void> {
  const ms = 1500 + Math.random() * 1000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mockSimilarityScore(input: AnalysisInput): number {
  // Deterministic-ish score based on reference count so repeated
  // submissions with same inputs feel consistent.
  const base = 62 + input.referenceImagePaths.length * 3;
  const jitter = (Math.random() - 0.5) * 10;
  return Math.min(99, Math.max(40, Math.round(base + jitter)));
}

function buildSummary(score: number, useCase: string): string {
  const subjectMap: Record<string, string> = {
    room: "the recorded space",
    property: "the recorded property",
    car: "the recorded vehicle",
    item: "the recorded item",
    generic: "the recorded subject",
  };
  const subject = subjectMap[useCase] ?? "the recorded subject";

  if (score >= 80) {
    return `High similarity detected between the reference images and ${subject}. Visual features are strongly consistent.`;
  }
  if (score >= 60) {
    return `Moderate similarity detected between the reference images and ${subject}. Key visual features appear consistent.`;
  }
  return `Low similarity detected. The reference images and ${subject} share some visual features but show notable differences.`;
}
