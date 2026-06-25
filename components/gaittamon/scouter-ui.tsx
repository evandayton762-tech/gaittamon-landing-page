"use client"

const clamp = (v: number) => Math.min(1, Math.max(0, v))

type Origin = "left" | "right" | "top"

const POINTS: {
  id: string
  dot: [number, number]
  label: [number, number]
  text: string
  align: "start" | "end" | "mid"
  origin: Origin
}[] = [
  {
    id: "name",
    // Crown area of the card — shifted right with the reticle
    dot: [36, 32],
    label: [53, 21],
    text: "Cindrake · Common",
    align: "start",
    origin: "left",
  },
  {
    id: "tier",
    // Mid-card right edge
    dot: [47, 52],
    label: [55, 55],
    text: "Lv. 5 · Fire",
    align: "start",
    origin: "left",
  },
  {
    id: "stat",
    // Bottom stat bar
    dot: [36, 72],
    label: [30, 92],
    text: "Stat Bar · HP · Moves",
    align: "mid",
    origin: "top",
  },
]

function labelWrapTransform(align: "start" | "end" | "mid") {
  if (align === "end") return "translate(-100%, -50%)"
  if (align === "start") return "translate(0, -50%)"
  return "translate(-50%, 0)"
}

// Corner bracket positions as percentages of the overlay viewport.
// Card anatomyX = -vw*0.2 puts the card center at ~32% from left on a
// wide screen. These values frame the card with equal breathing room.
// x1/x2 shifted right and spread wider than before.
const RET = { x1: 20, y1: 14, x2: 50, y2: 86 }
// Arm length in px — equal on all four sides, so corners look uniform.
const ARM = 26

/**
 * Dragon-Ball "scouter" HUD pointing at the card (left side in the anatomy
 * stage). Sequenced by `appear` (0..1):
 *   1. dots + corner reticle fade in
 *   2. connector lines draw OUTWARD from each dot to its label
 *   3. label boxes draw out (scale from the edge nearest the card)
 *   4. label text fades in
 * `opacity` fades the whole overlay in/out with the section.
 */
export function ScouterUi({
  opacity,
  appear,
}: {
  opacity: number
  appear: number
}) {
  const dotsO = clamp(appear / 0.2)
  const draw = clamp((appear - 0.2) / 0.35) // line draw
  const boxDraw = clamp((appear - 0.55) / 0.25) // box outline draws out
  const textO = clamp((appear - 0.8) / 0.2) // text fades in last

  // Each corner bracket is two absolutely-positioned <div> elements sharing a
  // corner point. Using real divs with border-* utilities gives equal pixel
  // stroke width on all four sides regardless of viewport aspect ratio.
  const corners = [
    // top-left
    {
      id: "tl",
      outer: { left: `${RET.x1}%`, top: `${RET.y1}%` },
      borderH: "border-l-2 border-t-2",
      styleH: { width: ARM, height: ARM },
    },
    // top-right
    {
      id: "tr",
      outer: { left: `${RET.x2}%`, top: `${RET.y1}%` },
      borderH: "border-r-2 border-t-2",
      styleH: { width: ARM, height: ARM, transform: "translateX(-100%)" },
    },
    // bottom-left
    {
      id: "bl",
      outer: { left: `${RET.x1}%`, top: `${RET.y2}%` },
      borderH: "border-l-2 border-b-2",
      styleH: { width: ARM, height: ARM, transform: "translateY(-100%)" },
    },
    // bottom-right
    {
      id: "br",
      outer: { left: `${RET.x2}%`, top: `${RET.y2}%` },
      borderH: "border-r-2 border-b-2",
      styleH: {
        width: ARM,
        height: ARM,
        transform: "translate(-100%, -100%)",
      },
    },
  ]

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-20"
      style={{ opacity }}
    >
      {/* Corner bracket reticle — div-based so stroke width is always even */}
      {corners.map((c) => (
        <div
          key={c.id}
          className={`absolute ${c.borderH} border-[#ffd700]`}
          style={{ ...c.outer, ...c.styleH, opacity: dotsO }}
        />
      ))}

      {/* Connector lines — SVG so we can do the draw animation */}
      <svg
        className="absolute inset-0 h-full w-full text-[#ffd700]"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
      >
        {POINTS.map((p) => {
          // Endpoint grows from dot to label so the line visibly extends outward.
          const ex = p.dot[0] + (p.label[0] - p.dot[0]) * draw
          const ey = p.dot[1] + (p.label[1] - p.dot[1]) * draw
          return (
            <line
              key={p.id}
              x1={p.dot[0]}
              y1={p.dot[1]}
              x2={ex}
              y2={ey}
              stroke="currentColor"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
              strokeOpacity={draw > 0.001 ? 0.7 : 0}
            />
          )
        })}
      </svg>

      {/* Pulsing anchor dots on the card */}
      {POINTS.map((p) => (
        <div
          key={p.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${p.dot[0]}%`, top: `${p.dot[1]}%`, opacity: dotsO }}
        >
          <span className="relative flex h-3 w-3 items-center justify-center">
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-[#ffd700]/50"
              style={{ animation: "scout-pulse 1.6s ease-in-out infinite" }}
            />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ffd700]" />
          </span>
        </div>
      ))}

      {/* Label boxes: frame draws out, then text fades in */}
      {POINTS.map((p) => {
        const scaleStyle =
          p.origin === "top"
            ? { transform: `scaleY(${boxDraw})`, transformOrigin: "top" }
            : {
                transform: `scaleX(${boxDraw})`,
                transformOrigin: p.origin === "right" ? "right" : "left",
              }
        return (
          <div
            key={p.id}
            className="absolute"
            style={{
              left: `${p.label[0]}%`,
              top: `${p.label[1]}%`,
              transform: labelWrapTransform(p.align),
            }}
          >
            <div className="relative">
              <div
                className="absolute inset-0 rounded-sm border border-[#ffd700]/60 bg-[#0a0814]/80"
                style={{
                  visibility: boxDraw > 0.001 ? "visible" : "hidden",
                  ...scaleStyle,
                }}
              />
              <span
                className="relative block whitespace-nowrap px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white sm:text-xs"
                style={{ opacity: textO }}
              >
                {p.text}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
