"use client"

import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

/**
 * BackgroundSphere — a giant inward-facing sphere that fills the frame with a
 * dark, grainy ambient backdrop whose hue slowly drifts between gold and purple
 * over time (Junni's BG-sphere technique, palette-constrained to GAITTAMON).
 *
 * The hue oscillates in a narrow band (gold ~0.12 -> purple ~0.78) and value is
 * kept low so it reads as atmosphere rather than a bright wash. Per-pixel random
 * noise adds the constant grain.
 */
export function BackgroundSphere() {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float time;
        varying vec2 vUv;

        vec3 hsv2rgb(vec3 c){
          vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }
        float random(vec2 co){
          return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main(){
          // hue drifts gold (~0.12) <-> purple (~0.78) and back
          float hue = mix(0.12, 0.78, 0.5 + 0.5 * sin(time * 0.1 + vUv.y * 0.5));
          // low value keeps it a dark ambient backdrop; darken toward the poles
          float val = 0.20 + 0.10 * smoothstep(0.0, 0.6, vUv.y);
          vec3 col = hsv2rgb(vec3(hue, 0.55, val));
          col += random(gl_FragCoord.xy * 0.01 + time * 0.05) * 0.04; // grain
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  }, [])

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.time.value = state.clock.elapsedTime
  })

  return (
    <mesh frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[100, 32, 32]} />
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
