import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex flex-col min-h-screen">
      <Header isAuthenticated={true} />
      <main className="flex-1 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
