"use client"
import Link from "next/link"
import { useState } from "react"
import { BedDouble, ChevronLeft, Droplet, Flame, Footprints, Heart, Minus, Plus, Sparkles, Utensils } from "lucide-react"
import { api, useApi } from "@/lib/api"
import { usePrefs } from "@/lib/prefs"
import type { Today } from "@/lib/types"
import { AreaChart, Bars, Card, CountUp, Gate, PageHeader, Progress, Rings, Title } from "@/components/ui"

const KIND = {
  sleep: { icon: BedDouble, color: "var(--sleep)" },
  move: { icon: Footprints, color: "var(--steps)" },
  eat: { icon: Utensils, color: "var(--eat)" },
}

export default function TodayPage() {
  const q = useApi<Today>("/api/today")
  const p = usePrefs()
  const { t, n, pick, day, dur, longDate, digits } = p
  const h = new Date().getHours()
  const greet = t(h < 12 ? "morning" : h < 16 ? "noon" : h < 20 ? "evening" : "night")

  return (
    <>
      <PageHeader kicker={longDate()} title={q.data ? `${greet}${p.lang === "fa" ? "، " : ", "}${pick(q.data.user.name)}` : greet} />
      <Gate q={q}>
        {(d) => {
          const g = d.goals, x = d.today
          const bpm = d.heart.at(-1)?.bpm ?? x.resting_hr
          return (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Card i={0} className="lift md:col-span-2">
                <div className="flex flex-col items-center gap-8 sm:flex-row sm:gap-10">
                  <Rings size={216} stroke={24} gap={4} rings={[
                    { value: x.steps / g.steps, color: "var(--move)" },
                    { value: x.active_min / g.active_min, color: "var(--steps)" },
                    { value: d.sleep.minutes / g.sleep_min, color: "var(--sleep)" },
                  ]} />
                  <div className="grid w-full flex-1 gap-5">
                    {[
                      { label: t("steps"), v: x.steps, goal: g.steps, color: "var(--move)", unit: t("steps") },
                      { label: t("activity"), v: x.active_min, goal: g.active_min, color: "var(--steps)", unit: t("min") },
                      { label: t("sleep"), v: Math.round(d.sleep.minutes / 6) / 10, goal: g.sleep_min / 60, color: "var(--sleep)", unit: t("hours"), digits: 1 },
                    ].map((r) => (
                      <div key={r.label}>
                        <p className="text-[13px] font-semibold" style={{ color: r.color }}>{r.label}</p>
                        <p className="text-3xl font-bold tracking-tight">
                          <CountUp value={r.v} digits={r.digits} />
                          <span className="text-lg font-semibold text-muted"> / {n(r.goal)} {r.unit}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
                  <span className="rounded-full bg-fill px-3 py-1.5">🔥 {n(d.streak)} {t("streak")}</span>
                  <span className="rounded-full bg-fill px-3 py-1.5">📍 {n(x.distance_km, 1)} {t("km")}</span>
                  <span className="rounded-full bg-fill px-3 py-1.5">⚡ {n(x.kcal_out)} {t("kcal")}</span>
                </div>
              </Card>

              <Card i={1} className="lift">
                <Title action={<Heart className="animate-pulse text-heart" fill="currentColor" size={20} />}>{t("heart")}</Title>
                <p className="text-5xl font-bold tracking-tight"><CountUp value={bpm} /><span className="text-base font-medium text-muted"> {t("bpm")}</span></p>
                <p className="mt-1 mb-3 text-sm text-muted">{t("resting")}: {n(x.resting_hr)}</p>
                <AreaChart values={d.heart.map((v) => v.bpm)} color="var(--heart)" height={110}
                  label={(i, v) => `${digits(d.heart[i].t)} · ${n(v)}`} />
              </Card>

              <Card i={2} className="lift md:col-span-2">
                <Title action={<Sparkles className="text-eat" size={20} />}>{t("insights")}</Title>
                <ul className="grid gap-3">
                  {d.insights.map((it, k) => {
                    const { icon: Icon, color } = KIND[it.kind]
                    return (
                      <li key={k} className="rise flex items-start gap-3 rounded-2xl bg-fill p-3.5" style={{ "--i": k + 3 } as React.CSSProperties}>
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: color }}><Icon size={18} /></span>
                        <p className="text-[15px] leading-7">{pick(it.text)}</p>
                      </li>
                    )
                  })}
                </ul>
              </Card>

              <Water initial={d.water} goal={g.water} />

              <Card i={4} className="lift">
                <Title action={<Flame className="text-eat" size={20} />}>{t("kcal")}</Title>
                {[
                  { label: t("burned"), v: x.kcal_out, color: "var(--move)" },
                  { label: t("eaten"), v: d.intake.kcal, color: "var(--eat)" },
                ].map((r) => (
                  <div key={r.label} className="mb-4">
                    <div className="mb-1.5 flex justify-between text-sm"><span className="text-muted">{r.label}</span><b className="num">{n(r.v)}</b></div>
                    <Progress value={r.v / g.kcal_in} color={r.color} />
                  </div>
                ))}
                <Link href="/nutrition" className="press inline-flex items-center gap-1 text-sm font-semibold text-accent">
                  {t("nutrition")} <ChevronLeft size={16} className="ltr:rotate-180" />
                </Link>
              </Card>

              <Card i={5} className="lift">
                <Title action={<BedDouble className="text-sleep" size={20} />}>{t("lastNight")}</Title>
                <div className="flex items-center gap-5">
                  <Rings size={96} stroke={11} rings={[{ value: d.sleep.score / 100, color: "var(--sleep)" }]}>
                    <b className="text-2xl"><CountUp value={d.sleep.score} /></b>
                  </Rings>
                  <div className="text-sm">
                    <p className="text-lg font-bold">{dur(d.sleep.minutes)}</p>
                    <p className="text-muted">{digits(`${d.sleep.bedtime} – ${d.sleep.wake}`)}</p>
                    <Link href="/sleep" className="press mt-2 inline-flex items-center gap-1 font-semibold text-accent">
                      {t("stages")} <ChevronLeft size={16} className="ltr:rotate-180" />
                    </Link>
                  </div>
                </div>
              </Card>

              <Card i={6} className="md:col-span-2">
                <Title>{t("hourly")}</Title>
                <Bars values={d.hourly_steps.slice(6)} color="var(--move)" fmt={(v) => `${n(v)} ${t("steps")}`}
                  labels={d.hourly_steps.slice(6).map((_, k) => ((k + 6) % 3 === 0 ? n(k + 6) : ""))} />
              </Card>

              <Card i={7}>
                <Title>{t("week")}</Title>
                <Bars values={d.week.map((w) => w.steps)} labels={d.week.map((w) => day(w.date, "narrow"))}
                  color="var(--steps)" goal={g.steps} highlight={6} fmt={(v) => n(v)} />
              </Card>
            </div>
          )
        }}
      </Gate>
    </>
  )
}

function Water({ initial, goal }: { initial: number; goal: number }) {
  const { t, n } = usePrefs()
  const [w, setW] = useState(initial)
  const change = (delta: 1 | -1) => {
    setW((v) => Math.max(0, v + delta)) // optimistic
    api<{ water: number }>("/api/water", { method: "POST", body: JSON.stringify({ delta }) }).then((r) => setW(r.water), () => setW(initial))
  }
  const btn = "press grid size-10 place-items-center rounded-full bg-fill"
  return (
    <Card i={3} className="lift">
      <Title action={<Droplet className="text-water" fill="currentColor" size={20} />}>{t("water")}</Title>
      <p className="text-4xl font-bold tracking-tight"><span className="num">{n(w)}</span><span className="text-base font-medium text-muted"> / {n(goal)} {t("glasses")}</span></p>
      <div className="my-5 grid grid-cols-8 gap-1.5" dir="ltr">
        {Array.from({ length: goal }, (_, k) => (
          <span key={k} className="h-9 rounded-b-xl rounded-t-md border-2 transition-all duration-500"
            style={{ borderColor: "var(--water)", background: k < w ? "var(--water)" : "transparent", transitionDelay: `${k * 40}ms`, opacity: k < w ? 1 : 0.35 }} />
        ))}
      </div>
      <div className="flex gap-2">
        <button aria-label="-1" className={btn} onClick={() => change(-1)} disabled={w === 0}><Minus size={18} /></button>
        <button aria-label="+1" className={`${btn} flex-1 gap-1.5 bg-water! font-semibold text-white grid-flow-col`} onClick={() => change(1)}>
          <Plus size={18} /> {t("glasses")}
        </button>
      </div>
    </Card>
  )
}
