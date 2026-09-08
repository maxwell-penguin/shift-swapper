import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { OnboardingForm } from "@/components/onboarding-form";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");
  if ((session.user as any).groupId) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Welcome to Shift Swapper</h1>
        <p className="mt-1 text-sm text-slate-500">First, tell us who you are and which group you&rsquo;re joining.</p>
      </div>
      <OnboardingForm />
    </main>
  );
}
