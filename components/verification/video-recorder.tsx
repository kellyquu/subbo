"use client";

import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Video, Square, RotateCcw } from "lucide-react";

/** Max frames to capture during recording (1 per second, capped). */
const MAX_FRAMES = 10;
/** JPEG quality for captured frames (0–1). */
const FRAME_QUALITY = 0.75;
/** Canvas dimensions for captured frames. */
const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 360;

type RecordingState = "idle" | "ready" | "recording" | "done";

interface VideoRecorderProps {
  /**
   * Called when recording finishes.
   * @param blob  The full video blob (used for in-app playback).
   * @param frames  JPEG data-URLs extracted at ~1 fps during recording.
   */
  onCapture: (blob: Blob, frames: string[]) => void;
  maxSeconds?: number;
}

export function VideoRecorder({ onCapture, maxSeconds = 60 }: VideoRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameDataUrlsRef = useRef<string[]>([]);

  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
      }
      setState("ready");
    } catch (err) {
      setError("Camera access denied. Please allow camera access and try again.");
      console.error(err);
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    frameDataUrlsRef.current = [];

    // Create a reusable off-screen canvas for frame capture.
    // Scale down to max FRAME_WIDTH/FRAME_HEIGHT while preserving aspect ratio.
    if (!captureCanvasRef.current) {
      const canvas = document.createElement("canvas");
      const track = streamRef.current?.getVideoTracks()[0];
      const settings = track?.getSettings();
      const sw = settings?.width ?? FRAME_WIDTH;
      const sh = settings?.height ?? FRAME_HEIGHT;
      const ratio = Math.min(FRAME_WIDTH / sw, FRAME_HEIGHT / sh, 1);
      canvas.width = Math.round(sw * ratio);
      canvas.height = Math.round(sh * ratio);
      captureCanvasRef.current = canvas;
    }

    let mr: MediaRecorder;
    try {
      const mimeType = getSupportedMimeType();
      mr = mimeType
        ? new MediaRecorder(streamRef.current, { mimeType })
        : new MediaRecorder(streamRef.current);
    } catch (err) {
      setError(`MediaRecorder init failed: ${String(err)}`);
      return;
    }
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = () => {
      const blobType = mr.mimeType || "video/mp4";
      const blob = new Blob(chunksRef.current, { type: blobType });
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
      onCapture(blob, frameDataUrlsRef.current);
      setState("done");
      stopStream();
    };

    mr.start(250);
    setState("recording");
    setElapsed(0);

    timerRef.current = setInterval(() => {
      // Capture a frame from the live video every second (up to MAX_FRAMES).
      if (
        frameDataUrlsRef.current.length < MAX_FRAMES &&
        videoRef.current &&
        captureCanvasRef.current
      ) {
        const ctx = captureCanvasRef.current.getContext("2d");
        if (ctx) {
          ctx.drawImage(
            videoRef.current,
            0,
            0,
            captureCanvasRef.current.width,
            captureCanvasRef.current.height
          );
          frameDataUrlsRef.current.push(
            captureCanvasRef.current.toDataURL("image/jpeg", FRAME_QUALITY)
          );
        }
      }

      setElapsed((s) => {
        if (s + 1 >= maxSeconds) {
          stopRecording();
          return s + 1;
        }
        return s + 1;
      });
    }, 1000);
  }, [maxSeconds, onCapture]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const reset = useCallback(() => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setElapsed(0);
    setState("idle");
    frameDataUrlsRef.current = [];
    stopStream();
  }, [recordedUrl, stopStream]);

  function formatTime(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  return (
    <div className="space-y-3">
      <div className="relative bg-neutral-900 rounded-lg overflow-hidden flex items-center justify-center" style={{ aspectRatio: "auto", minHeight: "240px" }}>
        {state === "idle" && (
          <div className="text-center text-neutral-400">
            <Video size={40} className="mx-auto mb-2" />
            <p className="text-sm">Camera not started</p>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${state === "ready" || state === "recording" ? "block" : "hidden"}`}
        />

        {state === "recording" && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 rounded px-2 py-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-xs font-mono">{formatTime(elapsed)}</span>
          </div>
        )}

        {state === "done" && recordedUrl && (
          <video
            src={recordedUrl}
            controls
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-2">
        {state === "idle" && (
          <Button type="button" onClick={startCamera} className="gap-2">
            <Video size={16} />
            Start camera
          </Button>
        )}

        {state === "ready" && (
          <Button type="button" onClick={startRecording} className="gap-2 bg-red-600 hover:bg-red-700">
            <span className="w-2 h-2 rounded-full bg-white" />
            Record
          </Button>
        )}

        {state === "recording" && (
          <Button type="button" onClick={stopRecording} variant="outline" className="gap-2">
            <Square size={16} />
            Stop recording
          </Button>
        )}

        {state === "done" && (
          <Button type="button" onClick={reset} variant="outline" className="gap-2">
            <RotateCcw size={16} />
            Re-record
          </Button>
        )}
      </div>

      {state === "done" && (
        <p className="text-xs text-neutral-500">
          Video captured in-app · {formatTime(elapsed)} recorded
        </p>
      )}
    </div>
  );
}

function getSupportedMimeType(): string {
  // isTypeSupported is absent on some older Safari/iOS versions.
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4;codecs=avc1",
    "video/mp4",
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}
