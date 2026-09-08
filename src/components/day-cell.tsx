"use client";

import { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { format } from "date-fns";
import { Avatar, Button, DropSettle } from "@/components/ui";

export type Shift = {
  id: string;
  ownerId: string;
  date: string;
  startTime: string;
  endTime: string;
  owner: { id: string; name: string };
};

const MAX_VISIBLE_CHIPS = 3;

type DayCellProps = {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
  shifts: Shift[];
  currentUserId?: string;
  quickEditShift: Shift | null;
  selected: boolean;
  onSelect: () => void;
  onAddHere: () => void;
  addingHere: boolean;
  onSaveQuickEdit: (shiftId: string, patch: { startTime: string; endTime: string }) => Promise<boolean>;
  onDismissQuickEdit: () => void;
  onRequestSwap: (shift: Shift) => void;
  onRemove: (shift: Shift) => Promise<string | null>;
  markingMode: boolean;
  redShiftIds: Set<string>;
  greenShiftIds: Set<string>;
  onMarkRed: (shift: Shift) => void;
  onToggleGreen: (shift: Shift) => void;
};

export function DayCell({
  date,
  inCurrentMonth,
  isToday,
  shifts,
  currentUserId,
  quickEditShift,
  selected,
  onSelect,
  onAddHere,
  addingHere,
  onSaveQuickEdit,
  onDismissQuickEdit,
  onRequestSwap,
  onRemove,
  markingMode,
  redShiftIds,
  greenShiftIds,
  onMarkRed,
  onToggleGreen,
}: DayCellProps) {
  const dateKey = format(date, "yyyy-MM-dd");
  const { setNodeRef, isOver } = useDroppable({ id: dateKey });

  // Your own shift always stays visible even if a day is crowded — it's the
  // only chip you can act on (request a swap / remove), so it can't be the
  // one that gets buried behind "+N more".
  const sortedShifts = [...shifts].sort(
    (a, b) => Number(b.ownerId === currentUserId) - Number(a.ownerId === currentUserId),
  );
  const visible = sortedShifts.slice(0, MAX_VISIBLE_CHIPS);
  const hidden = sortedShifts.slice(MAX_VISIBLE_CHIPS);
  const editingHere = quickEditShift && shifts.some((s) => s.id === quickEditShift.id);

  return (
    <div
      ref={setNodeRef}
      onClick={markingMode ? undefined : onSelect}
      className={`relative flex min-h-[5.5rem] flex-col gap-1.5 border-b border-r border-ink-200 p-1.5 transition sm:min-h-[7rem] sm:p-2 ${
        inCurrentMonth ? "bg-white" : "bg-ink-50"
      } ${
        isOver
          ? "bg-accent-100 ring-2 ring-inset ring-accent-500"
          : selected
            ? "ring-1 ring-inset ring-accent-300"
            : ""
      }`}
    >
      <span
        className={`self-end text-caption sm:text-label ${
          isToday
            ? "flex h-5 w-5 items-center justify-center rounded-full bg-ink-900 font-semibold text-white sm:h-6 sm:w-6"
            : inCurrentMonth
              ? "text-ink-600"
              : "text-ink-300"
        }`}
      >
        {format(date, "d")}
      </span>

      <div className="flex flex-col gap-0.5">
        {visible.map((shift) => {
          const chip = (
            <ShiftChip
              shift={shift}
              isMine={shift.ownerId === currentUserId}
              onRequestSwap={onRequestSwap}
              onRemove={onRemove}
              markingMode={markingMode}
              isRed={redShiftIds.has(shift.id)}
              isGreen={greenShiftIds.has(shift.id)}
              onMarkRed={onMarkRed}
              onToggleGreen={onToggleGreen}
            />
          );
          return quickEditShift?.id === shift.id ? (
            <DropSettle key={shift.id}>{chip}</DropSettle>
          ) : (
            <div key={shift.id}>{chip}</div>
          );
        })}
        {hidden.length > 0 && (
          <OverflowPill
            shifts={hidden}
            markingMode={markingMode}
            greenShiftIds={greenShiftIds}
            onToggleGreen={onToggleGreen}
          />
        )}
      </div>

      {!markingMode && selected && !editingHere && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddHere();
          }}
          disabled={addingHere}
          className="absolute left-0 top-full z-20 mt-1 whitespace-nowrap rounded-card border border-dashed border-accent-500 bg-white px-2 py-1 text-caption font-medium text-accent-700 shadow-sm transition-colors hover:bg-accent-100 disabled:opacity-50"
        >
          {addingHere ? "Adding…" : "+ Add shift here"}
        </button>
      )}

      {!markingMode && editingHere && quickEditShift && (
        <QuickEditPopover
          shift={quickEditShift}
          onSave={onSaveQuickEdit}
          onDismiss={onDismissQuickEdit}
        />
      )}
    </div>
  );
}

// The ring color communicates the same red/give-away or green/acceptable
// status whether it comes from an already-posted SwapPreference or the
// in-progress marking draft — both mean the same thing to someone reading
// the calendar, so they share one visual language.
function markRingClass(isRed: boolean, isGreen: boolean) {
  if (isRed) return "ring-2 ring-offset-1 ring-denied-400";
  if (isGreen) return "ring-2 ring-offset-1 ring-approved-400";
  return "";
}

function ShiftChip({
  shift,
  isMine,
  onRequestSwap,
  onRemove,
  markingMode,
  isRed,
  isGreen,
  onMarkRed,
  onToggleGreen,
}: {
  shift: Shift;
  isMine: boolean;
  onRequestSwap: (shift: Shift) => void;
  onRemove: (shift: Shift) => Promise<string | null>;
  markingMode: boolean;
  isRed: boolean;
  isGreen: boolean;
  onMarkRed: (shift: Shift) => void;
  onToggleGreen: (shift: Shift) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    const err = await onRemove(shift);
    setRemoving(false);
    if (err) setError(err);
    else setMenuOpen(false);
  }

  function handleClick() {
    if (markingMode) {
      if (isMine) onMarkRed(shift);
      else onToggleGreen(shift);
      return;
    }
    if (isMine) setMenuOpen((v) => !v);
  }

  const firstName = (shift.owner.name || "Unnamed").split(" ")[0];
  const clickable = markingMode ? true : isMine;

  return (
    <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={handleClick}
        title={`${shift.owner.name || "Unnamed"}, ${shift.startTime}–${shift.endTime}`}
        className={`flex w-full min-w-0 items-center gap-1 rounded transition-colors ${
          clickable ? "cursor-pointer hover:bg-ink-100" : "cursor-default"
        }`}
      >
        <span className={`flex-none rounded-full transition-colors ${markRingClass(isRed, isGreen)}`}>
          <Avatar userId={shift.ownerId} name={shift.owner.name} size="xs" />
        </span>
        <span className="truncate text-micro text-ink-700 sm:text-caption">{firstName}</span>
      </button>

      {!markingMode && menuOpen && (
        <div className="absolute left-0 top-full z-30 mt-1 w-44 rounded-card border border-ink-200 bg-white p-1 text-label shadow-lg">
          <p className="px-2 py-1 text-caption text-ink-400">
            {shift.startTime}–{shift.endTime}
          </p>
          <button
            onClick={() => {
              onRequestSwap(shift);
              setMenuOpen(false);
            }}
            className="block w-full rounded px-2 py-1.5 text-left text-ink-700 transition-colors hover:bg-ink-50"
          >
            Request a swap
          </button>
          <button
            disabled={removing}
            onClick={handleRemove}
            className="block w-full rounded px-2 py-1.5 text-left text-denied-700 transition-colors hover:bg-denied-100 disabled:opacity-50"
          >
            {removing ? "Removing…" : "Remove"}
          </button>
          {error && <p className="px-2 pb-1 pt-0.5 text-caption text-denied-400">{error}</p>}
        </div>
      )}
    </div>
  );
}

function OverflowPill({
  shifts,
  markingMode,
  greenShiftIds,
  onToggleGreen,
}: {
  shifts: Shift[];
  markingMode: boolean;
  greenShiftIds: Set<string>;
  onToggleGreen: (shift: Shift) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded bg-ink-100 px-1 py-0.5 text-left text-micro font-medium text-ink-600 transition-colors hover:bg-ink-200 sm:text-caption"
      >
        +{shifts.length} more
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-44 rounded-card border border-ink-200 bg-white p-1.5 shadow-lg">
          <ul className="space-y-1">
            {shifts.map((shift) => {
              // Overflow items are, by construction, never the current
              // user's own shift (day-cell always keeps that one visible) —
              // so in marking mode these can only ever be toggled green.
              const isGreen = greenShiftIds.has(shift.id);
              return (
                <li key={shift.id}>
                  <button
                    onClick={() => markingMode && onToggleGreen(shift)}
                    className={`flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-caption text-ink-700 transition-colors ${
                      markingMode ? "cursor-pointer hover:bg-ink-100" : "cursor-default"
                    }`}
                  >
                    <span className={`flex-none rounded-full transition-colors ${markRingClass(false, isGreen)}`}>
                      <Avatar userId={shift.ownerId} name={shift.owner.name} size="xs" />
                    </span>
                    <span className="truncate">{shift.owner.name || "Unnamed"}</span>
                    <span className="ml-auto flex-none text-micro text-ink-400">
                      {shift.startTime}–{shift.endTime}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function QuickEditPopover({
  shift,
  onSave,
  onDismiss,
}: {
  shift: Shift;
  onSave: (shiftId: string, patch: { startTime: string; endTime: string }) => Promise<boolean>;
  onDismiss: () => void;
}) {
  const [startTime, setStartTime] = useState(shift.startTime);
  const [endTime, setEndTime] = useState(shift.endTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(false);
    const ok = await onSave(shift.id, { startTime, endTime });
    setSaving(false);
    if (ok) onDismiss();
    else setError(true);
  }

  return (
    <div
      className="absolute left-0 top-full z-30 mt-1 w-64 rounded-card border border-ink-200 bg-white p-3 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="mb-2 text-caption font-medium text-ink-600">Shift added — adjust the time?</p>
      <div className="flex items-center gap-1.5">
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-[6.5rem] rounded border border-ink-300 px-1.5 py-1 text-caption"
        />
        <span className="text-ink-400">to</span>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="w-[6.5rem] rounded border border-ink-300 px-1.5 py-1 text-caption"
        />
      </div>
      {error && <p className="mt-1.5 text-caption text-denied-400">Couldn't save that.</p>}
      <div className="mt-2 flex justify-end gap-1.5">
        <Button variant="ghost" className="px-2 py-1 text-caption" onClick={onDismiss}>
          Done
        </Button>
        <Button className="px-2 py-1 text-caption" disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
