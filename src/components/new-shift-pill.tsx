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
      className={`flex touch-none select-none items-center gap-2 rounded-full bg-accent-500 px-4 py-2 text-label font-medium text-ink-900 shadow-sm transition-colors hover:bg-accent-300 active:cursor-grabbing ${
        isDragging ? "animate-drag-lift" : "cursor-grab"
      }`}
    >
      <span className="text-base leading-none">+</span>
      New shift
    </button>
  );
}

export function NewShiftPillPreview() {
  return (
    <div className="flex items-center gap-2 rounded-full bg-accent-500 px-4 py-2 text-label font-medium text-ink-900 shadow-lg">
      <span className="text-base leading-none">+</span>
      New shift
    </div>
  );
}
