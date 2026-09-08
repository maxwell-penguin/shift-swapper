"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";

export function OnboardingForm() {
  const [displayName, setDisplayName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdGroup, setCreatedGroup] = useState<{ name: string; inviteCode: string } | null>(null);

  const nameReady = displayName.trim().length > 0;

  async function handleCreate() {
    if (!nameReady || !groupName.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: displayName.trim(), groupName: groupName.trim() }),
    });
    setCreating(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't create the group.");
      return;
    }
    setCreatedGroup(await res.json());
  }

  async function handleJoin() {
    if (!nameReady || !inviteCode.trim()) return;
    setJoining(true);
    setError(null);
    const res = await fetch("/api/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: displayName.trim(), inviteCode: inviteCode.trim() }),
    });
    setJoining(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't find a group with that code.");
      return;
    }
    // Full reload so the client session (and every server-gated page) picks
    // up the newly-set groupId — this only ever happens once per person.
    window.location.href = "/dashboard";
  }

  if (createdGroup) {
    return (
      <Card className="w-full max-w-sm p-6 text-center">
        <p className="text-sm text-slate-600">
          <strong className="text-slate-900">{createdGroup.name}</strong> is ready. Share this code so the rest of
          your group can join:
        </p>
        <p className="my-4 rounded-md bg-stone-50 py-3 text-2xl font-semibold tracking-[0.3em] text-slate-900">
          {createdGroup.inviteCode}
        </p>
        <Button className="w-full" onClick={() => (window.location.href = "/dashboard")}>
          Continue to your dashboard
        </Button>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      <label className="mb-1 block text-sm font-medium text-slate-700">Your name</label>
      <input
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Jamie Ortiz"
        className="mb-6 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
      />

      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-3 p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Create a new group</h2>
            <p className="text-xs text-slate-500">Start fresh — you&rsquo;ll get a code to invite everyone else.</p>
          </div>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name, e.g. Elm House"
            className="rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
          <Button disabled={!nameReady || !groupName.trim() || creating} onClick={handleCreate}>
            {creating ? "Creating…" : "Create group"}
          </Button>
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Join a group</h2>
            <p className="text-xs text-slate-500">Got an invite code from someone already using it?</p>
          </div>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="Invite code"
            maxLength={6}
            className="rounded-md border border-stone-300 px-3 py-2 text-sm uppercase tracking-widest"
          />
          <Button
            variant="secondary"
            disabled={!nameReady || !inviteCode.trim() || joining}
            onClick={handleJoin}
          >
            {joining ? "Joining…" : "Join group"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
