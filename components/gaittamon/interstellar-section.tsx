"use client"

import { useMemo, useRef, type MutableRefObject } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useTexture } from "@react-three/drei"
import * as THREE from "three"

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const damp = THREE.MathUtils.damp

// ---------------------------------------------------------------------------
// InterstellarParticle — ambient embers in gold/purple around the interstellar
// grid. Reuses the same Junni Sec3Particle vertex + HSV-constrained fragment.
// ---------------------------------------------------------------------------
function useParticleSpriteSheet() {
  return useMemo(() => {
    const cellSize = 64
    const cells = 6
    const canvas = document.createElement("canvas")
    canvas.width = cellSize * cells
    canvas.height = cellSize
    const ctx = canvas.getContext("2d")!
    const c0 = (cx: number, cy: number) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26)
      g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)")
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill()
    }
    const c1 = (cx: number, cy: number) => {
      ctx.fillStyle = "rgba(255,255,255,0.9)"
      ctx.fillRect(cx - 3, cy - 18, 6, 36); ctx.fillRect(cx - 18, cy - 3, 36, 6)
    }
    const c2 = (cx: number, cy: number) => {
      ctx.fillStyle = "rgba(255,255,255,0.85)"
      ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx + 18, cy + 14); ctx.lineTo(cx - 18, cy + 14); ctx.closePath(); ctx.fill()
    }
    const c3 = (cx: number, cy: number) => {
      ctx.fillStyle = "rgba(255,255,255,0.85)"
      ctx.beginPath(); ctx.moveTo(cx, cy - 22); ctx.lineTo(cx + 14, cy); ctx.lineTo(cx, cy + 22); ctx.lineTo(cx - 14, cy); ctx.closePath(); ctx.fill()
    }
    const c4 = (cx: number, cy: number) => {
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 4
      ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.stroke()
    }
    const c5 = (cx: number, cy: number) => {
      ctx.fillStyle = "rgba(255,255,255,0.9)"
      for (let s = 0; s < 4; s++) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(s * Math.PI / 4)
        ctx.fillRect(-2, -24, 4, 48); ctx.restore()
      }
    }
    const fns = [c0, c1, c2, c3, c4, c5]
    fns.forEach((fn, i) => { ctx.save(); fn(i * cellSize + cellSize / 2, cellSize / 2); ctx.restore() })
    return new THREE.CanvasTexture(canvas)
  }, [])
}

function InterstellarParticle({ visRef }: { visRef: MutableRefObject<number> }) {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const spriteTex = useParticleSpriteSheet()

  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(0.2, 0.2)
    const base = new THREE.InstancedBufferGeometry()
    base.index = plane.index
    base.attributes.position = plane.attributes.position
    base.attributes.uv = plane.attributes.uv
    const range = new THREE.Vector3(7, 8, 7)
    const count = 80
    const offsetPos = new Float32Array(count * 3)
    const num = new Float32Array(count * 2)
    for (let i = 0; i < count; i++) {
      offsetPos[i * 3] = Math.random() * range.x
      offsetPos[i * 3 + 1] = Math.random() * range.y
      offsetPos[i * 3 + 2] = Math.random() * range.z
      num[i * 2] = i; num[i * 2 + 1] = Math.random() * 0.95 + 0.05
    }
    base.setAttribute("offsetPos", new THREE.InstancedBufferAttribute(offsetPos, 3))
    base.setAttribute("num", new THREE.InstancedBufferAttribute(num, 2))
    base.instanceCount = count
    return base
  }, [])

  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      time: { value: 0 }, range: { value: new THREE.Vector3(7, 8, 7) },
      uVisibility: { value: 0 }, tex: { value: spriteTex },
    },
    vertexShader: /* glsl */ `
      attribute vec3 offsetPos; attribute vec2 num;
      uniform float time; uniform vec3 range; uniform float uVisibility;
      varying vec2 vUv; varying vec2 vNum;
      #define linearstep(e0,e1,x) min(max(((x)-(e0))/((e1)-(e0)),0.0),1.0)
      mat2 rotate2d(float a){ return mat2(cos(a),-sin(a),sin(a),cos(a)); }
      vec2 spriteUVSelector(vec2 uv, vec2 tile, float frames, float t){
        float f = floor(frames * mod(t,1.0));
        uv.x += mod(f,tile.x); uv.y -= floor(f/tile.x);
        uv.y -= 1.0; uv /= tile; uv.y += 1.0; return uv; }
      void main(){
        vec3 oPos = offsetPos; vec3 hrange = range/2.0;
        float center = linearstep(5.0,1.0,length(oPos.xz - range.xz/2.0));
        oPos.y += time*center; oPos = mod(oPos,range); oPos -= range/2.0;
        oPos.xz *= rotate2d(time*center); oPos.xz *= 1.0+(1.0-uVisibility);
        vec3 pos = position;
        pos *= smoothstep(hrange.y, hrange.y-0.5, abs(oPos.y));
        pos *= num.y; pos *= 1.0+exp(-mod(time*1.0+num.y*2.0,1.0)*7.0)*3.0*num.y;
        pos.xy *= rotate2d(time*num.y); pos += oPos;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(pos,1.0);
        vUv = spriteUVSelector(uv,vec2(6.0,1.0),6.0,num.x/4.0); vNum = num;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tex; uniform float time;
      varying vec2 vUv; varying vec2 vNum;
      vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0);
        vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
        vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
        float d=q.x-min(q.w,q.y); float e=1.0e-10;
        return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)), d/(q.x+e), q.x); }
      vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0);
        vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www);
        return c.z*mix(K.xxx, clamp(p-K.xxx,0.0,1.0), c.y); }
      void main(){
        vec4 color = texture2D(tex,vUv);
        vec3 hsv = rgb2hsv(color.xyz);
        hsv.x = mix(0.12, 0.78, fract(time*0.05 + vNum.y*0.5));
        hsv.y = 0.7; color.xyz = hsv2rgb(hsv);
        if (color.w < 0.05) discard;
        gl_FragColor = vec4(color);
      }
    `,
  }), [spriteTex])

  useFrame((state, delta) => {
    if (!matRef.current) return
    matRef.current.uniforms.time.value = state.clock.elapsedTime
    matRef.current.uniforms.uVisibility.value = damp(
      matRef.current.uniforms.uVisibility.value, visRef.current, 4, delta)
  })

  return (
    <mesh geometry={geometry} frustumCulled={false} ref={(m) => {
      if (m) matRef.current = (m as THREE.Mesh).material as THREE.ShaderMaterial
    }}>
      <primitive object={material} attach="material" />
    </mesh>
  )
}

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
    // Slowed clock so the streaming text rings drift gently, not race past.
    matRef.current.uniforms.time.value = state.clock.elapsedTime * 0.3
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
      // Gentle, slow orbit (was too fast).
      ringGroup.current.rotation.y += delta * 0.08
      ringGroup.current.rotation.x = 0.15
    }
  })

  return (
    <group>
      <group ref={ringGroup}>
        <TextRing visRef={visRef} tex={ringTex} />
        <Grid visRef={visRef} />
      </group>
      {/* Ambient embers — NOT in hero, only in interstellar/shatter/TV */}
      <InterstellarParticle visRef={visRef} />
    </group>
  )
}
