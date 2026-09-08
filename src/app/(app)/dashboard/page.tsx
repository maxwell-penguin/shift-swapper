"use client";

import dynamic from "next/dynamic";

// dnd-kit's useDraggable assigns its a11y-description id from a module-level
// counter that isn't guaranteed to match between the server render and the
// client's first render, which throws a hydration warning on this SSR'd page.
// The grid is auth-gated and fetches all its own data client-side anyway, so
// there's nothing worth server-rendering here — skip SSR for it entirely.
const DashboardGrid = dynamic(() => import("@/components/dashboard-grid").then((m) => m.DashboardGrid), {
  ssr: false,
});

export default function DashboardPage() {
  return <DashboardGrid />;
}
