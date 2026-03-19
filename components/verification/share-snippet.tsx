"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

interface ShareSnippetProps {
  slug: string;
}

export function ShareSnippet({ slug }: ShareSnippetProps) {
  const [copied, setCopied] = useState(false);
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/v/${slug}`;

  const text = `✔ Verified by Subbo\nView verification: ${url}`;

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-3">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
        Share this verification
      </p>
      <div className="bg-white rounded border border-neutral-200 p-3 font-mono text-sm text-neutral-800 whitespace-pre-line">
        {text}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="gap-2"
        onClick={copy}
      >
        {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
        {copied ? "Copied!" : "Copy snippet"}
      </Button>
      <p className="text-xs text-neutral-400">
        Paste this on Facebook Marketplace, Craigslist, or anywhere you share your listing.
      </p>
    </div>
  );
}
