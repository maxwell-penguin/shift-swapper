"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

type Row = { date: string; startTime: string; endTime: string };

const emptyRow = (): Row => ({ date: "", startTime: "19:00", endTime: "08:00" });

export function AddShiftsModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function submit() {
    const toSubmit = rows.filter((r) => r.date);
    if (toSubmit.length === 0) return;

    setSaving(true);
    setError(null);
    try {
      for (const row of toSubmit) {
        const res = await fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Couldn't save that shift.");
      }
      onAdded();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-md bg-white p-5 shadow-lg sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Add my shifts</h2>

        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={row.date}
                onChange={(e) => updateRow(i, { date: e.target.value })}
                className="rounded border border-stone-300 px-2 py-1.5 text-sm"
              />
              <input
                type="time"
                value={row.startTime}
                onChange={(e) => updateRow(i, { startTime: e.target.value })}
                className="w-[6.5rem] rounded border border-stone-300 px-2 py-1.5 text-sm"
              />
              <span className="text-slate-400">to</span>
              <input
                type="time"
                value={row.endTime}
                onChange={(e) => updateRow(i, { endTime: e.target.value })}
                className="w-[6.5rem] rounded border border-stone-300 px-2 py-1.5 text-sm"
              />
              <button
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                disabled={rows.length === 1}
                className="ml-auto px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                aria-label="Remove date"
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => setRows((prev) => [...prev, emptyRow()])}
          className="mt-3 text-sm font-medium text-amber-600 hover:text-amber-700"
        >
          Add another date
        </button>

        {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={submit}>
            {saving ? "Saving…" : "Save shifts"}
          </Button>
        </div>
      </div>
    </div>
  );
}
