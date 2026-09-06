import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "success" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-amber-500 text-slate-900 hover:bg-amber-400",
  secondary: "border border-stone-300 bg-white text-slate-700 hover:bg-stone-50",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
  ghost: "text-slate-500 hover:text-slate-800",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-md border border-stone-200 bg-white ${className}`}>{children}</div>;
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <p className="py-10 text-center text-sm text-slate-500">{label}</p>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <p className="mb-3">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
