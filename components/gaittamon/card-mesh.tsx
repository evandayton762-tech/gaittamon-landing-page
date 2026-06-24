"use client"

import { useMemo, useRef, type MutableRefObject } from "react"
import { useFrame, useLoader } from "@react-three/fiber"
import { RoundedBox } from "@react-three/drei"
import * as THREE from "three"

const damp = THREE.MathUtils.damp
const lerp = THREE.MathUtils.lerp
const clamp = THREE.MathUtils.clamp

// Maps the global 0..1 scroll progress into per-stage local progress.
function stage(p: number, start: number, end: number) {
  return Math.min(1, Math.max(0, (p - start) / (end - start)))
}

// Smooth ease in-out
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

const CARD_W = 2.5
const CARD_H = 3.5

// Builds a rounded-rectangle plane with UVs normalized to 0..1 so a texture
// fits the whole face. This gives the card soft rounded corners.
function useRoundedPlane(w: number, h: number, r: number) {
  return useMemo(() => {
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

    const geo = new THREE.ShapeGeometry(shape, 24)
    const pos = geo.attributes.position
    const uv: number[] = []
    for (let i = 0; i < pos.count; i++) {
      uv.push((pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h)
    }
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2))
    return geo
  }, [w, h, r])
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

  const [front, back] = useLoader(THREE.TextureLoader, [
    "/card-front.png",
    "/cardback.png",
  ])
  front.colorSpace = THREE.SRGBColorSpace
  back.colorSpace = THREE.SRGBColorSpace
  front.anisotropy = 8
  back.anisotropy = 8

  const faceGeo = useRoundedPlane(CARD_W - 0.06, CARD_H - 0.06, 0.2)

  useFrame((state, delta) => {
    if (!group.current) return
    const p = progressRef.current
    const t = state.clock.elapsedTime
    const vw = state.viewport.width

    // Keep the card fully on-screen on any aspect ratio.
    const fit = clamp(vw / 3.4, 0.5, 1)
    const baseScale = 0.84 * fit

    // Stage windows
    const sTurn = easeInOut(stage(p, 0.14, 0.36)) // hero -> fusion (move right)
    const sCenter = easeInOut(stage(p, 0.42, 0.6)) // fusion -> anatomy (to center)
    const sZoom = easeInOut(stage(p, 0.7, 0.9)) // anatomy -> meta (zoom past)

    // --- Rotation: back (PI) -> turns to front (2PI) -> settles, with a
    // leftward spin flourish on the way to center.
    let rotY = lerp(Math.PI, Math.PI * 2, sTurn)
    rotY = lerp(rotY, Math.PI * 2, sCenter)
    rotY -= Math.sin(sCenter * Math.PI) * 0.8 // spin-left, then settle to front
    rotY += Math.sin(t * 0.5) * 0.04 * (1 - sTurn) * (1 - sZoom) // idle sway

    const rotX =
      -0.02 + sCenter * 0.04 + Math.sin(t * 0.4) * 0.02 * (1 - sZoom)
    const rotZ = Math.sin(sCenter * Math.PI) * 0.05

    group.current.rotation.y = damp(group.current.rotation.y, rotY, 6, delta)
    group.current.rotation.x = damp(group.current.rotation.x, rotX, 6, delta)
    group.current.rotation.z = damp(group.current.rotation.z, rotZ, 6, delta)

    // --- Position: hero center -> right side -> back to center ---
    const rightX = vw * 0.24
    let x = lerp(0, rightX, sTurn)
    x = lerp(x, 0, sCenter)
    x *= 1 - sZoom

    const floatY = Math.sin(t * 0.9) * 0.07 * (1 - sZoom)
    const y = floatY + lerp(0, 0.04, sCenter)

    group.current.position.x = damp(group.current.position.x, x, 5, delta)
    group.current.position.y = damp(group.current.position.y, y, 5, delta)

    // --- Scale: smaller as it moves aside, small + centered for anatomy,
    // then large for the zoom-past finale. ---
    let scl = lerp(baseScale, baseScale * 0.74, sTurn)
    scl = lerp(scl, baseScale * 0.82, sCenter)
    scl = lerp(scl, baseScale * 4.4, sZoom)
    const s = damp(group.current.scale.x, scl, 7, delta)
    group.current.scale.setScalar(s)

    // --- Zoom-past: push toward the camera and fade out. ---
    const z = lerp(0, 6.2, sZoom)
    group.current.position.z = damp(group.current.position.z, z, 7, delta)

    const targetOpacity = 1 - stage(p, 0.8, 0.92)
    for (const m of [frontMat.current, backMat.current, bodyMat.current]) {
      if (m) m.opacity = damp(m.opacity, targetOpacity, 8, delta)
    }
  })

  return (
    <group ref={group}>
      {/* Dark rounded body that forms the border / edge of the card */}
      <RoundedBox args={[CARD_W, CARD_H, 0.07]} radius={0.22} smoothness={5}>
        <meshStandardMaterial
          ref={bodyMat}
          color="#0b0918"
          metalness={0.7}
          roughness={0.35}
          emissive="#241046"
          emissiveIntensity={0.25}
          transparent
        />
      </RoundedBox>

      {/* Front face (Mystitoad) */}
      <mesh geometry={faceGeo} position={[0, 0, 0.038]}>
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

      {/* Back face (ornate vortex), faces the opposite direction */}
      <mesh geometry={faceGeo} position={[0, 0, -0.038]} rotation={[0, Math.PI, 0]}>
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
