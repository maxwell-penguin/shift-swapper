"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { addMonths, eachDayOfInterval, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { AddShiftsModal } from "@/components/add-shifts-modal";
import { Button, Card, ErrorState, LoadingState } from "@/components/ui";

type Shift = {
  id: string;
  ownerId: string;
  date: string;
  startTime: string;
  endTime: string;
  owner: { id: string; name: string };
};

function monthDate(month: string) {
  return new Date(`${month}-01T00:00:00Z`);
}

export function DashboardGrid() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;

  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swapShift, setSwapShift] = useState<Shift | null>(null);
  const [posting, setPosting] = useState(false);
  const [showAddShifts, setShowAddShifts] = useState(false);

  const loadShifts = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetch(`/api/shifts?month=${month}`)
      .then((res) => {
        if (!res.ok) throw new Error("Couldn't load shifts for this month.");
        return res.json();
      })
      .then(setShifts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [month]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const days = useMemo(() => {
    const start = startOfMonth(monthDate(month));
    return eachDayOfInterval({ start, end: endOfMonth(start) });
  }, [month]);

  const owners = useMemo(() => {
    const byId = new Map<string, string>();
    shifts.forEach((s) => byId.set(s.ownerId, s.owner.name));
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [shifts]);

  function shiftFor(ownerId: string, day: Date) {
    const key = format(day, "yyyy-MM-dd");
    return shifts.find((s) => s.ownerId === ownerId && s.date.slice(0, 10) === key);
  }

  async function requestSwap(shift: Shift) {
    setPosting(true);
    const res = await fetch("/api/swaps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId: shift.id }),
    });
    setPosting(false);
    if (res.ok) setSwapShift(null);
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setMonth(format(subMonths(monthDate(month), 1), "yyyy-MM"))}>
            &larr;
          </Button>
          <h1 className="min-w-[10rem] text-center text-xl font-semibold text-slate-900">
            {format(monthDate(month), "MMMM yyyy")}
          </h1>
          <Button variant="secondary" onClick={() => setMonth(format(addMonths(monthDate(month), 1), "yyyy-MM"))}>
            &rarr;
          </Button>
        </div>
        <Button onClick={() => setShowAddShifts(true)} className="w-full sm:w-auto">
          Add my shifts
        </Button>
      </div>

      {loading ? (
        <LoadingState label="Loading shifts…" />
      ) : error ? (
        <ErrorState message={error} onRetry={loadShifts} />
      ) : owners.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">No shifts entered for this month yet.</p>
      ) : (
        <Card className="overflow-x-auto">
          <p className="px-3 pt-3 text-xs text-slate-400 sm:hidden">Swipe to see the full month</p>
          <table className="w-full border-collapse text-xs sm:text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-r border-stone-200 bg-slate-900 px-2 py-2 text-left font-medium text-white">
                  Don
                </th>
                {days.map((day) => (
                  <th
                    key={day.toISOString()}
                    className="border-b border-stone-200 bg-slate-900 px-2 py-2 font-medium text-white"
                  >
                    {format(day, "d")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {owners.map((owner) => (
                <tr key={owner.id}>
                  <td className="sticky left-0 z-10 border-b border-r border-stone-200 bg-white px-2 py-1.5 font-medium text-slate-800">
                    {owner.name}
                  </td>
                  {days.map((day) => {
                    const shift = shiftFor(owner.id, day);
                    const isMine = !!shift && shift.ownerId === userId;
                    return (
                      <td
                        key={day.toISOString()}
                        onClick={() => isMine && setSwapShift(shift!)}
                        className={`whitespace-nowrap border-b border-stone-200 px-2 py-1.5 text-center ${
                          isMine
                            ? "cursor-pointer border-l-2 border-l-amber-500 bg-amber-50 font-medium text-slate-900 hover:bg-amber-100"
                            : shift
                              ? "text-slate-600"
                              : ""
                        }`}
                      >
                        {shift ? shift.startTime : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {swapShift && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setSwapShift(null)}
        >
          <div className="w-full max-w-sm rounded-md bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <p className="mb-4 text-sm text-slate-700">
              Request a swap for your {swapShift.startTime}–{swapShift.endTime} shift on{" "}
              {format(new Date(swapShift.date), "MMM d")}?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSwapShift(null)}>
                Cancel
              </Button>
              <Button disabled={posting} onClick={() => requestSwap(swapShift)}>
                {posting ? "Posting…" : "Post swap request"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAddShifts && <AddShiftsModal onClose={() => setShowAddShifts(false)} onAdded={loadShifts} />}
    </div>
  );
}
