import { SwapsList } from "@/components/swaps-list";

export default function SwapsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Swap requests</h1>
      <SwapsList />
    </div>
  );
}
