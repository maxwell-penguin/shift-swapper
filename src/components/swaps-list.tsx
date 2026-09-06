"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";

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
  open: "bg-gray-100 text-gray-700 border-gray-300",
  mutual: "bg-amber-100 text-amber-800 border-amber-400",
  pending_approval: "bg-amber-100 text-amber-800 border-amber-400",
  approved: "bg-green-100 text-green-800 border-green-400",
  denied: "bg-red-100 text-red-800 border-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  mutual: "Agreed — pending RLC approval",
  pending_approval: "Agreed — pending RLC approval",
  approved: "Approved — finalized",
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
  const [actingOn, setActingOn] = useState<string | null>(null);

  const loadSwaps = useCallback(() => {
    setLoading(true);
    return fetch("/api/swaps")
      .then((res) => res.json())
      .then(setSwaps)
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

  if (loading) return <p>Loading…</p>;
  if (swaps.length === 0) return <p className="text-gray-500">No open swap requests.</p>;

  return (
    <ul className="space-y-3">
      {swaps.map((swap) => {
        const canAccept =
          swap.status === "open" && swap.requesterId !== userId && (!swap.targetId || swap.targetId === userId);
        const involvedInMutual =
          (swap.status === "mutual" || swap.status === "pending_approval") &&
          (userId === swap.requesterId || userId === swap.acceptedById);
        const busy = actingOn === swap.id;

        return (
          <li
            key={swap.id}
            className={`rounded-md border p-4 ${
              swap.status === "mutual" || swap.status === "pending_approval" ? "border-amber-300 bg-amber-50" : "bg-white"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {format(new Date(swap.shift.date), "EEE, MMM d")} · {swap.shift.startTime}–{swap.shift.endTime}
                </p>
                <p className="text-sm text-gray-600">
                  Requested by {swap.requester.name}
                  {swap.acceptedBy && <> · agreed with {swap.acceptedBy.name}</>}
                </p>
              </div>
              <StatusBadge status={swap.status} />
            </div>

            {(canAccept || involvedInMutual) && (
              <div className="mt-3 flex gap-2">
                {canAccept && (
                  <button
                    disabled={busy}
                    onClick={() => act(swap.id, "accept")}
                    className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Accept
                  </button>
                )}
                {involvedInMutual && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => act(swap.id, "approve")}
                      className="rounded-md bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      RLC approved
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => act(swap.id, "deny")}
                      className="rounded-md bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      RLC denied
                    </button>
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
