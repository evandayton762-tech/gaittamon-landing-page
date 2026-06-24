"use client"

const clamp = (v: number) => Math.min(1, Math.max(0, v))

type Anchor = "start" | "end" | "mid"

const POINTS: {
  id: string
  dot: [number, number]
  label: [number, number]
  text: string
  anchor: Anchor
}[] = [
  {
    id: "name",
    dot: [50, 27],
    label: [27, 15],
    text: "Mystitoad · Exalted",
    anchor: "end",
  },
  {
    id: "tier",
    dot: [60, 50],
    label: [82, 47],
    text: "Lv. 20 · Tier 6",
    anchor: "start",
  },
  {
    id: "stat",
    dot: [50, 72],
    label: [50, 87],
    text: "Inline Stat Bar · HP · Abilities",
    anchor: "mid",
  },
]

function labelTransform(anchor: Anchor) {
  if (anchor === "end") return "translate(-100%, -50%)"
  if (anchor === "start") return "translate(0, -50%)"
  return "translate(-50%, 0)"
}

/**
 * Dragon-Ball "scouter" HUD pointing at the centered card.
 * Sequenced by `appear` (0..1): dots fade in first, then lines draw outward
 * from each dot toward its label, then the labels fade in. `opacity` controls
 * the whole overlay (fade in + out with the section).
 */
export function ScouterUi({
  opacity,
  appear,
}: {
  opacity: number
  appear: number
}) {
  const dotsO = clamp(appear / 0.3)
  const draw = clamp((appear - 0.25) / 0.5)
  const labelO = clamp((appear - 0.62) / 0.32)

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-20"
      style={{ opacity }}
    >
      {/* Connector lines (draw outward from each dot) */}
      <svg
        className="absolute inset-0 h-full w-full text-cyan-glow"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
      >
        {/* corner reticle, fades in with the dots */}
        <g
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          style={{ opacity: dotsO * 0.5 }}
        >
          <path d="M18 30 V18 H30" />
          <path d="M82 30 V18 H70" />
          <path d="M18 70 V82 H30" />
          <path d="M82 70 V82 H70" />
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
            style={{ opacity: 0.7 }}
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

      {/* Labels fade in last */}
      {POINTS.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.label[0]}%`,
            top: `${p.label[1]}%`,
            transform: labelTransform(p.anchor),
            opacity: labelO,
          }}
        >
          <span className="whitespace-nowrap rounded-sm border border-cyan-glow/50 bg-[#04141a]/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-glow shadow-glow-cyan backdrop-blur-sm sm:text-xs">
            {p.text}
          </span>
        </div>
      ))}
    </div>
  )
}
