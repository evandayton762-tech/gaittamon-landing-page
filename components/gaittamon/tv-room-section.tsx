"use client"

import { useMemo, useRef, type MutableRefObject } from "react"
import { useFrame } from "@react-three/fiber"
import { useGLTF, useTexture, MeshReflectorMaterial } from "@react-three/drei"
import * as THREE from "three"
import { FogClouds } from "./fog-clouds"

// 6-cell sprite sheet for ember particles
function useTvParticleSpriteSheet() {
  return useMemo(() => {
    const cellSize = 64; const cells = 6
    const canvas = document.createElement("canvas")
    canvas.width = cellSize * cells; canvas.height = cellSize
    const ctx = canvas.getContext("2d")!
    const fns: ((cx: number, cy: number) => void)[] = [
      (cx, cy) => { const g = ctx.createRadialGradient(cx,cy,0,cx,cy,26); g.addColorStop(0,"rgba(255,255,255,1)"); g.addColorStop(1,"rgba(255,255,255,0)"); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,26,0,Math.PI*2); ctx.fill() },
      (cx, cy) => { ctx.fillStyle="rgba(255,255,255,0.9)"; ctx.fillRect(cx-3,cy-18,6,36); ctx.fillRect(cx-18,cy-3,36,6) },
      (cx, cy) => { ctx.fillStyle="rgba(255,255,255,0.85)"; ctx.beginPath(); ctx.moveTo(cx,cy-20); ctx.lineTo(cx+18,cy+14); ctx.lineTo(cx-18,cy+14); ctx.closePath(); ctx.fill() },
      (cx, cy) => { ctx.fillStyle="rgba(255,255,255,0.85)"; ctx.beginPath(); ctx.moveTo(cx,cy-22); ctx.lineTo(cx+14,cy); ctx.lineTo(cx,cy+22); ctx.lineTo(cx-14,cy); ctx.closePath(); ctx.fill() },
      (cx, cy) => { ctx.strokeStyle="rgba(255,255,255,0.9)"; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(cx,cy,18,0,Math.PI*2); ctx.stroke() },
      (cx, cy) => { ctx.fillStyle="rgba(255,255,255,0.9)"; for(let s=0;s<4;s++){ctx.save();ctx.translate(cx,cy);ctx.rotate(s*Math.PI/4);ctx.fillRect(-2,-24,4,48);ctx.restore()} },
    ]
    fns.forEach((fn,i) => { ctx.save(); fn(i*cellSize+cellSize/2, cellSize/2); ctx.restore() })
    return new THREE.CanvasTexture(canvas)
  }, [])
}

function TvEmbers({ visRef }: { visRef: MutableRefObject<number> }) {
  const matRef = useRef<THREE.ShaderMaterial | null>(null)
  const spriteTex = useTvParticleSpriteSheet()
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
      offsetPos[i*3]=Math.random()*range.x; offsetPos[i*3+1]=Math.random()*range.y; offsetPos[i*3+2]=Math.random()*range.z
      num[i*2]=i; num[i*2+1]=Math.random()*0.95+0.05
    }
    base.setAttribute("offsetPos", new THREE.InstancedBufferAttribute(offsetPos, 3))
    base.setAttribute("num", new THREE.InstancedBufferAttribute(num, 2))
    base.instanceCount = count
    return base
  }, [])
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time:{value:0}, range:{value:new THREE.Vector3(7,8,7)}, uVisibility:{value:0}, tex:{value:spriteTex} },
    vertexShader: /* glsl */ `
      attribute vec3 offsetPos; attribute vec2 num;
      uniform float time; uniform vec3 range; uniform float uVisibility;
      varying vec2 vUv; varying vec2 vNum;
      #define linearstep(e0,e1,x) min(max(((x)-(e0))/((e1)-(e0)),0.0),1.0)
      mat2 r2d(float a){ return mat2(cos(a),-sin(a),sin(a),cos(a)); }
      vec2 sprUV(vec2 uv,vec2 t,float f,float ti){ float ff=floor(f*mod(ti,1.0)); uv.x+=mod(ff,t.x); uv.y-=floor(ff/t.x); uv.y-=1.0; uv/=t; uv.y+=1.0; return uv; }
      void main(){
        vec3 o=offsetPos; vec3 h=range/2.0;
        float c=linearstep(5.0,1.0,length(o.xz-range.xz/2.0));
        o.y+=time*c; o=mod(o,range); o-=range/2.0; o.xz*=r2d(time*c); o.xz*=1.0+(1.0-uVisibility);
        vec3 p=position;
        p*=smoothstep(h.y,h.y-0.5,abs(o.y)); p*=num.y; p*=1.0+exp(-mod(time+num.y*2.0,1.0)*7.0)*3.0*num.y;
        p.xy*=r2d(time*num.y); p+=o;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
        vUv=sprUV(uv,vec2(6.0,1.0),6.0,num.x/4.0); vNum=num;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tex; uniform float time;
      varying vec2 vUv; varying vec2 vNum;
      vec3 h2r(vec3 c){ vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0); vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y); }
      vec3 r2h(vec3 c){ vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); return vec3(abs(q.z+(q.w-q.y)/(6.0*d+1e-10)),d/(q.x+1e-10),q.x); }
      void main(){
        vec4 col=texture2D(tex,vUv);
        vec3 hsv=r2h(col.xyz);
        hsv.x=mix(0.12,0.78,fract(time*0.05+vNum.y*0.5)); hsv.y=0.7;
        col.xyz=h2r(hsv); if(col.w<0.05) discard;
        gl_FragColor=vec4(col);
      }
    `,
  }), [spriteTex])
  useFrame((state, delta) => {
    if (!matRef.current) return
    matRef.current.uniforms.time.value = state.clock.elapsedTime
    matRef.current.uniforms.uVisibility.value = damp(matRef.current.uniforms.uVisibility.value, visRef.current, 4, delta)
  })
  return (
    <mesh geometry={geometry} frustumCulled={false} ref={(m) => { if (m) matRef.current = (m as THREE.Mesh).material as THREE.ShaderMaterial }}>
      <primitive object={material} attach="material" />
    </mesh>
  )
}

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const damp = THREE.MathUtils.damp
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

// ---------------------------------------------------------------------------
// Display screen shaders — logo/noise default; IS_RAYMARCH_1 = box corridor;
// IS_RAYMARCH_2 = metaballs. Exactly from the prompt spec.
// ---------------------------------------------------------------------------
const DISPLAY_VERT = /* glsl */ `
varying vec2 vUv; varying vec2 vUv2; varying float vBrightness; varying float vFade;
varying vec3 vNormal; varying vec3 vViewPos; varying float vInvert;
uniform float time; uniform sampler2D uNoiseTex; uniform float uOffset;
#define PI 3.14159265
vec2 spriteUVSelector(vec2 uv, vec2 tile, float frames, float t){
  float f = floor(frames * mod(t,1.0));
  uv.x += mod(f,tile.x); uv.y -= floor(f/tile.x);
  uv.y -= 1.0; uv /= tile; uv.y += 1.0; return uv;
}
void main(){
  vec3 pos = position;
  vec4 mvPosition = modelViewMatrix * vec4(pos,1.0);
  gl_Position = projectionMatrix * mvPosition;
  vUv = uv; vUv.y = 1.0 - vUv.y;
  vUv2 = spriteUVSelector(vUv, vec2(2.0,4.0), 8.0, uOffset/8.0);
  vec2 noise = texture2D(uNoiseTex, vec2(time*0.03 + modelMatrix[3][0])).xy;
  vec2 noiseHigh = texture2D(uNoiseTex, vec2(time*3.0 + modelMatrix[3][0])).xy;
  vBrightness = smoothstep(0.55,0.65, noise.x + noiseHigh.x*0.08) * 0.9;
  vInvert = step(0.5, noise.y + noiseHigh.y*0.08);
  vFade = sin(vBrightness*PI) + sin(vInvert*PI);
  vUv = uv; vNormal = normalMatrix * normal; vViewPos = -mvPosition.xyz;
}
`

const makeFrag = (defines: Record<string, string> = {}) => {
  const defs = Object.entries(defines).map(([k, v]) => `#define ${k} ${v}`).join("\n")
  return /* glsl */ `
${defs}
varying vec2 vUv; varying vec2 vUv2; varying float vBrightness; varying float vFade;
varying vec3 vNormal; varying vec3 vViewPos; varying float vInvert;
uniform float time; uniform sampler2D uNoiseTex; uniform sampler2D uDisplayTex;
uniform float uRaymarchEffect; uniform float uSectionVisibility;
float random(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
mat2 rotate(float a){ return mat2(cos(a),-sin(a),sin(a),cos(a)); }
#ifdef IS_RAYMARCH
  float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
  float sdSphere(vec3 p,float s){ return length(p)-s; }
#endif
#ifdef IS_RAYMARCH_1
  float SDF(vec3 p){
    p.xy *= rotate(p.z*0.05 + uRaymarchEffect*5.0);
    vec3 lp = mod(p,4.0)-2.0;
    lp.yz *= rotate(uRaymarchEffect*10.0 + time);
    lp.xz *= rotate(uRaymarchEffect*10.0);
    vec3 size = vec3(0.3, 0.3+uRaymarchEffect*3.0, 0.3); size *= 1.0-uRaymarchEffect*0.5;
    return sdBox(lp, size);
  }
#endif
#ifdef IS_RAYMARCH_2
  float smin(float a,float b,float k){ float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
  float SDF(vec3 p){
    vec3 p1=p+vec3(sin(time)*0.1,cos(time)*0.1,0.0);
    vec3 p2=p+vec3(sin(time*1.4)*0.4,cos(time)*0.5,0.0);
    vec3 p3=p+vec3(sin(time*3.0)*0.7,cos(time*0.8)*0.7,0.0);
    vec3 p4=p+vec3(sin(time)*1.0,cos(time*0.5)*1.0,sin(time*0.4)*1.0);
    vec3 p5=p+vec3(sin(time*1.6)*1.0,cos(time*0.4)*1.0,cos(time*0.3)*1.0);
    float d=min(sdSphere(p1,0.5),999.0);
    d=smin(sdSphere(p2,0.3),d,0.3); d=smin(sdSphere(p3,0.2),d,0.3);
    d=smin(sdSphere(p4,0.2),d,0.3); d=smin(sdSphere(p5,0.3),d,0.3);
    return d;
  }
#endif
#ifdef IS_RAYMARCH
  vec3 getNormal(vec3 p){ float d=0.001;
    return normalize(vec3(SDF(p+vec3(d,0,0))-SDF(p-vec3(d,0,0)),
                          SDF(p+vec3(0,d,0))-SDF(p-vec3(0,d,0)),
                          SDF(p+vec3(0,0,d))-SDF(p-vec3(0,0,d)))); }
#endif
void main(){
  vec3 color = vec3(0.0); vec2 texUv = vUv2;
  vec2 n = vec2((texture2D(uNoiseTex, vec2(vUv2.y*2.0, time*3.0)).xy - 0.5)*0.5);
  n *= vFade; n.x -= (texture2D(uNoiseTex, vec2(vUv2.y*50.0, time*3.0)).x - 0.5)*0.05;
  vec2 texUvR = texUv + n; vec2 texUvG = texUv + n*0.5; vec2 texUvB = texUv + n;
  #ifdef IS_RAYMARCH
    float fov = 50.0;
    #ifdef IS_RAYMARCH_1
      vec3 cPos = vec3(0.0,0.0,-time*10.0);
      cPos.x = cos(time*0.5); cPos.y = sin(time)*1.2; cPos.z -= n.y*3.0;
    #endif
    vec2 pos = vUv.xy*2.0-1.0; pos.x += n.y*2.0;
    vec3 ray = normalize(vec3(sin(fov)*pos.x, sin(fov)*pos.y, -1.0));
    #ifdef IS_RAYMARCH_2
      vec3 cPos = vec3(0.0,0.0,5.0); mat2 rot = rotate(time); cPos.xz *= rot; ray.xz *= rot;
    #endif
    float rLen=0.0; vec3 rPos=cPos; float hit=0.0;
    for(int i=0;i<40;i++){
      float d=SDF(rPos); rLen+=d; rPos=cPos+ray*rLen;
      if(abs(d)<=0.01){ vec3 nrm=getNormal(rPos);
        float diff=clamp(dot(vec3(0.5),nrm),0.1,1.0);
        color=mix(vec3(diff), nrm*0.5+0.5, vInvert*0.9); hit=1.0; break; }
    }
    color = mix(vec3(vInvert), color, hit);
  #else
    vec4 logo = vec4(0.0);
    logo.xw += texture2D(uDisplayTex, texUvR).xw;
    logo.yw += texture2D(uDisplayTex, texUvG).yw;
    logo.zw += texture2D(uDisplayTex, texUvB).zw;
    logo.w /= 3.0;
    color = mix(vec3(1.0), logo.xyz, logo.w);
  #endif
  vec3 noiseColor = vec3(0.0) + random(vUv + mod(time,1.0) + 1000.0)*0.7;
  noiseColor += step(0.0, sin(time*3.0 - vUv2.y)*sin(time*3.0 - vUv.y*8.0))*0.1;
  float noiseW = smoothstep(0.0,0.01, -texture2D(uNoiseTex, vec2(vUv2.y + time*10.0, 0.0)).x + vBrightness*1.2);
  color = mix(color, noiseColor, noiseW);
  color *= step(0.0, sin(vUv2.y*5.0 - time*80.0))*0.05 + 0.95;
  color = mix(color, 1.0 - color, vInvert);
  color *= 0.78 - sin(vUv.y*200.0 - time*10.0)*0.02;
  color *= smoothstep(1.0, 0.3, length(vUv - 0.5));
  gl_FragColor = vec4(color, uSectionVisibility);
}
`
}

// ---------------------------------------------------------------------------
// Light bracket shaders (exact from spec)
// ---------------------------------------------------------------------------
const LIGHT_VERT = /* glsl */ `
varying vec2 vUv; varying float vBrightness;
uniform float time; uniform sampler2D uNoiseTex;
void main(){
  vec3 pos = position;
  vec4 worldPos = modelMatrix * vec4(pos,1.0);
  vec4 mvPosition = viewMatrix * worldPos;
  gl_Position = projectionMatrix * mvPosition;
  vUv = uv;
  vec4 noise = texture2D(uNoiseTex, vec2(time*0.5 + modelMatrix[3][0]));
  vBrightness = smoothstep(0.0,0.4, noise.x) * 0.9;
  vBrightness *= 1.0 - abs(vUv.x - 0.5)*2.0;
}
`

const LIGHT_FRAG = /* glsl */ `
varying vec2 vUv; varying float vBrightness; uniform float uVisibility;
void main(){
  gl_FragColor = vec4(vec3(1.0)*vBrightness, uVisibility);
}
`

// BackText — same shader as fusion-section BackText (horizontal scroll + vertical wipe)
const BACKTEXT_VERT = /* glsl */ `
varying vec2 vUv;
uniform float time;
void main(){
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vUv = uv;
  vUv.x += time * 0.02;
}
`
const BACKTEXT_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform float uVisibility;
varying vec2 vUv;
void main(){
  vec4 col = texture2D(uTex, vUv);
  col.w *= step(abs(vUv.y - 0.5), uVisibility * 0.5);
  if (col.w < 0.5) discard;
  gl_FragColor = col;
}
`

// ---------------------------------------------------------------------------
// TVRoom — loads section_3.glb and drives every named sub-object
// ---------------------------------------------------------------------------
export function TvRoomSection({
  progressRef,
}: {
  progressRef: MutableRefObject<number>
}) {
  const { scene } = useGLTF("/junni/section_3.glb")
  const noiseTex = useTexture("/junni/textures/noise.png")
  const displayTex = useTexture("/junni/textures/display.png")
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping
  displayTex.wrapS = displayTex.wrapT = THREE.RepeatWrapping

  const groupRef = useRef<THREE.Group>(null)
  const visRef = useRef(0)
  // CursorLight state
  const cursorPos = useRef(new THREE.Vector3(0, 0, 2))
  const cursorVel = useRef(new THREE.Vector3())
  const cursorLightRef = useRef<THREE.DirectionalLight>(null)

  // --- Parse GLB nodes once ---
  const { displayMats, lightMats, wireMat, backTextData } = useMemo(() => {
    const displayMats: { mat: THREE.ShaderMaterial; target: number; current: number }[] = []
    const lightMats: THREE.ShaderMaterial[] = []

    // ---- Displays ----
    const displaysNode = scene.getObjectByName("Displays")
    if (displaysNode) {
      let screenIdx = 0
      displaysNode.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (!mesh.isMesh) return
        const name = child.name || ""
        const isRaymarch = name.includes("Raymarching_1") || name.includes("Raymarching_2") || screenIdx === 1 || screenIdx === 2
        const isR1 = name.includes("Raymarching_1") || screenIdx === 1
        const isR2 = name.includes("Raymarching_2") || screenIdx === 2
        const defines: Record<string, string> = {}
        if (isRaymarch) defines["IS_RAYMARCH"] = ""
        if (isR1) defines["IS_RAYMARCH_1"] = ""
        if (isR2) defines["IS_RAYMARCH_2"] = ""
        const mat = new THREE.ShaderMaterial({
          vertexShader: DISPLAY_VERT,
          fragmentShader: makeFrag(defines),
          transparent: true,
          side: THREE.FrontSide,
          uniforms: {
            time: { value: 0 },
            uNoiseTex: { value: noiseTex },
            uDisplayTex: { value: displayTex },
            uOffset: { value: screenIdx },
            uRaymarchEffect: { value: 0 },
            uSectionVisibility: { value: 0 },
          },
        })
        mesh.material = mat
        displayMats.push({ mat, target: Math.random() * 0.8 + 0.2, current: 0 })
        screenIdx++
      })
    }

    // ---- Lights ----
    const lightsNode = scene.getObjectByName("Lights")
    if (lightsNode) {
      lightsNode.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (!mesh.isMesh) return
        const mat = new THREE.ShaderMaterial({
          vertexShader: LIGHT_VERT,
          fragmentShader: LIGHT_FRAG,
          transparent: true,
          uniforms: {
            time: { value: 0 },
            uNoiseTex: { value: noiseTex },
            uVisibility: { value: 0 },
          },
        })
        mesh.material = mat
        lightMats.push(mat)
      })
    }

    // ---- Wire — dark standard material ----
    const wireMat = new THREE.MeshStandardMaterial({
      color: "#181818",
      metalness: 0.15,
      roughness: 0.88,
    })
    const wireNode = scene.getObjectByName("Wire")
    if (wireNode) {
      wireNode.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (mesh.isMesh) mesh.material = wireMat
      })
    }

    // ---- BackText ----
    const backTextNode = scene.getObjectByName("BackText") as THREE.Mesh | null
    const backGeo = backTextNode?.geometry ?? null
    const backSrcMat = backTextNode?.material as THREE.MeshStandardMaterial | null
    const backTex = backSrcMat?.map ?? null
    const backMat = new THREE.ShaderMaterial({
      vertexShader: BACKTEXT_VERT,
      fragmentShader: BACKTEXT_FRAG,
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTex: { value: backTex },
        time: { value: 0 },
        uVisibility: { value: 0 },
      },
    })

    return { displayMats, lightMats, wireMat, backTextData: { geo: backGeo, mat: backMat } }
  }, [scene, noiseTex, displayTex])

  useFrame((state, delta) => {
    const g = groupRef.current
    if (!g) return
    const p = progressRef.current
    const t = state.clock.elapsedTime

    // TV section: entrance p ∈ [0.88, 0.96], full visibility above that.
    const enter = clamp((p - 0.88) / 0.08)
    const vis = easeOutCubic(enter)
    visRef.current = vis
    g.visible = vis > 0.005
    if (!g.visible) return

    // Update display materials
    for (const d of displayMats) {
      d.mat.uniforms.time.value = t
      d.mat.uniforms.uSectionVisibility.value = damp(
        d.mat.uniforms.uSectionVisibility.value,
        vis,
        4,
        delta,
      )
      // Retarget raymarch effect every ~1-1.8s per screen
      const retargetInterval = 0.8 + Math.random() * 1.0
      if (Math.floor(t / retargetInterval) !== Math.floor((t - delta) / retargetInterval)) {
        d.target = Math.random()
      }
      d.current = damp(d.current, d.target, 2, delta)
      d.mat.uniforms.uRaymarchEffect.value = d.current
    }

    // Update light materials
    for (const lm of lightMats) {
      lm.uniforms.time.value = t
      lm.uniforms.uVisibility.value = damp(lm.uniforms.uVisibility.value, vis, 4, delta)
    }

    // Wire opacity follows section visibility
    wireMat.opacity = vis
    wireMat.transparent = true

    // BackText
    if (backTextData.mat) {
      backTextData.mat.uniforms.time.value = t
      // Delayed reveal: 1s delay then 2s easeOutCubic
      const btReveal = easeOutCubic(clamp((p - 0.89) / 0.06))
      backTextData.mat.uniforms.uVisibility.value = damp(
        backTextData.mat.uniforms.uVisibility.value,
        btReveal,
        3,
        delta,
      )
    }

    // CursorLight — damps toward pointer
    if (cursorLightRef.current) {
      const goal = new THREE.Vector3(state.pointer.x * 4, state.pointer.y * 3, -0.5)
      cursorVel.current.add(goal.clone().sub(cursorPos.current).multiplyScalar(delta * 2.5))
      cursorVel.current.multiplyScalar(0.8)
      cursorPos.current.add(cursorVel.current)
      cursorLightRef.current.position.copy(cursorPos.current)
      cursorLightRef.current.intensity = vis * 1.8
    }
  })

  return (
    <group ref={groupRef} visible={false}>
      {/* Cursor-follow directional light */}
      <directionalLight ref={cursorLightRef} color="#ffe6a8" intensity={0} />

      {/* Warm scene fill lights */}
      <pointLight position={[0, 3, 0]} color="#ffe0a0" intensity={8} distance={12} />
      <pointLight position={[-3, 1, 1]} color="#ffd070" intensity={6} distance={10} />
      <pointLight position={[3, 1, 1]} color="#c090ff" intensity={5} distance={10} />

      {/* GLB scene — transforms as-is from the GLB */}
      <primitive object={scene} />

      {/* BackText (arched band behind the room) */}
      {backTextData.geo && (
        <mesh geometry={backTextData.geo} position={[0, 0, -5]} scale={1.5}>
          <primitive object={backTextData.mat} attach="material" />
        </mesh>
      )}

      {/* Reflective floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]}>
        <planeGeometry args={[24, 24]} />
        <MeshReflectorMaterial
          blur={[300, 100]}
          resolution={512}
          mixBlur={0.7}
          mixStrength={0.9}
          roughness={0.9}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#100820"
          metalness={0.5}
          mirror={0.7}
        />
      </mesh>

      {/* Fog clouds reflected in the floor */}
      <FogClouds progressRef={progressRef} />

      {/* Ember particles — gold/purple, swirling */}
      <TvEmbers visRef={visRef} />
    </group>
  )
}

useGLTF.preload("/junni/section_3.glb")
