"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui";

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const result = await signIn("email", { email, redirect: false });
    setStatus(result?.error ? "error" : "sent");
  }

  if (status === "sent") {
    return (
      <p className="mt-2 max-w-xs text-body text-ink-600">
        Check your inbox — we sent a sign-in link to <strong>{email}</strong>.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 flex w-full max-w-xs flex-col gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="rounded-card border border-ink-300 px-3 py-2 text-label"
      />
      <Button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send magic link"}
      </Button>
      {status === "error" && <p className="text-label text-denied-700">Couldn't send that link. Try again.</p>}
    </form>
  );
}
