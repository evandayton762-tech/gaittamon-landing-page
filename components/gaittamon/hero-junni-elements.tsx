"use client"

import { useMemo, useRef, type MutableRefObject } from "react"
import { useFrame } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

// ---- Shared shader chunks --------------------------------------------------

const LINES_VERT = /* glsl */ `
uniform float uVisibility;
uniform float len;
varying vec2 vUv;
void main() {
  vec3 pos = position;
  float v = mod(uVisibility, 2.0);
  if (v <= 1.0) {
    pos.y *= v;
  } else {
    pos.y += len;
    pos.y *= 2.0 - v;
    pos.y -= len;
  }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  vUv = uv;
}
`

const LINES_FRAG = /* glsl */ `
uniform float uHeroFade;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(1.0, 1.0, 1.0, uHeroFade);
}
`

const CROSS_VERT = /* glsl */ `
attribute vec3 offsetPos;
attribute float num;
uniform float uRotate;
uniform float uVisibility;
uniform float time;
varying vec3 vPos;

float easeInOutQuad(float t) { return t < 0.5 ? 2.0*t*t : -1.0+(4.0-2.0*t)*t; }
float easeOutBack(float x) {
  float c1 = 1.70158, c3 = c1 + 1.0;
  return 1.0 + c3*pow(x-1.0,3.0) + c1*pow(x-1.0,2.0);
}
#define linearstep(e0,e1,x) min(max(((x)-(e0))/((e1)-(e0)),0.0),1.0)
mat2 rotate2d(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }

void main() {
  vec3 pos = position;
  pos *= uVisibility;
  float r = easeInOutQuad(smoothstep(0.0, 1.0, -num + uRotate * 2.0));
  float ru = easeOutBack(linearstep(0.0, 1.0, -num * 0.5 + uVisibility * 1.5));
  pos.xy *= rotate2d(r * 3.14159 + (1.0 - uVisibility));
  vec4 mvPosition = modelViewMatrix * vec4(pos + offsetPos, 1.0);
  mvPosition.y += mvPosition.y * (1.0 - ru) * 2.0;
  gl_Position = projectionMatrix * mvPosition;
  vPos = mvPosition.xyz + pos * 30.0;
}
`

const CROSS_FRAG = /* glsl */ `
varying vec3 vPos;
uniform float time;
uniform float uHeroFade;
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
void main() {
  vec3 color = hsv2rgb(vec3(-(vPos.x + vPos.y)*0.01 + 0.3 + time*0.1, 1.0, 1.0));
  gl_FragColor = vec4(color, uHeroFade);
}
`

const DOTS_VERT = /* glsl */ `
uniform float uVisibility;
uniform float num;
float easeOutBack(float x) {
  float c1 = 1.70158, c3 = c1 + 1.0;
  return 1.0 + c3*pow(x-1.0,3.0) + c1*pow(x-1.0,2.0);
}
#define linearstep(e0,e1,x) min(max(((x)-(e0))/((e1)-(e0)),0.0),1.0)
void main() {
  vec3 pos = position;
  float v = easeOutBack(linearstep(0.0, 1.0, -num + uVisibility * 1.5));
  pos *= v;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const DOTS_FRAG = /* glsl */ `
uniform float uHeroFade;
void main() {
  gl_FragColor = vec4(1.0, 1.0, 1.0, uHeroFade);
}
`

const SLASH_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const SLASH_FRAG = /* glsl */ `
uniform float uVisibility;
uniform float time;
uniform float uHeroFade;
varying vec2 vUv;
void main() {
  if (step(-1.0 + uVisibility, sin(vUv.x * 30.0 - time * 3.0)) > 0.0) discard;
  gl_FragColor = vec4(1.0, 1.0, 1.0, 0.7 * uHeroFade);
}
`

type Tracked = {
  uniforms: { [k: string]: THREE.IUniform }
  kind: "lines" | "cross" | "dots" | "slash"
  delay: number // seconds (for cross stagger / slash delay)
}

export function HeroJunniElements({
  progressRef,
}: {
  progressRef: MutableRefObject<number>
}) {
  const { scene } = useGLTF("/junni/section_1.glb")
  const groupRef = useRef<THREE.Group>(null)
  const mountAt = useRef<number | null>(null)

  // Build a processed clone: apply shader materials + layout to named objects.
  const { root, tracked } = useMemo(() => {
    const root = scene.clone(true)
    const tracked: Tracked[] = []

    const applyToMeshes = (
      obj: THREE.Object3D | null,
      make: (mesh: THREE.Mesh, idx: number, total: number) => void,
    ) => {
      if (!obj) return
      const meshes: THREE.Mesh[] = []
      obj.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh)
      })
      meshes.forEach((m, i) => make(m, i, meshes.length))
    }

    // Reset parent transforms so repositioning a named child doesn't get the
    // parent transform applied twice.
    const resetParent = (name: string) => {
      const parent = root.getObjectByName(name)
      if (parent) {
        parent.position.set(0, 0, 0)
        parent.rotation.set(0, 0, 0)
        parent.scale.set(1, 1, 1)
      }
    }
    ;["Lines", "Crosses", "Dots", "Slashes", "Gradations"].forEach(resetParent)

    // --- Lines node actually contains SPHERES — render them as a popping
    // dot/sphere cluster (DOTS shader), not bars. ---
    const lines = root.getObjectByName("Lines")
    if (lines) {
      lines.position.set(0, -0.2, 0)
      const meshes: THREE.Mesh[] = []
      lines.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh)
      })
      meshes.forEach((m, i) => {
        const uniforms = {
          uVisibility: { value: 0 },
          num: { value: i / Math.max(1, meshes.length) },
          uHeroFade: { value: 1 },
        }
        m.material = new THREE.ShaderMaterial({
          vertexShader: DOTS_VERT,
          fragmentShader: DOTS_FRAG,
          transparent: true,
          side: THREE.DoubleSide,
          uniforms,
        })
        tracked.push({ uniforms, kind: "dots", delay: 0 })
      })
    }

    // --- Crosses (instanced, 3 per cross) ---
    const crossLayout: Record<string, { pos: [number, number, number]; delay: number }> = {
      Cross_Right: { pos: [2.6, 1.4, 0], delay: 0 },
      Cross_Left: { pos: [-2.8, -1.2, 0], delay: 0.5 },
    }
    for (const name of Object.keys(crossLayout)) {
      const cross = root.getObjectByName(name)
      if (!cross) continue
      cross.position.set(...crossLayout[name].pos)
      cross.scale.setScalar(1.0)
      applyToMeshes(cross, (m) => {
        const src = m.geometry
        const ig = new THREE.InstancedBufferGeometry()
        if (src.index) ig.setIndex(src.index)
        ig.setAttribute("position", src.attributes.position)
        if (src.attributes.uv) ig.setAttribute("uv", src.attributes.uv)
        ig.instanceCount = 3
        ig.setAttribute(
          "offsetPos",
          new THREE.InstancedBufferAttribute(
            new Float32Array([0, 0, 0, 0.2, 0, 0, 0.4, 0, 0]),
            3,
          ),
        )
        ig.setAttribute(
          "num",
          new THREE.InstancedBufferAttribute(new Float32Array([0, 1 / 3, 2 / 3]), 1),
        )
        m.geometry = ig
        const uniforms = {
          uVisibility: { value: 0 },
          uRotate: { value: 0 },
          time: { value: 0 },
          uHeroFade: { value: 1 },
        }
        m.material = new THREE.ShaderMaterial({
          vertexShader: CROSS_VERT,
          fragmentShader: CROSS_FRAG,
          transparent: true,
          side: THREE.DoubleSide,
          uniforms,
        })
        m.frustumCulled = false
        tracked.push({ uniforms, kind: "cross", delay: crossLayout[name].delay })
      })
    }

    // --- Dots ---
    const dotsLayout: Record<string, [number, number, number]> = {
      Dots_RightTop: [-5.0, 3.0, 0],
      Dots_RightBottom: [-2.0, -1.5, 0],
      Dots_LeftBottom: [3.0, -3.5, 0],
    }
    for (const name of Object.keys(dotsLayout)) {
      const dots = root.getObjectByName(name)
      if (!dots) continue
      dots.position.set(...dotsLayout[name])
      const meshes: THREE.Mesh[] = []
      dots.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh)
      })
      meshes.forEach((m, i) => {
        const uniforms = {
          uVisibility: { value: 0 },
          num: { value: i / Math.max(1, meshes.length) },
          uHeroFade: { value: 1 },
        }
        m.material = new THREE.ShaderMaterial({
          vertexShader: DOTS_VERT,
          fragmentShader: DOTS_FRAG,
          transparent: true,
          side: THREE.DoubleSide,
          uniforms,
        })
        tracked.push({ uniforms, kind: "dots", delay: 0 })
      })
    }

    // --- Slashes — the single diagonal line crossing the hero center ---
    const slashes = root.getObjectByName("Slashes")
    if (slashes) {
      slashes.position.set(0, 0, 0.3) // slightly in front of the card
      slashes.scale.setScalar(1.2)
      applyToMeshes(slashes, (m) => {
        const uniforms = {
          uVisibility: { value: 0 },
          time: { value: 0 },
          uHeroFade: { value: 1 },
        }
        m.material = new THREE.ShaderMaterial({
          vertexShader: SLASH_VERT,
          fragmentShader: SLASH_FRAG,
          transparent: true,
          side: THREE.DoubleSide,
          uniforms,
        })
        tracked.push({ uniforms, kind: "slash", delay: 0.5 })
      })
    }

    // --- Gradations (keep embedded materials, just reposition) ---
    const gradLayout: Record<string, [number, number, number]> = {
      Gradation_RightTop: [-3.0, 2.0, 0],
      Gradation_LeftBottom: [3.0, -4.0, 0],
      Gradation_RightBottom: [-2.0, -3.0, 0],
    }
    for (const name of Object.keys(gradLayout)) {
      const g = root.getObjectByName(name)
      if (g) g.position.set(...gradLayout[name])
    }

    // Hide elements we don't drive (logo, baku, spheres) — keep scene tidy.
    for (const hide of ["Logo", "Baku", "Objects", "Camera", "CameraTarget"]) {
      const o = root.getObjectByName(hide)
      if (o) o.visible = false
    }

    return { root, tracked }
  }, [scene])

  useFrame((state) => {
    const g = groupRef.current
    if (!g) return
    const t = state.clock.elapsedTime
    if (mountAt.current === null) mountAt.current = t
    const elapsed = t - (mountAt.current ?? t)
    const p = progressRef.current

    const heroFade = clamp(1 - p / 0.1)
    g.visible = heroFade > 0.01
    if (!g.visible) return

    const exit = clamp((p - 0.08) / 0.09) // letter-split window

    for (const tr of tracked) {
      tr.uniforms.uHeroFade.value = heroFade
      if (tr.uniforms.time) tr.uniforms.time.value = t
      const d = Math.max(0, elapsed - tr.delay)
      if (tr.kind === "lines") {
        const enter = clamp(d / 1.0)
        tr.uniforms.uVisibility.value = enter + exit // 0 -> 1 -> 2
      } else if (tr.kind === "cross") {
        tr.uniforms.uVisibility.value = clamp(d / 1.0)
        // Continuous 0->1 over 2s, looping forever.
        tr.uniforms.uRotate.value = (d % 2) / 2
      } else if (tr.kind === "dots") {
        tr.uniforms.uVisibility.value = clamp(d / 0.5)
      } else if (tr.kind === "slash") {
        const enter = easeOutCubic(clamp(d / 0.5))
        tr.uniforms.uVisibility.value = enter * (1 - exit)
      }
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, -0.5]} scale={0.85}>
      <primitive object={root} />
    </group>
  )
}

useGLTF.preload("/junni/section_1.glb")
