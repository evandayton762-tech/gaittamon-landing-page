"use client"

import { useMemo, useRef, type MutableRefObject } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const damp = THREE.MathUtils.damp

// Soft radial sprite texture generated once on a canvas — gives each fog
// billboard a feathered cloud edge instead of a hard quad.
function useSoftSprite() {
  return useMemo(() => {
    const size = 128
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")!
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    grad.addColorStop(0, "rgba(255,255,255,0.9)")
    grad.addColorStop(0.4, "rgba(255,255,255,0.35)")
    grad.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}

/**
 * Drifting volumetric fog / cloud ambience. Fades in during the Section 3
 * shatter and stays present through Section 4, giving both sections a shared
 * atmospheric backdrop.
 */
export function FogClouds({
  progressRef,
}: {
  progressRef: MutableRefObject<number>
}) {
  const sprite = useSoftSprite()
  const groupRef = useRef<THREE.Group>(null)
  const matRef = useRef<THREE.MeshBasicMaterial>(null)

  const clouds = useMemo(() => {
    const list: { pos: THREE.Vector3; scale: number; speed: number; tint: THREE.Color }[] = []
    const tints = [
      new THREE.Color("#3a2a6a"),
      new THREE.Color("#1f3a5a"),
      new THREE.Color("#5a3a2a"),
      new THREE.Color("#2a2a3a"),
    ]
    for (let i = 0; i < 22; i++) {
      list.push({
        pos: new THREE.Vector3(
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 8,
          -2 - Math.random() * 6,
        ),
        scale: 3 + Math.random() * 5,
        speed: 0.05 + Math.random() * 0.12,
        tint: tints[i % tints.length],
      })
    }
    return list
  }, [])

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const p = progressRef.current
    // Fade in at the shatter (p > 0.62), stay through Section 4.
    const target = clamp((p - 0.62) / 0.08)
    const t = state.clock.elapsedTime
    const meshes = groupRef.current.children as THREE.Mesh[]
    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i]
      const c = clouds[i]
      m.position.x = c.pos.x + Math.sin(t * c.speed + i) * 1.5
      m.position.y = c.pos.y + Math.cos(t * c.speed * 0.7 + i) * 0.6
      const mat = m.material as THREE.MeshBasicMaterial
      mat.opacity = damp(mat.opacity, target * 0.28, 3, delta)
    }
    groupRef.current.visible = target > 0.01
  })

  return (
    <group ref={groupRef}>
      {clouds.map((c, i) => (
        <mesh key={i} position={c.pos.toArray()} scale={c.scale}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            ref={i === 0 ? matRef : undefined}
            map={sprite}
            color={c.tint}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  )
}
