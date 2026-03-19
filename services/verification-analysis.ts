/**
 * Verification Analysis Service — Histogram + dHash hybrid.
 *
 * Primary signal: RGB color histogram intersection (angle-invariant).
 *   Same room from different angles → similar color distribution → high score.
 * Secondary signal: dHash (catches near-duplicates, adds robustness).
 *
 * Combined similarity = 0.65 × histSim + 0.35 × hashSim
 * Score = round(avgCombinedSimilarity × 100)
 *
 * Zero cost — pure JS/TS, no paid APIs, Vercel-safe.
 */

import { decode as decodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";
import type { AnalysisInput, AnalysisOutput } from "@/types";

// ── Constants ────────────────────────────────────────────────────────────────

const HASH_SIZE = 8;          // 64-bit dHash
const HIST_BINS = 16;         // 16 buckets per RGB channel → 48 total
const HIST_WEIGHT = 0.65;     // Histogram is primary — stable across angles
const HASH_WEIGHT = 0.35;     // dHash is secondary — catches near-duplicates
/** Combined similarity threshold (0–1) for a frame to count as "matched". */
const MATCH_THRESHOLD = 0.60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const BUCKET = "verification-media";

// ── Types ────────────────────────────────────────────────────────────────────

interface ImageFeatures {
  /** 8-byte dHash (64 bits). */
  hash: number[];
  /**
   * Normalised RGB histogram — 48 values (16 bins × 3 channels).
   * Each channel's 16 values sum to 1.
   */
  histogram: number[];
}

interface DecodedImage {
  data: Buffer;
  width: number;
  height: number;
}

// ── Public entry point ───────────────────────────────────────────────────────

export async function runAnalysis(input: AnalysisInput): Promise<AnalysisOutput> {
  const framePaths = input.capturedFramePaths ?? [];

  if (framePaths.length === 0) {
    return errorResult("no_frames", "No captured frames were available for analysis. Please re-record the video.");
  }

  // Compute features for all reference images.
  const refFeatures: ImageFeatures[] = [];
  const refErrors: string[] = [];
  for (const path of input.referenceImagePaths) {
    try {
      const buf = await fetchImageBuffer(publicUrl(path));
      refFeatures.push(computeFeatures(buf));
    } catch (e) {
      refErrors.push(String(e));
    }
  }

  if (refFeatures.length === 0) {
    return errorResult("no_ref_features", "Could not process any reference images. Please re-upload them.", { ref_errors: refErrors });
  }

  // For each captured frame, compute max combined similarity to any reference.
  const frameSimilarities: number[] = [];
  const frameErrors: string[] = [];
  for (const path of framePaths) {
    try {
      const buf = await fetchImageBuffer(publicUrl(path));
      const frameFeatures = computeFeatures(buf);
      const maxSim = Math.max(...refFeatures.map((rf) => combinedSimilarity(frameFeatures, rf)));
      frameSimilarities.push(maxSim);
    } catch (e) {
      frameErrors.push(String(e));
    }
  }

  if (frameSimilarities.length === 0) {
    return errorResult("no_frame_features", "Could not process any captured frames.", { frame_errors: frameErrors });
  }

  const avgSim = frameSimilarities.reduce((a, b) => a + b, 0) / frameSimilarities.length;
  const matchedFrames = frameSimilarities.filter((s) => s >= MATCH_THRESHOLD).length;
  const score = Math.round(avgSim * 100);

  return {
    similarity_score: score,
    summary: buildSummary(score, matchedFrames, frameSimilarities.length, input.useCase),
    metadata: {
      engine: "histogram-dhash-v1",
      hist_weight: HIST_WEIGHT,
      hash_weight: HASH_WEIGHT,
      match_threshold: MATCH_THRESHOLD,
      reference_count: refFeatures.length,
      frame_count: frameSimilarities.length,
      matched_frames: matchedFrames,
      avg_similarity: Math.round(avgSim * 1000) / 1000,
      frame_similarities: frameSimilarities.map((s) => Math.round(s * 100) / 100),
      use_case: input.useCase,
      ...(refErrors.length ? { ref_errors: refErrors } : {}),
      ...(frameErrors.length ? { frame_errors: frameErrors } : {}),
      analyzed_at: new Date().toISOString(),
    },
  };
}

// ── Feature computation ──────────────────────────────────────────────────────

function computeFeatures(buf: Buffer): ImageFeatures {
  const { data, width, height } = decodeImage(buf);
  const gray = toGrayscale(data, width, height);
  return {
    hash: computeDHash(gray, width, height),
    histogram: computeColorHistogram(data, width, height),
  };
}

/**
 * Combined similarity score (0–1).
 * Higher = more similar. Angle-tolerant due to histogram weighting.
 */
function combinedSimilarity(a: ImageFeatures, b: ImageFeatures): number {
  const histSim = histogramIntersection(a.histogram, b.histogram);
  const hashSim = 1 - hammingDistance(a.hash, b.hash) / 64;
  return HIST_WEIGHT * histSim + HASH_WEIGHT * hashSim;
}

// ── Histogram ────────────────────────────────────────────────────────────────

/**
 * Compute a normalised RGB histogram with HIST_BINS buckets per channel.
 * Result length: HIST_BINS * 3. Each channel's values sum to 1.
 */
function computeColorHistogram(rgba: Buffer, width: number, height: number): number[] {
  const buckets = new Array(HIST_BINS * 3).fill(0);
  const total = width * height;
  const step = Math.floor(256 / HIST_BINS);

  for (let i = 0; i < total; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    buckets[Math.min(Math.floor(r / step), HIST_BINS - 1)]++;
    buckets[HIST_BINS + Math.min(Math.floor(g / step), HIST_BINS - 1)]++;
    buckets[HIST_BINS * 2 + Math.min(Math.floor(b / step), HIST_BINS - 1)]++;
  }

  // Normalise each channel independently so each sums to 1.
  for (let c = 0; c < 3; c++) {
    for (let b = 0; b < HIST_BINS; b++) {
      buckets[c * HIST_BINS + b] /= total;
    }
  }
  return buckets;
}

/**
 * Histogram intersection similarity (0–1).
 * 1 = identical distributions, 0 = no overlap.
 * Divide by 3 because we have 3 normalised channels each summing to 1.
 */
function histogramIntersection(h1: number[], h2: number[]): number {
  let sum = 0;
  for (let i = 0; i < h1.length; i++) {
    sum += Math.min(h1[i], h2[i]);
  }
  return sum / 3;
}

// ── dHash ────────────────────────────────────────────────────────────────────

function computeDHash(gray: number[], srcW: number, srcH: number): number[] {
  const resized = resizeNearest(gray, srcW, srcH, HASH_SIZE + 1, HASH_SIZE);
  const bits: number[] = [];
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      bits.push(resized[y * (HASH_SIZE + 1) + x] > resized[y * (HASH_SIZE + 1) + x + 1] ? 1 : 0);
    }
  }
  const bytes: number[] = [];
  for (let i = 0; i < 8; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
    bytes.push(byte);
  }
  return bytes;
}

function hammingDistance(a: number[], b: number[]): number {
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let xor = a[i] ^ b[i];
    while (xor) { dist += xor & 1; xor >>>= 1; }
  }
  return dist;
}

// ── Image decoding ───────────────────────────────────────────────────────────

function decodeImage(buf: Buffer): DecodedImage {
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    const img = decodeJpeg(buf, { useTArray: true });
    return { data: Buffer.from(img.data), width: img.width, height: img.height };
  }
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const img = PNG.sync.read(buf);
    return { data: Buffer.from(img.data), width: img.width, height: img.height };
  }
  try {
    const img = decodeJpeg(buf, { useTArray: true });
    return { data: Buffer.from(img.data), width: img.width, height: img.height };
  } catch {
    throw new Error("Unsupported image format (expected JPEG or PNG).");
  }
}

function toGrayscale(rgba: Buffer, width: number, height: number): number[] {
  const gray: number[] = new Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
  }
  return gray;
}

function resizeNearest(gray: number[], srcW: number, srcH: number, dstW: number, dstH: number): number[] {
  const out: number[] = new Array(dstW * dstH);
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(Math.floor((x * srcW) / dstW), srcW - 1);
      const sy = Math.min(Math.floor((y * srcH) / dstH), srcH - 1);
      out[y * dstW + x] = gray[sy * srcW + sx];
    }
  }
  return out;
}

// ── Fetching ─────────────────────────────────────────────────────────────────

function publicUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function errorResult(
  code: string,
  summary: string,
  extra: Record<string, unknown> = {}
): AnalysisOutput {
  return {
    similarity_score: 0,
    summary,
    metadata: { engine: "histogram-dhash-v1", error: code, ...extra, analyzed_at: new Date().toISOString() },
  };
}

const SUBJECT_MAP: Record<string, string> = {
  room: "the recorded space",
  property: "the recorded property",
  car: "the recorded vehicle",
  item: "the recorded item",
  generic: "the recorded subject",
};

function buildSummary(score: number, matchedFrames: number, totalFrames: number, useCase: string): string {
  const subject = SUBJECT_MAP[useCase] ?? "the recorded subject";
  const ratio = `${matchedFrames}/${totalFrames} frames`;

  if (score >= 80) {
    return `High similarity detected. ${ratio} matched strongly — ${subject} is visually consistent with the reference photos.`;
  }
  if (score >= 65) {
    return `Good similarity detected. ${ratio} matched a reference image — ${subject} shares the same visual character as the reference photos.`;
  }
  if (score >= 50) {
    return `Moderate similarity detected. ${ratio} matched a reference image — ${subject} shares some visual features with the reference photos.`;
  }
  return `Low similarity detected. Only ${ratio} matched a reference image. The reference photos and ${subject} appear notably different.`;
}
