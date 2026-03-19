"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { X, ImagePlus } from "lucide-react";

interface ImageUploaderProps {
  onChange: (files: File[]) => void;
  maxImages?: number;
}

export function ImageUploader({ onChange, maxImages = 10 }: ImageUploaderProps) {
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(incoming: FileList | null) {
    if (!incoming) return;

    const newFiles = Array.from(incoming)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, maxImages - previews.length);

    if (newFiles.length === 0) return;

    const newPreviews = newFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));

    const updated = [...previews, ...newPreviews].slice(0, maxImages);
    setPreviews(updated);
    onChange(updated.map((p) => p.file));
  }

  function remove(index: number) {
    URL.revokeObjectURL(previews[index].url);
    const updated = previews.filter((_, i) => i !== index);
    setPreviews(updated);
    onChange(updated.map((p) => p.file));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      <div
        className="border-2 border-dashed border-neutral-200 rounded-lg p-6 text-center cursor-pointer hover:border-neutral-400 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <ImagePlus className="mx-auto mb-2 text-neutral-400" size={24} />
        <p className="text-sm text-neutral-600">
          Click or drag &amp; drop to add reference images
        </p>
        <p className="text-xs text-neutral-400 mt-1">
          {previews.length}/{maxImages} images · JPEG, PNG, WebP
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {previews.map((p, i) => (
            <div key={i} className="relative group aspect-square rounded-md overflow-hidden bg-neutral-100">
              <Image
                src={p.url}
                alt={`Reference ${i + 1}`}
                fill
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
