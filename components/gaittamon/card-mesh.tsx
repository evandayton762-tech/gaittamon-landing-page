"use client"

import { useEffect, useMemo, useRef, type MutableRefObject } from "react"
import { useFrame, useLoader, type ThreeEvent } from "@react-three/fiber"
import * as THREE from "three"

const damp = THREE.MathUtils.damp
const lerp = THREE.MathUtils.lerp
const clamp = THREE.MathUtils.clamp
const PI = Math.PI

// Maps the global 0..1 scroll progress into per-stage local progress.
function stage(p: number, start: number, end: number) {
  return Math.min(1, Math.max(0, (p - start) / (end - start)))
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

const CARD_W = 2.5
const CARD_H = 3.5
const DEPTH = 0.02 // thin TCG-style card body
const SHATTER_P = 0.66 // progress where the card hard-cuts into shards

// A rounded-rectangle shape reused for both the thin body and the faces.
function roundedRectShape(w: number, h: number, r: number) {
  const shape = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  shape.moveTo(x + r, y)
  shape.lineTo(x + w - r, y)
  shape.quadraticCurveTo(x + w, y, x + w, y + r)
  shape.lineTo(x + w, y + h - r)
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  shape.lineTo(x + r, y + h)
  shape.quadraticCurveTo(x, y + h, x, y + h - r)
  shape.lineTo(x, y + r)
  shape.quadraticCurveTo(x, y, x + r, y)
  return shape
}

// Flat rounded plane with normalized UVs so a texture fills the whole face.
function useRoundedPlane(w: number, h: number, r: number) {
  return useMemo(() => {
    const geo = new THREE.ShapeGeometry(roundedRectShape(w, h, r), 24)
    const pos = geo.attributes.position
    const uv: number[] = []
    for (let i = 0; i < pos.count; i++) {
      uv.push((pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h)
    }
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2))
    return geo
  }, [w, h, r])
}

// Thin extruded rounded body — gives real rounded corners with a slim edge.
function useCardBody(w: number, h: number, r: number, depth: number) {
  return useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, r), {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 1,
      steps: 1,
      curveSegments: 24,
    })
    geo.center()
    return geo
  }, [w, h, r, depth])
}

export function CardMesh({
  progressRef,
}: {
  progressRef: MutableRefObject<number>
}) {
  const group = useRef<THREE.Group>(null)
  const frontMat = useRef<THREE.MeshStandardMaterial>(null)
  const backMat = useRef<THREE.MeshStandardMaterial>(null)
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null)

  // Pointer interaction state.
  const hovered = useRef(false)
  const pressed = useRef(false)
  const pointer = useRef({ x: 0, y: 0 })

  const [front, back] = useLoader(THREE.TextureLoader, [
    "/card-front.png", // Cindrake card art (updated)
    "/cardback.png",   // purple vortex back
  ])
  front.colorSpace = THREE.SRGBColorSpace
  back.colorSpace = THREE.SRGBColorSpace
  front.anisotropy = 8
  back.anisotropy = 8

  const faceGeo = useRoundedPlane(CARD_W - 0.08, CARD_H - 0.08, 0.18)
  const bodyGeo = useCardBody(CARD_W, CARD_H, 0.2, DEPTH)
  const faceZ = DEPTH / 2 + 0.006 + 0.001

  useEffect(() => {
    const up = () => {
      pressed.current = false
    }
    window.addEventListener("pointerup", up)
    return () => window.removeEventListener("pointerup", up)
  }, [])

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (e.uv) {
      pointer.current.x = (e.uv.x - 0.5) * 2
      pointer.current.y = (e.uv.y - 0.5) * 2
    }
  }
  const onOver = () => {
    hovered.current = true
  }
  const onOut = () => {
    hovered.current = false
    pressed.current = false
  }
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    pressed.current = true
  }
  const handlers = {
    onPointerMove: onMove,
    onPointerOver: onOver,
    onPointerOut: onOut,
    onPointerDown: onDown,
  }

  useFrame((state, delta) => {
    if (!group.current) return
    const p = progressRef.current
    const t = state.clock.elapsedTime
    const vw = state.viewport.width

    const fit = clamp(vw / 3.6, 0.5, 1)
    const baseScale = 0.72 * fit

    // Stage windows (driven by the spacer-relative progress in experience.tsx).
    // New timeline: hero(back) -> split flip to front + slide right -> Section 1
    // hold on the right -> return to center for the Section 2 interstellar
    // hold (continuous Y auto-rotate) -> fade out as the Section 3 shatter
    // takes over.
    const sFlip = easeInOut(stage(p, 0.08, 0.2)) // hero -> flip to front (stays centered)
    const inSec2 = p >= 0.42 && p < SHATTER_P
    // The card hard-cuts to invisible the instant the shatter triggers — the
    // shard fragments ARE the broken card, so there is no fade overlap.
    const shattered = p >= SHATTER_P

    // --- Pointer tilt: subtle on hover, stronger while pressed. ---
    const strength = pressed.current ? 0.4 : hovered.current ? 0.16 : 0

    if (inSec2) {
      // FIXED orientation, front-facing — bounded oscillation that always
      // returns to center (never accumulates) so the orientation entering the
      // Section 3 shatter is known and stable.
      group.current.rotation.y = damp(
        group.current.rotation.y,
        Math.sin(t * 0.3) * 0.05 + pointer.current.x * strength,
        6,
        delta,
      )
      group.current.rotation.x = damp(
        group.current.rotation.x,
        0.1 - pointer.current.y * strength,
        6,
        delta,
      )
      group.current.rotation.z = damp(group.current.rotation.z, 0, 6, delta)
    } else {
      let rotY = lerp(PI, PI * 2, sFlip) // PI (back) -> 2*PI (front)
      rotY += Math.sin(t * 0.5) * 0.04 * (1 - sFlip)
      rotY += pointer.current.x * strength
      let rotX = -0.02 + Math.sin(t * 0.4) * 0.02
      rotX += -pointer.current.y * strength
      group.current.rotation.y = damp(group.current.rotation.y, rotY, 6, delta)
      group.current.rotation.x = damp(group.current.rotation.x, rotX, 6, delta)
      group.current.rotation.z = damp(group.current.rotation.z, 0, 6, delta)
    }

    // --- Position: stays centered the entire timeline. ---
    const floatY = Math.sin(t * 0.9) * 0.05
    group.current.position.x = damp(group.current.position.x, 0, 5, delta)
    group.current.position.y = damp(group.current.position.y, floatY, 5, delta)
    group.current.position.z = damp(group.current.position.z, 0, 7, delta)

    // --- Scale: full size centered, slightly smaller as it flips in. ---
    const scl = lerp(baseScale, baseScale * 0.92, sFlip)
    const s = damp(group.current.scale.x, scl, 7, delta)
    group.current.scale.setScalar(s)

    // Solid card is fully opaque until the shatter, then instantly gone.
    const targetOpacity = shattered ? 0 : 1
    for (const m of [frontMat.current, backMat.current, bodyMat.current]) {
      if (m) m.opacity = targetOpacity
    }
    group.current.visible = !shattered
  })

  return (
    <group ref={group}>
      {/* Thin rounded body forms the card edge / border */}
      <mesh geometry={bodyGeo} {...handlers}>
        <meshStandardMaterial
          ref={bodyMat}
          color="#0b0918"
          metalness={0.7}
          roughness={0.35}
          emissive="#241046"
          emissiveIntensity={0.22}
          transparent
        />
      </mesh>

      {/* Front face (Mystitoad) */}
      <mesh geometry={faceGeo} position={[0, 0, faceZ]} {...handlers}>
        <meshStandardMaterial
          ref={frontMat}
          map={front}
          transparent
          metalness={0.3}
          roughness={0.5}
          emissive="#0a3a4a"
          emissiveIntensity={0.22}
        />
      </mesh>

      {/* Back face (vortex), faces the opposite direction */}
      <mesh
        geometry={faceGeo}
        position={[0, 0, -faceZ]}
        rotation={[0, PI, 0]}
        {...handlers}
      >
        <meshStandardMaterial
          ref={backMat}
          map={back}
          transparent
          metalness={0.5}
          roughness={0.45}
          emissive="#1a0a3a"
          emissiveIntensity={0.28}
        />
      </mesh>
    </group>
  )
}
