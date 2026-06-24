"use client"

import { useRef, type MutableRefObject } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Text3D } from "@react-three/drei"
import * as THREE from "three"

const FONT_URL = "/fonts/helvetiker_bold.typeface.json"
const TEXT = "GAITTAMON"
const TITLE_Z = 1.6 // float in front of the card back
const LETTER_GAP = 0.1

const damp = THREE.MathUtils.damp

/**
 * 3D extruded "GAITTAMON" wordmark. Letters are laid out from measured glyph
 * widths, the whole group performs a slow forward-facing orbit/tilt, and each
 * letter lifts + tilts toward the pointer as the mouse passes over it.
 */
export function Title3D({
  progressRef,
}: {
  progressRef: MutableRefObject<number>
}) {
  const group = useRef<THREE.Group>(null)
  // One wrapper group per letter so we can center + animate each independently.
  const wrappers = useRef<(THREE.Group | null)[]>([])
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const basePos = useRef<number[]>([])
  const fitScale = useRef(1)
  const laidOut = useRef(false)

  const { camera, size } = useThree()
  const chars = TEXT.split("")

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return

    // --- One-time layout from measured glyph widths ---
    if (!laidOut.current) {
      const widths: number[] = []
      let total = 0
      let ready = true
      meshes.current.forEach((m, i) => {
        if (!m || !m.geometry) {
          ready = false
          widths[i] = 0
          return
        }
        m.geometry.computeBoundingBox()
        const bb = m.geometry.boundingBox
        const w = bb ? bb.max.x - bb.min.x : 0.5
        widths[i] = w
        total += w + LETTER_GAP
      })
      if (ready) {
        total -= LETTER_GAP
        let cursor = -total / 2
        meshes.current.forEach((m, i) => {
          const w = widths[i]
          const cx = cursor + w / 2
          basePos.current[i] = cx
          if (m) m.position.x = -w / 2 // center glyph within its wrapper
          // Place the wrapper at the glyph's slot center.
          const wrap = wrappers.current[i]
          if (wrap) wrap.position.x = cx
          cursor += w + LETTER_GAP
        })
        laidOut.current = true
        console.log("[v0] title layout", {
          widths,
          basePos: [...basePos.current],
          wrappersFilled: wrappers.current.filter(Boolean).length,
        })
      }
    }

    // --- Hero-only visibility (fade with scroll) ---
    const p = progressRef.current
    const heroOpacity = Math.min(1, Math.max(0, 1 - p / 0.1))
    g.visible = heroOpacity > 0.01
    if (!g.visible) return

    const t = state.clock.elapsedTime

    // --- Viewport math at the title's depth for pointer projection ---
    const fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180
    const dist = camera.position.z - TITLE_Z
    const visH = 2 * Math.tan(fov / 2) * dist
    const visW = visH * (size.width / Math.max(1, size.height))

    // Fit the wordmark to ~88% of the visible width (responsive).
    if (laidOut.current) {
      const firstX = basePos.current[0] ?? 0
      const lastX = basePos.current[basePos.current.length - 1] ?? 0
      const span = Math.abs(lastX - firstX) + 1.2
      const target = Math.min(1, (visW * 0.62) / span)
      fitScale.current = damp(fitScale.current, target, 6, delta)
    }

    g.position.z = TITLE_Z
    g.scale.setScalar(fitScale.current)

    const px = state.pointer.x * (visW / 2)
    const py = state.pointer.y * (visH / 2)

    // --- Slow group orbit/tilt + gentle pointer parallax (stays forward) ---
    const orbitY = Math.sin(t * 0.35) * 0.1 + state.pointer.x * 0.12
    const orbitX = Math.sin(t * 0.28) * 0.05 - state.pointer.y * 0.08
    g.rotation.y = damp(g.rotation.y, orbitY, 4, delta)
    g.rotation.x = damp(g.rotation.x, orbitX, 4, delta)

    // --- Per-letter reaction to the pointer + idle float ---
    wrappers.current.forEach((w, i) => {
      if (!w) return
      const lx = (basePos.current[i] ?? 0) * fitScale.current
      const dx = px - lx
      const dy = py - 0
      const react = Math.exp(-((dx * dx) / 1.1 + (dy * dy) / 0.7))

      const floatY = Math.sin(t * 1.1 + i * 0.6) * 0.03
      w.position.y = damp(w.position.y, floatY + react * 0.12, 8, delta)
      w.position.z = damp(w.position.z, react * 0.7, 8, delta)
      w.rotation.y = damp(w.rotation.y, react * Math.sign(dx) * -0.35, 8, delta)
      w.rotation.x = damp(w.rotation.x, react * Math.sign(dy) * 0.3, 8, delta)
    })

    // --- Push the fade onto every letter's material ---
    meshes.current.forEach((m) => {
      if (!m) return
      const mat = m.material as THREE.MeshStandardMaterial
      if (mat) {
        mat.opacity = heroOpacity
        mat.transparent = true
      }
    })
  })

  return (
    <group ref={group} position={[0, 0, TITLE_Z]}>
      {chars.map((char, i) => (
        <group
          key={`${char}-${i}`}
          ref={(el) => {
            wrappers.current[i] = el
          }}
        >
          <Text3D
            ref={(el) => {
              meshes.current[i] = el as unknown as THREE.Mesh
            }}
            font={FONT_URL}
            size={0.62}
            height={0.16}
            curveSegments={6}
            bevelEnabled
            bevelThickness={0.02}
            bevelSize={0.014}
            bevelSegments={3}
          >
            {char}
            <meshStandardMaterial
              color="#eafcff"
              emissive="#1fb6e6"
              emissiveIntensity={0.55}
              metalness={0.35}
              roughness={0.25}
              transparent
            />
          </Text3D>
        </group>
      ))}
    </group>
  )
}
