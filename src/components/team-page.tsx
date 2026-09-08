"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Avatar, Button, Card, ErrorState, LoadingState } from "@/components/ui";

type Member = { id: string; name: string; role: "ADMIN" | "MEMBER"; createdAt: string };
type Group = { id: string; name: string; inviteCode: string; createdAt: string };

export function TeamPage() {
  const { data: session, update: updateSession } = useSession();
  const myId = (session?.user as any)?.id;
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const [members, setMembers] = useState<Member[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, groupRes] = await Promise.all([fetch("/api/groups/members"), fetch("/api/groups")]);
      if (!membersRes.ok || !groupRes.ok) throw new Error("Couldn't load your team.");
      setMembers(await membersRes.json());
      setGroup(await groupRes.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const adminCount = members.filter((m) => m.role === "ADMIN").length;

  async function toggleRole(member: Member) {
    const nextRole = member.role === "ADMIN" ? "MEMBER" : "ADMIN";
    setBusyId(member.id);
    const res = await fetch(`/api/groups/members/${member.id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
    setBusyId(null);
    if (res.ok) await load();
  }

  function startEditName(current: string) {
    setNameDraft(current);
    setNameError(null);
    setEditingName(true);
  }

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setSavingName(true);
    setNameError(null);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setSavingName(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setNameError(body.error ?? "Couldn't save your name.");
      return;
    }
    setEditingName(false);
    // Session's name comes from the DB user row on every fetch — re-pull it
    // (rather than write session state directly) so the nav/avatars agree
    // with what actually saved.
    await Promise.all([updateSession(), load()]);
  }

  async function copyInviteCode() {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(group.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard permission denied or unavailable — the code is still shown on screen either way
    }
  }

  async function handleLeave() {
    setLeaving(true);
    await fetch("/api/groups/leave", { method: "POST" });
    // Full reload so the client session picks up the cleared groupId — same
    // pattern as onboarding-form.tsx after joining a group.
    window.location.href = "/";
  }

  if (loading) return <LoadingState label="Loading your team…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      {group && (
        <Card className="p-4">
          <h2 className="text-title font-medium text-ink-900">{group.name}</h2>
          <p className="mt-1 text-caption text-ink-500">Share this code so others can join your group</p>
          <div className="mt-2 flex items-center gap-2">
            <p className="rounded-card bg-ink-50 px-3 py-2 text-title font-semibold tracking-[0.3em] text-ink-900">
              {group.inviteCode}
            </p>
            <Button variant="secondary" onClick={copyInviteCode}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="mb-3 text-title font-medium text-ink-900">Members</h2>
        <ul className="space-y-2">
          {members.map((member) => {
            const isLastAdminSelf = member.id === myId && member.role === "ADMIN" && adminCount === 1;

            const isMe = member.id === myId;
            const editingThisRow = isMe && editingName;

            return (
              <li key={member.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Avatar userId={member.id} name={member.name} size="md" />
                  <div>
                    {editingThisRow ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          autoFocus
                          className="rounded-card border border-ink-300 px-2 py-1 text-label"
                        />
                        <Button
                          className="px-2 py-1 text-caption"
                          disabled={!nameDraft.trim() || savingName}
                          onClick={saveName}
                        >
                          {savingName ? "Saving…" : "Save"}
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-2 py-1 text-caption"
                          onClick={() => setEditingName(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <p className="text-label font-medium text-ink-900">
                        {member.name || "Unnamed"}
                        {isMe && (
                          <>
                            <span className="ml-1 text-ink-400">(you)</span>
                            <button
                              onClick={() => startEditName(member.name)}
                              className="ml-1.5 text-caption font-normal text-accent-600 hover:text-accent-700"
                            >
                              Edit
                            </button>
                          </>
                        )}
                      </p>
                    )}
                    {nameError && editingThisRow && <p className="mt-1 text-caption text-denied-400">{nameError}</p>}
                    {!editingThisRow && (
                      <span
                        className={`inline-block rounded-full border px-1.5 py-0.5 text-micro font-medium ${
                          member.role === "ADMIN"
                            ? "border-accent-500 bg-accent-100 text-accent-700"
                            : "border-ink-300 bg-ink-100 text-ink-600"
                        }`}
                      >
                        {member.role}
                      </span>
                    )}
                  </div>
                </div>

                {isAdmin && !editingThisRow && (
                  <Button
                    variant="secondary"
                    className="px-2.5 py-1 text-caption"
                    disabled={busyId === member.id || isLastAdminSelf}
                    title={isLastAdminSelf ? "Promote someone else first" : undefined}
                    onClick={() => toggleRole(member)}
                  >
                    {member.role === "ADMIN" ? "Demote" : "Promote"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <div>
        <Button variant="danger" onClick={() => setShowLeaveConfirm(true)}>
          Leave group
        </Button>
      </div>

      {showLeaveConfirm && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink-950/50 p-4"
          onClick={() => setShowLeaveConfirm(false)}
        >
          <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <p className="mb-4 text-body text-ink-700">
              Leaving removes all your shifts and swap requests, and returns any swaps or trades you were part of
              to the market for others to pick up.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowLeaveConfirm(false)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={leaving} onClick={handleLeave}>
                {leaving ? "Leaving…" : "Leave group"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
