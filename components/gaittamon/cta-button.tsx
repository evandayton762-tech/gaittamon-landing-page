"use client"

import type { ReactNode } from "react"

export function CtaButton({
  children,
  variant = "cyan",
}: {
  children: ReactNode
  variant?: "cyan" | "gold"
}) {
  const glow =
    variant === "gold"
      ? "border-gold/60 text-gold shadow-glow-purple hover:bg-gold/10"
      : "border-cyan-glow/60 text-cyan-glow shadow-glow-cyan hover:bg-cyan-glow/10"

  return (
    <button
      type="button"
      className={`group relative inline-flex items-center gap-2 rounded-full border bg-[#06060a]/60 px-8 py-3.5 font-mono text-sm font-medium uppercase tracking-[0.2em] backdrop-blur-md transition-all duration-300 hover:scale-[1.03] ${glow}`}
    >
      <span className="relative z-10">{children}</span>
      <span className="relative z-10 transition-transform duration-300 group-hover:translate-x-1">
        →
      </span>
    </button>
  )
}
