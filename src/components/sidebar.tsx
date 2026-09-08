"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { ChatPanel } from "@/components/chat-panel";
import { SwapsList } from "@/components/swaps-list";

const TABS = [
  { id: "chat", label: "Chat" },
  { id: "requests", label: "Requests" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function Sidebar() {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <Card className="flex h-[28rem] w-full flex-none flex-col overflow-hidden lg:h-[36rem] lg:w-80">
      <div className="flex border-b border-ink-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 border-b-2 px-3 py-2.5 text-label font-medium transition-colors ${
              tab === t.id
                ? "border-accent-500 text-ink-900"
                : "border-transparent text-ink-400 hover:text-ink-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "chat" ? (
        <ChatPanel />
      ) : (
        <div className="scrollbar-thin flex-1 overflow-y-auto p-3">
          <SwapsList compact />
        </div>
      )}
    </Card>
  );
}
