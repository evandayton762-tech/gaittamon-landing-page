"use client"

import { useMemo, useRef, type MutableRefObject } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import {
  Text,
  MeshTransmissionMaterial,
  useGLTF,
  useCubeTexture,
  useTexture,
} from "@react-three/drei"
import * as THREE from "three"

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const damp = THREE.MathUtils.damp
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4)
const easeOutBack = (x: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}
const easeInCubic = (t: number) => t * t * t
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

type TextMesh = THREE.Mesh & {
  material: THREE.Material & { opacity: number; transparent: boolean }
}

// ---------------------------------------------------------------------------
// Slides — Junni's Section 2 background: 50 instanced textured bands wrapped on
// an elliptical cylinder, each sheared diagonally and scrolling its texture at
// its own rate. Replaces the old flat 3-row implementation.
// ---------------------------------------------------------------------------
function Slides({ visRef, tex }: { visRef: MutableRefObject<number>; tex: THREE.Texture }) {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const res = 4
    const radius = 9.0
    const height = 1.6
    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    for (let i = 0; i <= res; i++) {
      const theta = (i / res) * Math.PI * 2 + Math.PI / 4
      const x = Math.cos(theta) * radius * 2.0
      const z = Math.sin(theta) * radius
      positions.push(x, height / 2, z) // top
      positions.push(x, -height / 2, z) // bottom
      uvs.push(i / res, 1, i / res, 0)
    }
    for (let i = 0; i < res; i++) {
      const a = i * 2
      const b = i * 2 + 1
      const c = (i + 1) * 2
      const d = (i + 1) * 2 + 1
      indices.push(a, b, c, b, d, c)
    }
    const base = new THREE.InstancedBufferGeometry()
    base.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
    base.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
    base.setIndex(indices)

    const num = 50
    const offsetPos = new Float32Array(num * 3)
    const scaleArr = new Float32Array(num)
    const rndArr = new Float32Array(num * 2)
    const speedArr = new Float32Array(num)
    let yCursor = 0
    for (let i = 0; i < num; i++) {
      const scale = 0.3 + Math.random() * 1.0 // 0.3 - 1.3
      scaleArr[i] = scale
      offsetPos[i * 3] = 0
      offsetPos[i * 3 + 1] = yCursor
      offsetPos[i * 3 + 2] = 0
      yCursor -= scale * height * 0.8
      rndArr[i * 2] = Math.random()
      rndArr[i * 2 + 1] = Math.random()
      speedArr[i] = 0.5 + Math.random()
    }
    // Recenter the stack vertically.
    const shift = yCursor / 2
    for (let i = 0; i < num; i++) offsetPos[i * 3 + 1] -= shift

    base.setAttribute("offsetPos", new THREE.InstancedBufferAttribute(offsetPos, 3))
    base.setAttribute("scale", new THREE.InstancedBufferAttribute(scaleArr, 1))
    base.setAttribute("rnd", new THREE.InstancedBufferAttribute(rndArr, 2))
    base.setAttribute("speed", new THREE.InstancedBufferAttribute(speedArr, 1))
    base.instanceCount = num
    return base
  }, [])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      uniforms: {
        tex: { value: tex },
        time: { value: 0 },
        uVisibility: { value: 0 },
        uSectionViewing: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 offsetPos;
        attribute float scale;
        attribute vec2 rnd;
        attribute float speed;
        uniform float time;
        uniform float uSectionViewing;
        varying vec2 vUv;
        void main(){
          vec3 pos = position;
          pos.y *= scale;
          pos.y += pos.x * 0.25;   // diagonal shear
          pos += offsetPos;
          vUv = uv;
          vUv.x *= 5.0;
          vUv.x += time * 0.1 * speed * rnd.x + rnd.y + uSectionViewing * rnd.x;
          vUv.x /= scale;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tex;
        uniform float uVisibility;
        varying vec2 vUv;
        void main(){
          vec4 text = texture2D(tex, vUv);
          if (text.w < 0.2) discard;
          gl_FragColor = vec4(vec3(0.9), uVisibility * text.w);
        }
      `,
    })
  }, [tex])

  useFrame((state, delta) => {
    if (!matRef.current) return
    matRef.current.uniforms.time.value = state.clock.elapsedTime
    matRef.current.uniforms.uVisibility.value = damp(
      matRef.current.uniforms.uVisibility.value,
      visRef.current,
      4,
      delta,
    )
    matRef.current.uniforms.uSectionViewing.value = visRef.current
  })

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={-1}>
      <primitive
        object={material}
        attach="material"
        ref={(m: THREE.ShaderMaterial) => {
          matRef.current = m
        }}
      />
    </mesh>
  )
}

export function LayeredTextSection({
  progressRef,
}: {
  progressRef: MutableRefObject<number>
}) {
  const group = useRef<THREE.Group>(null)
  const container = useRef<THREE.Group>(null)
  const { viewport } = useThree()
  const vwScale = viewport.width / 10

  // Word refs (flat Text meshes)
  const fusionRef = useRef<TextMesh>(null)
  const outlineAboveRef = useRef<TextMesh>(null)
  const outlineBelowRef = useRef<TextMesh>(null)
  const infiniteRef = useRef<TextMesh>(null)
  const endlessRef = useRef<TextMesh>(null)

  const slideVisRef = useRef(0)

  // Background bands texture.
  const bgText = useTexture("/junni/textures/sec2-bg-text.png")
  bgText.wrapS = THREE.RepeatWrapping
  bgText.wrapT = THREE.RepeatWrapping

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

  // Each word: [ref, finalX, finalY, fontSize, baseOpacity, entranceDelay]
  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const p = progressRef.current
    const t = state.clock.elapsedTime

    const sTypo = clamp((p - 0.17) / 0.1)
    const sTypoExit = clamp((p - 0.37) / 0.09)
    const groupOpacity = sTypo * (1 - sTypoExit)
    g.visible = groupOpacity > 0.005
    slideVisRef.current = groupOpacity
    if (!g.visible) {
      // Make sure glass cannot linger once the section has exited.
      glassRefs.current.forEach((m) => {
        if (m) {
          m.scale.setScalar(0)
          m.visible = false
        }
      })
      return
    }

    // Container: slight up-right tilt + gentle perpetual hover (bounded, never
    // drifts) — Junni's continuous container rotation, oscillation form.
    if (container.current) {
      container.current.rotation.z = 0.06
      container.current.rotation.x = Math.sin(t * 0.4) * 0.12
      container.current.rotation.y = Math.sin(t * 0.33 + 1) * 0.06
    }

    // Word entrance: twist (rotation.x 4 -> 0) + scale-in with overshoot + fade.
    // Exit: fade + scale down.
    const placeWord = (
      ref: { current: TextMesh | null },
      fy: number,
      baseOpacity: number,
      delay: number,
    ) => {
      const m = ref.current
      if (!m) return
      const tin = clamp((sTypo - delay) / (1 - delay))
      const twist = (1 - tin) * 4.0
      const scaleIn = easeOutBack(clamp(tin)) // overshoot pop
      const tout = easeInCubic(sTypoExit)
      m.rotation.x = twist * (1 - tout)
      m.rotation.z = 0
      const s = scaleIn * (1 - tout)
      m.scale.setScalar(Math.max(0.0001, s))
      m.position.y = fy
      m.material.transparent = true
      m.material.opacity = baseOpacity * easeOutQuart(tin) * (1 - tout)
    }

    // Fixed, heavily overlapping layout (positions set on the JSX; entrance
    // only animates twist/scale/opacity).
    placeWord(fusionRef, 0, 1, 0)
    placeWord(outlineAboveRef, 1.0, 0.5, 0.05)
    placeWord(outlineBelowRef, -1.0, 0.5, 0.05)
    placeWord(infiniteRef, 0.55, 0.95, 0.12)
    placeWord(endlessRef, -0.5, 0.8, 0.18)

    // Glass shapes: rotate + spring scale entrance staggered + pointer-follow nudge.
    const glassDelays = [0.15, 0.25, 0.32]
    const px = state.pointer.x
    const py = state.pointer.y
    glassRefs.current.forEach((m, i) => {
      if (!m) return
      const tin = easeInOutCubic(clamp((sTypo - glassDelays[i]) / 0.4))
      const sc = tin * (1 - easeInCubic(sTypoExit))
      const visible = groupOpacity > 0.005 && sc > 0.005
      m.visible = visible
      m.scale.setScalar(sc * (glassMeshes[i]?.scl || 1))
      // Idle self-rotation (per-shape, different axes)
      if (i === 0) {
        m.rotation.y += 0.0028
        m.rotation.z += 0.0009
      } else if (i === 1) {
        m.rotation.x += 0.0018
        m.rotation.y += 0.003
      } else {
        m.rotation.x += 0.004
      }
      // Damped pointer nudge — shape tilts toward cursor
      m.rotation.y = damp(m.rotation.y, m.rotation.y + px * 0.18, 5, delta)
      m.rotation.x = damp(m.rotation.x, m.rotation.x + (-py) * 0.12, 5, delta)
    })
  })

  return (
    <group ref={group} visible={false}>
      {/* Background — 50 instanced curved textured bands */}
      <Slides visRef={slideVisRef} tex={bgText} />

      {/* Hovering / tilted typography container */}
      <group ref={container}>
        {/* Hollow FUSION outline ABOVE (one layer behind) */}
        <Text
          ref={outlineAboveRef as never}
          position={[0, 1.0, -2.8]}
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

        {/* Hollow FUSION outline BELOW (one layer behind) */}
        <Text
          ref={outlineBelowRef as never}
          position={[0, -1.0, -2.8]}
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

        {/* Dominant solid FUSION (flat, gold) — dead center */}
        <Text
          ref={fusionRef as never}
          position={[0, 0, -2.6]}
          fontSize={2.8 * vwScale}
          color="#ffd700"
          anchorX="center"
          anchorY="middle"
          fillOpacity={1}
        >
          FUSION
        </Text>

        {/* INFINITE — front, off-center, overlapping FUSION's upper-left */}
        <Text
          ref={infiniteRef as never}
          position={[-1.0, 0.55, -2.3]}
          fontSize={0.95 * vwScale}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          fillOpacity={0.95}
        >
          INFINITE
        </Text>

        {/* ENDLESS POSSIBILITIES — off-center lower-right */}
        <Text
          ref={endlessRef as never}
          position={[1.0, -0.5, -2.3]}
          fontSize={0.4}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.08}
          fillOpacity={0.8}
        >
          ENDLESS POSSIBILITIES
        </Text>
      </group>

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
          visible={false}
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
