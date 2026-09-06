"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Button, Card, ErrorState, LoadingState } from "@/components/ui";

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
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? ""}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function SwapsList() {
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

  return (
    <ul className="space-y-3">
      {swaps.map((swap) => {
        const canAccept =
          swap.status === "open" && swap.requesterId !== userId && (!swap.targetId || swap.targetId === userId);
        const isPending = swap.status === "mutual" || swap.status === "pending_approval";
        const involvedInMutual = isPending && (userId === swap.requesterId || userId === swap.acceptedById);
        const busy = actingOn === swap.id;

        return (
          <li key={swap.id}>
            <Card className={`p-4 ${isPending ? "border-amber-300 bg-amber-50" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">
                    {format(new Date(swap.shift.date), "EEE, MMM d")}, {swap.shift.startTime}–{swap.shift.endTime}
                  </p>
                  <p className="text-sm text-slate-600">Requested by {swap.requester.name}</p>
                  {swap.acceptedBy && <p className="text-sm text-slate-600">Agreed to by {swap.acceptedBy.name}</p>}
                </div>
                <StatusBadge status={swap.status} />
              </div>

              {(canAccept || involvedInMutual) && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {canAccept && (
                    <Button disabled={busy} onClick={() => act(swap.id, "accept")}>
                      Accept
                    </Button>
                  )}
                  {involvedInMutual && (
                    <>
                      <Button variant="success" disabled={busy} onClick={() => act(swap.id, "approve")}>
                        RLC approved
                      </Button>
                      <Button variant="danger" disabled={busy} onClick={() => act(swap.id, "deny")}>
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
