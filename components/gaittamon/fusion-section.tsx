"use client"

import { useMemo, useRef, type MutableRefObject } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useGLTF, useTexture, Text } from "@react-three/drei"
import * as THREE from "three"

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const lerp = THREE.MathUtils.lerp
const damp = THREE.MathUtils.damp
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

const CARD_W = 2.5
const CARD_H = 3.5

// ---------------------------------------------------------------------------
// ShatterCard — the card front subdivided into a grid of fragments that begin
// assembled at the card position then explode outward as the sphere emerges.
// ---------------------------------------------------------------------------
function ShatterCard({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  const front = useTexture("/card-front.png")
  front.colorSpace = THREE.SRGBColorSpace

  const cols = 6
  const rows = 8

  const fragments = useMemo(() => {
    const fw = CARD_W / cols
    const fh = CARD_H / rows
    const list: {
      geometry: THREE.PlaneGeometry
      home: THREE.Vector3
      dir: THREE.Vector3
      spin: THREE.Vector3
    }[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const geo = new THREE.PlaneGeometry(fw, fh)
        // Remap UVs to this fragment's sub-region of the front texture.
        const u0 = c / cols
        const u1 = (c + 1) / cols
        const v0 = 1 - (r + 1) / rows
        const v1 = 1 - r / rows
        const uv = geo.attributes.uv as THREE.BufferAttribute
        uv.setXY(0, u0, v1)
        uv.setXY(1, u1, v1)
        uv.setXY(2, u0, v0)
        uv.setXY(3, u1, v0)
        uv.needsUpdate = true
        const home = new THREE.Vector3(
          (c + 0.5) / cols * CARD_W - CARD_W / 2,
          (r + 0.5) / rows * CARD_H - CARD_H / 2,
          0,
        )
        const dir = new THREE.Vector3(
          home.x + (Math.random() - 0.5) * 1.2,
          home.y + (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 4,
        ).normalize()
        const spin = new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6,
        )
        list.push({ geometry: geo, home, dir, spin })
      }
    }
    return list
  }, [])

  const { viewport } = useThree()

  useFrame((_, delta) => {
    if (!group.current) return
    const p = progressRef.current
    const fit = clamp(viewport.width / 3.6, 0.5, 1)
    const baseScale = 0.72 * fit
    group.current.scale.setScalar(baseScale)

    // Shatter drives from assembled (0) to fully exploded (1).
    const shatter = clamp((p - 0.66) / 0.12)
    const visible = p > 0.63 && p < 0.86
    group.current.visible = visible
    if (!visible) return

    const meshes = group.current.children as THREE.Mesh[]
    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i]
      const f = fragments[i]
      const dist = shatter * (3 + f.dir.length())
      m.position.set(
        f.home.x + f.dir.x * dist * 2,
        f.home.y + f.dir.y * dist * 2,
        f.home.z + f.dir.z * dist * 2,
      )
      m.rotation.x = f.spin.x * shatter
      m.rotation.y = f.spin.y * shatter
      m.rotation.z = f.spin.z * shatter
      const mat = m.material as THREE.MeshStandardMaterial
      // Fade fragments out as they finish exploding.
      mat.opacity = damp(mat.opacity, 1 - clamp((shatter - 0.5) / 0.5), 8, delta)
    }
  })

  return (
    <group ref={group}>
      {fragments.map((f, i) => (
        <mesh key={i} geometry={f.geometry}>
          <meshStandardMaterial
            map={front}
            transparent
            side={THREE.DoubleSide}
            metalness={0.3}
            roughness={0.5}
            emissive="#0a3a4a"
            emissiveIntensity={0.2}
          />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// FusionSphere — emergent orb (placeholder for a future fusion-creature GLB).
// ---------------------------------------------------------------------------
function FusionSphere({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)

  useFrame((state, delta) => {
    if (!mesh.current) return
    const p = progressRef.current
    const appear = clamp((p - 0.72) / 0.08)
    const exit = clamp((p - 0.85) / 0.05)
    const vis = appear * (1 - exit)
    const t = state.clock.elapsedTime
    const pulse = 1 + Math.sin(t * 1.5) * 0.04
    const target = vis * pulse
    const s = damp(mesh.current.scale.x, target, 5, delta)
    mesh.current.scale.setScalar(s)
    mesh.current.visible = s > 0.02
    mesh.current.rotation.y += delta * 0.3
    mesh.current.rotation.x = Math.sin(t * 0.4) * 0.15
    if (mat.current) mat.current.emissiveIntensity = 0.6 + Math.sin(t * 2) * 0.2
  })

  return (
    <mesh ref={mesh} scale={0} position={[0, 0, 0]}>
      <icosahedronGeometry args={[1.1, 4]} />
      <meshStandardMaterial
        ref={mat}
        color="#1a0f33"
        emissive="#ffb400"
        emissiveIntensity={0.7}
        metalness={0.85}
        roughness={0.18}
      />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// BackText — section_3.glb 'BackText' with a vertical wipe reveal.
// ---------------------------------------------------------------------------
function BackText({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const { scene } = useGLTF("/junni/section_3.glb")
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const meshRef = useRef<THREE.Mesh>(null)

  const data = useMemo(() => {
    const node = scene.getObjectByName("BackText") as THREE.Mesh | null
    if (!node) return null
    const srcMat = node.material as THREE.MeshStandardMaterial
    const tex = srcMat?.map ?? null
    return { geometry: node.geometry, tex }
  }, [scene])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTex: { value: data?.tex ?? null },
        time: { value: 0 },
        uVisibility: { value: 0 },
      },
      vertexShader: /* glsl */ `
        uniform float time;
        varying vec2 vUv;
        void main(){
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          vUv = uv;
          vUv.x += time * 0.02;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        uniform float uVisibility;
        varying vec2 vUv;
        void main(){
          vec4 col = texture2D(uTex, vUv);
          col.w *= step(abs(vUv.y - 0.5), uVisibility * 0.5);
          if (col.w < 0.5) discard;
          gl_FragColor = col;
        }
      `,
    })
  }, [data])

  useFrame((state, delta) => {
    if (!matRef.current) return
    const p = progressRef.current
    matRef.current.uniforms.time.value = state.clock.elapsedTime
    // Reveal when shatter triggers (p > 0.72), exit at p > 0.85.
    const reveal = easeOutCubic(clamp((p - 0.72) / 0.1))
    const exit = clamp((p - 0.85) / 0.05)
    const target = reveal * (1 - exit)
    matRef.current.uniforms.uVisibility.value = damp(
      matRef.current.uniforms.uVisibility.value,
      target,
      4,
      delta,
    )
  })

  if (!data) return null
  return (
    <mesh
      ref={meshRef}
      geometry={data.geometry}
      position={[0, 0, -4]}
      scale={1.4}
    >
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

// ---------------------------------------------------------------------------
// Sec3Particle — 100 colourful HSV planes swirling above the sphere.
// ---------------------------------------------------------------------------
function Sec3Particle({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(0.2, 0.2)
    const base = new THREE.InstancedBufferGeometry()
    base.index = plane.index
    base.attributes.position = plane.attributes.position
    base.attributes.uv = plane.attributes.uv
    const range = new THREE.Vector3(7, 8, 7)
    const count = 100
    const offsetPos = new Float32Array(count * 3)
    const num = new Float32Array(count * 2)
    for (let i = 0; i < count; i++) {
      offsetPos[i * 3] = Math.random() * range.x
      offsetPos[i * 3 + 1] = Math.random() * range.y
      offsetPos[i * 3 + 2] = Math.random() * range.z
      num[i * 2] = i
      num[i * 2 + 1] = Math.random() * 0.95 + 0.05
    }
    base.setAttribute("offsetPos", new THREE.InstancedBufferAttribute(offsetPos, 3))
    base.setAttribute("num", new THREE.InstancedBufferAttribute(num, 2))
    base.instanceCount = count
    return base
  }, [])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        time: { value: 0 },
        range: { value: new THREE.Vector3(7, 8, 7) },
        uVisibility: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 offsetPos;
        attribute vec2 num;
        uniform float time;
        uniform vec3 range;
        uniform float uVisibility;
        varying vec2 vUv;
        varying vec2 vNum;
        #define linearstep(e0,e1,x) min(max(((x)-(e0))/((e1)-(e0)),0.0),1.0)
        mat2 rotate2d(float a){ return mat2(cos(a),-sin(a),sin(a),cos(a)); }
        void main(){
          vec3 oPos = offsetPos;
          float center = linearstep(5.0, 1.0, length(oPos.xz - range.xz / 2.0));
          oPos.y += time * center;
          oPos = mod(oPos, range);
          oPos -= range / 2.0;
          oPos.xz *= rotate2d(time * center);
          oPos.xz *= 1.0 + (1.0 - uVisibility);
          vec3 pos = position;
          vec3 hrange = range / 2.0;
          pos *= smoothstep(hrange.y, hrange.y - 0.5, abs(oPos.y));
          pos *= num.y;
          pos *= 1.0 + exp(-mod(time * 1.0 + num.y * 2.0, 1.0) * 7.0) * 3.0 * num.y;
          pos.xy *= rotate2d(time * num.y);
          pos += oPos;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          vUv = uv;
          vNum = num;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float time;
        varying vec2 vUv;
        varying vec2 vNum;
        vec3 hsv2rgb(vec3 c){
          vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }
        void main(){
          vec2 d = vUv - 0.5;
          float circle = smoothstep(0.5, 0.1, length(d));
          vec4 color = vec4(1.0);
          vec3 hsv = vec3(fract(time * 0.1 + vNum.y * 0.4), 0.8, 1.0);
          color.xyz = hsv2rgb(hsv);
          color.w = circle;
          gl_FragColor = color;
        }
      `,
    })
  }, [])

  useFrame((state, delta) => {
    if (!matRef.current) return
    const p = progressRef.current
    matRef.current.uniforms.time.value = state.clock.elapsedTime
    const appear = clamp((p - 0.72) / 0.06)
    const exit = clamp((p - 0.85) / 0.05)
    const target = appear * (1 - exit)
    matRef.current.uniforms.uVisibility.value = damp(
      matRef.current.uniforms.uVisibility.value,
      target,
      4,
      delta,
    )
  })

  return (
    <mesh geometry={geometry} position={[0, 2.8, 0]} frustumCulled={false}>
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

// ---------------------------------------------------------------------------
// Carousel — curved word ring that emerges from the center horizon, arcs out
// on a back-tilted ring, then recedes to the center line and fades.
// ---------------------------------------------------------------------------
const WORDS = ["FUSION", "MONSTERS", "BATTLE", "ALCHEMY"]

function Carousel({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const ring = useRef<THREE.Group>(null)
  const wordRefs = useRef<(THREE.Group | null)[]>([])
  const radius = 5.8

  useFrame((_, delta) => {
    if (!ring.current) return
    const p = progressRef.current
    const enter = clamp((p - 0.77) / 0.06)
    const exit = clamp((p - 0.84) / 0.03)
    const vis = enter * (1 - exit)
    ring.current.visible = vis > 0.01
    ring.current.rotation.x = -1.45
    ring.current.rotation.z += 0.0038

    wordRefs.current.forEach((w, i) => {
      if (!w) return
      // Each word emerges from the center (radius 0) out to the ring radius,
      // staggered; exit collapses back to the center line.
      const stagger = i * 0.06
      const localVis = clamp((vis - stagger) / (1 - stagger))
      const eased = easeInOutCubic(localVis)
      const r = radius * eased
      const angle = (i / WORDS.length) * Math.PI * 2
      w.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0)
      const s = damp(w.scale.x, eased, 6, delta)
      w.scale.setScalar(s)
    })
  })

  return (
    <group ref={ring}>
      {WORDS.map((word, i) => (
        <group
          key={word}
          ref={(el) => {
            wordRefs.current[i] = el
          }}
          scale={0}
        >
          <Text
            fontSize={0.9}
            color="#ffd700"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.006}
            outlineColor="#3a1500"
          >
            {word}
          </Text>
        </group>
      ))}
    </group>
  )
}

export function FusionSection({
  progressRef,
}: {
  progressRef: MutableRefObject<number>
}) {
  return (
    <group>
      <ShatterCard progressRef={progressRef} />
      <FusionSphere progressRef={progressRef} />
      <BackText progressRef={progressRef} />
      <Sec3Particle progressRef={progressRef} />
      <Carousel progressRef={progressRef} />
    </group>
  )
}

useGLTF.preload("/junni/section_3.glb")
