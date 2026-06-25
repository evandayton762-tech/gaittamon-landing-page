"use client"

import type { ReactNode } from "react"

// Both the "cyan" and "gold" variants now render the same dark glassmorphism
// gold pill. The `variant` prop is kept for backwards compatibility only.
export function CtaButton({
  children,
}: {
  children: ReactNode
  variant?: "cyan" | "gold"
}) {
  return (
    <button
      type="button"
      className="cta-gold group relative inline-flex items-center gap-2 rounded-full px-8 py-3.5 font-mono text-sm font-medium uppercase tracking-[0.2em] backdrop-blur-md"
    >
      <span className="relative z-10">{children}</span>
      <span className="relative z-10 transition-transform duration-300 group-hover:translate-x-1">
        →
      </span>
    </button>
  )
}
