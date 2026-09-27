"use client"
import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from "react"
import { usePrefs } from "@/lib/prefs"

export function Card({ i = 0, className = "", children }: { i?: number; className?: string; children: ReactNode }) {
  return <section className={`glass card rise ${className}`} style={{ "--i": i } as CSSProperties}>{children}</section>
}

export function Title({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[17px] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}

export function PageHeader({ kicker, title, action }: { kicker?: string; title: string; action?: ReactNode }) {
  return (
    <header className="rise mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {kicker && <p className="mb-1 text-sm font-medium text-muted">{kicker}</p>}
        <h1 className="text-[34px] leading-tight font-bold tracking-tight md:text-5xl">{title}</h1>
      </div>
      {action}
    </header>
  )
}

/** Concentric Apple-style rings. value is 0..1 (capped visually). */
export function Rings({ rings, size = 120, stroke = 14, gap = 3, children }: {
  rings: { value: number; color: string }[]; size?: number; stroke?: number; gap?: number; children?: ReactNode
}) {
  const [on, setOn] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id) }, [])
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 overflow-visible">
        {rings.map(({ value, color }, k) => {
          const r = size / 2 - stroke / 2 - k * (stroke + gap)
          const c = 2 * Math.PI * r
          const common = { cx: size / 2, cy: size / 2, r, fill: "none", strokeWidth: stroke, stroke: color }
          return (
            <g key={k}>
              <circle {...common} strokeOpacity={0.18} />
              <circle {...common} strokeLinecap="round" strokeDasharray={c}
                strokeDashoffset={on ? c * (1 - Math.min(Math.max(value, 0.001), 1)) : c}
                style={{ transition: `stroke-dashoffset 1.8s cubic-bezier(.16,1,.3,1) ${k * 150}ms`,
                         filter: `drop-shadow(0 0 5px color-mix(in srgb, ${color} 55%, transparent))` }} />
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

/** Interactive area chart; time always runs left-to-right. */
export function AreaChart({ values, color, height = 170, label }: {
  values: number[]; color: string; height?: number; label?: (i: number, v: number) => string
}) {
  const id = "g" + useId().replace(/[^a-zA-Z0-9]/g, "")
  const [hover, setHover] = useState<number | null>(null)
  const w = 600, h = height, pad = 10
  const max = Math.max(...values, 1) * 1.12
  const x = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(values.length - 1, 1)
  const y = (v: number) => h - pad - (v / max) * (h - 2 * pad)
  const pts = values.map((v, i) => [x(i), y(v)])
  const line = smooth(pts)
  return (
    <div dir="ltr" className="relative select-none">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="reveal block w-full touch-none" style={{ height }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setHover(Math.max(0, Math.min(values.length - 1, Math.round(((e.clientX - r.left) / r.width) * (values.length - 1)))))
        }}
        onPointerLeave={() => setHover(null)}>
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
        {hover != null && <line x1={pts[hover][0]} x2={pts[hover][0]} y1={0} y2={h} stroke={color} strokeOpacity={0.5}
          strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hover != null && (
        <>
          <span className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-solid shadow-lg"
            style={{ left: `${(pts[hover][0] / w) * 100}%`, top: pts[hover][1] * (height / h), background: color }} />
          <span className="glass pointer-events-none absolute -top-2 -translate-x-1/2 -translate-y-full rounded-xl px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
            style={{ left: `clamp(40px, ${(pts[hover][0] / w) * 100}%, calc(100% - 40px))` }}>
            {label ? label(hover, values[hover]) : values[hover]}
          </span>
        </>
      )}
    </div>
  )
}

export function Bars({ values, labels, color, goal, height = 150, fmt, highlight }: {
  values: number[]; labels?: string[]; color: string; goal?: number; height?: number; fmt?: (v: number) => string; highlight?: number
}) {
  const max = Math.max(goal ?? 0, ...values, 1) * 1.1
  return (
    <div dir="ltr">
      <div className="relative flex items-end gap-[3%]" style={{ height }}>
        {goal != null && (
          <div className="absolute inset-x-0 border-t border-dashed" style={{ bottom: `${(goal / max) * 100}%`, borderColor: color, opacity: 0.5 }} />
        )}
        {values.map((v, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end justify-center">
            {fmt && (
              <span className="glass pointer-events-none absolute z-10 -translate-y-2 rounded-lg px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap opacity-0 transition group-hover:opacity-100"
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
          {labels.map((l, i) => <span key={i} className="flex-1 truncate text-center text-[11px] text-muted">{l}</span>)}
        </div>
      )}
    </div>
  )
}

export function Progress({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-fill">
      <div className="fill-x h-full rounded-full" style={{ width: `${Math.min(100, value * 100)}%`, background: color }} />
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void
}) {
  const idx = options.findIndex((o) => o.value === value), n = options.length
  return (
    <div role="radiogroup" className="relative grid rounded-full bg-fill p-1 text-sm font-medium"
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      <span className="absolute inset-y-1 rounded-full bg-solid shadow-sm transition-[inset-inline-start] duration-500 ease-[cubic-bezier(.3,1.3,.5,1)]"
        style={{ width: `calc((100% - .5rem) / ${n})`, insetInlineStart: `calc(.25rem + ${idx} * (100% - .5rem) / ${n})` }} />
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={`press relative z-10 rounded-full px-3 py-1.5 whitespace-nowrap ${o.value === value ? "" : "text-muted"}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stat({ label, value, unit, color }: { label: string; value: ReactNode; unit?: string; color?: string }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-muted">{label}</p>
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
        <p className="mb-2 text-4xl">📡</p>
        <p className="mb-4 font-semibold">{t("errorTitle")}</p>
        <button onClick={q.reload} className="press rounded-full bg-accent px-5 py-2 font-semibold text-white">{t("retry")}</button>
      </Card>
    )
  if (!q.data)
    return (
      <div aria-busy className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="shimmer h-48 rounded-[28px]" />)}
      </div>
    )
  return <>{children(q.data)}</>
}
