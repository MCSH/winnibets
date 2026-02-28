import type { ReactNode } from "react";

export default function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-ink-light border border-ink-border/60 rounded-lg p-6 ${className}`}
    >
      {children}
    </div>
  );
}
