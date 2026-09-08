"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Button, Card, EmptyState, ErrorState, LoadingState, StatusBadge, type StatusTone } from "@/components/ui";
import { parseDateOnly, isBeforeToday } from "@/lib/dates";

type Person = { id: string; name: string };
type Shift = { id: string; date: string; startTime: string; endTime: string };
type MyShift = { id: string; ownerId: string; date: string; startTime: string; endTime: string };

type Swap = {
  id: string;
  status: string;
  shift: Shift;
  requester: Person;
  requesterId: string;
  targetId: string | null;
  acceptedBy: Person | null;
  acceptedById: string | null;
  offeredShift: Shift | null;
};

const STATUS_TONE: Record<string, StatusTone> = {
  open: "open",
  mutual: "mutual",
  pending_approval: "mutual",
  approved: "approved",
  denied: "denied",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  mutual: "Awaiting RLC approval",
  pending_approval: "Awaiting RLC approval",
  approved: "Approved",
  denied: "Denied",
};

function monthKey(offset: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return format(d, "yyyy-MM");
}

export function SwapsList({ compact = false }: { compact?: boolean }) {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const [acceptingSwap, setAcceptingSwap] = useState<Swap | null>(null);
  const [myShifts, setMyShifts] = useState<MyShift[] | null>(null);
  const [loadingMyShifts, setLoadingMyShifts] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [acceptError, setAcceptError] = useState<string | null>(null);

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

  async function act(swapId: string, action: "approve" | "deny") {
    setActingOn(swapId);
    try {
      await fetch(`/api/swaps/${swapId}/${action}`, { method: "PATCH" });
      await loadSwaps();
    } finally {
      setActingOn(null);
    }
  }

  async function openAcceptPicker(swap: Swap) {
    setAcceptingSwap(swap);
    setSelectedOfferId("");
    setAcceptError(null);
    setMyShifts(null);
    setLoadingMyShifts(true);

    const [shiftBatches, preferences] = await Promise.all([
      Promise.all([0, 1, 2].map((offset) => fetch(`/api/shifts?month=${monthKey(offset)}`).then((r) => r.json()))),
      fetch("/api/swap-preferences").then((r) => r.json()),
    ]);
    const allShifts: MyShift[] = shiftBatches.flat();
    const committedByPreference = new Set(
      preferences.filter((p: any) => p.userId === userId).map((p: any) => p.giveShiftId),
    );
    const committedBySwap = new Set(
      swaps.flatMap((s) => [s.shift.id, ...(s.offeredShift ? [s.offeredShift.id] : [])]),
    );
    const available = allShifts.filter(
      (s) =>
        s.ownerId === userId &&
        !committedByPreference.has(s.id) &&
        !committedBySwap.has(s.id) &&
        !isBeforeToday(parseDateOnly(s.date)),
    );
    setMyShifts(available);
    setLoadingMyShifts(false);
  }

  async function confirmAccept(offeredShiftId?: string) {
    if (!acceptingSwap) return;
    setActingOn(acceptingSwap.id);
    setAcceptError(null);
    const res = await fetch(`/api/swaps/${acceptingSwap.id}/accept`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offeredShiftId: offeredShiftId ?? undefined }),
    });
    setActingOn(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setAcceptError(body.error ?? "Couldn't accept that swap.");
      return;
    }
    setAcceptingSwap(null);
    await loadSwaps();
  }

  if (loading) return <LoadingState label="Loading swap requests…" />;
  if (error) return <ErrorState message={error} onRetry={loadSwaps} />;
  if (swaps.length === 0) {
    return (
      <EmptyState
        title="No swap requests right now"
        body="Requests you make or receive will show up here."
      />
    );
  }

  const dateFormat = compact ? "MMM d" : "EEE, MMM d";
  const btnSize = compact ? "px-2.5 py-1 text-caption" : "";

  return (
    <>
      <ul className={compact ? "space-y-2" : "space-y-3"}>
        {swaps.map((swap) => {
          const canAccept =
            swap.status === "open" && swap.requesterId !== userId && (!swap.targetId || swap.targetId === userId);
          const isPending = swap.status === "mutual" || swap.status === "pending_approval";
          const showRlcButtons = isPending && isAdmin;
          const busy = actingOn === swap.id;

          return (
            <li key={swap.id}>
              <Card className={`${compact ? "p-3" : "p-4"} ${isPending ? "border-mutual-400/40 bg-mutual-100" : ""}`}>
                <div className={`flex gap-2 ${compact ? "flex-col" : "flex-wrap items-start justify-between"}`}>
                  <div>
                    <p className={`font-medium text-ink-900 ${compact ? "text-label" : "text-body"}`}>
                      {format(parseDateOnly(swap.shift.date), dateFormat)}, {swap.shift.startTime}–
                      {swap.shift.endTime}
                    </p>
                    <p className={`text-ink-600 ${compact ? "text-caption" : "text-label"}`}>
                      Requested by {swap.requester.name}
                    </p>
                    {swap.acceptedBy && (
                      <p className={`text-ink-600 ${compact ? "text-caption" : "text-label"}`}>
                        Agreed to by {swap.acceptedBy.name}
                        {swap.offeredShift && (
                          <>
                            {" "}
                            (offering back {format(parseDateOnly(swap.offeredShift.date), "MMM d")},{" "}
                            {swap.offeredShift.startTime}–{swap.offeredShift.endTime})
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  <StatusBadge
                    tone={STATUS_TONE[swap.status] ?? "open"}
                    label={STATUS_LABEL[swap.status] ?? swap.status}
                  />
                </div>

                {(canAccept || showRlcButtons) && (
                  <div className={`mt-3 flex flex-col gap-2 ${compact ? "" : "sm:flex-row"}`}>
                    {canAccept && (
                      <Button className={btnSize} disabled={busy} onClick={() => openAcceptPicker(swap)}>
                        Accept
                      </Button>
                    )}
                    {showRlcButtons && (
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

      {acceptingSwap && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink-950/50 p-4"
          onClick={() => setAcceptingSwap(null)}
        >
          <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <p className="mb-4 text-body text-ink-700">
              Accept {acceptingSwap.requester.name}&rsquo;s {acceptingSwap.shift.startTime}–
              {acceptingSwap.shift.endTime} shift on {format(parseDateOnly(acceptingSwap.shift.date), "MMM d")}?
            </p>

            {loadingMyShifts ? (
              <LoadingState label="Loading your shifts…" />
            ) : (
              <div className="space-y-3">
                <Button className="w-full" disabled={actingOn === acceptingSwap.id} onClick={() => confirmAccept()}>
                  Just cover it
                </Button>

                {myShifts && myShifts.length > 0 && (
                  <div className="rounded-card border border-ink-200 p-3">
                    <p className="mb-2 text-caption font-medium text-ink-500">Or offer a shift back</p>
                    <select
                      value={selectedOfferId}
                      onChange={(e) => setSelectedOfferId(e.target.value)}
                      className="mb-2 w-full rounded-card border border-ink-300 px-2 py-1.5 text-label"
                    >
                      <option value="">Choose one of your shifts…</option>
                      {myShifts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {format(parseDateOnly(s.date), "EEE, MMM d")}, {s.startTime}–{s.endTime}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="secondary"
                      className="w-full"
                      disabled={!selectedOfferId || actingOn === acceptingSwap.id}
                      onClick={() => confirmAccept(selectedOfferId)}
                    >
                      Offer this shift back
                    </Button>
                  </div>
                )}
              </div>
            )}

            {acceptError && <p className="mt-3 text-label text-denied-400">{acceptError}</p>}

            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={() => setAcceptingSwap(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
