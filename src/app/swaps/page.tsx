import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SwapsList } from "@/components/swaps-list";

export default async function SwapsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  return (
    <main className="p-6">
      <h1 className="mb-4 text-lg font-semibold">Swap requests</h1>
      <SwapsList />
    </main>
  );
}
