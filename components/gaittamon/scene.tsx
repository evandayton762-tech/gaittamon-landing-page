"use client"

import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Environment } from "@react-three/drei"
import { EffectComposer, Noise, Vignette } from "@react-three/postprocessing"
import { BlendFunction, BloomEffect } from "postprocessing"
import * as THREE from "three"
import { CardMesh } from "./card-mesh"
import { Title3D } from "./title-3d"
import { HeroJunniElements } from "./hero-junni-elements"
import { LayeredTextSection } from "./layered-text-section"
import { InterstellarSection } from "./interstellar-section"
import { FusionSection } from "./fusion-section"
import { FogClouds } from "./fog-clouds"
import { BackgroundSphere } from "./background-sphere"

const damp = THREE.MathUtils.damp
const clamp = (v: number) => Math.min(1, Math.max(0, v))

// Global subtle camera drift toward the pointer — applies in every section,
// stacking on top of the card tilt and per-letter title reactivity. The
// parallax strength increases in Section 3 so the shatter tableau shifts more.
function CameraParallax({ progressRef }: { progressRef: MutableRefObject<number> }) {
  useFrame((state, delta) => {
    const p = progressRef.current
    const sec3 = clamp((p - 0.6) / 0.1)
    const k = 0.015 + sec3 * 0.01
    state.camera.position.x = damp(state.camera.position.x, state.pointer.x * k, 4, delta)
    state.camera.position.y = damp(state.camera.position.y, state.pointer.y * (k * 0.66), 4, delta)
    state.camera.lookAt(0, 0, 0)
  })
  return null
}

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

// Three colored point lights orbiting on Lissajous paths — they keep the hero
// and shatter scenes feeling "alive" with shifting colored light in palette.
function MovingLights() {
  const a = useRef<THREE.PointLight>(null)
  const b = useRef<THREE.PointLight>(null)
  const c = useRef<THREE.PointLight>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (a.current) {
      a.current.position.set(Math.sin(t * 0.35) * 4, Math.cos(t * 0.27) * 2.6, 2 + Math.sin(t * 0.2) * 1.5)
    }
    if (b.current) {
      b.current.position.set(Math.sin(t * 0.23 + 2) * 3.5, Math.cos(t * 0.31 + 1) * 3, 1.5 + Math.cos(t * 0.18) * 1.5)
    }
    if (c.current) {
      c.current.position.set(Math.cos(t * 0.29 + 4) * 3, Math.sin(t * 0.21 + 3) * 2.2, 2.5 + Math.sin(t * 0.25) * 1.2)
    }
  })
  return (
    <>
      <pointLight ref={a} color="#c79a3a" intensity={26} distance={16} />
      <pointLight ref={b} color="#8a4aff" intensity={22} distance={16} />
      <pointLight ref={c} color="#5ee9ff" intensity={18} distance={16} />
    </>
  )
}

// CursorLight — a directional light whose position damps toward the pointer so
// the lighting on the Section 3 orb/shards shifts as the mouse moves.
function CursorLight({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const pos = useRef(new THREE.Vector3(0, 0, 2))
  const vel = useRef(new THREE.Vector3())
  useFrame((state, delta) => {
    if (!light.current) return
    const p = progressRef.current
    const active = clamp((p - 0.6) / 0.06)
    const goal = new THREE.Vector3(state.pointer.x * 4, state.pointer.y * 3, 2)
    vel.current.add(goal.sub(pos.current).multiplyScalar(delta * 2.5))
    vel.current.multiplyScalar(0.8)
    pos.current.add(vel.current)
    light.current.position.copy(pos.current)
    light.current.intensity = active * 2.2
  })
  return <directionalLight ref={light} color="#ffe6a8" intensity={0} />
}

// Bloom built with the `primitive` pattern (per the official docs) instead of
// the <Bloom> JSX wrapper. The wrapper component is not a forwardRef in this
// version, so in React 19 a passed `ref` becomes a normal prop that the
// composer tries to JSON.stringify — throwing a circular-structure error.
// Constructing the BloomEffect directly and mounting it as a <primitive>
// avoids that serialization entirely.
function CustomBloom({
  effectRef,
}: {
  effectRef: MutableRefObject<BloomEffect | null>
}) {
  const effect = useMemo(
    () =>
      new BloomEffect({
        intensity: 0,
        luminanceThreshold: 0.5,
        luminanceSmoothing: 0.3,
        mipmapBlur: true,
      }),
    [],
  )
  useEffect(() => {
    effectRef.current = effect
    return () => {
      effectRef.current = null
      effect.dispose()
    }
  }, [effect, effectRef])
  return <primitive object={effect} dispose={null} />
}

// Drives Bloom intensity per section by mutating the effect instance through a
// ref. Lives OUTSIDE <EffectComposer> so it never participates in composer
// child introspection.
function BloomController({
  effectRef,
  progressRef,
}: {
  effectRef: MutableRefObject<BloomEffect | null>
  progressRef: MutableRefObject<number>
}) {
  useFrame((_, delta) => {
    if (!effectRef.current) return
    const p = progressRef.current
    // ramp 0 -> 1.0 across Section 2, then 1.0 -> 1.5 across Section 3
    const sec2 = clamp((p - 0.4) / 0.12)
    const sec3 = clamp((p - 0.62) / 0.1)
    const target = sec2 * 1.0 + sec3 * 0.5
    effectRef.current.intensity = damp(effectRef.current.intensity, target, 3, delta)
  })
  return null
}

export function Scene({
  progressRef,
}: {
  progressRef: MutableRefObject<number>
}) {
  const bloomRef = useRef<BloomEffect | null>(null)
  return (
    <div className="fixed inset-0 h-screen w-full">
      <Canvas
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 6], fov: 35 }}
      >
        <color attach="background" args={["#050505"]} />

        <ambientLight intensity={0.35} color="#6a4aff" />
        <directionalLight position={[-4, 3, 5]} intensity={1.2} color="#b48cff" />
        <pointLight position={[0, -3, 4]} intensity={20} color="#c79a3a" distance={16} />

        <CameraParallax progressRef={progressRef} />

        <Suspense fallback={null}>
          <BackgroundSphere />
          <MovingLights />
          <SweepLight progressRef={progressRef} />
          <CursorLight progressRef={progressRef} />
          <BloomController effectRef={bloomRef} progressRef={progressRef} />
          <HeroJunniElements progressRef={progressRef} />
          <LayeredTextSection progressRef={progressRef} />
          <InterstellarSection progressRef={progressRef} />
          <FogClouds progressRef={progressRef} />
          <FusionSection progressRef={progressRef} />
          <CardMesh progressRef={progressRef} />
          <Title3D progressRef={progressRef} />
          <Environment preset="night" />
          <EffectComposer>
            <CustomBloom effectRef={bloomRef} />
            <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.12} />
            <Vignette eskil={false} offset={0.3} darkness={0.7} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  )
}
