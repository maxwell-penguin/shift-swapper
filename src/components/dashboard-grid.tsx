"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
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

function monthDate(month: string) {
  return parseDateOnly(`${month}-01`);
}

export function DashboardGrid() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;

  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
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

  const gridDays = useMemo(() => {
    const monthStart = startOfMonth(monthDate(month));
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    shifts.forEach((s) => {
      const key = s.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [shifts]);

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
          <div className="flex flex-col items-center gap-1 sm:items-end">
            <NewShiftPill />
            <p className="text-caption text-ink-400">Drag onto a day, or tap a day then "Add shift here"</p>
          </div>
        </div>

        {dropError && (
          <div className="mb-3 rounded-card border border-denied-400/30 bg-denied-100 px-3 py-2 text-label text-denied-700">
            {dropError}
          </div>
        )}

        {loading ? (
          <LoadingState label="Loading shifts…" />
        ) : error ? (
          <ErrorState message={error} onRetry={loadShifts} />
        ) : (
          <Card className="overflow-hidden">
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
                  />
                );
              })}
            </div>
          </Card>
        )}
      </div>

      <DragOverlay>{activeId === NEW_SHIFT_DRAG_ID ? <NewShiftPillPreview /> : null}</DragOverlay>

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
