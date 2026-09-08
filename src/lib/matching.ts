// Top Trading Cycles matcher for the multi-way Swap Market.
//
// Each open preference points to its most-preferred still-available option
// (specific shiftIds tried first, in listed order; date-range/time-of-day is
// a fallback filter used only if none of those is available). Every node has
// out-degree at most 1, so following pointers from any node either dead-ends
// or loops back on itself — a loop is a valid trade. Remove matched nodes and
// repeat, since removing one cycle can free up pointers to form another.
//
// No preference ranking beyond "listed order" / "soonest date first" — there's
// no signal for anything richer than that here.

export type PreferenceNode = {
  id: string;
  userId: string;
  groupId: string;
  giveShiftId: string;
  giveShiftDate: Date;
  giveShiftStartTime: string;
  acceptableShiftIds: string[];
  acceptableFromDate: Date | null;
  acceptableToDate: Date | null;
  acceptableTimeOfDay: string | null;
};

export type CycleMatch = { preferenceId: string; matchedWithId: string };

export function timeOfDayBucket(startTime: string): "morning" | "afternoon" | "evening" | "overnight" {
  const hour = Number(startTime.slice(0, 2));
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 19) return "evening";
  return "overnight"; // 19:00-04:59 — this app's standard don shift starts at 19:00
}

function pickPreferredTarget(node: PreferenceNode, remaining: Map<string, PreferenceNode>): PreferenceNode | null {
  // groupId is checked here too, not just by whoever calls findTradeCycles —
  // a cross-group match should be structurally impossible even if some future
  // caller forgets to pre-filter its input by group.
  const candidates = [...remaining.values()].filter(
    (t) => t.id !== node.id && t.userId !== node.userId && t.groupId === node.groupId,
  );

  if (node.acceptableShiftIds.length > 0) {
    for (const shiftId of node.acceptableShiftIds) {
      const match = candidates.find((t) => t.giveShiftId === shiftId);
      if (match) return match;
    }
  }

  if (node.acceptableFromDate || node.acceptableToDate || node.acceptableTimeOfDay) {
    const inRange = candidates
      .filter(
        (t) =>
          (!node.acceptableFromDate || t.giveShiftDate >= node.acceptableFromDate) &&
          (!node.acceptableToDate || t.giveShiftDate <= node.acceptableToDate) &&
          (!node.acceptableTimeOfDay || timeOfDayBucket(t.giveShiftStartTime) === node.acceptableTimeOfDay),
      )
      .sort((a, b) => a.giveShiftDate.getTime() - b.giveShiftDate.getTime());
    if (inRange.length > 0) return inRange[0];
  }

  return null;
}

/**
 * Returns every trade cycle found, each as an array of {preferenceId,
 * matchedWithId} pairs — matchedWithId is the preference whose giveShift that
 * person will receive. A 2-entry cycle is a direct swap; longer cycles are
 * the multi-way trades this matcher exists for.
 */
export function findTradeCycles(nodes: PreferenceNode[]): CycleMatch[][] {
  const remaining = new Map(nodes.map((n) => [n.id, n]));
  const cycles: CycleMatch[][] = [];

  while (remaining.size > 0) {
    const pointer = new Map<string, string>();
    for (const node of remaining.values()) {
      const target = pickPreferredTarget(node, remaining);
      if (target) pointer.set(node.id, target.id);
    }
    if (pointer.size === 0) break;

    const visited = new Set<string>();
    let cycle: string[] | null = null;

    for (const startId of remaining.keys()) {
      if (visited.has(startId)) continue;

      const path: string[] = [];
      const pathIndex = new Map<string, number>();
      let cur: string | undefined = startId;

      while (cur !== undefined && !visited.has(cur)) {
        if (pathIndex.has(cur)) {
          cycle = path.slice(pathIndex.get(cur)!);
          break;
        }
        pathIndex.set(cur, path.length);
        path.push(cur);
        cur = pointer.get(cur);
      }

      path.forEach((id) => visited.add(id));
      if (cycle) break;
    }

    if (!cycle) break;

    cycles.push(cycle.map((id) => ({ preferenceId: id, matchedWithId: pointer.get(id)! })));
    cycle.forEach((id) => remaining.delete(id));
  }

  return cycles;
}
