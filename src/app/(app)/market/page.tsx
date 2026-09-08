import { SwapMarket } from "@/components/swap-market";

export default function MarketPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Swap Market</h1>
      <p className="mb-4 text-sm text-slate-500">
        Post what you&rsquo;d give up and what you&rsquo;d take — the matcher can chain trades together even when no
        two people want to swap directly.
      </p>
      <SwapMarket />
    </div>
  );
}
