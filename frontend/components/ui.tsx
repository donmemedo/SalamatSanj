"use client"
import { type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject, useEffect, useId, useRef, useState } from "react"
import { usePrefs } from "@/lib/prefs"

// Solid surface: glass is reserved for chrome (sidebar, tab bar, sheet), so translucency never stacks.
export function Card({ i = 0, className = "", children }: { i?: number; className?: string; children: ReactNode }) {
  return <section className={`card rise ${className}`} style={{ "--i": i } as CSSProperties}>{children}</section>
}

export function Title({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[1.0625rem] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}

/** docTitle names the route for the tab and for Next's route announcer (screen readers); defaults to title. */
export function PageHeader({ kicker, title, docTitle, action }: { kicker?: string; title: string; docTitle?: string; action?: ReactNode }) {
  const { t } = usePrefs()
  return (
    <header className="rise mb-6 flex flex-wrap items-end justify-between gap-4">
      <title>{`${docTitle ?? title} · ${t("brand")}`}</title>
      <div>
        {kicker && <p className="mb-1 text-sm font-medium text-muted">{kicker}</p>}
        <h1 className="text-[2.125rem] leading-tight font-bold tracking-tight md:text-5xl">{title}</h1>
      </div>
      {action}
    </header>
  )
}

/** Concentric Apple-style rings. value is 0..1 (capped visually). Decorative: the numbers sit next to it. */
export function Rings({ rings, size = 120, stroke = 14, gap = 3, children }: {
  rings: { value: number; color: string }[]; size?: number; stroke?: number; gap?: number; children?: ReactNode
}) {
  const [on, setOn] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id) }, [])
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg aria-hidden width={size} height={size} className="-rotate-90 overflow-visible">
        {rings.map(({ value, color }, k) => {
          const r = size / 2 - stroke / 2 - k * (stroke + gap)
          const c = 2 * Math.PI * r
          const common = { cx: size / 2, cy: size / 2, r, fill: "none", strokeWidth: stroke, stroke: color }
          return (
            <g key={k}>
              <circle {...common} strokeOpacity={0.18} />
              <circle {...common} strokeLinecap="round" strokeDasharray={c}
                strokeDashoffset={on ? c * (1 - Math.min(Math.max(value, 0.001), 1)) : c}
                style={{ transition: `stroke-dashoffset 1.8s cubic-bezier(.16,1,.3,1) ${k * 150}ms` }} />
            </g>
          )
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

export function CountUp({ value, digits = 0 }: { value: number; digits?: number }) {
  const { n } = usePrefs()
  const [v, setV] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { from.current = value; setV(value); return }
    let raf = 0, start = 0
    const a = from.current
    const step = (ts: number) => {
      start ||= ts
      const k = Math.min(1, (ts - start) / 1300)
      const cur = a + (value - a) * (1 - Math.pow(1 - k, 4))
      from.current = cur
      setV(cur)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <span className="num">{n(v, digits)}</span>
}

const smooth = (p: number[][]) =>
  p.map(([x, y], i) => {
    if (!i) return `M${x},${y}`
    const [px, py] = p[i - 1], mx = (px + x) / 2
    return `C${mx},${py} ${mx},${y} ${x},${y}`
  }).join("")

/** Lowest and highest points as one sentence: the text alternative for a chart. */
function useSummary(values: number[], say: (i: number) => string) {
  const { t } = usePrefs()
  if (!values.length) return undefined
  const lo = values.indexOf(Math.min(...values)), hi = values.indexOf(Math.max(...values))
  return `${t("lowest")}: ${say(lo)} · ${t("highest")}: ${say(hi)}`
}

/** Interactive area chart; time always runs left-to-right. */
export function AreaChart({ values, color, height = 170, label }: {
  values: number[]; color: string; height?: number; label?: (i: number, v: number) => string
}) {
  const { n } = usePrefs()
  const id = "g" + useId().replace(/[^a-zA-Z0-9]/g, "")
  const [hover, setHover] = useState<number | null>(null)
  const hv = hover != null && hover < values.length ? hover : null // values can shrink under a stale hover index
  const say = (i: number) => (label ? label(i, values[i]) : n(values[i]))
  const summary = useSummary(values, say)
  const w = 600, h = height, pad = 10
  const max = Math.max(...values, 1) * 1.12
  const x = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(values.length - 1, 1)
  const y = (v: number) => h - pad - (v / max) * (h - 2 * pad)
  const pts = values.map((v, i) => [x(i), y(v)])
  const line = smooth(pts)
  const track = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setHover(Math.max(0, Math.min(values.length - 1, Math.round(((e.clientX - r.left) / r.width) * (values.length - 1)))))
  }
  return (
    <div dir="ltr" role="img" aria-label={summary} className="relative select-none">
      {/* pan-y: vertical swipes still scroll the page; a tap or horizontal drag scrubs the chart */}
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="reveal block w-full touch-pan-y" style={{ height }}
        onPointerDown={track} onPointerMove={track} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity=".38" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={w} y1={h * f} y2={h * f} stroke="var(--line)" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={`${line}L${x(values.length - 1)},${h}L${x(0)},${h}Z`} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hv != null && <line x1={pts[hv][0]} x2={pts[hv][0]} y1={0} y2={h} stroke={color} strokeOpacity={0.5}
          strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hv != null && (
        <>
          <span className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-solid shadow-lg"
            style={{ left: `${(pts[hv][0] / w) * 100}%`, top: pts[hv][1] * (height / h), background: color }} />
          <span className="pointer-events-none absolute -top-2 -translate-x-1/2 -translate-y-full rounded-xl bg-solid px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-lg ring-1 ring-line"
            style={{ left: `clamp(40px, ${(pts[hv][0] / w) * 100}%, calc(100% - 40px))` }}>
            {say(hv)}
          </span>
        </>
      )}
    </div>
  )
}

export function Bars({ values, labels, color, goal, height = 150, fmt, highlight }: {
  values: number[]; labels?: string[]; color: string; goal?: number; height?: number; fmt?: (v: number) => string; highlight?: number
}) {
  const { n } = usePrefs()
  const f = fmt ?? n
  const summary = useSummary(values, (i) => [labels?.[i], f(values[i])].filter(Boolean).join(" "))
  const max = Math.max(goal ?? 0, ...values, 1) * 1.1
  return (
    <div dir="ltr" role="img" aria-label={summary}>
      <div className="relative flex items-end gap-[3%]" style={{ height }}>
        {goal != null && (
          <div className="absolute inset-x-0 border-t border-dashed" style={{ bottom: `${(goal / max) * 100}%`, borderColor: color, opacity: 0.5 }} />
        )}
        {values.map((v, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end justify-center">
            {fmt && (
              <span className="pointer-events-none absolute z-10 -translate-y-2 rounded-lg bg-solid px-2 py-0.5 text-[0.6875rem] font-semibold tracking-[0.01em] whitespace-nowrap opacity-0 shadow-lg ring-1 ring-line transition group-hover:opacity-100"
                style={{ bottom: `${(v / max) * 100}%` }}>{fmt(v)}</span>
            )}
            <div className="grow-y w-full max-w-8 rounded-full"
              style={{ height: `max(6px, ${(v / max) * 100}%)`, background: color, animationDelay: `${i * 35}ms`,
                       opacity: highlight == null || highlight === i ? 1 : 0.45 }} />
          </div>
        ))}
      </div>
      {labels && (
        <div className="mt-2 flex gap-[3%]">
          {labels.map((l, i) => <span key={i} className="flex-1 truncate text-center text-[0.6875rem] tracking-[0.01em] text-muted">{l}</span>)}
        </div>
      )}
    </div>
  )
}

export function Progress({ value, color, label }: { value: number; color: string; label?: string }) {
  const pct = Math.round(Math.min(100, value * 100))
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
      className="h-2 overflow-hidden rounded-full bg-fill">
      <div className="fill-x h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string
}) {
  const idx = options.findIndex((o) => o.value === value), n = options.length
  // Radio-group keyboard model: one tab stop, arrows move the selection (mirrored in RTL).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key]
    if (!step) return
    e.preventDefault()
    const flip = e.key.startsWith("ArrowL") || e.key.startsWith("ArrowR") ? getComputedStyle(e.currentTarget).direction === "rtl" : false
    const k = (idx + (flip ? -step : step) + n) % n
    onChange(options[k].value)
    ;(e.currentTarget.children[k + 1] as HTMLElement | undefined)?.focus() // child 0 is the sliding indicator
  }
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className="relative grid rounded-full bg-fill p-1 text-sm font-medium"
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      <span className="absolute inset-y-1 rounded-full bg-solid shadow-sm transition-[inset-inline-start] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{ width: `calc((100% - .5rem) / ${n})`, insetInlineStart: `calc(.25rem + ${idx} * (100% - .5rem) / ${n})` }} />
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value} tabIndex={o.value === value ? 0 : -1} onClick={() => onChange(o.value)}
          className={`press relative z-10 min-h-11 rounded-full px-3 py-2 whitespace-nowrap ${o.value === value ? "" : "text-muted"}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stat({ label, value, unit, color }: { label: string; value: ReactNode; unit?: string; color?: string }) {
  return (
    <div>
      <p className="text-[0.8125rem] font-medium text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight" style={{ color }}>
        {value} {unit && <span className="text-sm font-medium text-muted">{unit}</span>}
      </p>
    </div>
  )
}

export function Gate<T>({ q, children }: { q: { data?: T; error: boolean; reload: () => unknown }; children: (d: T) => ReactNode }) {
  const { t } = usePrefs()
  if (q.error)
    return (
      <Card className="mx-auto max-w-md text-center">
        <p aria-hidden className="mb-2 text-4xl">📡</p>
        <p role="alert" className="mb-4 font-semibold">{t("errorTitle")}</p>
        <button onClick={q.reload} className="press min-h-11 rounded-full bg-accent px-5 py-2.5 font-semibold text-on-accent">{t("retry")}</button>
      </Card>
    )
  if (!q.data)
    return (
      <div role="status" aria-busy className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <span className="sr-only">{t("loading")}</span>
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="shimmer h-48 rounded-[28px]" />)}
      </div>
    )
  return <>{children(q.data)}</>
}

const rubber = (x: number, dim: number) => (x * dim * 0.55) / (dim + 0.55 * x)

/** Drag a <dialog> sheet down to dismiss: 1:1 tracking, rubber-band upward, momentum-projected release.
 *  Pointer-only enhancement: Escape, the close button and a backdrop tap still work. Reset `translate` before reopening. */
export function SheetHandle({ sheet }: { sheet: RefObject<HTMLDialogElement | null> }) {
  const drag = useRef<{ y0: number; last: number; t: number; v: number } | null>(null)
  const end = (y: number) => {
    const d = drag.current, el = sheet.current
    drag.current = null
    if (!d || !el) return
    el.style.transition = ""
    const projected = y - d.y0 + ((d.v / 1000) * 0.998) / (1 - 0.998) // where the flick would come to rest
    if (projected > el.offsetHeight / 2) el.close() // exits downward from where the finger left it
    else el.style.translate = "" // settles back
  }
  return (
    <div aria-hidden className="mx-auto -mt-2 flex h-7 w-28 cursor-grab touch-none items-center justify-center"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { y0: e.clientY, last: e.clientY, t: e.timeStamp, v: 0 }
        if (sheet.current) sheet.current.style.transition = "none"
      }}
      onPointerMove={(e) => {
        const d = drag.current, el = sheet.current
        if (!d || !el) return
        d.v = ((e.clientY - d.last) / Math.max(1, e.timeStamp - d.t)) * 1000
        d.last = e.clientY
        d.t = e.timeStamp
        const dy = e.clientY - d.y0
        el.style.translate = `0 ${dy > 0 ? dy : -rubber(-dy, el.offsetHeight)}px`
      }}
      onPointerUp={(e) => end(e.clientY)} onPointerCancel={(e) => end(e.clientY)}>
      <span className="h-1.5 w-10 rounded-full bg-muted/40" />
    </div>
  )
}
