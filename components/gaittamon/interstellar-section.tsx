"use client"

import { useMemo, useRef, type MutableRefObject } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useGLTF, useCubeTexture, useTexture } from "@react-three/drei"
import * as THREE from "three"

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const damp = THREE.MathUtils.damp

// ---------------------------------------------------------------------------
// TextRing — 100 instanced square rings carrying the scrolling outro text,
// orbiting the centered card. Built entirely in code (no GLB geometry).
// ---------------------------------------------------------------------------
function TextRing({
  visRef,
  tex,
}: {
  visRef: MutableRefObject<number>
  tex: THREE.Texture
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const res = 4
    const radius = 0.6
    const height = 0.048
    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    const ringVerts: THREE.Vector3[] = []
    for (let i = 0; i <= res; i++) {
      const theta = (i / res) * Math.PI * 2 + Math.PI / 4
      ringVerts.push(new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0))
    }
    let vi = 0
    for (let i = 0; i < res; i++) {
      const a = ringVerts[i]
      const b = ringVerts[i + 1]
      const uvxA = (i / res) * 5.0
      const uvxB = ((i + 1) / res) * 5.0
      // top & bottom verts for a and b
      positions.push(a.x, a.y, height / 2, a.x, a.y, -height / 2, b.x, b.y, height / 2, b.x, b.y, -height / 2)
      uvs.push(uvxA, 1, uvxA, 0, uvxB, 1, uvxB, 0)
      indices.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2)
      vi += 4
    }
    const base = new THREE.InstancedBufferGeometry()
    base.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
    base.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
    base.setIndex(indices)

    const count = 100
    const num = new Float32Array(count)
    const rnd = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      num[i] = i
      rnd[i * 3] = Math.random()
      rnd[i * 3 + 1] = Math.random()
      rnd[i * 3 + 2] = Math.random()
    }
    base.setAttribute("num", new THREE.InstancedBufferAttribute(num, 1))
    base.setAttribute("rnd", new THREE.InstancedBufferAttribute(rnd, 3))
    base.instanceCount = count
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
      },
      vertexShader: /* glsl */ `
        attribute float num;
        attribute vec3 rnd;
        varying vec2 vUv;
        varying float vAlpha;
        uniform float time;
        uniform float uVisibility;
        float easeInOutQuad(float t){ return t < 0.5 ? 2.0*t*t : -1.0+(4.0-2.0*t)*t; }
        void main(){
          float offsetPos = (mod(num - time * rnd.x, 100.0) - 50.0) * 0.03;
          vec3 pos = position;
          float v = easeInOutQuad(smoothstep(0.0, 1.0, -rnd.x + uVisibility * 2.0));
          pos.xyz *= (0.6 + rnd.y * 0.4) + (1.0 - v) * 0.2;
          pos.z += offsetPos;
          vAlpha = v * smoothstep(1.5, 0.0, abs(offsetPos)) * rnd.y;
          vUv = uv;
          vUv.y += mod(num, 8.0) + 8.0;
          vUv.y /= 16.0;
          vUv.x -= time * rnd.z * 0.1;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tex;
        varying float vAlpha;
        varying vec2 vUv;
        void main(){
          vec4 color = vec4(1.0);
          color.w *= texture2D(tex, vUv).w;
          if (color.w < 0.2) discard;
          color.w *= vAlpha * 0.3;
          gl_FragColor = color;
        }
      `,
    })
  }, [tex])

  useFrame((state, delta) => {
    if (!matRef.current) return
    matRef.current.uniforms.time.value = state.clock.elapsedTime * 6
    const target = visRef.current
    matRef.current.uniforms.uVisibility.value = damp(
      matRef.current.uniforms.uVisibility.value,
      target,
      4,
      delta,
    )
  })

  return <mesh geometry={geometry} material={material} ref={(m) => {
    if (m) matRef.current = (m as THREE.Mesh).material as THREE.ShaderMaterial
  }} />
}

// ---------------------------------------------------------------------------
// Grid — 2250 instanced "+" markers filling a volume around the card.
// ---------------------------------------------------------------------------
function Grid({ visRef }: { visRef: MutableRefObject<number> }) {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const offset = 0.15
    const scale = 0.2
    const positions = new Float32Array([
      offset, 0, 0, offset + scale, 0, 0,
      -offset, 0, 0, -offset - scale, 0, 0,
      0, offset, 0, 0, offset + scale, 0,
      0, -offset, 0, 0, -offset - scale, 0,
    ])
    const index = [0, 1, 2, 3, 4, 5, 6, 7]
    const base = new THREE.InstancedBufferGeometry()
    base.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
    base.setIndex(index)

    const resX = 15
    const resY = 15
    const resZ = 10
    const range = new THREE.Vector3(5, 5, 8)
    const count = resX * resY * resZ
    const offsetPos = new Float32Array(count * 3)
    const num = new Float32Array(count)
    let i = 0
    for (let z = 0; z < resZ; z++) {
      for (let y = 0; y < resY; y++) {
        for (let x = 0; x < resX; x++) {
          offsetPos[i * 3] = (x / (resX - 1) - 0.5) * range.x
          offsetPos[i * 3 + 1] = (y / (resY - 1) - 0.5) * range.y
          offsetPos[i * 3 + 2] = (z / (resZ - 1) - 0.5) * range.z
          num[i] = z
          i++
        }
      }
    }
    base.setAttribute("offsetPos", new THREE.InstancedBufferAttribute(offsetPos, 3))
    base.setAttribute("num", new THREE.InstancedBufferAttribute(num, 1))
    base.instanceCount = count
    return base
  }, [])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: { visibility: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute vec3 offsetPos;
        uniform float visibility;
        varying float vAlpha;
        void main(){
          vec3 pos = position + offsetPos;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          vAlpha = visibility * smoothstep(-10.0, 0.0, mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main(){
          gl_FragColor = vec4(1.0, 1.0, 1.0, 0.15 * vAlpha);
        }
      `,
    })
  }, [])

  useFrame((_, delta) => {
    if (!matRef.current) return
    matRef.current.uniforms.visibility.value = damp(
      matRef.current.uniforms.visibility.value,
      visRef.current,
      4,
      delta,
    )
  })

  return (
    <lineSegments geometry={geometry} ref={(m) => {
      if (m) matRef.current = (m as THREE.LineSegments).material as THREE.ShaderMaterial
    }}>
      <primitive object={material} attach="material" />
    </lineSegments>
  )
}

// ---------------------------------------------------------------------------
// Glass shapes from section_2.glb 'Transparents' with the Section 2 cubemap.
// ---------------------------------------------------------------------------
function GlassShapes({ visRef }: { visRef: MutableRefObject<number> }) {
  const { scene } = useGLTF("/junni/section_2.glb")
  const envMap = useCubeTexture(
    ["px.png", "nx.png", "py.png", "ny.png", "pz.png", "nz.png"],
    { path: "/junni/envmap/sec2/" },
  )
  const group = useRef<THREE.Group>(null)

  const shapes = useMemo(() => {
    const node = scene.getObjectByName("Transparents")
    const out: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = []
    node?.updateWorldMatrix(true, true)
    node?.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.updateWorldMatrix(true, false)
        out.push({ geometry: m.geometry, matrix: m.matrixWorld.clone() })
      }
    })
    return out
  }, [scene])

  const material = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      transmission: 1,
      thickness: 0.45,
      roughness: 0.06,
      ior: 1.5,
      metalness: 0,
      envMap,
      envMapIntensity: 1.2,
      transparent: true,
      color: new THREE.Color("#dfe9ff"),
    })
  }, [envMap])

  useFrame((_, delta) => {
    if (!group.current) return
    const meshes = group.current.children as THREE.Mesh[]
    if (meshes[0]) {
      meshes[0].rotation.y += 0.0028
      meshes[0].rotation.z += 0.0009
    }
    if (meshes[1]) {
      meshes[1].rotation.x += 0.0018
      meshes[1].rotation.y += 0.003
    }
    if (meshes[2]) meshes[2].rotation.x += 0.004
    const v = visRef.current
    const target = v > 0.5 ? 1 : 0
    const s = damp(group.current.scale.x, target, 4, delta)
    group.current.scale.setScalar(s)
    group.current.visible = s > 0.02
  })

  return (
    <group ref={group} scale={0}>
      {shapes.map((s, i) => (
        <mesh key={i} geometry={s.geometry} material={material} position={[(i - 1) * 2.6, 0.4, -1.5]} />
      ))}
    </group>
  )
}

export function InterstellarSection({
  progressRef,
}: {
  progressRef: MutableRefObject<number>
}) {
  const ringTex = useTexture("/junni/textures/outro-text.png")
  const visRef = useRef(0)
  const ringGroup = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    const p = progressRef.current
    // Entrance over [0.40, 0.50], exit over [0.63, 0.71].
    const enter = clamp((p - 0.4) / 0.1)
    const exit = clamp((p - 0.63) / 0.08)
    visRef.current = enter * (1 - exit)
    if (ringGroup.current) {
      ringGroup.current.rotation.y += delta * 0.35
      ringGroup.current.rotation.x = 0.15
    }
  })

  return (
    <group>
      <group ref={ringGroup}>
        <TextRing visRef={visRef} tex={ringTex} />
        <Grid visRef={visRef} />
      </group>
      <GlassShapes visRef={visRef} />
    </group>
  )
}

useGLTF.preload("/junni/section_2.glb")
