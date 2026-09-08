"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday as isTodayFn,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { DayCell, type Shift } from "@/components/day-cell";
import { NEW_SHIFT_DRAG_ID, NewShiftPill, NewShiftPillPreview } from "@/components/new-shift-pill";
import { Button, Card, ErrorState, LoadingState } from "@/components/ui";
import { parseDateOnly } from "@/lib/dates";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Preference = {
  id: string;
  userId: string;
  giveShiftId: string;
  acceptableShiftIds: string[];
  status: string;
};

function monthDate(month: string) {
  return parseDateOnly(`${month}-01`);
}

export function DashboardGrid() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;

  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [quickEditShift, setQuickEditShift] = useState<Shift | null>(null);
  const [swapShift, setSwapShift] = useState<Shift | null>(null);
  const [posting, setPosting] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [targetId, setTargetId] = useState("");
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [addingHereKey, setAddingHereKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"mine" | "everyone">("everyone");

  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [markingMode, setMarkingMode] = useState(false);
  const [draftGiveShift, setDraftGiveShift] = useState<Shift | null>(null);
  const [draftAcceptableIds, setDraftAcceptableIds] = useState<Set<string>>(new Set());
  const [postingPreference, setPostingPreference] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const loadShifts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shifts?month=${month}`);
      if (!res.ok) throw new Error("Couldn't load shifts for this month.");
      const data: Shift[] = await res.json();
      setShifts(data);
      return data;
    } catch (e: any) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }, [month]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  useEffect(() => {
    fetch("/api/groups/members")
      .then((res) => (res.ok ? res.json() : []))
      .then(setMembers)
      .catch(() => {});
  }, []);

  const loadPreferences = useCallback(() => {
    return fetch("/api/swap-preferences")
      .then((res) => (res.ok ? res.json() : []))
      .then(setPreferences)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const gridDays = useMemo(() => {
    const monthStart = startOfMonth(monthDate(month));
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const visibleShifts = useMemo(
    () => (viewMode === "mine" ? shifts.filter((s) => s.ownerId === userId) : shifts),
    [shifts, viewMode, userId],
  );

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    visibleShifts.forEach((s) => {
      const key = s.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [visibleShifts]);

  // Red/green read the same whether they come from an already-posted
  // SwapPreference (persistent, visible to everyone) or the in-progress
  // marking draft (local to this session, not yet posted) — red always wins
  // if a shift is somehow both, since "I'm giving this up" is the more
  // definite fact.
  const { redShiftIds, greenShiftIds } = useMemo(() => {
    const red = new Set<string>();
    const green = new Set<string>();
    preferences.forEach((p) => {
      if (p.status !== "open") return;
      red.add(p.giveShiftId);
      p.acceptableShiftIds.forEach((id) => green.add(id));
    });
    if (draftGiveShift) red.add(draftGiveShift.id);
    draftAcceptableIds.forEach((id) => green.add(id));
    red.forEach((id) => green.delete(id));
    return { redShiftIds: red, greenShiftIds: green };
  }, [preferences, draftGiveShift, draftAcceptableIds]);

  // Shared by the drag-and-drop path and the tap-to-add fallback below — both
  // end at the same "create a default 19:00–08:00 shift on this day" action.
  async function createShiftOn(dateKey: string) {
    setDropError(null);
    const res = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dateKey, startTime: "19:00", endTime: "08:00" }),
    });
    if (!res.ok) {
      setDropError("Couldn't add that shift.");
      return;
    }
    const created = await res.json();
    const refreshed = await loadShifts();
    setQuickEditShift(refreshed.find((s) => s.id === created.id) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const dateKey = event.over?.id;
    if (event.active.id !== NEW_SHIFT_DRAG_ID || !dateKey || typeof dateKey !== "string") return;
    await createShiftOn(dateKey);
  }

  async function handleAddHere(dateKey: string) {
    setAddingHereKey(dateKey);
    await createShiftOn(dateKey);
    setAddingHereKey(null);
    setSelectedDayKey(null);
  }

  async function saveQuickEdit(shiftId: string, patch: { startTime: string; endTime: string }) {
    const res = await fetch(`/api/shifts/${shiftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return false;
    await loadShifts();
    return true;
  }

  async function removeShift(shift: Shift) {
    const res = await fetch(`/api/shifts/${shift.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return body.error ?? "Couldn't remove that shift.";
    }
    await loadShifts();
    return null;
  }

  async function requestSwap(shift: Shift) {
    setPosting(true);
    const res = await fetch("/api/swaps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId: shift.id, targetId: targetId || undefined }),
    });
    setPosting(false);
    if (res.ok) {
      setSwapShift(null);
      setTargetId("");
    }
  }

  function toggleMarkingMode() {
    const turningOn = !markingMode;
    setMarkingMode(turningOn);
    if (turningOn) {
      // Marking needs everyone's shifts on screen, and no other floating UI
      // competing with the action bar.
      setViewMode("everyone");
      setSelectedDayKey(null);
      setQuickEditShift(null);
      setSwapShift(null);
    } else {
      setDraftGiveShift(null);
      setDraftAcceptableIds(new Set());
      setPreferenceError(null);
    }
  }

  function handleMarkRed(shift: Shift) {
    setPreferenceError(null);
    setDraftGiveShift((cur) => (cur?.id === shift.id ? null : shift));
    if (draftGiveShift?.id === shift.id) setDraftAcceptableIds(new Set());
  }

  function handleToggleGreen(shift: Shift) {
    if (!draftGiveShift) return;
    setDraftAcceptableIds((prev) => {
      const next = new Set(prev);
      if (next.has(shift.id)) next.delete(shift.id);
      else next.add(shift.id);
      return next;
    });
  }

  function cancelDraft() {
    setDraftGiveShift(null);
    setDraftAcceptableIds(new Set());
    setPreferenceError(null);
  }

  async function postDraft() {
    if (!draftGiveShift || draftAcceptableIds.size === 0) return;
    setPostingPreference(true);
    setPreferenceError(null);
    const res = await fetch("/api/swap-preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ giveShiftId: draftGiveShift.id, acceptableShiftIds: [...draftAcceptableIds] }),
    });
    setPostingPreference(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setPreferenceError(body.error ?? "Couldn't post that preference.");
      return;
    }
    cancelDraft();
    setMarkingMode(false);
    await loadPreferences();
    setToast("Posted to the Swap Market.");
  }

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div>
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => setMonth(format(subMonths(monthDate(month), 1), "yyyy-MM"))}>
              &larr;
            </Button>
            <h1 className="min-w-[10rem] text-center text-display font-semibold text-ink-900">
              {format(monthDate(month), "MMMM yyyy")}
            </h1>
            <Button variant="secondary" onClick={() => setMonth(format(addMonths(monthDate(month), 1), "yyyy-MM"))}>
              &rarr;
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="inline-flex rounded-full border border-ink-200 bg-white p-0.5 text-label">
              {(["everyone", "mine"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  disabled={markingMode && mode === "mine"}
                  title={markingMode && mode === "mine" ? "Switch off marking mode to filter to your shifts" : undefined}
                  className={`rounded-full px-3 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    viewMode === mode ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-800"
                  }`}
                >
                  {mode === "everyone" ? "Everyone" : "My shifts"}
                </button>
              ))}
            </div>
            <button
              onClick={toggleMarkingMode}
              className={`rounded-full border px-3 py-1.5 text-label font-medium transition-colors ${
                markingMode
                  ? "border-accent-500 bg-accent-500 text-ink-900"
                  : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
              }`}
            >
              Mark shifts to swap
            </button>
          </div>
          <div className="flex flex-col items-center gap-1 sm:items-end">
            {!markingMode && <NewShiftPill />}
            <p className="text-caption text-ink-400">
              {markingMode
                ? "Tap your shift to mark it red, then tap others' shifts to mark green"
                : 'Drag onto a day, or tap a day then "Add shift here"'}
            </p>
          </div>
        </div>

        {dropError && (
          <div className="mb-3 rounded-card border border-denied-400/30 bg-denied-100 px-3 py-2 text-label text-denied-700">
            {dropError}
          </div>
        )}

        {loading && !loadedOnce ? (
          <LoadingState label="Loading shifts…" />
        ) : error ? (
          <ErrorState message={error} onRetry={loadShifts} />
        ) : (
          <Card className={`overflow-hidden transition-colors ${markingMode ? "ring-2 ring-accent-500" : ""}`}>
            <div className="grid grid-cols-7">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="border-b border-r border-ink-200 bg-ink-50 py-2 text-center text-caption font-medium text-ink-500 last:border-r-0 sm:text-label"
                >
                  {label}
                </div>
              ))}
              {gridDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                return (
                  <DayCell
                    key={key}
                    date={day}
                    inCurrentMonth={isSameMonth(day, monthDate(month))}
                    isToday={isTodayFn(day)}
                    shifts={shiftsByDate.get(key) ?? []}
                    currentUserId={userId}
                    quickEditShift={quickEditShift}
                    selected={selectedDayKey === key}
                    onSelect={() => setSelectedDayKey((cur) => (cur === key ? null : key))}
                    onAddHere={() => handleAddHere(key)}
                    addingHere={addingHereKey === key}
                    onSaveQuickEdit={saveQuickEdit}
                    onDismissQuickEdit={() => setQuickEditShift(null)}
                    onRequestSwap={(shift) => {
                      setTargetId("");
                      setSwapShift(shift);
                    }}
                    onRemove={removeShift}
                    markingMode={markingMode}
                    redShiftIds={redShiftIds}
                    greenShiftIds={greenShiftIds}
                    onMarkRed={handleMarkRed}
                    onToggleGreen={handleToggleGreen}
                  />
                );
              })}
            </div>
          </Card>
        )}
      </div>

      <DragOverlay>{activeId === NEW_SHIFT_DRAG_ID ? <NewShiftPillPreview /> : null}</DragOverlay>

      {draftGiveShift && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex w-full max-w-sm flex-col gap-2 rounded-card border border-ink-200 bg-white p-4 shadow-lg sm:max-w-md sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-label font-medium text-ink-900">
                Giving up {format(parseDateOnly(draftGiveShift.date), "EEE, MMM d")}, {draftGiveShift.startTime}–
                {draftGiveShift.endTime}
              </p>
              <p className="text-caption text-ink-500">
                {draftAcceptableIds.size === 0
                  ? "Tap other shifts you'd take instead"
                  : `${draftAcceptableIds.size} shift${draftAcceptableIds.size === 1 ? "" : "s"} marked acceptable`}
              </p>
              {preferenceError && <p className="mt-1 text-caption text-denied-400">{preferenceError}</p>}
            </div>
            <div className="flex flex-none gap-2">
              <Button variant="ghost" onClick={cancelDraft}>
                Cancel
              </Button>
              <Button disabled={draftAcceptableIds.size === 0 || postingPreference} onClick={postDraft}>
                {postingPreference ? "Posting…" : "Post to Swap Market"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-card border border-approved-400/40 bg-approved-100 px-4 py-2.5 text-label text-approved-700 shadow-lg">
            <span>{toast}</span>
            <Link href="/market" className="font-medium underline transition-colors hover:text-approved-400">
              View Swap Market
            </Link>
          </div>
        </div>
      )}

      {swapShift && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink-950/50 p-4"
          onClick={() => setSwapShift(null)}
        >
          <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <p className="mb-4 text-body text-ink-700">
              Request a swap for your {swapShift.startTime}–{swapShift.endTime} shift on{" "}
              {format(parseDateOnly(swapShift.date), "MMM d")}?
            </p>

            {members.length > 1 && (
              <div className="mb-4">
                <label className="mb-1 block text-caption font-medium text-ink-500">
                  Aim this at someone specific (optional)
                </label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full rounded-card border border-ink-300 px-2 py-1.5 text-label"
                >
                  <option value="">Anyone in the group</option>
                  {members
                    .filter((m) => m.id !== userId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || "Unnamed"}
                      </option>
                    ))}
                </select>
              </div>
            )}

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
    </DndContext>
  );
}
