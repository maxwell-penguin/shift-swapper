"use client";

import { format } from "date-fns";
import { parseDateOnly } from "@/lib/dates";
import { colorForUser, initialsFor } from "@/lib/user-color";
import { Button, Card } from "@/components/ui";

export type Person = { id: string; name: string };
export type ShiftRef = { id: string; date: string; startTime: string; endTime: string };

type MatchedWithRef = { id: string; userId: string; user: Person; giveShiftId: string; giveShift: ShiftRef };

export type CyclePreference = {
  id: string;
  userId: string;
  user: Person;
  giveShiftId: string;
  giveShift: ShiftRef;
  matchedWithId: string | null;
  matchedWith: MatchedWithRef | null;
  agreedAt: string | null;
};

export type SwapCycleT = {
  id: string;
  status: string;
  preferences: CyclePreference[];
};

const STATUS_STYLE: Record<string, string> = {
  proposed: "bg-stone-100 text-slate-600 border-stone-300",
  all_agreed: "bg-amber-100 text-amber-800 border-amber-400",
  pending_approval: "bg-amber-100 text-amber-800 border-amber-400",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-400",
  denied: "bg-rose-100 text-rose-800 border-rose-400",
};

const STATUS_LABEL: Record<string, string> = {
  proposed: "Awaiting confirmations",
  all_agreed: "Awaiting RLC approval",
  pending_approval: "Awaiting RLC approval",
  approved: "Approved",
  denied: "Denied",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? ""}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// Walks the "gives to" direction starting from an arbitrary member and
// re-appends the start at the end, so the chain visually closes the loop:
// A -> B -> C -> A.
function buildChain(preferences: CyclePreference[]): CyclePreference[] {
  if (preferences.length === 0) return [];
  const start = preferences[0];
  const chain = [start];
  let current = start;
  for (let i = 0; i < preferences.length; i++) {
    const next = preferences.find((p) => p.matchedWithId === current.id);
    if (!next || next.id === start.id) break;
    chain.push(next);
    current = next;
  }
  chain.push(start);
  return chain;
}

function CycleDiagram({ preferences }: { preferences: CyclePreference[] }) {
  const chain = buildChain(preferences);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {chain.map((pref, i) => {
        const color = colorForUser(pref.userId);
        return (
          <div key={`${pref.id}-${i}`} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-300">&rarr;</span>}
            <span
              title={pref.user.name || "Unnamed"}
              className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-semibold"
              style={{ backgroundColor: color.hex, color: color.text }}
            >
              {initialsFor(pref.user.name)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CycleCard({
  cycle,
  currentUserId,
  isAdmin = false,
  onConfirm,
  onApprove,
  onDeny,
  busy,
}: {
  cycle: SwapCycleT;
  currentUserId?: string;
  isAdmin?: boolean;
  onConfirm: (cycleId: string) => void;
  onApprove: (cycleId: string) => void;
  onDeny: (cycleId: string) => void;
  busy: boolean;
}) {
  const myPref = cycle.preferences.find((p) => p.userId === currentUserId);
  const isParticipant = !!myPref;
  const iHaveConfirmed = !!myPref?.agreedAt;
  const isPending = cycle.status === "proposed";
  const isAllAgreed = cycle.status === "all_agreed" || cycle.status === "pending_approval";
  const showRlcButtons = isAllAgreed && isAdmin;

  return (
    <Card className={`p-4 ${isAllAgreed ? "border-amber-300 bg-amber-50" : ""}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">{cycle.preferences.length}-way trade</p>
        <StatusBadge status={cycle.status} />
      </div>

      <CycleDiagram preferences={cycle.preferences} />

      <ul className="mt-3 space-y-1.5 text-sm">
        {cycle.preferences.map((pref) => (
          <li key={pref.id} className="flex flex-wrap items-baseline gap-x-1.5 text-slate-700">
            <span className="font-medium text-slate-900">{pref.user.name || "Unnamed"}</span>
            <span className="text-slate-500">gives</span>
            <span>
              {format(parseDateOnly(pref.giveShift.date), "MMM d")}, {pref.giveShift.startTime}–
              {pref.giveShift.endTime}
            </span>
            {pref.matchedWith && (
              <>
                <span className="text-slate-500">receives</span>
                <span>
                  {format(parseDateOnly(pref.matchedWith.giveShift.date), "MMM d")},{" "}
                  {pref.matchedWith.giveShift.startTime}–{pref.matchedWith.giveShift.endTime}
                </span>
                <span className="text-slate-500">from {pref.matchedWith.user.name || "Unnamed"}</span>
              </>
            )}
            <span className={pref.agreedAt ? "text-emerald-600" : "text-slate-400"}>
              {pref.agreedAt ? "confirmed" : "waiting"}
            </span>
          </li>
        ))}
      </ul>

      {(isParticipant || showRlcButtons) && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {isParticipant && isPending && !iHaveConfirmed && (
            <Button disabled={busy} onClick={() => onConfirm(cycle.id)}>
              Confirm your part
            </Button>
          )}
          {isParticipant && isPending && iHaveConfirmed && (
            <p className="text-sm text-slate-500">Waiting on the others to confirm…</p>
          )}
          {showRlcButtons && (
            <>
              <Button variant="success" disabled={busy} onClick={() => onApprove(cycle.id)}>
                RLC approved
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => onDeny(cycle.id)}>
                RLC denied
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
