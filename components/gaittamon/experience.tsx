"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import { useScrollProgress } from "@/hooks/use-scroll-progress"
import { ScouterUi } from "./scouter-ui"
import { CtaButton } from "./cta-button"

const Scene = dynamic(() => import("./scene").then((m) => m.Scene), {
  ssr: false,
})

// Smoothstep helper to fade overlay sections in/out around a center point.
function band(p: number, start: number, peak: number, end: number) {
  if (p <= start || p >= end) return 0
  if (p < peak) return (p - start) / (peak - start)
  return 1 - (p - peak) / (end - peak)
}

// Seamless, background-free panels: just the accent line + a soft text shadow
// so copy stays legible over the live 3D scene.
const panel =
  "max-w-md pl-6 [text-shadow:0_2px_18px_rgba(0,0,0,0.9)]"

export function Experience() {
  const progress = useScrollProgress()
  const progressRef = useRef(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  useEffect(() => {
    setReady(true)
  }, [])

  const heroOpacity = Math.max(0, 1 - progress / 0.12)
  const fusionOpacity = band(progress, 0.16, 0.27, 0.4)
  const anatomyOpacity = band(progress, 0.42, 0.54, 0.66)
  // One-way reveal driver for the scouter sequence (dots -> lines -> labels).
  const anatomyAppear = Math.min(1, Math.max(0, (progress - 0.44) / 0.16))
  const metaOpacity = band(progress, 0.68, 0.8, 0.92)

  return (
    <div className="relative">
      {/* Fixed 3D layer */}
      {ready && <Scene progressRef={progressRef} />}

      {/* Vignette / atmosphere on top of the canvas */}
      <div className="pointer-events-none fixed inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_45%,#050505_100%)]" />

      {/* Scouter HUD */}
      <ScouterUi opacity={anatomyOpacity} appear={anatomyAppear} />

      {/* ===== Stage 1: Hero ===== */}
      <section className="relative z-30 flex h-screen w-full items-center justify-center px-6">
        <motion.div
          className="flex flex-col items-center text-center"
          style={{ opacity: heroOpacity }}
        >
          <p className="mb-5 font-mono text-xs uppercase tracking-[0.5em] text-cyan-glow/80">
            The Fusion Trading Card Game
          </p>
          <h1 className="text-balance bg-gradient-to-b from-white via-white to-white/50 bg-clip-text font-sans text-6xl font-black tracking-tight text-transparent text-glow-cyan sm:text-8xl md:text-9xl">
            GAITTAMON
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg text-foreground/70 sm:text-xl">
            Fuse the Weak. Forge the Unstoppable.
          </p>
          <div className="mt-10">
            <CtaButton>Play Free Now</CtaButton>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-center"
          style={{ opacity: heroOpacity }}
        >
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.4em] text-cyan-glow/70">
            Scroll to Fuse
          </p>
          <motion.div
            className="mx-auto flex h-9 w-5 items-start justify-center rounded-full border border-cyan-glow/40 p-1"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          >
            <motion.span
              className="h-2 w-1 rounded-full bg-cyan-glow"
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        </motion.div>
      </section>

      {/* ===== Stage 2: Fusion (text left, card moves right) ===== */}
      <section className="relative z-30 flex h-screen w-full items-center justify-start px-6 sm:px-12 lg:px-20">
        <motion.div
          className={`border-l-2 border-l-purple-glow ${panel}`}
          style={{ opacity: fusionOpacity }}
        >
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-purple-glow">
            01 — Fusion
          </p>
          <h2 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Infinite Alchemy.
          </h2>
          <p className="mt-5 text-pretty leading-relaxed text-foreground/70">
            Combine Tier 1, 2, and 3 creatures to unlock devastating Tier 4, 5,
            and 6 titans. Every match is a step toward your next ultimate fusion.
          </p>
        </motion.div>
      </section>

      {/* ===== Stage 3: Anatomy (text left, card centered for scouter) ===== */}
      <section className="relative z-30 flex h-screen w-full items-center justify-start px-6 sm:px-12 lg:px-20">
        <motion.div
          className={`max-w-xs border-l-2 border-l-purple-glow ${panel}`}
          style={{ opacity: anatomyOpacity }}
        >
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-purple-glow">
            02 — Anatomy
          </p>
          <h2 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Master the Anatomy.
          </h2>
          <p className="mt-5 text-pretty leading-relaxed text-foreground/70">
            Every element matters. From the Exalted status to the inline stat
            bars, mastery of Gaittamon requires perfect synergy.
          </p>
        </motion.div>
      </section>

      {/* ===== Stage 4: Meta (center) ===== */}
      <section className="relative z-30 flex h-screen w-full items-center justify-center px-6">
        <motion.div
          className="max-w-lg text-center [text-shadow:0_2px_18px_rgba(0,0,0,0.9)]"
          style={{ opacity: metaOpacity }}
        >
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-cyan-glow">
            03 — Ranked
          </p>
          <h2 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            The Meta Never Sleeps.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-pretty leading-relaxed text-foreground/70">
            Take your fusions to the Ranked Ladder. Test your deck against
            endless combinations.
          </p>
          <div className="mt-9">
            <CtaButton variant="gold">Enter the Portal</CtaButton>
          </div>
        </motion.div>
      </section>

      {/* ===== Stage 5: Gameplay + Footer (normal scroll, opaque) ===== */}
      <GameplayFooter />
    </div>
  )
}

function GameplayFooter() {
  return (
    <section className="relative z-30 w-full">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-12 text-center">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.4em] text-cyan-glow/80">
            Gameplay
          </p>
          <h2 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            See the Fusion in Motion.
          </h2>
        </div>

        {/* Gameplay video placeholder */}
        <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-white/10 shadow-glow-purple">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0e0826] via-[#04141a] to-[#050505]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,color-mix(in_oklch,var(--cyan-glow)_22%,transparent),transparent_55%)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              aria-label="Play gameplay trailer"
              className="flex h-20 w-20 items-center justify-center rounded-full border border-cyan-glow/50 bg-[#06060a]/60 text-cyan-glow shadow-glow-cyan backdrop-blur-md transition-transform hover:scale-105"
            >
              <svg width="22" height="26" viewBox="0 0 22 26" fill="currentColor">
                <path d="M0 1.6c0-1.2 1.3-2 2.4-1.4l18 11.4a1.6 1.6 0 0 1 0 2.8l-18 11.4A1.6 1.6 0 0 1 0 24.4z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-12 sm:flex-row">
          <div className="text-center sm:text-left">
            <p className="font-sans text-2xl font-black tracking-tight text-foreground text-glow-cyan">
              GAITTAMON
            </p>
            <p className="mt-1 text-sm text-foreground/50">
              Fuse the Weak. Forge the Unstoppable.
            </p>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 font-mono text-xs uppercase tracking-[0.2em] text-foreground/60">
            <a href="#" className="transition-colors hover:text-cyan-glow">
              Play
            </a>
            <a href="#" className="transition-colors hover:text-cyan-glow">
              Cards
            </a>
            <a href="#" className="transition-colors hover:text-cyan-glow">
              Ranked
            </a>
            <a href="#" className="transition-colors hover:text-cyan-glow">
              Discord
            </a>
          </nav>
        </div>
        <div className="border-t border-white/5 py-6 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/30">
          © {new Date().getFullYear()} Gaittamon — All Rights Reserved
        </div>
      </footer>
    </section>
  )
}
