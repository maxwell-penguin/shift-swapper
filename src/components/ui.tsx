"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";
import { colorForUser, initialsFor } from "@/lib/user-color";

type Variant = "primary" | "secondary" | "danger" | "success" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-accent-500 text-ink-900 hover:bg-accent-300",
  secondary: "border border-ink-200 bg-white text-ink-700 hover:bg-ink-50",
  danger: "bg-denied-400 text-white hover:bg-denied-700",
  success: "bg-approved-400 text-white hover:bg-approved-700",
  ghost: "text-ink-500 hover:text-ink-800",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`rounded-card px-3 py-2 text-label font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-ink-200 bg-white ${className}`}>{children}</div>;
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <p className="py-10 text-center text-label text-ink-500">{label}</p>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-card border border-denied-400/30 bg-denied-100 p-4 text-label text-denied-700">
      <p className="mb-3">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

const AVATAR_SIZES = {
  xs: "h-6 w-6 text-micro",
  sm: "h-7 w-7 text-micro",
  md: "h-8 w-8 text-caption",
} as const;

export function Avatar({
  userId,
  name,
  size = "sm",
  ring = false,
  title,
  className = "",
}: {
  userId: string;
  name: string;
  size?: keyof typeof AVATAR_SIZES;
  ring?: boolean;
  title?: string;
  className?: string;
}) {
  const color = colorForUser(userId);
  return (
    <span
      title={title}
      className={`flex flex-none items-center justify-center rounded-full font-semibold ${AVATAR_SIZES[size]} ${
        ring ? "ring-2 ring-white" : ""
      } ${className}`}
      style={{ backgroundColor: color.hex, color: color.text }}
    >
      {initialsFor(name)}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      {icon && <div className="mb-1 text-ink-300">{icon}</div>}
      <p className="text-title font-medium text-ink-900">{title}</p>
      {body && <p className="max-w-xs text-label text-ink-500">{body}</p>}
      {action && (
        <Button className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export type StatusTone = "open" | "mutual" | "approved" | "denied";

const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  open: "bg-ink-100 text-ink-600 border-ink-300",
  mutual: "bg-mutual-100 text-mutual-700 border-mutual-400",
  approved: "bg-approved-100 text-approved-700 border-approved-400",
  denied: "bg-denied-100 text-denied-700 border-denied-400",
};

// `tone` is the presentational bucket (color); `label` is the exact copy for
// the caller's own status vocabulary (SwapRequest and SwapCycle each have
// their own status strings but map onto the same four tones). Keying the
// motion element by tone means a status flip replays the entrance transition
// instead of silently swapping text.
export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <motion.span
      key={tone}
      initial={{ opacity: 0.4, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-caption font-medium ${STATUS_TONE_CLASSES[tone]}`}
    >
      {label}
    </motion.span>
  );
}

// A one-shot entrance pulse for something that just appeared as a direct
// result of the current user's own action (e.g. a shift chip right after a
// drop) — not a page-load animation, and it only ever plays once per mount.
export function DropSettle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
