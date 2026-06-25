"use client"

import { useMemo, useRef, type MutableRefObject } from "react"
import { useFrame } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInQuad = (t: number) => t * t

// ---- Shared shader chunks --------------------------------------------------

// Diagonal line that GROWS from the middle on enter and SHRINKS back toward the
// middle on exit (Junni Section1/Lines vertex shader). uVisibility 0->1 grows,
// 1->2 shrinks.
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

// Big translucent "balls" — soft fresnel shell tinted to the brand palette.
const BALL_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`

const BALL_FRAG = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uHeroFade;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float f = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.2);
  vec3 col = mix(uColorA, uColorB, f);
  float a = (0.10 + f * 0.65) * uHeroFade * uOpacity;
  gl_FragColor = vec4(col, a);
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

type Tracked = {
  uniforms: { [k: string]: THREE.IUniform }
  kind: "slash" | "cross" | "dots"
  delay: number
}

// A "ball": individually transformed sphere with a region-based exit.
type Ball = {
  mesh: THREE.Mesh
  uniforms: { [k: string]: THREE.IUniform }
  home: THREE.Vector3
  baseScale: number
  region: "top" | "middle" | "bottom"
}

export function HeroJunniElements({
  progressRef,
}: {
  progressRef: MutableRefObject<number>
}) {
  const { scene } = useGLTF("/junni/section_1.glb")
  const groupRef = useRef<THREE.Group>(null)
  const mountAt = useRef<number | null>(null)

  const { root, tracked, balls } = useMemo(() => {
    const root = scene.clone(true)
    const tracked: Tracked[] = []
    const balls: Ball[] = []

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

    // Reset named parent transforms so repositioning children isn't doubled.
    const resetParent = (name: string) => {
      const parent = root.getObjectByName(name)
      if (parent) {
        parent.position.set(0, 0, 0)
        parent.rotation.set(0, 0, 0)
        parent.scale.set(1, 1, 1)
      }
    }
    ;["Lines", "Crosses", "Slashes", "Dots", "Gradations"].forEach(resetParent)

    // --- The big translucent BALLS live under the `Lines` node (Sphere.*). ---
    // Spread them to the corners/edges so they frame the card instead of
    // covering the Xs and dot-matrix, and shrink them to background accents.
    const lines = root.getObjectByName("Lines")
    if (lines) {
      const sphereMeshes: THREE.Mesh[] = []
      lines.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) sphereMeshes.push(o as THREE.Mesh)
      })
      // Hand-placed layout (by eye): spread, behind the card, varied size.
      const layout: {
        pos: [number, number, number]
        scale: number
        region: Ball["region"]
        color: [string, string]
      }[] = [
        { pos: [-3.4, 2.2, -2.0], scale: 0.55, region: "top", color: ["#3a2a6a", "#b48cff"] },
        { pos: [3.6, 1.6, -2.6], scale: 0.42, region: "top", color: ["#4a3a1a", "#e6c074"] },
        { pos: [0.2, 0.1, -3.2], scale: 0.7, region: "middle", color: ["#2a2050", "#8a6aff"] },
        { pos: [-3.0, -2.4, -2.2], scale: 0.5, region: "bottom", color: ["#3a2a6a", "#c79a3a"] },
        { pos: [3.0, -2.2, -2.4], scale: 0.46, region: "bottom", color: ["#241a44", "#a98cff"] },
      ]
      sphereMeshes.forEach((m, i) => {
        const cfg = layout[i % layout.length]
        const uniforms = {
          uHeroFade: { value: 1 },
          uOpacity: { value: 1 },
          uColorA: { value: new THREE.Color(cfg.color[0]) },
          uColorB: { value: new THREE.Color(cfg.color[1]) },
        }
        m.material = new THREE.ShaderMaterial({
          vertexShader: BALL_VERT,
          fragmentShader: BALL_FRAG,
          transparent: true,
          depthWrite: false,
          side: THREE.FrontSide,
          uniforms,
        })
        m.renderOrder = -2
        m.position.set(...cfg.pos)
        m.scale.setScalar(cfg.scale)
        balls.push({
          mesh: m,
          uniforms,
          home: new THREE.Vector3(...cfg.pos),
          baseScale: cfg.scale,
          region: cfg.region,
        })
      })
    }

    // --- Crosses (instanced ×, 3 per cross) — rainbow, rotating. ---
    const crossLayout: Record<string, { pos: [number, number, number]; delay: number }> = {
      Cross_Right: { pos: [2.4, 0.6, 0.4], delay: 0 },
      Cross_Left: { pos: [-2.6, -0.4, 0.4], delay: 0.5 },
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
          // Render the Xs cleanly ABOVE the translucent balls — no z-fighting.
          depthTest: false,
          depthWrite: false,
          uniforms,
        })
        m.renderOrder = 10
        m.frustumCulled = false
        tracked.push({ uniforms, kind: "cross", delay: crossLayout[name].delay })
      })
    }

    // --- Dot-matrix (small white spheres) — easeOutBack pop, in FRONT. ---
    const dotsLayout: Record<string, [number, number, number]> = {
      Dots_RightTop: [-4.6, 2.8, 0.6],
      Dots_RightBottom: [-1.8, -1.4, 0.6],
      Dots_LeftBottom: [2.8, -3.0, 0.6],
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
          depthWrite: false,
          side: THREE.DoubleSide,
          uniforms,
        })
        m.renderOrder = 6
        tracked.push({ uniforms, kind: "dots", delay: 0 })
      })
    }

    // --- Slash — the diagonal line that grows/shrinks from the middle. ---
    const slashes = root.getObjectByName("Slashes")
    if (slashes) {
      slashes.position.set(0, 0, 0.2)
      slashes.scale.setScalar(1.3)
      applyToMeshes(slashes, (m) => {
        m.geometry.computeBoundingBox()
        const bb = m.geometry.boundingBox
        const len = bb ? bb.max.y - bb.min.y : 1
        const uniforms = {
          uVisibility: { value: 0 },
          len: { value: len },
          uHeroFade: { value: 1 },
        }
        m.material = new THREE.ShaderMaterial({
          vertexShader: LINES_VERT,
          fragmentShader: LINES_FRAG,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          uniforms,
        })
        m.renderOrder = 5
        tracked.push({ uniforms, kind: "slash", delay: 0.4 })
      })
    }

    // Reposition gradations (keep embedded materials).
    const gradLayout: Record<string, [number, number, number]> = {
      Gradation_RightTop: [-3.0, 2.0, -1.0],
      Gradation_LeftBottom: [3.0, -4.0, -1.0],
      Gradation_RightBottom: [-2.0, -3.0, -1.0],
    }
    for (const name of Object.keys(gradLayout)) {
      const g = root.getObjectByName(name)
      if (g) g.position.set(...gradLayout[name])
    }

    // Hide elements we don't drive.
    for (const hide of ["Logo", "Baku", "Objects", "Camera", "CameraTarget"]) {
      const o = root.getObjectByName(hide)
      if (o) o.visible = false
    }

    return { root, tracked, balls }
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

    const exit = clamp((p - 0.02) / 0.1) // hero leave window
    const exitE = easeInQuad(exit)

    // Shader-driven elements.
    for (const tr of tracked) {
      tr.uniforms.uHeroFade.value = heroFade
      if (tr.uniforms.time) tr.uniforms.time.value = t
      const d = Math.max(0, elapsed - tr.delay)
      if (tr.kind === "slash") {
        const enter = clamp(d / 1.0)
        tr.uniforms.uVisibility.value = enter + exit // 0 -> 1 -> 2 (grow then shrink)
      } else if (tr.kind === "cross") {
        tr.uniforms.uVisibility.value = clamp(d / 1.0)
        tr.uniforms.uRotate.value = (d % 2) / 2 // loop 0->1 over 2s
      } else if (tr.kind === "dots") {
        tr.uniforms.uVisibility.value = clamp(d / 0.5)
      }
    }

    // Balls: enter scale-in, then region-based directional exit + fade.
    const enterBall = easeOutCubic(clamp(elapsed / 0.9))
    for (const b of balls) {
      let dx = 0
      let dy = 0
      let scaleMul = 1
      if (b.region === "top") {
        dy = exitE * 4.0 // travel UP and out
      } else if (b.region === "bottom") {
        dy = -exitE * 4.0 // travel DOWN and out
      } else {
        scaleMul = 1 - exitE // middle shrinks toward 0
      }
      const floatY = Math.sin(t * 0.5 + b.home.x) * 0.08
      b.mesh.position.set(b.home.x, b.home.y + dy + floatY, b.home.z)
      b.mesh.scale.setScalar(b.baseScale * enterBall * scaleMul)
      // All fade out together as the hero clears.
      b.uniforms.uOpacity.value = 1 - exitE
      b.uniforms.uHeroFade.value = heroFade
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, -0.4]} scale={0.9}>
      <primitive object={root} />
    </group>
  )
}

useGLTF.preload("/junni/section_1.glb")
