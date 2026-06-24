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
    dot: [30, 36],
    label: [47, 27],
    text: "Mystitoad · Exalted",
    align: "start",
    origin: "left",
  },
  {
    id: "tier",
    dot: [38, 55],
    label: [49, 58],
    text: "Lv. 20 · Tier 6",
    align: "start",
    origin: "left",
  },
  {
    id: "stat",
    dot: [30, 70],
    label: [30, 84],
    text: "Inline Stat Bar · HP",
    align: "mid",
    origin: "top",
  },
]

function labelWrapTransform(align: "start" | "end" | "mid") {
  if (align === "end") return "translate(-100%, -50%)"
  if (align === "start") return "translate(0, -50%)"
  return "translate(-50%, 0)"
}

// Card-bounding reticle corners (tight around the left-positioned card).
const RET = { x1: 20, y1: 28, x2: 41, y2: 78 }

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

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-20"
      style={{ opacity }}
    >
      {/* Connector lines + corner reticle */}
      <svg
        className="absolute inset-0 h-full w-full text-cyan-glow"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
      >
        <g
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          style={{ opacity: dotsO * 0.5 }}
        >
          <path d={`M${RET.x1} ${RET.y1 + 7} V${RET.y1} H${RET.x1 + 6}`} />
          <path d={`M${RET.x2} ${RET.y1 + 7} V${RET.y1} H${RET.x2 - 6}`} />
          <path d={`M${RET.x1} ${RET.y2 - 7} V${RET.y2} H${RET.x1 + 6}`} />
          <path d={`M${RET.x2} ${RET.y2 - 7} V${RET.y2} H${RET.x2 - 6}`} />
        </g>

        {POINTS.map((p) => (
          <path
            key={p.id}
            d={`M ${p.dot[0]} ${p.dot[1]} L ${p.label[0]} ${p.label[1]}`}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - draw}
            stroke="currentColor"
            strokeWidth="1.25"
            vectorEffect="non-scaling-stroke"
            style={{ opacity: 0.75 }}
          />
        ))}
      </svg>

      {/* Pulsing dots anchored on the card */}
      {POINTS.map((p) => (
        <div
          key={p.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${p.dot[0]}%`, top: `${p.dot[1]}%`, opacity: dotsO }}
        >
          <span className="relative flex h-3 w-3 items-center justify-center">
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-cyan-glow/60"
              style={{ animation: "scout-pulse 1.6s ease-in-out infinite" }}
            />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-glow shadow-glow-cyan" />
          </span>
        </div>
      ))}

      {/* Label boxes: frame draws out from the edge nearest the card, text fades in */}
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
              {/* drawing frame */}
              <div
                className="absolute inset-0 rounded-sm border border-cyan-glow/60 bg-[#04141a]/75 shadow-glow-cyan"
                style={{ opacity: boxDraw > 0.001 ? 1 : 0, ...scaleStyle }}
              />
              {/* text defines the box size, fades in last */}
              <span
                className="relative block whitespace-nowrap px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-glow sm:text-xs"
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
