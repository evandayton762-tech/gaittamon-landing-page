"use client"

import { motion } from "framer-motion"

function ScoutTag({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <div
      className={`pointer-events-none absolute flex items-center gap-2 ${className}`}
    >
      <span className="relative flex h-2.5 w-2.5">
        <span
          className="absolute inline-flex h-full w-full rounded-full bg-cyan-glow"
          style={{ animation: "scout-pulse 1.6s ease-in-out infinite" }}
        />
      </span>
      <span className="whitespace-nowrap rounded-sm border border-cyan-glow/50 bg-[#04141a]/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-glow shadow-glow-cyan backdrop-blur-sm sm:text-xs">
        {label}
      </span>
    </div>
  )
}

/**
 * Dragon-Ball "scouter" style HUD that points at parts of the 3D card.
 * Visible only during the anatomy stage; opacity controlled by parent.
 */
export function ScouterUi({ opacity }: { opacity: number }) {
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-20"
      style={{ opacity }}
    >
      {/* Reticle bracket framing the card */}
      <svg
        className="absolute left-1/2 top-1/2 h-[70vh] w-[70vh] -translate-x-1/2 -translate-y-1/2 text-cyan-glow/40"
        viewBox="0 0 100 100"
        fill="none"
      >
        <path d="M8 22 V8 H22" stroke="currentColor" strokeWidth="0.6" />
        <path d="M92 22 V8 H78" stroke="currentColor" strokeWidth="0.6" />
        <path d="M8 78 V92 H22" stroke="currentColor" strokeWidth="0.6" />
        <path d="M92 78 V92 H78" stroke="currentColor" strokeWidth="0.6" />
        {/* connector lines toward tags */}
        <line x1="34" y1="30" x2="20" y2="22" stroke="currentColor" strokeWidth="0.4" />
        <line x1="66" y1="50" x2="82" y2="50" stroke="currentColor" strokeWidth="0.4" />
        <line x1="50" y1="74" x2="50" y2="86" stroke="currentColor" strokeWidth="0.4" />
      </svg>

      {/* Top-left of card */}
      <ScoutTag
        label="Mystitoad (Exalted)"
        className="left-[14%] top-[20%] sm:left-[24%] sm:top-[22%]"
      />
      {/* Middle-right of card */}
      <ScoutTag
        label="Lv. 20 · Tier 6"
        className="right-[10%] top-[48%] sm:right-[22%]"
      />
      {/* Bottom of card */}
      <ScoutTag
        label="Inline Stat Bar: Icons · HP · Ticks · Abilities"
        className="bottom-[18%] left-1/2 -translate-x-1/2 sm:bottom-[20%]"
      />
    </motion.div>
  )
}
