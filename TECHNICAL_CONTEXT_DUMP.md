# GAITTAMON Landing Page — Complete Technical Context Dump

## 1. File & Component Structure

```
/vercel/share/v0-project/
├── app/
│   ├── layout.tsx                        # Root layout with metadata, fonts (Geist Sans/Mono), dark theme
│   ├── page.tsx                          # Single page route, imports Experience component
│   └── globals.css                       # Tailwind v4 setup with custom CSS variables, animations, glow effects
├── components/
│   ├── gaittamon/
│   │   ├── experience.tsx                # Main orchestrator: scroll progress, fixed 3D scene, scroll-anchored overlays
│   │   ├── scene.tsx                     # R3F Canvas wrapper, lighting setup, SweepLight, CardMesh, Title3D
│   │   ├── card-mesh.tsx                 # 3D card geometry + animation: ExtrudeGeometry body, TextureLoader faces, pointer tilt
│   │   ├── title-3d.tsx                  # GAITTAMON Text3D wordmark, per-letter pointer reactivity
│   │   ├── scouter-ui.tsx                # Dragon Ball HUD overlay: corner brackets, SVG lines, label boxes, dots
│   │   ├── top-nav.tsx                   # Fixed header: logo, desktop nav links, Discord link, Play button
│   │   └── cta-button.tsx                # Reusable button component: cyan/gold variants, arrow animation
│   └── ui/
│       └── button.tsx                    # shadcn button (unused in current build)
├── hooks/
│   └── use-scroll-progress.ts            # Global scroll progress hook (0..1 relative to full page)
├── lib/
│   └── utils.ts                          # (utility helpers, likely empty or minimal)
├── public/
│   ├── card-front.png                    # Cindrake card artwork (textured face)
│   ├── cardback.png                      # Purple vortex card back
│   ├── gaittamon-logo.png                # Top-nav logo
│   ├── fonts/
│   │   └── helvetiker_bold.typeface.json # JSON typeface for Text3D
│   └── icon-*.png, icon.svg              # Favicon variants
├── package.json                          # Full dependency manifest
├── tsconfig.json                         # TypeScript configuration
├── next.config.mjs                       # Next.js config (images: unoptimized)
└── components.json                       # shadcn configuration
```

---

## 2. package.json Dependencies

### Full Dependencies List:

```json
{
  "dependencies": {
    "@base-ui/react": "^1.5.0",
    "@react-three/drei": "^10.7.7",
    "@react-three/fiber": "^9.6.1",
    "@types/three": "^0.184.1",
    "@vercel/analytics": "1.6.1",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "framer-motion": "^12.41.0",
    "lucide-react": "^1.16.0",
    "next": "16.2.6",
    "react": "^19",
    "react-dom": "^19",
    "shadcn": "^4.8.0",
    "tailwind-merge": "^3.3.1",
    "three": "^0.184.0",
    "tw-animate-css": "^1.4.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.2.0",
    "@types/node": "^24",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "postcss": "^8.5",
    "tailwindcss": "^4.2.0",
    "typescript": "5.7.3"
  },
  "pnpm": {
    "overrides": {
      "hono": "4.12.25"
    }
  }
}
```

**Key Stack:**
- Next.js 16.2.6 (App Router)
- React 19
- Three.js 0.184.0 with R3F 9.6.1 and Drei 10.7.7
- Tailwind CSS 4.2.0 (new @import format)
- Framer Motion 12.41.0
- TypeScript 5.7.3

---

## 3. Scroll & Section System

### Scroll Progress Tracking:

**File:** `experience.tsx`

The site uses a **custom scroll-relative progress system** that is independent of absolute scroll position or footer height:

```typescript
const TIMELINE_SCREENS = 4  // Card animation spans 4 viewport heights
const SPACER_VH = 360       // 360vh scroll spacer drives the timeline

// In Experience component:
const [progress, setProgress] = useState(0)
const progressRef = useRef(0)

useEffect(() => {
  const update = () => {
    const denom = TIMELINE_SCREENS * window.innerHeight || 1
    const next = clamp(window.scrollY / denom)  // 0..1 across 4 screens
    progressRef.current = next
    setProgress(next)
  }
  const onScroll = () => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(update)
  }
  // ...
}, [])
```

### Section Progress Windows (Progress = 0..1):

```
p ∈ [0, 0.1]      → Hero visibility fades out (opacity = 1 - p/0.1)
p ∈ [0.14, 0.4]   → Fusion section (sTurn = easeInOut((p - 0.14) / 0.26))
p ∈ [0.44, 0.78]  → Anatomy section (sCenter = easeInOut((p - 0.44) / 0.22))
p ∈ [0.7, 0.9]    → Zoom-past / fade (sZoom = easeInOut((p - 0.7) / 0.2))
p ∈ [0.8, 1]      → Card fully faded, footer content scrolls in
```

### Progress-Driven Overlay Anchoring:

The `anchor()` function creates scroll-pinned text overlays with fade-in and fade-out transitions:

```typescript
function anchor(p, inStart, inEnd, outStart, outEnd) {
  if (p <= inStart) return { opacity: 0, ty: 26 }     // Hidden, offset down
  if (p < inEnd) {
    const t = easeInOut((p - inStart) / (inEnd - inStart))
    return { opacity: t, ty: 26 * (1 - t) }           // Slide up + fade in
  }
  if (p <= outStart) return { opacity: 1, ty: 0 }     // Hold centered
  if (p < outEnd) {
    const t = easeInOut((p - outStart) / (outEnd - outStart))
    return { opacity: 1 - t, ty: -26 * t }            // Slide down + fade out
  }
  return { opacity: 0, ty: -26 }                       // Hidden, offset up
}
```

**Active Sections:**
- **Hero:** `opacity = clamp(1 - progress / 0.1)`
- **01 Fusion:** `anchor(progress, 0.14, 0.22, 0.3, 0.4)`
- **02 Anatomy:** `anchor(progress, 0.44, 0.54, 0.66, 0.78)`
- **Scouter UI:** appears during anatomy hold, reveal over `(p - 0.54) / 0.12` duration

---

## 4. Section-by-Section Breakdown

### **Hero Section** (p ∈ [0, 0.1])

**Filename:** `experience.tsx` (fixed overlay)

**3D Elements (in Scene):**
- Card: Back-facing (`rotY = π`), centered at `(0, 0, 0)`, slight idle float
- GAITTAMON Text3D: 9 individual Text3D meshes (one per letter), positioned at `z = 1.6`, responsive scale
- Lighting:
  - Ambient: `intensity=0.35, color="#6a4aff"` (purple)
  - Directional: `position=[-4, 3, 5], intensity=1.2, color="#b48cff"` (purple)
  - Point (warm): `position=[0, -3, 4], intensity=20, color="#c79a3a"` (gold, bottom)

**HTML/JSX Overlays:**
- Subtitle: `"The Fusion Trading Card Game"` (cyan glow, mono 10px)
- H1 (sr-only): `"GAITTAMON"` (reserved for 3D render)
- Tagline: `"Fuse the Weak. Forge the Unstoppable."` (cyan text, foreground/70)
- CTA Button: `<CtaButton>Play Free Now</CtaButton>` (cyan variant)
- Idle Scroll Hint: Pulsing arrow + `"Scroll to Fuse"` (appears after 3s inactivity, animates with `scroll-bob` keyframe)

**Entrance/Exit:**
- Entrance: Instant visibility at page load
- Exit: Linear fade-out (`opacity = 1 - p / 0.1`) for p ∈ [0, 0.1]

### **01 Fusion Section** (p ∈ [0.14, 0.4])

**Filename:** `experience.tsx` (fixed overlay, left-aligned)

**3D Elements:**
- Card: Rotates from back (`rotY = π`) to front (`rotY = 2π`), moves right (`x = vw * 0.2 * sTurn`), scales down
- GAITTAMON Title: Continues its idle orbit/tilt, opacity tracks hero fade
- Lighting: Same as hero, no sweep yet

**HTML/JSX Overlays:**
- Label: `"01 — Fusion"` (purple glow, mono 10px)
- Heading: `"Infinite Alchemy."` (cyan text shadow, text-4xl bold)
- Body: `"Combine Tier 1, 2, and 3 creatures..."` (foreground/75, leading-relaxed)
- Border-left: 2px purple glow border

**Entrance/Exit:**
- Entrance: Fade + slide up over `[0.14, 0.22]`
- Hold: Perfect alignment `[0.22, 0.3]`
- Exit: Fade + slide down over `[0.3, 0.4]`
- Transform: `transform: translateY(${fusion.ty}px)`

### **02 Anatomy Section** (p ∈ [0.44, 0.78])

**Filename:** `experience.tsx` (fixed overlay, right-aligned)

**3D Elements:**
- Card: Completes full left revolution from front (`0`) → back-facing (`π`), moves left (`x = -vw * 0.2 * sCenter`), scales down further
- SweepLight: Point light at position `[sin(t * 1.2) * 3 * (0.4 + sweep), cos(t * 0.8) * 1.5, 3]`, sweeps with `sweep = clamp((p - 0.4) / 0.25)`, intensity `30 + sweep * 90` (up to 120)
- GAITTAMON Title: Continues orbit, opacity tracks hero fade
- Lighting: Same + sweep light cyan (#5ee9ff)

**HTML/JSX Overlays:**
- Label: `"02 — Anatomy"` (cyan glow, mono 10px)
- Heading: `"Master the Anatomy."` (cyan text shadow, text-4xl bold)
- Body: `"Every element matters. From the Exalted status..."` (foreground/75, text-right)
- Border-right: 2px cyan glow border
- **Scouter UI** (begins reveal at p ≈ 0.54): Dragon Ball HUD with corner brackets, connector lines, pulsing dots, label boxes

**Entrance/Exit:**
- Entrance: Fade + slide up over `[0.44, 0.54]`
- Hold: Perfect alignment `[0.54, 0.66]`
- Exit: Fade + slide down over `[0.66, 0.78]`
- Transform: `transform: translateY(${anatomy.ty}px)`

**Scouter UI Sequence** (driven by `appear = clamp((progress - 0.54) / 0.12)`, p ∈ [0.54, 0.66]):
1. **Dots + reticle fade in:** `dotsO = clamp(appear / 0.2)` → fully visible by appear=0.2
2. **Connector lines draw:** `draw = clamp((appear - 0.2) / 0.35)` → grows from dot to label by appear=0.55
3. **Label boxes draw:** `boxDraw = clamp((appear - 0.55) / 0.25)` → scale from anchor edge by appear=0.8
4. **Text fades in:** `textO = clamp((appear - 0.8) / 0.2)` → fully visible by appear=1

### **03 Ranked Section** (p > 0.78, scrolls in with footer)

**Filename:** `experience.tsx` (GameplayFooter function)

**3D Elements:**
- Scene fully faded (card opacity → 0 over [0.7, 0.8])

**HTML/JSX Overlays (IntersectionObserver-triggered FadeUp animations):**
- Label: `"03 — Ranked"`
- Heading: `"The Meta Never Sleeps."`
- Body: `"Take your fusions to the Ranked Ladder..."` (foreground/75, max-width center)
- CTA Button: `<CtaButton variant="gold">Enter the Portal</CtaButton>`

**Entrance:**
- Triggered on scroll-into-view (IntersectionObserver, threshold=0.15)
- Animates: `opacity: 0 → 1`, `translateY: 32px → 0` over 0.7s ease

### **Gameplay Video Section** (p > 0.78)

**Filename:** `experience.tsx` (GameplayFooter function)

**3D Elements:**
- None (scene behind)

**HTML/JSX Overlays:**
- Heading: `"See the Fusion in Motion."` (cyan glow, text-4xl)
- Video Placeholder: Dark gradient box with play button icon (cyan glow)
- `aspect-video`, rounded-3xl, border cyan/10, shadow-glow-purple

**Entrance:**
- Same FadeUp pattern as 03 Ranked

### **Footer Section** (p > 0.78)

**Filename:** `experience.tsx` (GameplayFooter function)

**3D Elements:**
- None

**HTML/JSX Overlays:**
- Logo + Tagline: `"GAITTAMON"` (text-glow-cyan), `"Fuse the Weak. Forge the Unstoppable."`
- Nav Links: Play, Cards, Ranked, Discord (hover → cyan-glow)
- Copyright: `"© {year} Gaittamon — All Rights Reserved"`
- Responsive: flex row on desktop, stacked on mobile

---

## 5. The Card Implementation

### Geometry:

**File:** `card-mesh.tsx`

```typescript
const CARD_W = 2.5          // Width in 3D units
const CARD_H = 3.5          // Height (taller = portrait TCG ratio)
const DEPTH = 0.02          // Thin card body (0.02 units)

// Rounded-rectangle shape: hand-drawn quadratic Bezier corners
function roundedRectShape(w: number, h: number, r: number) {
  const shape = new THREE.Shape()
  const x = -w / 2, y = -h / 2
  // Move to top-left + radius, draw lines and quadratic curves for rounded corners
  shape.moveTo(x + r, y)
  shape.lineTo(x + w - r, y)
  shape.quadraticCurveTo(x + w, y, x + w, y + r)
  // ... (repeat for all 4 corners)
  return shape
}

// Card body: extruded rounded shape with beveled edges
const bodyGeo = new THREE.ExtrudeGeometry(roundedRectShape(CARD_W, CARD_H, 0.2), {
  depth: DEPTH,
  bevelEnabled: true,
  bevelThickness: 0.006,
  bevelSize: 0.006,
  bevelSegments: 1,
  steps: 1,
  curveSegments: 24,
})

// Flat faces: normalized UVs so texture fills entire face
const faceGeo = useRoundedPlane(CARD_W - 0.08, CARD_H - 0.08, 0.18)
const faceZ = DEPTH / 2 + 0.006 + 0.001  // Positioned just on top of body
```

### Materials:

**Body (edge):**
```typescript
<meshStandardMaterial
  color="#0b0918"                  // Deep purple edge
  metalness={0.7}                 // Shiny
  roughness={0.35}                // Some specularity
  emissive="#241046"              // Purple glow
  emissiveIntensity={0.22}
  transparent
/>
```

**Front Face (Cindrake art):**
```typescript
<meshStandardMaterial
  map={front}                     // TextureLoader("/card-front.png")
  transparent
  metalness={0.3}
  roughness={0.5}
  emissive="#0a3a4a"              // Cyan tint
  emissiveIntensity={0.22}
/>
```

**Back Face (vortex):**
```typescript
<meshStandardMaterial
  map={back}                      // TextureLoader("/cardback.png")
  transparent
  metalness={0.5}
  roughness={0.45}
  emissive="#1a0a3a"              // Purple tint
  emissiveIntensity={0.28}
/>
// Positioned at z = -faceZ, rotation=[0, PI, 0] to face backward
```

### State & Animation:

**Rotation:**
- Hero: Back-facing (`rotY = π`) with subtle wobble (`Math.sin(t * 0.5) * 0.04`)
- Fusion: Flip to front (`sTurn` interpolates `π → 2π`)
- Anatomy: Full left revolution (`sCenter` interpolates `2π → 0`)
- Zoom: Half pirouette + rise (`sZoom` interpolates `0 → π`)

**Position:**
- Fusion: Moves right (`x = vw * 0.2 * sTurn`)
- Anatomy: Moves left (`x = -vw * 0.2 * sCenter`)
- Zoom: Rises toward camera (`z = 3.2 * sZoom`)
- Always floats: `y = Math.sin(t * 0.9) * 0.05 * (1 - sZoom)`

**Scale:**
- Starts: `baseScale = 0.72 * fit` (responsive to viewport width)
- Fusion: Shrinks to `78%` of base
- Anatomy: Shrinks to `82%` of base
- Zoom: Grows to `170%` of base, then fades before becoming pixelated

**Opacity:**
- Fades from 1 → 0 over `[0.7, 0.8]` (exit smooth before zoom gets too large)

**Pointer Interaction:**
- On hover: Subtle tilt (`strength = 0.16`)
- On press: Stronger tilt (`strength = 0.4`)
- Tilt axis: `rotY += pointer.x * strength`, `rotX += -pointer.y * strength`
- Tracked via `onPointerMove`, `onPointerDown`, `onPointerUp` events on the mesh

### Mesh Hierarchy:

```typescript
<group ref={group}>                    // Animated parent group
  <mesh geometry={bodyGeo} ...>        // Thin extruded body (edge)
    <meshStandardMaterial ... />
  </mesh>
  <mesh geometry={faceGeo} position={[0, 0, faceZ]} ...>  // Front face
    <meshStandardMaterial map={front} ... />
  </mesh>
  <mesh geometry={faceGeo} position={[0, 0, -faceZ]} rotation={[0, PI, 0]} ...>  // Back face
    <meshStandardMaterial map={back} ... />
  </mesh>
</group>
```

---

## 6. GAITTAMON Typography

### Rendering Method:

**File:** `title-3d.tsx`

The "GAITTAMON" wordmark is rendered as **9 individual `Text3D` components** (one per letter) inside an extruded 3D scene using Drei's `<Text3D>` component.

```typescript
const FONT_URL = "/fonts/helvetiker_bold.typeface.json"
const TEXT = "GAITTAMON"  // 9 characters
const TITLE_Z = 1.6       // Positioned in front of card back
const LETTER_GAP = 0.1    // Spacing between letters
```

### Per-Letter Geometry:

```typescript
<Text3D
  font={FONT_URL}
  size={0.62}                        // Glyph size (responsive via group scale)
  height={0.16}                      // Extrusion depth
  curveSegments={6}
  bevelEnabled
  bevelThickness={0.02}
  bevelSize={0.014}
  bevelSegments={3}
>
  {char}
  <meshStandardMaterial
    color="#eafcff"                 // Cyan-white
    emissive="#1fb6e6"              // Bright cyan glow
    emissiveIntensity={0.55}
    metalness={0.35}
    roughness={0.25}
    transparent
  />
</Text3D>
```

### Layout & Positioning:

**Dynamic Glyph Measurement:**
- Bounding boxes computed for each letter from Text3D geometry
- Widths summed to calculate total span
- Letters centered horizontally, then positioned in a grid with `LETTER_GAP` spacing
- One wrapper `<group>` per letter for independent animation

```typescript
// Pseudo-code
let cursor = -totalWidth / 2
for each letter:
  boundingBox = letter.geometry.computeBoundingBox()
  letterWidth = bb.max.x - bb.min.x
  centerX = cursor + letterWidth / 2
  wrapper.position.x = centerX
  mesh.position.x = -letterWidth / 2  // Center mesh within wrapper
  cursor += letterWidth + LETTER_GAP
```

### Per-Letter Reactivity:

Each letter wrapper animates based on pointer proximity:

```typescript
// Pointer distance falloff: Gaussian-like
const dx = pointerX - letterX
const dy = pointerY - letterY
const react = Math.exp(-((dx*dx)/1.1 + (dy*dy)/0.7))

// Animation targets
wrapper.position.y += react * 0.12       // Lift toward pointer
wrapper.position.z += react * 0.7        // Push forward (z-depth)
wrapper.rotation.y = react * Math.sign(dx) * -0.35  // Tilt horizontal
wrapper.rotation.x = react * Math.sign(dy) * 0.3    // Tilt vertical
```

Plus idle float on each letter:
```typescript
const floatY = Math.sin(t * 1.1 + i * 0.6) * 0.03   // Staggered wave
```

### Group Animation:

The entire wordmark group performs a slow orbit/tilt while the hero is visible:

```typescript
const orbitY = Math.sin(t * 0.35) * 0.1 + state.pointer.x * 0.12
const orbitX = Math.sin(t * 0.28) * 0.05 - state.pointer.y * 0.08
group.rotation.y = damp(group.rotation.y, orbitY, 4, delta)
group.rotation.x = damp(group.rotation.x, orbitX, 4, delta)
```

### Responsive Scale:

```typescript
// Fit the wordmark to ~62% of the visible width
const target = Math.min(1, (visW * 0.62) / span)
fitScale.current = damp(fitScale.current, target, 6, delta)
group.scale.setScalar(fitScale.current)
```

### Opacity:

Fades with hero section:
```typescript
heroOpacity = clamp(1 - p / 0.1)
// Applied to every Text3D material
mat.opacity = heroOpacity
mat.transparent = true
```

---

## 7. Current Materials & Shaders

### No Custom GLSL Shaders

All materials are **standard THREE.MeshStandardMaterial** (physically-based rendering). No custom GLSL fragments are used.

### Material Summary:

| Component | Geometry | Color | Metalness | Roughness | Emissive | Emissive Intensity | Transparent |
|-----------|----------|-------|-----------|-----------|----------|-------------------|-------------|
| Card Body | ExtrudeGeometry | #0b0918 (purple) | 0.7 | 0.35 | #241046 (purple) | 0.22 | Yes |
| Card Front | ShapeGeometry + TextureLoader | Map (card-front.png) | 0.3 | 0.5 | #0a3a4a (cyan) | 0.22 | Yes |
| Card Back | ShapeGeometry + TextureLoader | Map (cardback.png) | 0.5 | 0.45 | #1a0a3a (purple) | 0.28 | Yes |
| GAITTAMON Letters (all 9) | Text3D Extruded | #eafcff (cyan-white) | 0.35 | 0.25 | #1fb6e6 (cyan) | 0.55 | Yes |

### Texture Properties:

Both card textures loaded via `THREE.TextureLoader`:
- **Colorspace:** `THREE.SRGBColorSpace`
- **Anisotropy:** 8 (for diagonal edge clarity when card is tilted)
- **Transparent:** Textures have alpha channels for blending

---

## 8. Lighting Setup

**File:** `scene.tsx`

### Lights in the Scene:

```typescript
<ambientLight intensity={0.35} color="#6a4aff" />                    // Soft purple fill
<directionalLight position={[-4, 3, 5]} intensity={1.2} color="#b48cff" />  // Purple key light
<pointLight position={[0, -3, 4]} intensity={20} color="#c79a3a" distance={16} />  // Warm gold accent
<SweepLight progressRef={progressRef} />  // Dynamic sweep (anatomy stage only)
<Environment preset="night" />            // Drei environment map
```

### Ambient Light:
- **Color:** #6a4aff (purple)
- **Intensity:** 0.35 (soft overall fill)

### Directional Light (Key):
- **Position:** [-4, 3, 5] (upper left, slightly forward)
- **Color:** #b48cff (purple)
- **Intensity:** 1.2 (dominant side light)

### Point Light (Warm Accent):
- **Position:** [0, -3, 4] (below card, forward)
- **Color:** #c79a3a (gold/orange warm tone)
- **Intensity:** 20
- **Distance:** 16 units (falloff range)
- **Purpose:** Creates warm rim/fill on underside of card during anatomy stage

### Sweep Light (Dynamic):

**File:** `scene.tsx` > `SweepLight` component

```typescript
function SweepLight({ progressRef }) {
  const light = useRef<THREE.PointLight>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const p = progressRef.current
    
    // Active during anatomy → zoom (p ∈ [0.4, 0.65])
    const sweep = clamp((p - 0.4) / 0.25)  // 0 → 1 over anatomy hold
    
    // Orbits around card, sweeping like a spotlight
    light.current.position.x = Math.sin(t * 1.2) * 3 * (0.4 + sweep)
    light.current.position.y = Math.cos(t * 0.8) * 1.5
    light.current.intensity = 30 + sweep * 90  // Grows from 30 → 120
  })
  return <pointLight ref={light} color="#5ee9ff" position={[2, 1, 3]} distance={14} />
}
```

- **Color:** #5ee9ff (cyan)
- **Intensity:** 30 → 120 (sweeps up during anatomy hold)
- **Distance:** 14 units
- **Orbit:** Moves in Lissajous pattern around the card to create "reflection sweep" effect

### Environment:

```typescript
<Environment preset="night" />  // Drei's preset night HDRI
```

Provides subtle reflections on metallic surfaces (card edges, letters).

---

## 9. Navigation & UI Elements

### Top Navigation (`top-nav.tsx`)

```typescript
<header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-3 sm:px-10">
  {/* Logo */}
  <a href="/" aria-label="Gaittamon home">
    <Image
      src="/gaittamon-logo.png"
      alt="Gaittamon"
      width={160}
      height={72}
      priority
      className="h-14 w-auto object-contain drop-shadow-[0_0_12px_rgba(255,180,0,0.5)]"
    />
  </a>

  {/* Desktop Nav (hidden on mobile) */}
  <nav aria-label="Main navigation" className="hidden items-center sm:flex">
    {/* Links with cyan dividers */}
    {[
      { label: "How to Play", href: "#how-to-play" },
      { label: "Cards", href: "#cards" },
      { label: "Lore", href: "#lore" },
    ].map((link, i) => (
      <span key={link.href} className="flex items-center">
        {i > 0 && <span aria-hidden="true" className="mx-5 h-4 w-px bg-cyan-glow/40" />}
        <a href={link.href} className="font-mono text-xs uppercase tracking-[0.22em] text-foreground/60 transition-colors hover:text-cyan-glow">
          {link.label}
        </a>
      </span>
    ))}

    {/* Discord Link */}
    <span aria-hidden="true" className="mx-5 h-4 w-px bg-cyan-glow/40" />
    <a href="https://discord.gg/" target="_blank" rel="noopener noreferrer"
       className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.22em] text-foreground/60 transition-colors hover:text-[#5865F2]"
       aria-label="Join our Discord">
      {/* Discord SVG icon */}
      Discord
    </a>

    {/* Play Button (gold variant) */}
    <a href="#play" className="ml-8 rounded-full border-2 border-gold/70 bg-gold/10 px-7 py-2.5 font-mono text-sm font-semibold uppercase tracking-[0.22em] text-gold shadow-[0_0_18px_color-mix(in_oklch,var(--gold)_35%,transparent)] transition-all hover:bg-gold/20 hover:shadow-[0_0_28px_color-mix(in_oklch,var(--gold)_55%,transparent)]">
      Play
    </a>
  </nav>

  {/* Mobile Play Button */}
  <a href="#play" className="flex sm:hidden rounded-full border-2 border-gold/70 bg-gold/10 px-5 py-2 font-mono text-sm font-semibold uppercase tracking-[0.18em] text-gold">
    Play
  </a>
</header>
```

**Styling:**
- **Fixed:** `fixed inset-x-0 top-0 z-50`
- **Layout:** Flexbox, space-between
- **Logo:** `h-14 w-auto`, drop shadow gold glow
- **Desktop Nav:** Hidden below `sm` breakpoint
- **Links:** Monospace, uppercase, 10px tracking, cyan on hover
- **Discord:** Blue (#5865F2) on hover
- **Play Button:** Gold border, semi-transparent gold background, gold glow shadow, hover → brighter

### CTA Button (`cta-button.tsx`)

```typescript
export function CtaButton({
  children,
  variant = "cyan",
}: {
  children: ReactNode
  variant?: "cyan" | "gold"
}) {
  const glow = variant === "gold"
    ? "border-gold/60 text-gold shadow-glow-purple hover:bg-gold/10"
    : "border-cyan-glow/60 text-cyan-glow shadow-glow-cyan hover:bg-cyan-glow/10"

  return (
    <button
      type="button"
      className={`group relative inline-flex items-center gap-2 rounded-full border bg-[#06060a]/60 px-8 py-3.5 font-mono text-sm font-medium uppercase tracking-[0.2em] backdrop-blur-md transition-all duration-300 hover:scale-[1.03] ${glow}`}
    >
      <span className="relative z-10">{children}</span>
      <span className="relative z-10 transition-transform duration-300 group-hover:translate-x-1">
        →
      </span>
    </button>
  )
}
```

**Styling:**
- **Shape:** Rounded-full pill
- **Border:** 1px border (cyan or gold, 60% opacity)
- **Background:** Dark semi-transparent `#06060a/60` with backdrop blur
- **Text:** Monospace, uppercase, small font, 0.2em tracking
- **Arrow:** Slides right on hover (`translate-x-1`)
- **Scale:** Hover → 1.03x scale
- **Glow:** Shadow from CSS variables (see globals.css)
- **Color Variants:**
  - **cyan (default):** cyan-glow text, shadow-glow-cyan
  - **gold:** gold text, shadow-glow-purple

---

## 10. Canvas & Renderer Setup

**File:** `scene.tsx`

```typescript
<Canvas
  gl={{ antialias: true, alpha: true }}
  dpr={[1, 2]}
  camera={{ position: [0, 0, 6], fov: 35 }}
>
  <color attach="background" args={["#050505"]} />
  <fog attach="fog" args={["#050505", 8, 18]} />

  <ambientLight intensity={0.35} color="#6a4aff" />
  <directionalLight position={[-4, 3, 5]} intensity={1.2} color="#b48cff" />
  <pointLight position={[0, -3, 4]} intensity={20} color="#c79a3a" distance={16} />

  <Suspense fallback={null}>
    <SweepLight progressRef={progressRef} />
    <CardMesh progressRef={progressRef} />
    <Title3D progressRef={progressRef} />
    <Environment preset="night" />
  </Suspense>
</Canvas>
```

### Canvas Props:

| Prop | Value | Purpose |
|------|-------|---------|
| `gl.antialias` | `true` | Smooth edges on geometry |
| `gl.alpha` | `true` | Transparent background (no opaque backbuffer) |
| `dpr` | `[1, 2]` | Device pixel ratio: 1x on low-res, 2x on retina |
| `camera.position` | `[0, 0, 6]` | Viewing distance from scene (Z=6) |
| `camera.fov` | `35` | Narrow field of view (cinematic zoom) |

### Scene Setup:

```typescript
<color attach="background" args={["#050505"]} />   // Very dark background
<fog attach="fog" args={["#050505", 8, 18]} />     // Exponential fog: near=8, far=18
```

**Fog:**
- Fog color: #050505 (matches background for seamless fade)
- Start distance: 8 units (close to card position z=0)
- End distance: 18 units (far beyond card)
- Creates atmospheric depth fade as objects recede

### Children Structure:

```typescript
<Suspense fallback={null}>
  <SweepLight />                // Dynamic point light (anatomy stage)
  <CardMesh />                  // 3D card with two textured faces + body
  <Title3D />                   // 9 Text3D letters
  <Environment preset="night" />   // HDRI reflections
</Suspense>
```

**Suspense:** Wraps all dynamic components to avoid render blocking.

### Three.js Version:

- **three.js:** 0.184.0
- **@react-three/fiber:** 9.6.1
- **@react-three/drei:** 10.7.7

---

## 11. Custom CSS Variables & Animations

**File:** `globals.css` (Tailwind v4)

### Design Tokens (OKLCH Color Space):

```css
:root {
  --background: oklch(0.145 0 0);        /* Very dark gray/near-black */
  --foreground: oklch(0.97 0.01 280);    /* Off-white cyan tint */
  --gold: oklch(0.82 0.14 85);           /* Warm gold/orange */
  --cyan-glow: oklch(0.82 0.15 195);     /* Bright cyan */
  --purple-glow: oklch(0.55 0.2 300);    /* Saturated purple/magenta */
}
```

### Text Glow Effects:

```css
.text-glow-cyan {
  text-shadow:
    0 0 8px color-mix(in oklch, var(--cyan-glow) 70%, transparent),
    0 0 28px color-mix(in oklch, var(--cyan-glow) 40%, transparent);
}

.text-glow-gold {
  text-shadow:
    0 0 10px color-mix(in oklch, var(--gold) 60%, transparent),
    0 0 32px color-mix(in oklch, var(--gold) 35%, transparent);
}
```

### Box Glow Shadows:

```css
.shadow-glow-cyan {
  box-shadow:
    0 0 0 1px color-mix(in oklch, var(--cyan-glow) 50%, transparent),
    0 0 20px color-mix(in oklch, var(--cyan-glow) 45%, transparent),
    0 0 60px color-mix(in oklch, var(--cyan-glow) 25%, transparent);
}

.shadow-glow-purple {
  box-shadow:
    0 0 0 1px color-mix(in oklch, var(--purple-glow) 45%, transparent),
    0 0 24px color-mix(in oklch, var(--purple-glow) 40%, transparent);
}
```

### Keyframe Animations:

```css
@keyframes scout-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
/* Used on scouter UI dots and idle scroll hint */

@keyframes scroll-bob {
  0%, 100% { transform: translate(-50%, 0); }
  50% { transform: translate(-50%, 8px); }
}
/* Used on idle scroll hint to bob up/down 8px */
```

### Responsive Utilities:

All components use Tailwind responsive prefixes:
- `sm:` (640px+)
- `md:` (768px+)
- `lg:` (1024px+)

Example:
```typescript
className="text-4xl sm:text-5xl"  // 4xl on mobile, 5xl on tablet+
```

---

## 12. Data Flow Summary

### Top-Level Flow:

1. **app/page.tsx** → `<Experience />`
2. **Experience** orchestrates:
   - Scroll event listener → `progress` state (0..1 over 4 screens)
   - Fixed 3D `<Scene progressRef={progressRef} />`
   - Scroll-anchored text overlays with `anchor()` function
   - Vignette overlay (radial gradient)
   - ScouterUI overlay (opacity + appear-driven)
   - Scroll spacer (360vh) drives the timeline
3. **Scene** renders:
   - Canvas with camera `[0, 0, 6]`, FOV 35
   - Lights: ambient (purple), directional (purple), point (gold), sweep (dynamic cyan)
   - `<CardMesh progressRef={...} />` receives progress ref, animates rotation/position/scale
   - `<Title3D progressRef={...} />` receives progress ref, animates opacity + per-letter reactivity
   - Environment (night HDRI)

### State & Refs:

- **progress** (state): Throttled scroll progress for UI updates
- **progressRef** (ref): Immediate scroll progress for 60fps R3F updates (avoids state batching lag)

---

## 13. Build & Deployment

### Next.js Config:

```typescript
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
}
```

- TypeScript errors ignored during build (fast iteration)
- Image optimization disabled (unoptimized serves raw PNG/JPEG)

### Package Manager:

- **pnpm** with override for `hono@4.12.25`

### Scripts:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint ."
}
```

---

## 14. Key Dependencies & Versions

| Dependency | Version | Purpose |
|------------|---------|---------|
| next | 16.2.6 | React framework (App Router) |
| react | ^19 | UI library |
| react-dom | ^19 | React DOM renderer |
| three | 0.184.0 | 3D graphics |
| @react-three/fiber | 9.6.1 | R3F React wrapper for Three.js |
| @react-three/drei | 10.7.7 | R3F utilities (Text3D, Environment) |
| framer-motion | 12.41.0 | Animation library (unused in current build) |
| tailwindcss | 4.2.0 | CSS framework (v4, new @import format) |
| @tailwindcss/postcss | 4.2.0 | Tailwind PostCSS plugin |
| typescript | 5.7.3 | Type safety |
| lucide-react | 1.16.0 | Icon library (unused) |
| clsx | 2.1.1 | Conditional CSS classes |
| tailwind-merge | 3.3.1 | Merge Tailwind classes safely |
| @vercel/analytics | 1.6.1 | Analytics tracking |

---

## 15. Notable Implementation Details

### Why a Ref + State Dual Approach for Scroll Progress?

- **progressRef**: Direct update on scroll events (no state batching), used for 60fps R3F `useFrame` updates
- **progress**: State update on scroll, used for UI animations (text overlays, opacity tweening)
- This avoids React's state batching delay in animation loops while keeping overlays in sync

### Why `TIMELINE_SCREENS = 4` with Fixed 360vh Spacer?

The card animation is **independent of footer height**:
- Spacer is 360vh = 4 screens × 90vh (100vh - header margin)
- Timeline completes at `progress = 1` exactly when scroll reaches 360vh
- Footer content (Ranked section, video, footer) scrolls in AFTER the spacer, so they don't affect card timing

### Why Text3D Instead of HTML Text?

- 3D text renders inside the R3F canvas, perfectly integrated with lighting
- HTML overlay would require positioning calculations and could cause z-fighting
- Per-letter manipulation (individual rotations, scales, positions) is natural in 3D

### Why Textures with Alpha Channels?

- Card faces (front.png, cardback.png) have alpha for rounded corners without visible square boundaries
- Allows efficient clipping without geometry modifications

---

This concludes the complete technical context dump. All code snippets, materials, lighting, animations, and data flow are specified above.
