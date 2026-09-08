import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { MagicLinkForm } from "@/components/magic-link-form";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) redirect((session.user as any).groupId ? "/dashboard" : "/onboarding");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-50 px-4 text-center">
      <h1 className="text-display font-semibold text-ink-900">Shift Swapper</h1>
      <p className="max-w-xs text-label text-ink-500">Enter your email and we'll send you a link to sign in.</p>
      <MagicLinkForm />
    </main>
  );
}
