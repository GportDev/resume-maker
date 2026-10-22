import { LoaderCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "destructive";
export type ButtonSize = "sm" | "md";

const base =
  "pressable inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-medium";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-exhibit text-sheet hover:bg-exhibit-deep",
  secondary:
    "border border-rule-strong bg-field text-ink hover:border-ink-3 hover:bg-sheet-sunk",
  ghost: "text-ink-2 hover:bg-board-deep/60 hover:text-ink",
  danger:
    "border border-danger/50 bg-field text-danger hover:border-danger hover:bg-danger-tint",
  destructive: "bg-danger text-sheet hover:bg-danger/90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[0.8125rem]",
  md: "h-9 px-3.5 text-sm",
};

export function buttonClass({
  variant = "secondary",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();
}

export function Button({
  variant,
  size,
  pending = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={buttonClass({ variant, size, className })}
      {...props}
    >
      {pending ? (
        <LoaderCircle
          aria-hidden="true"
          className="size-4 animate-spin [animation-duration:600ms]"
        />
      ) : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  children,
  ...props
}: LinkProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}) {
  return (
    <Link className={buttonClass({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}

/** A text link that stands alone (not inside a sentence) with a 24px target. */
export const standaloneLinkClass =
  "inline-flex min-h-[24px] items-center rounded-[2px] font-medium text-exhibit underline-offset-3 hover:text-exhibit-deep hover:underline";

export const textLinkClass =
  "rounded-[2px] font-medium text-exhibit underline-offset-3 hover:text-exhibit-deep hover:underline";
