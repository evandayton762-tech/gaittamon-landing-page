"use client"

import { useEffect, useState } from "react"

/**
 * Returns the global page scroll progress as a value between 0 and 1.
 * 0 = top of the page, 1 = bottom of the scrollable area.
 */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let raf = 0

    const update = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const max =
        document.documentElement.scrollHeight - window.innerHeight || 1
      const next = Math.min(1, Math.max(0, scrollTop / max))
      setProgress(next)
    }

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  return progress
}
