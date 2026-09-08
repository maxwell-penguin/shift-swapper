"use client";

import { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { format } from "date-fns";
import { colorForUser, initialsFor } from "@/lib/user-color";
import { Button } from "@/components/ui";

export type Shift = {
  id: string;
  ownerId: string;
  date: string;
  startTime: string;
  endTime: string;
  owner: { id: string; name: string };
};

const MAX_VISIBLE_CHIPS = 4;

type DayCellProps = {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
  shifts: Shift[];
  currentUserId?: string;
  quickEditShift: Shift | null;
  onSaveQuickEdit: (shiftId: string, patch: { startTime: string; endTime: string }) => Promise<boolean>;
  onDismissQuickEdit: () => void;
  onRequestSwap: (shift: Shift) => void;
  onRemove: (shift: Shift) => Promise<string | null>;
};

export function DayCell({
  date,
  inCurrentMonth,
  isToday,
  shifts,
  currentUserId,
  quickEditShift,
  onSaveQuickEdit,
  onDismissQuickEdit,
  onRequestSwap,
  onRemove,
}: DayCellProps) {
  const dateKey = format(date, "yyyy-MM-dd");
  const { setNodeRef, isOver } = useDroppable({ id: dateKey });

  const visible = shifts.slice(0, MAX_VISIBLE_CHIPS);
  const overflow = shifts.length - visible.length;
  const editingHere = quickEditShift && shifts.some((s) => s.id === quickEditShift.id);

  return (
    <div
      ref={setNodeRef}
      className={`relative flex min-h-[5.5rem] flex-col gap-1.5 border-b border-r border-stone-200 p-1.5 transition-colors sm:min-h-[7rem] sm:p-2 ${
        inCurrentMonth ? "bg-white" : "bg-stone-50"
      } ${isOver ? "bg-amber-50 ring-2 ring-inset ring-amber-400" : ""}`}
    >
      <span
        className={`self-end text-xs sm:text-sm ${
          isToday
            ? "flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 font-semibold text-white sm:h-6 sm:w-6"
            : inCurrentMonth
              ? "text-slate-600"
              : "text-slate-300"
        }`}
      >
        {format(date, "d")}
      </span>

      <div className="flex flex-wrap gap-1">
        {visible.map((shift) => (
          <ShiftChip
            key={shift.id}
            shift={shift}
            isMine={shift.ownerId === currentUserId}
            onRequestSwap={onRequestSwap}
            onRemove={onRemove}
          />
        ))}
        {overflow > 0 && (
          <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-stone-200 px-1 text-[10px] font-medium text-slate-600 sm:h-7">
            +{overflow}
          </span>
        )}
      </div>

      {editingHere && quickEditShift && (
        <QuickEditPopover
          shift={quickEditShift}
          onSave={onSaveQuickEdit}
          onDismiss={onDismissQuickEdit}
        />
      )}
    </div>
  );
}

function ShiftChip({
  shift,
  isMine,
  onRequestSwap,
  onRemove,
}: {
  shift: Shift;
  isMine: boolean;
  onRequestSwap: (shift: Shift) => void;
  onRemove: (shift: Shift) => Promise<string | null>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const color = colorForUser(shift.ownerId);

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

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => isMine && setMenuOpen((v) => !v)}
        title={`${shift.owner.name || "Unnamed"}, ${shift.startTime}–${shift.endTime}`}
        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-white transition-transform sm:h-7 sm:w-7 sm:text-xs ${
          isMine ? "cursor-pointer hover:scale-110" : "cursor-default"
        }`}
        style={{ backgroundColor: color.hex, color: color.text }}
      >
        {initialsFor(shift.owner.name)}
      </button>

      {menuOpen && (
        <div className="absolute left-0 top-full z-30 mt-1 w-44 rounded-md border border-stone-200 bg-white p-1 text-sm shadow-lg">
          <p className="px-2 py-1 text-xs text-slate-400">
            {shift.startTime}–{shift.endTime}
          </p>
          <button
            onClick={() => {
              onRequestSwap(shift);
              setMenuOpen(false);
            }}
            className="block w-full rounded px-2 py-1.5 text-left text-slate-700 hover:bg-stone-50"
          >
            Request a swap
          </button>
          <button
            disabled={removing}
            onClick={handleRemove}
            className="block w-full rounded px-2 py-1.5 text-left text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            {removing ? "Removing…" : "Remove"}
          </button>
          {error && <p className="px-2 pb-1 pt-0.5 text-xs text-rose-600">{error}</p>}
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
    <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-md border border-stone-200 bg-white p-3 shadow-lg">
      <p className="mb-2 text-xs font-medium text-slate-600">Shift added — adjust the time?</p>
      <div className="flex items-center gap-1.5">
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-[6.5rem] rounded border border-stone-300 px-1.5 py-1 text-xs"
        />
        <span className="text-slate-400">to</span>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="w-[6.5rem] rounded border border-stone-300 px-1.5 py-1 text-xs"
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-rose-600">Couldn't save that.</p>}
      <div className="mt-2 flex justify-end gap-1.5">
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onDismiss}>
          Done
        </Button>
        <Button className="px-2 py-1 text-xs" disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
