import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SignInButton } from "@/components/sign-in-button";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Shift Swapper</h1>
      <p className="max-w-xs text-sm text-slate-500">
        Sign in with your Microsoft account to see the schedule and request swaps.
      </p>
      <SignInButton />
    </main>
  );
}
