"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import dynamic from "next/dynamic"
import { useLenis } from "lenis/react"
import { ScouterUi } from "./scouter-ui"
import { CtaButton } from "./cta-button"
import { TopNav } from "./top-nav"

// Number of viewport-heights of scroll the card timeline plays across.
const TIMELINE_SCREENS = 6
// Total spacer height driving the fixed-scene timeline.
const SPACER_VH = 540

const Scene = dynamic(() => import("./scene").then((m) => m.Scene), {
  ssr: false,
})

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

/**
 * Anchored hold-band. The overlay fades + slides in over [inStart,inEnd],
 * HOLDS perfectly aligned until outStart, then fades + slides out by outEnd.
 * Returns the opacity and a vertical offset (px) for the slide.
 */
function anchor(
  p: number,
  inStart: number,
  inEnd: number,
  outStart: number,
  outEnd: number,
): { opacity: number; ty: number } {
  if (p <= inStart) return { opacity: 0, ty: 26 }
  if (p < inEnd) {
    const t = easeInOut((p - inStart) / (inEnd - inStart))
    return { opacity: t, ty: 26 * (1 - t) }
  }
  if (p <= outStart) return { opacity: 1, ty: 0 }
  if (p < outEnd) {
    const t = easeInOut((p - outStart) / (outEnd - outStart))
    return { opacity: 1 - t, ty: -26 * t }
  }
  return { opacity: 0, ty: -26 }
}

export function Experience() {
  // `progress` (0..1) tracks scroll across the timeline region ONLY, in pixels,
  // so the card animation is independent of the footer content height below.
  const [progress, setProgress] = useState(0)
  const progressRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [idle, setIdle] = useState(false)

  // After a few seconds of no interaction, reveal + bob the scroll hint.
  useEffect(() => {
    let timer: number
    const reset = () => {
      setIdle(false)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setIdle(true), 3000)
    }
    const events = [
      "scroll",
      "mousemove",
      "keydown",
      "touchstart",
      "pointerdown",
      "wheel",
    ] as const
    reset()
    events.forEach((e) =>
      window.addEventListener(e, reset, { passive: true }),
    )
    return () => {
      window.clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [])

  // Mark ready once mounted so the canvas can spin up client-side.
  useEffect(() => {
    setReady(true)
  }, [])

  // Lenis smooth-scroll drives the timeline progress (0..1) across
  // TIMELINE_SCREENS viewport-heights of scroll.
  useLenis(({ scroll }: { scroll: number }) => {
    const denom = TIMELINE_SCREENS * window.innerHeight || 1
    const next = clamp(scroll / denom)
    progressRef.current = next
    setProgress(next)
  })

  // Hero copy fades out as the letter split begins (guide Step 3 windows).
  const heroOpacity = clamp(1 - progress / 0.1)
  // Section 1 — Layered Typography + Glass (p ∈ [0.17, 0.37]).
  const fusion = anchor(progress, 0.19, 0.25, 0.31, 0.37)
  // Section 2 — Interstellar + Scouter (p ∈ [0.40, 0.63]).
  const anatomy = anchor(progress, 0.42, 0.5, 0.6, 0.66)

  // Scouter sequence driver — auto-triggers late in the interstellar hold.
  const anatomyAppear = clamp((progress - 0.54) / 0.12)

  const headingClass =
    "text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl [text-shadow:0_2px_22px_rgba(0,0,0,0.9)]"
  const bodyClass =
    "mt-5 text-pretty leading-relaxed text-foreground/75 [text-shadow:0_2px_18px_rgba(0,0,0,0.9)]"

  return (
    <div className="relative">
      {/* Fixed top navigation */}
      <TopNav />

      {/* Fixed 3D layer (receives pointer events for card tilt) */}
      {ready && <Scene progressRef={progressRef} />}

      {/* Vignette / atmosphere */}
      <div className="pointer-events-none fixed inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_45%,#050505_100%)]" />

      {/* Scouter HUD */}
      <ScouterUi opacity={anatomy.opacity} appear={anatomyAppear} />

      {/* ===== Fixed, scroll-anchored text overlays ===== */}
      <div className="pointer-events-none fixed inset-0 z-30">
        {/* Hero */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
          style={{ opacity: heroOpacity }}
        >
          <p className="mb-5 font-mono text-xs uppercase tracking-[0.5em] text-cyan-glow/80">
            The Fusion Trading Card Game
          </p>
          {/* The wordmark is rendered as 3D geometry inside the canvas
              (components/gaittamon/title-3d.tsx). This spacer reserves its
              space so the surrounding copy frames it; the heading text is kept
              for screen readers + SEO. */}
          <h1 className="sr-only">GAITTAMON</h1>
          <div aria-hidden="true" className="h-28 sm:h-36 md:h-44" />
          <p className="mt-6 max-w-xl text-pretty text-lg text-foreground/70 sm:text-xl">
            Fuse the Weak. Forge the Unstoppable.
          </p>
          <div className="pointer-events-auto mt-10">
            <CtaButton>Play Free Now</CtaButton>
          </div>

          <div
            className="absolute bottom-10 left-1/2 -translate-x-1/2 text-center transition-opacity duration-700"
            style={{
              opacity: idle ? 1 : 0,
              animation: idle ? "scroll-bob 1.8s ease-in-out infinite" : "none",
            }}
          >
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.4em] text-cyan-glow/70">
              Scroll to Fuse
            </p>
            <div className="mx-auto flex h-9 w-5 items-start justify-center rounded-full border border-cyan-glow/40 p-1">
              <span
                className="h-2 w-1 rounded-full bg-cyan-glow"
                style={{ animation: "scout-pulse 1.8s ease-in-out infinite" }}
              />
            </div>
          </div>
        </div>

        {/* 01 Fusion — text LEFT (pulled toward middle), card moves right */}
        <div className="absolute inset-0 flex items-center justify-start px-8 sm:px-20 lg:pl-[12vw]">
          <div
            className="max-w-md border-l-2 border-l-purple-glow pl-6"
            style={{
              opacity: fusion.opacity,
              transform: `translateY(${fusion.ty}px)`,
            }}
          >
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-purple-glow">
              01 — Fusion
            </p>
            <h2 className={headingClass}>Infinite Alchemy.</h2>
            <p className={bodyClass}>
              Combine Tier 1, 2, and 3 creatures to unlock devastating Tier 4,
              5, and 6 titans. Every match is a step toward your next ultimate
              fusion.
            </p>
          </div>
        </div>

        {/* 02 Anatomy — text RIGHT (pulled toward middle), card on the left */}
        <div className="absolute inset-0 flex items-center justify-end px-8 sm:px-20 lg:pr-[12vw]">
          <div
            className="max-w-sm border-r-2 border-r-cyan-glow pr-6 text-right"
            style={{
              opacity: anatomy.opacity,
              transform: `translateY(${anatomy.ty}px)`,
            }}
          >
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-cyan-glow">
              02 — Anatomy
            </p>
            <h2 className={headingClass}>Master the Anatomy.</h2>
            <p className={bodyClass}>
              Every element matters. From the Exalted status to the inline stat
              bars, mastery of Gaittamon requires perfect synergy.
            </p>
          </div>
        </div>

      </div>

      {/* Scroll spacer drives the progress timeline for the fixed scene.
          Timeline completes at TIMELINE_SCREENS; the remainder is a quiet
          buffer before the footer content scrolls up. */}
      <div aria-hidden="true" style={{ height: `${SPACER_VH}vh` }} />

      {/* Gameplay + Footer scroll in over the dark scene at the end. */}
      <GameplayFooter />
    </div>
  )
}

function FadeUp({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.15 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: "opacity 0.7s ease, transform 0.7s ease",
      }}
    >
      {children}
    </div>
  )
}

function GameplayFooter() {
  return (
    <section className="relative z-30 w-full">
      {/* 03 Ranked — CTA first so users see "Enter the Portal" before
          scrolling down to the video, not after. Fades up on scroll-in. */}
      <FadeUp>
        <div className="mx-auto max-w-lg px-6 pb-16 pt-28 text-center">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-cyan-glow">
            03 — Ranked
          </p>
          <h2 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            The Meta Never Sleeps.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-pretty leading-relaxed text-foreground/75">
            Take your fusions to the Ranked Ladder. Test your deck against endless
            combinations.
          </p>
          <div className="mt-9">
            <CtaButton variant="gold">Enter the Portal</CtaButton>
          </div>
        </div>
      </FadeUp>

      {/* Gameplay video — more breathing room above so it doesn't feel crammed */}
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-10">
        <div className="mb-10 text-center">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.4em] text-cyan-glow/80">
            Gameplay
          </p>
          <h2 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            See the Fusion in Motion.
          </h2>
        </div>

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
