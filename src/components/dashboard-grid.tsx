"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { addMonths, eachDayOfInterval, endOfMonth, format, startOfMonth, subMonths } from "date-fns";

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
  const [swapShift, setSwapShift] = useState<Shift | null>(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/shifts?month=${month}`)
      .then((res) => res.json())
      .then(setShifts)
      .finally(() => setLoading(false));
  }, [month]);

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
      <div className="mb-4 flex items-center gap-4">
        <button onClick={() => setMonth(format(subMonths(monthDate(month), 1), "yyyy-MM"))}>&larr; Prev</button>
        <h1 className="text-lg font-semibold">{format(monthDate(month), "MMMM yyyy")}</h1>
        <button onClick={() => setMonth(format(addMonths(monthDate(month), 1), "yyyy-MM"))}>Next &rarr;</button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border bg-white px-2 py-1 text-left">Don</th>
                {days.map((day) => (
                  <th key={day.toISOString()} className="border px-2 py-1">
                    {format(day, "d")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {owners.map((owner) => (
                <tr key={owner.id}>
                  <td className="sticky left-0 z-10 border bg-white px-2 py-1 font-medium">{owner.name}</td>
                  {days.map((day) => {
                    const shift = shiftFor(owner.id, day);
                    const isMine = !!shift && shift.ownerId === userId;
                    return (
                      <td
                        key={day.toISOString()}
                        onClick={() => isMine && setSwapShift(shift!)}
                        className={`border px-2 py-1 text-center whitespace-nowrap ${
                          isMine ? "cursor-pointer bg-blue-50 hover:bg-blue-100" : ""
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
        </div>
      )}

      {swapShift && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/40"
          onClick={() => setSwapShift(null)}
        >
          <div className="rounded-md bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <p className="mb-4">
              Request a swap for your {swapShift.startTime}–{swapShift.endTime} shift on{" "}
              {format(new Date(swapShift.date), "MMM d")}?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setSwapShift(null)} className="px-3 py-1">
                Cancel
              </button>
              <button
                disabled={posting}
                onClick={() => requestSwap(swapShift)}
                className="rounded-md bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Post swap request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
