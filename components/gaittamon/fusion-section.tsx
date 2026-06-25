"use client"

import { useMemo, useRef, type MutableRefObject } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useGLTF, useTexture, Text3D } from "@react-three/drei"
import * as THREE from "three"

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const damp = THREE.MathUtils.damp
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeOutBack = (x: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

const FONT_URL = "/fonts/helvetiker_bold.typeface.json"
const CARD_W = 2.5
const CARD_H = 3.5
const SHATTER_P = 0.66

// ---------------------------------------------------------------------------
// ShatterCard — the card front subdivided into a grid of fragments that begin
// assembled at the card position then explode outward as the sphere emerges.
// The fragments ARE the broken card (the solid CardMesh hard-cuts at SHATTER_P).
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
          ((c + 0.5) / cols) * CARD_W - CARD_W / 2,
          ((r + 0.5) / rows) * CARD_H - CARD_H / 2,
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

  useFrame(() => {
    if (!group.current) return
    const p = progressRef.current
    const fit = clamp(viewport.width / 3.6, 0.5, 1)
    const baseScale = 0.72 * fit
    group.current.scale.setScalar(baseScale)

    // Shatter from assembled (0) at SHATTER_P to fully exploded (1) by ~0.82,
    // so at the snap point (0.74) the shards are still in flight and visible.
    const shatter = clamp((p - SHATTER_P) / 0.16)
    const visible = p >= SHATTER_P && p < 0.9
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
      // Persist through the snap point; only fade once nearly fully exploded.
      mat.opacity = 1 - clamp((shatter - 0.7) / 0.3)
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
// FusionSphere — emergent chrome orb. Begins scaling the instant the shatter
// triggers so it breaks through the flying shards; mid-emergence at the snap.
// ---------------------------------------------------------------------------
function FusionSphere({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)

  useFrame((state, delta) => {
    if (!mesh.current) return
    const p = progressRef.current
    // Emergence starts with the shatter; ~0.6 of full size at the snap (0.74).
    const appear = clamp((p - SHATTER_P) / 0.14)
    const exit = clamp((p - 0.85) / 0.05)
    const vis = appear * (1 - exit)
    const t = state.clock.elapsedTime
    const pulse = 1 + Math.sin(t * 1.5) * 0.04
    const target = vis * pulse
    const s = damp(mesh.current.scale.x, target, 6, delta)
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
// BackText — section_3.glb 'BackText' (arched word band) with a vertical wipe.
// ---------------------------------------------------------------------------
function BackText({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const { scene } = useGLTF("/junni/section_3.glb")
  const matRef = useRef<THREE.ShaderMaterial>(null)

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
    // Reveal just after the shatter triggers; exit at p > 0.85.
    const reveal = easeOutCubic(clamp((p - 0.68) / 0.1))
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
    <mesh geometry={data.geometry} position={[0, 0, -4]} scale={1.4}>
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
// Sec3Particle — instanced shard sprites swirling above the sphere, sampling a
// noise texture (additive, HSV cycle) so they read as bright angular shards.
// ---------------------------------------------------------------------------
function Sec3Particle({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const tex = useTexture("/junni/textures/noise.png")
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping

  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(0.2, 0.2)
    const base = new THREE.InstancedBufferGeometry()
    base.index = plane.index
    base.attributes.position = plane.attributes.position
    base.attributes.uv = plane.attributes.uv
    const range = new THREE.Vector3(7, 8, 7)
    const count = 120
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
        tex: { value: tex },
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
        uniform sampler2D tex;
        varying vec2 vUv;
        varying vec2 vNum;
        vec3 hsv2rgb(vec3 c){
          vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }
        void main(){
          // sample the noise texture as an angular shard mask
          float a = texture2D(tex, vUv * 0.5 + vNum.y * 0.5).r;
          a = smoothstep(0.45, 0.65, a);
          if (a < 0.05) discard;
          vec3 hsv = vec3(fract(time * 0.1 + vNum.y * 0.4), 0.85, 1.0);
          gl_FragColor = vec4(hsv2rgb(hsv), a);
        }
      `,
    })
  }, [tex])

  useFrame((state, delta) => {
    if (!matRef.current) return
    const p = progressRef.current
    matRef.current.uniforms.time.value = state.clock.elapsedTime
    // Fully on right when the shatter triggers, stays on through 0.85.
    const appear = clamp((p - SHATTER_P) / 0.04)
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
// SurroundWords — thick 3D extruded words that erupt from the orb center with a
// dot-matrix overshoot, scatter into the shard field angled toward the camera,
// hover during the hold, then keep blowing outward and fade on continued scroll.
// ---------------------------------------------------------------------------
const WORDS = ["FUSION", "MONSTERS", "BATTLE", "ALCHEMY", "EVOLVE"]

function SurroundWords({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const centered = useRef(false)

  // Per-word scatter target, outward direction, tilt and stagger.
  const cfg = useMemo(() => {
    return WORDS.map((_, i) => {
      const angle = (i / WORDS.length) * Math.PI * 2 + 0.4
      const radius = 2.2 + Math.random() * 1.2
      // scatter target — outward + biased toward the camera (positive z)
      const target = new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * 0.7,
        1.0 + Math.random() * 1.8,
      )
      const dir = target.clone().normalize()
      return {
        target,
        dir,
        tiltX: (Math.random() - 0.5) * 1.0,
        tiltY: (Math.random() - 0.5) * 1.2,
        num: i / WORDS.length,
        phase: Math.random() * 6.28,
      }
    })
  }, [])

  useFrame((state, delta) => {
    const p = progressRef.current
    const t = state.clock.elapsedTime

    // Center the extruded geometries once they're ready so they erupt and tilt
    // about their own center.
    if (!centered.current) {
      let allReady = true
      refs.current.forEach((g) => {
        const mesh = g?.children?.[0] as THREE.Mesh | undefined
        if (mesh?.geometry) {
          mesh.geometry.center()
        } else {
          allReady = false
        }
      })
      if (allReady && refs.current.length === WORDS.length) centered.current = true
    }

    const entrance = clamp((p - SHATTER_P) / 0.06)
    const explode = clamp((p - 0.8) / 0.07)

    refs.current.forEach((g, i) => {
      if (!g) return
      const c = cfg[i]
      // dot-matrix overshoot scale-in, staggered per word
      const sRaw = clamp(-c.num + entrance * 1.5)
      let s = easeOutBack(sRaw)
      s *= 1 + explode * 0.6 // keep scaling up as it blows out
      g.scale.setScalar(Math.max(0.0001, s) * 0.5)

      // start at orb center, lerp out to scatter target as it enters
      const base = c.target.clone().multiplyScalar(easeOutCubic(sRaw))
      // continued scroll keeps translating along outward dir
      base.add(c.dir.clone().multiplyScalar(explode * 5.0))
      // hover
      base.y += Math.sin(t * 0.6 + c.phase) * 0.12
      g.position.set(base.x, base.y, base.z)

      // angled toward camera, no spin
      g.rotation.set(c.tiltX, c.tiltY, 0)

      // fade as it blows out
      const mesh = g.children[0] as THREE.Mesh | undefined
      const mat = mesh?.material as (THREE.MeshStandardMaterial | undefined)
      if (mat) {
        mat.transparent = true
        mat.opacity = (1 - explode) * clamp(entrance * 1.5)
      }
    })
  })

  return (
    <group>
      {WORDS.map((word, i) => (
        <group
          key={word}
          ref={(el) => {
            refs.current[i] = el
          }}
          scale={0}
        >
          <Text3D
            font={FONT_URL}
            size={0.6}
            height={0.16}
            curveSegments={6}
            bevelEnabled
            bevelThickness={0.02}
            bevelSize={0.014}
            bevelSegments={3}
          >
            {word}
            <meshStandardMaterial
              color="#ffd700"
              emissive="#7a4000"
              emissiveIntensity={0.35}
              metalness={0.4}
              roughness={0.3}
              transparent
            />
          </Text3D>
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
  const core = useRef<THREE.Group>(null)

  // Cursor-follow: the whole orb + shards + words group drifts with the pointer
  // so the composition parallax-shifts with the mouse during Section 3.
  useFrame((state, delta) => {
    if (!core.current) return
    const p = progressRef.current
    const active = clamp((p - 0.6) / 0.06)
    core.current.position.x = damp(core.current.position.x, state.pointer.x * 0.5 * active, 4, delta)
    core.current.position.y = damp(core.current.position.y, state.pointer.y * 0.4 * active, 4, delta)
  })

  return (
    <group>
      <BackText progressRef={progressRef} />
      <group ref={core}>
        <ShatterCard progressRef={progressRef} />
        <FusionSphere progressRef={progressRef} />
        <SurroundWords progressRef={progressRef} />
      </group>
      <Sec3Particle progressRef={progressRef} />
    </group>
  )
}

useGLTF.preload("/junni/section_3.glb")
