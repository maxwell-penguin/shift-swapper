"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Button, Card, ErrorState, LoadingState } from "@/components/ui";
import { parseDateOnly } from "@/lib/dates";

type Person = { id: string; name: string };
type Shift = { id: string; date: string; startTime: string; endTime: string };

type Swap = {
  id: string;
  status: string;
  shift: Shift;
  requester: Person;
  requesterId: string;
  targetId: string | null;
  acceptedBy: Person | null;
  acceptedById: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  open: "bg-stone-100 text-slate-600 border-stone-300",
  mutual: "bg-amber-100 text-amber-800 border-amber-400",
  pending_approval: "bg-amber-100 text-amber-800 border-amber-400",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-400",
  denied: "bg-rose-100 text-rose-800 border-rose-400",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  mutual: "Awaiting RLC approval",
  pending_approval: "Awaiting RLC approval",
  approved: "Approved",
  denied: "Denied",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? ""}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function SwapsList({ compact = false }: { compact?: boolean }) {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;

  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const loadSwaps = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetch("/api/swaps")
      .then((res) => {
        if (!res.ok) throw new Error("Couldn't load swap requests.");
        return res.json();
      })
      .then(setSwaps)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSwaps();
  }, [loadSwaps]);

  async function act(swapId: string, action: "accept" | "approve" | "deny") {
    setActingOn(swapId);
    try {
      await fetch(`/api/swaps/${swapId}/${action}`, { method: "PATCH" });
      await loadSwaps();
    } finally {
      setActingOn(null);
    }
  }

  if (loading) return <LoadingState label="Loading swap requests…" />;
  if (error) return <ErrorState message={error} onRetry={loadSwaps} />;
  if (swaps.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">No swap requests right now.</p>;
  }

  const dateFormat = compact ? "MMM d" : "EEE, MMM d";
  const btnSize = compact ? "px-2.5 py-1 text-xs" : "";

  return (
    <ul className={compact ? "space-y-2" : "space-y-3"}>
      {swaps.map((swap) => {
        const canAccept =
          swap.status === "open" && swap.requesterId !== userId && (!swap.targetId || swap.targetId === userId);
        const isPending = swap.status === "mutual" || swap.status === "pending_approval";
        const involvedInMutual = isPending && (userId === swap.requesterId || userId === swap.acceptedById);
        const busy = actingOn === swap.id;

        return (
          <li key={swap.id}>
            <Card className={`${compact ? "p-3" : "p-4"} ${isPending ? "border-amber-300 bg-amber-50" : ""}`}>
              <div className={`flex gap-2 ${compact ? "flex-col" : "flex-wrap items-start justify-between"}`}>
                <div>
                  <p className={`font-medium text-slate-900 ${compact ? "text-sm" : ""}`}>
                    {format(parseDateOnly(swap.shift.date), dateFormat)}, {swap.shift.startTime}–
                    {swap.shift.endTime}
                  </p>
                  <p className={`text-slate-600 ${compact ? "text-xs" : "text-sm"}`}>
                    Requested by {swap.requester.name}
                  </p>
                  {swap.acceptedBy && (
                    <p className={`text-slate-600 ${compact ? "text-xs" : "text-sm"}`}>
                      Agreed to by {swap.acceptedBy.name}
                    </p>
                  )}
                </div>
                <StatusBadge status={swap.status} />
              </div>

              {(canAccept || involvedInMutual) && (
                <div className={`mt-3 flex flex-col gap-2 ${compact ? "" : "sm:flex-row"}`}>
                  {canAccept && (
                    <Button className={btnSize} disabled={busy} onClick={() => act(swap.id, "accept")}>
                      Accept
                    </Button>
                  )}
                  {involvedInMutual && (
                    <>
                      <Button className={btnSize} variant="success" disabled={busy} onClick={() => act(swap.id, "approve")}>
                        RLC approved
                      </Button>
                      <Button className={btnSize} variant="danger" disabled={busy} onClick={() => act(swap.id, "deny")}>
                        RLC denied
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
