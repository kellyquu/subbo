import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Video, ImageIcon, ExternalLink } from "lucide-react";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col min-h-screen">
      <Header isAuthenticated={!!user} />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-neutral-100 bg-white py-20 px-4">
          <div className="mx-auto max-w-3xl text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-500 font-medium">
              <ShieldCheck size={13} className="text-neutral-400" />
              Verification as a trust signal
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-neutral-900 leading-tight tracking-tight">
              Verify what&apos;s real.
            </h1>
            <p className="text-lg text-neutral-600 max-w-xl mx-auto">
              Upload reference images, record a real-time video inside the app, and get a
              public verification page you can share anywhere — no guarantees, just proof.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={user ? "/dashboard" : "/signup"}>
                <Button size="lg" className="w-full sm:w-auto">
                  {user ? "Go to dashboard" : "Start verifying"}
                </Button>
              </Link>
              {!user && (
                <Link href="/login">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Sign in
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 px-4 bg-neutral-50 border-b border-neutral-100">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-semibold text-neutral-900 text-center mb-10">
              How it works
            </h2>
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
                  <ImageIcon size={20} className="text-neutral-600" />
                </div>
                <h3 className="font-semibold text-neutral-900">Upload reference images</h3>
                <p className="text-sm text-neutral-500">
                  Add 3–10 photos of the space, vehicle, or item you want to verify.
                </p>
              </div>
              <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
                  <Video size={20} className="text-neutral-600" />
                </div>
                <h3 className="font-semibold text-neutral-900">Record in-app video</h3>
                <p className="text-sm text-neutral-500">
                  Record a live walkthrough directly inside Subbo — no pre-recorded uploads
                  allowed.
                </p>
              </div>
              <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
                  <ExternalLink size={20} className="text-neutral-600" />
                </div>
                <h3 className="font-semibold text-neutral-900">Share your verification</h3>
                <p className="text-sm text-neutral-500">
                  Get a public verification page and a copyable &ldquo;Verified by Subbo&rdquo; snippet
                  to share anywhere.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section className="py-16 px-4 bg-white border-b border-neutral-100">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-semibold text-neutral-900 text-center mb-2">
              Use it for anything you need to prove is real
            </h2>
            <p className="text-neutral-500 text-center mb-10">
              One verification format. Many contexts.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Room", emoji: "🛋️" },
                { label: "Property", emoji: "🏠" },
                { label: "Vehicle", emoji: "🚗" },
                { label: "Item", emoji: "📦" },
                { label: "General", emoji: "🔍" },
              ].map(({ label, emoji }) => (
                <div
                  key={label}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-5 text-center"
                >
                  <div className="text-2xl mb-1">{emoji}</div>
                  <p className="text-sm font-medium text-neutral-700">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Public verification page callout */}
        <section className="py-16 px-4 bg-neutral-50">
          <div className="mx-auto max-w-2xl text-center space-y-5">
            <ShieldCheck size={32} className="mx-auto text-neutral-400" />
            <h2 className="text-2xl font-semibold text-neutral-900">
              Every verification gets a public page
            </h2>
            <p className="text-neutral-500">
              Share a link like{" "}
              <span className="font-mono text-sm bg-neutral-100 px-1.5 py-0.5 rounded">
                subbo.com/v/abc123
              </span>{" "}
              on Facebook Marketplace, Craigslist, Reddit, or anywhere you list. Buyers can
              view the verification without signing in.
            </p>
            <div className="inline-block text-left bg-white border border-neutral-200 rounded-lg px-5 py-4 font-mono text-sm text-neutral-700 whitespace-pre-line shadow-sm">
              {`✔ Verified by Subbo\nView verification: subbo.com/v/abc123`}
            </div>
            <div>
              <Link href={user ? "/dashboard" : "/signup"}>
                <Button>
                  {user ? "Go to dashboard" : "Create your first verification"}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
