"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { ReactLenis, useLenis } from "lenis/react"
import type LenisType from "lenis"
import Snap from "lenis/snap"

// Number of viewport-heights the fixed-scene timeline plays across. Must match
// TIMELINE_SCREENS in experience.tsx.
const TIMELINE_SCREENS = 6

/**
 * Adds hard, mandatory scroll snapping at each section boundary so the user
 * cannot rest between sections — every settle locks onto the nearest hold.
 */
function SnapController() {
  const lenis = useLenis() as unknown as LenisType | undefined

  useEffect(() => {
    if (!lenis) return
    const snap = new Snap(lenis, {
      type: "mandatory",
      duration: 1.2,
    })

    let removers: Array<() => void> = []
    const build = () => {
      removers.forEach((r) => r())
      const H = window.innerHeight
      const span = TIMELINE_SCREENS * H
      removers = [
        snap.add(0), // hero
        snap.add(0.22 * span), // Section 1 hold
        snap.add(0.5 * span), // Section 2 hold
        snap.add(0.74 * span), // Section 3 hold (mid-emergence)
        snap.add(span), // end of timeline / TV diorama
      ]
    }
    build()

    window.addEventListener("resize", build)
    return () => {
      window.removeEventListener("resize", build)
      removers.forEach((r) => r())
      snap.destroy()
    }
  }, [lenis])

  return null
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  return (
    <ReactLenis root options={{ lerp: 0.09, smoothWheel: true }}>
      <SnapController />
      {children}
    </ReactLenis>
  )
}
