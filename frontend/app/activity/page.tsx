"use client"
import { useState } from "react"
import { useApi } from "@/lib/api"
import { usePrefs } from "@/lib/prefs"
import type { Day } from "@/lib/types"
import { AreaChart, Bars, Card, CountUp, Gate, PageHeader, Segmented, Stat, Title } from "@/components/ui"

export default function ActivityPage() {
  const { t, n, day, short } = usePrefs()
  const [days, setDays] = useState<"7" | "30">("7")
  const q = useApi<Day[]>(`/api/history?days=${days}`)
  const range = <Segmented value={days} onChange={setDays} options={[{ value: "7", label: t("days7") }, { value: "30", label: t("days30") }]} />

  return (
    <>
      <PageHeader kicker={t("tagline")} title={t("activity")} action={range} />
      <Gate q={q}>
        {(d) => {
          const steps = d.map((x) => x.steps)
          const total = steps.reduce((a, b) => a + b, 0)
          const best = d.reduce((a, b) => (b.steps > a.steps ? b : a))
          const lbl = (i: number) => short(d[i].date)
          return (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: t("total"), v: total, unit: t("steps"), color: "var(--move)" },
                { label: t("average"), v: Math.round(total / d.length), unit: t("steps"), color: "var(--steps)" },
                { label: t("distance"), v: d.reduce((a, b) => a + b.distance_km, 0), unit: t("km"), color: "var(--water)", digits: 1 },
                { label: t("best"), v: best.steps, unit: day(best.date), color: "var(--eat)" },
              ].map((s, k) => (
                <Card key={s.label} i={k} className="lift">
                  <Stat label={s.label} color={s.color} unit={s.unit} value={<CountUp value={s.v} digits={s.digits} />} />
                </Card>
              ))}

              <Card i={4} className="md:col-span-2 xl:col-span-4">
                <Title>{t("steps")}</Title>
                <AreaChart key={days} values={steps} color="var(--move)" height={220} label={(i, v) => `${lbl(i)} · ${n(v)}`} />
              </Card>

              <Card i={5} className="md:col-span-2">
                <Title>{t("activeMin")}</Title>
                <Bars key={days} values={d.map((x) => x.active_min)} color="var(--steps)" goal={45} fmt={(v) => `${n(v)} ${t("min")}`}
                  labels={d.map((x, i) => (d.length <= 7 || i % 5 === 0 ? day(x.date, "narrow") : ""))} />
              </Card>

              <Card i={6} className="md:col-span-2">
                <Title>{t("resting")}</Title>
                <AreaChart key={days} values={d.map((x) => x.resting_hr)} color="var(--heart)" height={150}
                  label={(i, v) => `${lbl(i)} · ${n(v)} ${t("bpm")}`} />
              </Card>
            </div>
          )
        }}
      </Gate>
    </>
  )
}
