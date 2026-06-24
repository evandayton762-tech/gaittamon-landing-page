"use client"

import { Suspense, useRef, type MutableRefObject } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Environment } from "@react-three/drei"
import * as THREE from "three"
import { CardMesh } from "./card-mesh"
import { Title3D } from "./title-3d"

// A moving rim light that sweeps to create the "dynamic reflection" during the
// anatomy stage.
function SweepLight({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const light = useRef<THREE.PointLight>(null)
  useFrame((state) => {
    if (!light.current) return
    const t = state.clock.elapsedTime
    const p = progressRef.current
    const sweep = Math.min(1, Math.max(0, (p - 0.4) / 0.25))
    light.current.position.x = Math.sin(t * 1.2) * 3 * (0.4 + sweep)
    light.current.position.y = Math.cos(t * 0.8) * 1.5
    light.current.intensity = 30 + sweep * 90
  })
  return <pointLight ref={light} color="#5ee9ff" position={[2, 1, 3]} distance={14} />
}

export function Scene({
  progressRef,
}: {
  progressRef: MutableRefObject<number>
}) {
  return (
    <div className="fixed inset-0 h-screen w-full">
      <Canvas
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 6], fov: 35 }}
      >
        <color attach="background" args={["#050505"]} />
        <fog attach="fog" args={["#050505", 8, 18]} />

        <ambientLight intensity={0.35} color="#6a4aff" />
        <directionalLight position={[-4, 3, 5]} intensity={1.2} color="#b48cff" />
        <pointLight position={[0, -3, 4]} intensity={20} color="#c79a3a" distance={16} />

        <Suspense fallback={null}>
          <SweepLight progressRef={progressRef} />
          <CardMesh progressRef={progressRef} />
          <Title3D progressRef={progressRef} />
          <Environment preset="night" />
        </Suspense>
      </Canvas>
    </div>
  )
}
