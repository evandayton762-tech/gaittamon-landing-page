"use client"

import { useMemo, useRef, type MutableRefObject } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import {
  Text,
  Text3D,
  MeshTransmissionMaterial,
  useGLTF,
  useCubeTexture,
} from "@react-three/drei"
import * as THREE from "three"

const FONT_URL = "/fonts/helvetiker_bold.typeface.json"
const PHRASE = "INFINITE FUSION · ENDLESS POSSIBILITIES · "
const BG_ROW = PHRASE.repeat(14)

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const lerp = THREE.MathUtils.lerp
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4)
const easeInCubic = (t: number) => t * t * t
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

type TextMesh = THREE.Mesh & { material: THREE.Material & { opacity: number } }

export function LayeredTextSection({
  progressRef,
}: {
  progressRef: MutableRefObject<number>
}) {
  const group = useRef<THREE.Group>(null)
  const { viewport } = useThree()
  const vwScale = viewport.width / 10

  // Layer refs
  const infiniteRef = useRef<TextMesh>(null)
  const endlessRef = useRef<TextMesh>(null)
  const fusionRef = useRef<THREE.Mesh>(null)
  const outlineAboveRef = useRef<THREE.Group>(null)
  const outlineBelowRef = useRef<THREE.Group>(null)
  const rowRefs = [
    useRef<TextMesh>(null),
    useRef<TextMesh>(null),
    useRef<TextMesh>(null),
  ]

  // --- Glass shapes from section_2.glb + sec2 cubemap ---
  const { scene } = useGLTF("/junni/section_2.glb")
  const envMap = useCubeTexture(
    ["px.png", "nx.png", "py.png", "ny.png", "pz.png", "nz.png"],
    { path: "/junni/envmap/sec2/" },
  )

  const glassMeshes = useMemo(() => {
    const transparents = scene.getObjectByName("Transparents")
    const out: { geo: THREE.BufferGeometry; pos: THREE.Vector3; scl: number }[] = []
    if (transparents) {
      transparents.updateWorldMatrix(true, true)
      transparents.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) {
          out.push({
            geo: m.geometry,
            pos: m.getWorldPosition(new THREE.Vector3()),
            scl: m.scale.x || 1,
          })
        }
      })
    }
    return out.slice(0, 3)
  }, [scene])
  const glassRefs = useRef<(THREE.Mesh | null)[]>([])

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const p = progressRef.current
    const t = state.clock.elapsedTime

    const sTypo = clamp((p - 0.17) / 0.1)
    const sTypoExit = clamp((p - 0.37) / 0.09)
    const groupOpacity = sTypo * (1 - sTypoExit)
    g.visible = groupOpacity > 0.005
    if (!g.visible) return

    const setText = (
      ref: { current: TextMesh | null },
      finalX: number,
      finalY: number,
      fromX: number,
      baseOpacity: number,
      delay: number,
    ) => {
      const m = ref.current
      if (!m) return
      const tin = easeOutQuart(clamp((sTypo - delay) / (1 - delay)))
      const tout = easeInCubic(sTypoExit)
      // entrance from fromX -> finalX, exit -> -11 diagonally up-left
      let x = lerp(fromX, finalX, tin)
      let y = finalY
      if (sTypoExit > 0) {
        x = lerp(finalX, -11, tout)
        y = lerp(finalY, finalY + 5, tout)
      }
      m.position.x = x
      m.position.y = y
      m.material.opacity = baseOpacity * tin * (1 - tout)
      m.material.transparent = true
    }

    setText(infiniteRef, -1.2, 0.7, -10, 0.9, 0)
    setText(endlessRef, 0.8, -0.6, 10, 0.75, 0.08)

    // Layer 2 — FUSION (Text3D)
    if (fusionRef.current) {
      const m = fusionRef.current
      const tin = easeOutQuart(sTypo)
      const tout = easeInCubic(sTypoExit)
      let x = lerp(14, 0, tin)
      let y = 0
      if (sTypoExit > 0) {
        x = lerp(0, -11, tout)
        y = lerp(0, 5, tout)
      }
      m.position.set(x, y, -2.0)
      const mat = m.material as THREE.Material & { opacity: number }
      mat.opacity = tin * (1 - tout)
      mat.transparent = true
    }

    // Layer 3 — hollow outlines: spring-ish scale in when sTypo > 0.25
    const outlineIn = easeInOutCubic(clamp((sTypo - 0.25) / 0.4))
    const outlineScale = outlineIn * (1 - easeInCubic(sTypoExit))
    if (outlineAboveRef.current) outlineAboveRef.current.scale.setScalar(outlineScale)
    if (outlineBelowRef.current) outlineBelowRef.current.scale.setScalar(outlineScale)

    // Layer 4 — diagonal background rows drift + staggered entrance
    const rowCfg = [
      { y: 1.1, drift: () => Math.sin(t * 0.18) * 0.5, delay: 0.2 },
      { y: 0, drift: () => Math.sin(t * 0.14 + 1) * -0.4, delay: 0.28 },
      { y: -1.1, drift: () => Math.sin(t * 0.22 + 2) * 0.3, delay: 0.36 },
    ]
    rowRefs.forEach((ref, i) => {
      const m = ref.current
      if (!m) return
      const cfg = rowCfg[i]
      const tin = easeOutQuart(clamp((sTypo - cfg.delay) / (1 - cfg.delay)))
      const tout = easeInCubic(clamp((sTypoExit - (2 - i) * 0.03) / 1))
      let x = lerp(9, cfg.drift(), tin)
      let y = cfg.y
      if (tout > 0) {
        x = lerp(cfg.drift(), -11, tout)
        y = lerp(cfg.y, cfg.y + 6, tout)
      }
      m.position.x = x
      m.position.y = y
      m.material.opacity = tin * (1 - tout)
      m.material.transparent = true
    })

    // Glass shapes: rotate + spring scale entrance staggered
    const glassDelays = [0.15, 0.25, 0.32]
    glassRefs.current.forEach((m, i) => {
      if (!m) return
      const tin = easeInOutCubic(clamp((sTypo - glassDelays[i]) / 0.4))
      const sc = tin * (1 - easeInCubic(sTypoExit))
      m.scale.setScalar(sc * (glassMeshes[i]?.scl || 1))
      if (i === 0) {
        m.rotation.y += 0.0028
        m.rotation.z += 0.0009
      } else if (i === 1) {
        m.rotation.x += 0.0018
        m.rotation.y += 0.003
      } else {
        m.rotation.x += 0.004
      }
    })
  })

  return (
    <group ref={group} visible={false}>
      {/* Layer 4 — diagonal background rows (z = -5.5) */}
      {[1.1, 0, -1.1].map((y, i) => (
        <Text
          key={`row-${i}`}
          ref={rowRefs[i] as never}
          position={[0, y, -5.5]}
          rotation={[0, 0, -0.12]}
          fontSize={[0.52, 0.38, 0.44][i]}
          color="#1a1a1a"
          maxWidth={9999}
          anchorX="center"
          anchorY="middle"
        >
          {BG_ROW}
        </Text>
      ))}

      {/* Layer 3 — hollow FUSION outlines (z = -3.2) */}
      <group ref={outlineAboveRef} position={[0, 1.55, -3.2]} scale={0}>
        <Text
          fontSize={2.8 * vwScale}
          font={undefined}
          anchorX="center"
          anchorY="middle"
          fillOpacity={0}
          strokeWidth={0.018}
          strokeColor="#ffd700"
          strokeOpacity={0.5}
        >
          FUSION
        </Text>
      </group>
      <group ref={outlineBelowRef} position={[0, -1.55, -3.2]} scale={0}>
        <Text
          fontSize={2.8 * vwScale}
          anchorX="center"
          anchorY="middle"
          fillOpacity={0}
          strokeWidth={0.018}
          strokeColor="#ffd700"
          strokeOpacity={0.5}
        >
          FUSION
        </Text>
      </group>

      {/* Layer 2 — dominant FUSION centerpiece (z = -2.0) */}
      <Text3D
        ref={fusionRef as never}
        font={FONT_URL}
        position={[14, 0, -2.0]}
        size={2.8 * vwScale}
        height={0.2}
        bevelEnabled
        bevelThickness={0.03}
        bevelSize={0.02}
        bevelSegments={3}
        curveSegments={6}
        center
      >
        FUSION
        <meshStandardMaterial
          color="#ffd700"
          emissive="#7a4000"
          emissiveIntensity={0.3}
          metalness={0.4}
          roughness={0.3}
          transparent
        />
      </Text3D>

      {/* Layer 1 — foreground solid text (z = -1.5) */}
      <Text
        ref={infiniteRef as never}
        position={[-10, 0.7, -1.5]}
        fontSize={0.9 * vwScale}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        fillOpacity={0.9}
      >
        INFINITE
      </Text>
      <Text
        ref={endlessRef as never}
        position={[10, -0.6, -1.5]}
        fontSize={0.42}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        fillOpacity={0.75}
      >
        ENDLESS POSSIBILITIES
      </Text>

      {/* Glass shapes from section_2.glb Transparents */}
      {glassMeshes.map((gm, i) => (
        <mesh
          key={`glass-${i}`}
          ref={(el) => {
            glassRefs.current[i] = el
          }}
          geometry={gm.geo}
          position={[gm.pos.x * 0.6, gm.pos.y * 0.6, -1.0]}
          scale={0}
        >
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.45}
            roughness={0.04}
            ior={1.5}
            chromaticAberration={0.04}
            distortion={0.28}
            distortionScale={0.32}
            temporalDistortion={0.12}
            backside
            samples={8}
            envMap={envMap}
          />
        </mesh>
      ))}
    </group>
  )
}

useGLTF.preload("/junni/section_2.glb")
