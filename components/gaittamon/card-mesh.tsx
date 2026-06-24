"use client"

import { useRef, type MutableRefObject } from "react"
import { useFrame, useLoader } from "@react-three/fiber"
import * as THREE from "three"

const damp = THREE.MathUtils.damp
const lerp = THREE.MathUtils.lerp

// Maps the global 0..1 scroll progress into per-stage local progress.
function stage(p: number, start: number, end: number) {
  return Math.min(1, Math.max(0, (p - start) / (end - start)))
}

// Smooth ease in-out
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

export function CardMesh({
  progressRef,
}: {
  progressRef: MutableRefObject<number>
}) {
  const group = useRef<THREE.Group>(null)
  const mesh = useRef<THREE.Mesh>(null)

  const [front, back] = useLoader(THREE.TextureLoader, [
    "/card-front.png",
    "/card-back.png",
  ])
  front.colorSpace = THREE.SRGBColorSpace
  back.colorSpace = THREE.SRGBColorSpace
  front.anisotropy = 8
  back.anisotropy = 8

  useFrame((state, delta) => {
    if (!group.current || !mesh.current) return
    const p = progressRef.current
    const t = state.clock.elapsedTime

    // Stage windows
    const sFlip = easeInOut(stage(p, 0.12, 0.32)) // 0 -> faces away, 1 -> faces user
    const sTilt = easeInOut(stage(p, 0.42, 0.6)) // anatomy tilt
    const sZoom = easeInOut(stage(p, 0.66, 0.86)) // zoom past camera

    // --- Rotation: start showing back (PI), flip to front (0) ---
    const targetRotY = lerp(Math.PI, 0, sFlip)
    // Anatomy tilt to catch the light, plus a gentle settle afterwards
    const targetRotYTilt = targetRotY + sTilt * -0.5
    const targetRotX = -0.04 + sTilt * 0.16 + Math.sin(t * 0.4) * 0.02
    const targetRotZ = sTilt * 0.06

    group.current.rotation.y = damp(
      group.current.rotation.y,
      targetRotYTilt,
      6,
      delta,
    )
    group.current.rotation.x = damp(group.current.rotation.x, targetRotX, 6, delta)
    group.current.rotation.z = damp(group.current.rotation.z, targetRotZ, 6, delta)

    // --- Position: float in hero, drift slightly during anatomy ---
    const floatY = Math.sin(t * 0.9) * 0.12 * (1 - sZoom)
    const targetY = lerp(0, 0.1, sTilt) + floatY
    const targetX = lerp(0, -0.15, sTilt) * (1 - sZoom)

    group.current.position.x = damp(group.current.position.x, targetX, 5, delta)
    group.current.position.y = damp(group.current.position.y, targetY, 5, delta)

    // --- Zoom past: scale up and rush toward the camera (+z), then fade ---
    const targetScale = lerp(1, 4.2, sZoom)
    const targetZ = lerp(0, 6.5, sZoom)
    group.current.position.z = damp(group.current.position.z, targetZ, 7, delta)

    const s = damp(group.current.scale.x, targetScale, 7, delta)
    group.current.scale.setScalar(s)

    // Fade the card out as it passes the camera
    const mat = mesh.current.material as THREE.MeshStandardMaterial
    const targetOpacity = 1 - Math.min(1, stage(p, 0.78, 0.9))
    mat.opacity = damp(mat.opacity, targetOpacity, 8, delta)
  })

  return (
    <group ref={group}>
      <mesh ref={mesh} castShadow>
        {/* Card plane ~ 2.5 x 3.5 ratio */}
        <boxGeometry args={[2.5, 3.5, 0.06]} />
        {/* Material array: order = +x,-x,+y,-y,+z(front face),-z(back face) */}
        <meshStandardMaterial attach="material-0" color="#0a0a12" metalness={0.6} roughness={0.4} />
        <meshStandardMaterial attach="material-1" color="#0a0a12" metalness={0.6} roughness={0.4} />
        <meshStandardMaterial attach="material-2" color="#0a0a12" metalness={0.6} roughness={0.4} />
        <meshStandardMaterial attach="material-3" color="#0a0a12" metalness={0.6} roughness={0.4} />
        <meshStandardMaterial
          attach="material-4"
          map={front}
          transparent
          metalness={0.35}
          roughness={0.5}
          emissive="#0a3a4a"
          emissiveIntensity={0.25}
        />
        <meshStandardMaterial
          attach="material-5"
          map={back}
          transparent
          metalness={0.55}
          roughness={0.45}
          emissive="#1a0a3a"
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  )
}
