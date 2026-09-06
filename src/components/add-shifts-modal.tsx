"use client";

import { useState } from "react";

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
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to add shift");
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
    <div className="fixed inset-0 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[80vh] w-[32rem] overflow-y-auto rounded-md bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Add my shifts</h2>

        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="date"
                value={row.date}
                onChange={(e) => updateRow(i, { date: e.target.value })}
                className="rounded border px-2 py-1"
              />
              <input
                type="time"
                value={row.startTime}
                onChange={(e) => updateRow(i, { startTime: e.target.value })}
                className="w-24 rounded border px-2 py-1"
              />
              <span>&ndash;</span>
              <input
                type="time"
                value={row.endTime}
                onChange={(e) => updateRow(i, { endTime: e.target.value })}
                className="w-24 rounded border px-2 py-1"
              />
              <button
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                disabled={rows.length === 1}
                className="px-2 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                aria-label="Remove date"
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        <button onClick={() => setRows((prev) => [...prev, emptyRow()])} className="mt-3 text-sm text-blue-600">
          + Add another date
        </button>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1">
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={submit}
            className="rounded-md bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save shifts"}
          </button>
        </div>
      </div>
    </div>
  );
}
