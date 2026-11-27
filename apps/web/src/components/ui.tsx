import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type ButtonKind = "primary" | "secondary" | "danger" | "quiet";

const BUTTON_BASE =
  "inline-flex min-h-10 items-center justify-center gap-2 border px-4 text-sm font-semibold " +
  "transition-colors duration-150 ease-out disabled:opacity-55";

const BUTTON_KINDS: Record<ButtonKind, string> = {
  primary: "border-ink bg-ink text-leaf hover:bg-[#3a3a3a] active:bg-black",
  secondary: "border-ink bg-leaf text-ink hover:bg-wash active:bg-hair",
  danger:
    "border-rubric bg-rubric text-leaf hover:bg-rubric-deep hover:border-rubric-deep active:bg-rubric-deep",
  quiet:
    "min-h-8 border-transparent bg-transparent px-2 text-ink underline underline-offset-4 hover:text-rubric-deep",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: ButtonKind;
  /** Shown in place of the label while the action is running. */
  busyLabel?: string;
  busy?: boolean;
}

export function Button({
  kind = "secondary",
  busy = false,
  busyLabel,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${BUTTON_BASE} ${BUTTON_KINDS[kind]} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && busyLabel !== undefined ? busyLabel : children}
    </button>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
  id: string;
}

export function Field({ label, hint, error, id, className = "", ...rest }: FieldProps) {
  const hintId = hint === undefined || error ? undefined : `${id}-hint`;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        className={`min-h-11 border bg-leaf px-3 text-base text-ink placeholder:text-mute ${
          error ? "border-rubric" : "border-ink"
        } ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {hint !== undefined && !error && (
        <p id={hintId} className="text-sm text-mute">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-rubric-deep">
          {error}
        </p>
      )}
    </div>
  );
}

/** A problem, said plainly, with what to do about it. */
export function Problem({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="border border-rubric bg-rubric-wash px-3 py-2.5 text-sm font-medium text-rubric-deep"
    >
      {children}
    </p>
  );
}

/** A label joined to its value by a dotted leader. */
export function Leader({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline">
      <dt className="shrink-0 text-mute">{label}</dt>
      <span className="leader" aria-hidden="true" />
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

/** A line of placeholder shown while content loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse bg-hair ${className}`} />;
}

export function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none">
      <path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
