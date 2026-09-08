// Runnable regression check for the TTC matcher — no test framework is set up
// in this project, so this is a plain assert-based script instead of a test
// file. Run with: npx tsx src/lib/matching.self-check.ts
import assert from "node:assert";
import { findTradeCycles, timeOfDayBucket, type PreferenceNode } from "./matching";

function node(
  partial: Partial<PreferenceNode> & Pick<PreferenceNode, "id" | "userId" | "giveShiftId">,
): PreferenceNode {
  return {
    groupId: "g1",
    giveShiftDate: new Date("2026-09-01"),
    giveShiftStartTime: "19:00",
    acceptableShiftIds: [],
    acceptableFromDate: null,
    acceptableToDate: null,
    acceptableTimeOfDay: null,
    ...partial,
  };
}

// 3-way cycle via specific shiftIds: A wants B's shift, B wants C's, C wants A's.
{
  const nodes = [
    node({ id: "A", userId: "u1", giveShiftId: "sA", acceptableShiftIds: ["sB"] }),
    node({ id: "B", userId: "u2", giveShiftId: "sB", acceptableShiftIds: ["sC"] }),
    node({ id: "C", userId: "u3", giveShiftId: "sC", acceptableShiftIds: ["sA"] }),
  ];
  const cycles = findTradeCycles(nodes);
  assert.strictEqual(cycles.length, 1, "expected exactly one 3-way cycle");
  assert.strictEqual(cycles[0].length, 3, "expected all 3 preferences in the cycle");
  assert.deepStrictEqual(
    new Set(cycles[0].map((m) => m.preferenceId)),
    new Set(["A", "B", "C"]),
  );
  const byId = new Map(cycles[0].map((m) => [m.preferenceId, m.matchedWithId]));
  assert.strictEqual(byId.get("A"), "B");
  assert.strictEqual(byId.get("B"), "C");
  assert.strictEqual(byId.get("C"), "A");
}

// A direct 2-way swap is just a 2-node cycle.
{
  const nodes = [
    node({ id: "A", userId: "u1", giveShiftId: "sA", acceptableShiftIds: ["sB"] }),
    node({ id: "B", userId: "u2", giveShiftId: "sB", acceptableShiftIds: ["sA"] }),
  ];
  const cycles = findTradeCycles(nodes);
  assert.strictEqual(cycles.length, 1);
  assert.strictEqual(cycles[0].length, 2);
}

// A wants B's shift, but B doesn't want A's — no cycle, nobody matched.
{
  const nodes = [
    node({ id: "A", userId: "u1", giveShiftId: "sA", acceptableShiftIds: ["sB"] }),
    node({ id: "B", userId: "u2", giveShiftId: "sB", acceptableShiftIds: ["sC"] }),
  ];
  assert.strictEqual(findTradeCycles(nodes).length, 0);
}

// Date-range fallback (no specific shiftIds listed) still finds a cycle.
{
  const nodes = [
    node({
      id: "A",
      userId: "u1",
      giveShiftId: "sA",
      giveShiftDate: new Date("2026-09-10"),
      acceptableFromDate: new Date("2026-09-01"),
      acceptableToDate: new Date("2026-09-30"),
    }),
    node({
      id: "B",
      userId: "u2",
      giveShiftId: "sB",
      giveShiftDate: new Date("2026-09-15"),
      acceptableFromDate: new Date("2026-09-01"),
      acceptableToDate: new Date("2026-09-30"),
    }),
  ];
  assert.strictEqual(findTradeCycles(nodes).length, 1);
}

// Specific shiftIds are tried before falling back to the date range.
{
  const nodes = [
    node({
      id: "A",
      userId: "u1",
      giveShiftId: "sA",
      acceptableShiftIds: ["sZ"], // not present — should fall through to the date range below
      giveShiftDate: new Date("2026-09-10"),
      acceptableFromDate: new Date("2026-09-01"),
      acceptableToDate: new Date("2026-09-30"),
    }),
    node({
      id: "B",
      userId: "u2",
      giveShiftId: "sB",
      giveShiftDate: new Date("2026-09-15"),
      acceptableShiftIds: ["sA"],
    }),
  ];
  const cycles = findTradeCycles(nodes);
  assert.strictEqual(cycles.length, 1);
}

// A leftover person nobody can satisfy is excluded; the rest still cycle.
{
  const nodes = [
    node({ id: "A", userId: "u1", giveShiftId: "sA", acceptableShiftIds: ["sB"] }),
    node({ id: "B", userId: "u2", giveShiftId: "sB", acceptableShiftIds: ["sC"] }),
    node({ id: "C", userId: "u3", giveShiftId: "sC", acceptableShiftIds: ["sA"] }),
    node({ id: "D", userId: "u4", giveShiftId: "sD", acceptableShiftIds: ["sZ"] }),
  ];
  const cycles = findTradeCycles(nodes);
  assert.strictEqual(cycles.length, 1);
  assert.strictEqual(cycles[0].length, 3);
}

// Two independent cycles in the same batch are both found.
{
  const nodes = [
    node({ id: "A", userId: "u1", giveShiftId: "sA", acceptableShiftIds: ["sB"] }),
    node({ id: "B", userId: "u2", giveShiftId: "sB", acceptableShiftIds: ["sA"] }),
    node({ id: "C", userId: "u3", giveShiftId: "sC", acceptableShiftIds: ["sD"] }),
    node({ id: "D", userId: "u4", giveShiftId: "sD", acceptableShiftIds: ["sC"] }),
  ];
  assert.strictEqual(findTradeCycles(nodes).length, 2);
}

// Two groups whose shiftIds would form a perfect cycle if group weren't
// checked — must never match across the boundary, even though nothing else
// distinguishes them (same acceptableShiftIds shape, same dates).
{
  const nodes = [
    node({ id: "A", userId: "u1", groupId: "g1", giveShiftId: "sA", acceptableShiftIds: ["sB"] }),
    node({ id: "B", userId: "u2", groupId: "g2", giveShiftId: "sB", acceptableShiftIds: ["sA"] }),
  ];
  assert.strictEqual(findTradeCycles(nodes).length, 0, "cross-group nodes must never form a cycle");
}

// A 3-way cycle should still form within one group even when unmatchable
// nodes from a different group are mixed into the same batch.
{
  const nodes = [
    node({ id: "A", userId: "u1", groupId: "g1", giveShiftId: "sA", acceptableShiftIds: ["sB"] }),
    node({ id: "B", userId: "u2", groupId: "g1", giveShiftId: "sB", acceptableShiftIds: ["sC"] }),
    node({ id: "C", userId: "u3", groupId: "g1", giveShiftId: "sC", acceptableShiftIds: ["sA"] }),
    // Different group, and (deliberately) references group g1's shiftIds —
    // should neither join g1's cycle nor form one of its own.
    node({ id: "D", userId: "u4", groupId: "g2", giveShiftId: "sD", acceptableShiftIds: ["sA"] }),
    node({ id: "E", userId: "u5", groupId: "g2", giveShiftId: "sE", acceptableShiftIds: ["sD"] }),
  ];
  const cycles = findTradeCycles(nodes);
  assert.strictEqual(cycles.length, 1);
  assert.deepStrictEqual(
    new Set(cycles[0].map((m) => m.preferenceId)),
    new Set(["A", "B", "C"]),
  );
}

assert.strictEqual(timeOfDayBucket("19:00"), "overnight"); // this app's standard don shift
assert.strictEqual(timeOfDayBucket("08:00"), "morning");
assert.strictEqual(timeOfDayBucket("13:30"), "afternoon");
assert.strictEqual(timeOfDayBucket("18:00"), "evening");
assert.strictEqual(timeOfDayBucket("02:00"), "overnight");

console.log("matching self-check: all assertions passed");
