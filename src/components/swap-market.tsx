"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { parseDateOnly } from "@/lib/dates";
import { Button, Card, ErrorState, LoadingState } from "@/components/ui";
import { CycleCard, type SwapCycleT } from "@/components/cycle-card";

type Shift = { id: string; ownerId: string; date: string; startTime: string; endTime: string };
type Person = { id: string; name: string };
type Preference = {
  id: string;
  userId: string;
  user: Person;
  giveShiftId: string;
  giveShift: Shift;
  status: string;
};

const TIME_OF_DAY_OPTIONS = [
  { value: "", label: "Any time of day" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "overnight", label: "Overnight" },
];

function monthKey(offset: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return format(d, "yyyy-MM");
}

export function SwapMarket() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const [myShifts, setMyShifts] = useState<Shift[]>([]);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [cycles, setCycles] = useState<SwapCycleT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [findResult, setFindResult] = useState<string | null>(null);
  const [busyCycleId, setBusyCycleId] = useState<string | null>(null);

  const [giveShiftId, setGiveShiftId] = useState("");
  const [acceptableShiftIds, setAcceptableShiftIds] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [shiftRes0, shiftRes1, shiftRes2, prefRes, cycleRes] = await Promise.all([
        fetch(`/api/shifts?month=${monthKey(0)}`),
        fetch(`/api/shifts?month=${monthKey(1)}`),
        fetch(`/api/shifts?month=${monthKey(2)}`),
        fetch("/api/swap-preferences"),
        fetch("/api/swap-cycles"),
      ]);
      if (![shiftRes0, shiftRes1, shiftRes2, prefRes, cycleRes].every((r) => r.ok)) {
        throw new Error("Couldn't load the swap market.");
      }
      const [shifts0, shifts1, shifts2, prefs, cyclesData] = await Promise.all([
        shiftRes0.json(),
        shiftRes1.json(),
        shiftRes2.json(),
        prefRes.json(),
        cycleRes.json(),
      ]);
      const allShifts: Shift[] = [...shifts0, ...shifts1, ...shifts2];
      setMyShifts(allShifts.filter((s) => s.ownerId === userId));
      setPreferences(prefs);
      setCycles(cyclesData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) loadAll();
  }, [userId, loadAll]);

  const myOpenShiftIds = useMemo(
    () => new Set(preferences.filter((p) => p.userId === userId).map((p) => p.giveShiftId)),
    [preferences, userId],
  );
  const availableToGive = myShifts.filter((s) => !myOpenShiftIds.has(s.id));
  const myPreferences = preferences.filter((p) => p.userId === userId);
  const marketOffers = preferences.filter((p) => p.status === "open" && p.userId !== userId);

  function toggleAcceptableShift(shiftId: string) {
    setAcceptableShiftIds((prev) => {
      const next = new Set(prev);
      if (next.has(shiftId)) next.delete(shiftId);
      else next.add(shiftId);
      return next;
    });
  }

  async function submitPreference() {
    if (!giveShiftId) return;
    setPosting(true);
    setPostError(null);
    const res = await fetch("/api/swap-preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        giveShiftId,
        acceptableShiftIds: [...acceptableShiftIds],
        acceptableFromDate: fromDate || undefined,
        acceptableToDate: toDate || undefined,
        acceptableTimeOfDay: timeOfDay || undefined,
      }),
    });
    setPosting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setPostError(body.error ?? "Couldn't post that preference.");
      return;
    }
    setGiveShiftId("");
    setAcceptableShiftIds(new Set());
    setFromDate("");
    setToDate("");
    setTimeOfDay("");
    await loadAll();
  }

  async function cancelPreference(id: string) {
    await fetch(`/api/swap-preferences/${id}`, { method: "DELETE" });
    await loadAll();
  }

  async function findMatches() {
    setFinding(true);
    setFindResult(null);
    const res = await fetch("/api/swap-cycles/find-matches", { method: "POST" });
    setFinding(false);
    if (res.ok) {
      const body = await res.json();
      setFindResult(
        body.cyclesFound === 0
          ? "No trade cycles found right now."
          : `Found ${body.cyclesFound} trade ${body.cyclesFound === 1 ? "cycle" : "cycles"}.`,
      );
      await loadAll();
    } else {
      setFindResult("Couldn't run the matcher.");
    }
  }

  async function act(cycleId: string, action: "confirm" | "approve" | "deny") {
    setBusyCycleId(cycleId);
    await fetch(`/api/swap-cycles/${cycleId}/${action}`, { method: "PATCH" });
    setBusyCycleId(null);
    await loadAll();
  }

  if (loading) return <LoadingState label="Loading the swap market…" />;
  if (error) return <ErrorState message={error} onRetry={loadAll} />;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Post a preference</h2>

          <label className="mb-1 block text-xs font-medium text-slate-500">Shift you want off</label>
          <select
            value={giveShiftId}
            onChange={(e) => setGiveShiftId(e.target.value)}
            className="mb-3 w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm"
          >
            <option value="">Choose a shift…</option>
            {availableToGive.map((s) => (
              <option key={s.id} value={s.id}>
                {format(parseDateOnly(s.date), "EEE, MMM d")}, {s.startTime}–{s.endTime}
              </option>
            ))}
          </select>

          {marketOffers.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium text-slate-500">Specific shifts you&rsquo;d take</p>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-stone-200 p-2">
                {marketOffers.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={acceptableShiftIds.has(p.giveShiftId)}
                      onChange={() => toggleAcceptableShift(p.giveShiftId)}
                    />
                    {format(parseDateOnly(p.giveShift.date), "MMM d")}, {p.giveShift.startTime}–
                    {p.giveShift.endTime} ({p.user.name || "Unnamed"})
                  </label>
                ))}
              </div>
            </div>
          )}

          <p className="mb-1 text-xs font-medium text-slate-500">
            Or accept any shift in this range, used only if none of the above is available
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
            />
            <select
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
            >
              {TIME_OF_DAY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {postError && <p className="mb-3 text-sm text-rose-600">{postError}</p>}

          <Button disabled={!giveShiftId || posting} onClick={submitPreference}>
            {posting ? "Posting…" : "Post to the market"}
          </Button>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Your open preferences</h2>
          {myPreferences.length === 0 ? (
            <p className="text-sm text-slate-500">You haven&rsquo;t posted anything to the market yet.</p>
          ) : (
            <ul className="space-y-2">
              {myPreferences.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-slate-700">
                    {format(parseDateOnly(p.giveShift.date), "MMM d")}, {p.giveShift.startTime}–
                    {p.giveShift.endTime}
                    {p.status === "matched" && <span className="ml-2 text-amber-700">(matched)</span>}
                  </span>
                  {p.status === "open" && (
                    <button
                      onClick={() => cancelPreference(p.id)}
                      className="text-xs text-slate-400 hover:text-rose-600"
                    >
                      Withdraw
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Proposed trades</h2>
              <p className="text-xs text-slate-500">
                Finds direct swaps and longer chains alike across everyone&rsquo;s open preferences.
              </p>
            </div>
            <Button disabled={finding} onClick={findMatches}>
              {finding ? "Searching…" : "Find matches"}
            </Button>
          </div>
          {findResult && <p className="mt-2 text-sm text-slate-600">{findResult}</p>}
        </Card>

        {cycles.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No proposed trades right now.</p>
        ) : (
          <ul className="space-y-3">
            {cycles.map((cycle) => (
              <li key={cycle.id}>
                <CycleCard
                  cycle={cycle}
                  currentUserId={userId}
                  isAdmin={isAdmin}
                  busy={busyCycleId === cycle.id}
                  onConfirm={(id) => act(id, "confirm")}
                  onApprove={(id) => act(id, "approve")}
                  onDeny={(id) => act(id, "deny")}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
