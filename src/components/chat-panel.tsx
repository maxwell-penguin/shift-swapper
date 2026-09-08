"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { colorForUser, initialsFor } from "@/lib/user-color";
import { ErrorState, LoadingState } from "@/components/ui";

const POLL_MS = 5000;
const NEAR_BOTTOM_PX = 80;

type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
};

export function ChatPanel() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const loadMessages = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetch("/api/messages");
      if (!res.ok) throw new Error("Couldn't load messages.");
      const data: ChatMessage[] = await res.json();
      setMessages(data);
      setError(null);
    } catch (e: any) {
      if (isInitial) setError(e.message);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages(true);
    const id = setInterval(() => loadMessages(false), POLL_MS);
    return () => clearInterval(id);
  }, [loadMessages]);

  useEffect(() => {
    const list = listRef.current;
    if (list && stickToBottomRef.current) list.scrollTop = list.scrollHeight;
  }, [messages]);

  function handleScroll() {
    const list = listRef.current;
    if (!list) return;
    stickToBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM_PX;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    setDraft("");
    stickToBottomRef.current = true;
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setSending(false);
    if (res.ok) await loadMessages(false);
    else setDraft(body);
  }

  if (loading) return <LoadingState label="Loading chat…" />;
  if (error) return <ErrorState message={error} onRetry={() => loadMessages(true)} />;

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} onScroll={handleScroll} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No messages yet — say hi.</p>
        ) : (
          messages.map((m) => {
            const color = colorForUser(m.author.id);
            return (
              <div key={m.id} className="flex gap-2">
                <span
                  className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{ backgroundColor: color.hex, color: color.text }}
                >
                  {initialsFor(m.author.name)}
                </span>
                <div className="min-w-0">
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-xs font-medium text-slate-700">
                      {m.author.id === userId ? "You" : m.author.name || "Unnamed"}
                    </span>
                    <span className="text-[10px] text-slate-400">{format(new Date(m.createdAt), "h:mm a")}</span>
                  </p>
                  <p className="break-words text-sm text-slate-800">{m.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-stone-200 p-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the group…"
          maxLength={2000}
          className="min-w-0 flex-1 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-900 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
