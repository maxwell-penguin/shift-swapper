"use client";

import { format } from "date-fns";
import { parseDateOnly } from "@/lib/dates";
import { Avatar, Button, Card, StatusBadge, type StatusTone } from "@/components/ui";

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

const STATUS_TONE: Record<string, StatusTone> = {
  proposed: "open",
  all_agreed: "mutual",
  pending_approval: "mutual",
  approved: "approved",
  denied: "denied",
};

const STATUS_LABEL: Record<string, string> = {
  proposed: "Awaiting confirmations",
  all_agreed: "Awaiting RLC approval",
  pending_approval: "Awaiting RLC approval",
  approved: "Approved",
  denied: "Denied",
};

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

// A 2-way trade is just "A gives, B gives back" — a plain row reads that
// fine. 3+ is genuinely a cycle, so it's laid out on a loop with directional
// arrows instead of a flat list, so the shape itself says "this comes back
// around" at a glance.
function CycleDiagram({ preferences, currentUserId }: { preferences: CyclePreference[]; currentUserId?: string }) {
  const chain = buildChain(preferences);
  const members = chain.slice(0, -1);

  if (members.length <= 2) {
    return (
      <div className="flex items-center justify-center gap-3 py-2">
        {members.map((pref, i) => (
          <div key={pref.id} className="flex items-center gap-3">
            {i > 0 && (
              <span className="text-title text-ink-300" aria-hidden>
                ⇄
              </span>
            )}
            <MemberAvatar pref={pref} isYou={pref.userId === currentUserId} />
          </div>
        ))}
      </div>
    );
  }

  const size = members.length <= 4 ? 180 : 220;
  const radius = members.length <= 4 ? 62 : 82;
  const center = size / 2;
  const positions = members.map((_, i) => {
    const angle = (i / members.length) * 2 * Math.PI - Math.PI / 2;
    return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
  });

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 text-ink-300">
        <defs>
          <marker id="cycle-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
          </marker>
        </defs>
        {positions.map((pos, i) => {
          const next = positions[(i + 1) % positions.length];
          const dx = next.x - pos.x;
          const dy = next.y - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const shrink = 22;
          const x1 = pos.x + (dx / dist) * shrink;
          const y1 = pos.y + (dy / dist) * shrink;
          const x2 = next.x - (dx / dist) * shrink;
          const y2 = next.y - (dy / dist) * shrink;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth={1.5}
              markerEnd="url(#cycle-arrow)"
            />
          );
        })}
      </svg>
      {members.map((pref, i) => (
        <div
          key={pref.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: positions[i].x, top: positions[i].y }}
        >
          <MemberAvatar pref={pref} isYou={pref.userId === currentUserId} />
        </div>
      ))}
    </div>
  );
}

function MemberAvatar({ pref, isYou }: { pref: CyclePreference; isYou: boolean }) {
  return (
    <div className={isYou ? "rounded-full ring-2 ring-accent-500 ring-offset-2" : ""}>
      <Avatar userId={pref.userId} name={pref.user.name} size="md" ring title={pref.user.name || "Unnamed"} />
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
    <Card className={`p-4 transition-colors ${isAllAgreed ? "border-mutual-400/40 bg-mutual-100" : ""}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-label font-medium text-ink-900">{cycle.preferences.length}-way trade</p>
        <StatusBadge tone={STATUS_TONE[cycle.status] ?? "open"} label={STATUS_LABEL[cycle.status] ?? cycle.status} />
      </div>

      <CycleDiagram preferences={cycle.preferences} currentUserId={currentUserId} />

      <ul className="mt-3 space-y-1.5 text-label">
        {cycle.preferences.map((pref) => (
          <li key={pref.id} className="flex flex-wrap items-baseline gap-x-1.5 text-ink-700">
            <span className="font-medium text-ink-900">{pref.user.name || "Unnamed"}</span>
            <span className="text-ink-500">gives</span>
            <span>
              {format(parseDateOnly(pref.giveShift.date), "MMM d")}, {pref.giveShift.startTime}–
              {pref.giveShift.endTime}
            </span>
            {pref.matchedWith && (
              <>
                <span className="text-ink-500">receives</span>
                <span>
                  {format(parseDateOnly(pref.matchedWith.giveShift.date), "MMM d")},{" "}
                  {pref.matchedWith.giveShift.startTime}–{pref.matchedWith.giveShift.endTime}
                </span>
                <span className="text-ink-500">from {pref.matchedWith.user.name || "Unnamed"}</span>
              </>
            )}
            <span className={pref.agreedAt ? "text-approved-400" : "text-ink-400"}>
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
            <p className="text-label text-ink-500">Waiting on the others to confirm…</p>
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
