"use client";

import { useDraggable } from "@dnd-kit/core";

export const NEW_SHIFT_DRAG_ID = "new-shift";

export function NewShiftPill() {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: NEW_SHIFT_DRAG_ID });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex touch-none select-none items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition-all hover:bg-amber-400 hover:shadow-md active:cursor-grabbing ${
        isDragging ? "opacity-30" : "cursor-grab"
      }`}
    >
      <span className="text-base leading-none">+</span>
      New shift
    </button>
  );
}

export function NewShiftPillPreview() {
  return (
    <div className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 shadow-lg">
      <span className="text-base leading-none">+</span>
      New shift
    </div>
  );
}
