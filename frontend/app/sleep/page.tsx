"use client"
import { Lightbulb, Moon, Sunrise } from "lucide-react"
import { useApi } from "@/lib/api"
import { usePrefs } from "@/lib/prefs"
import { STAGE_COLOR, type Sleep, type Stage } from "@/lib/types"
import { Bars, Card, CountUp, Gate, PageHeader, Rings, Stat, Title } from "@/components/ui"

const ROWS: Stage[] = ["awake", "rem", "light", "deep"]

export default function SleepPage() {
  const { t, n, pct, day, dur, digits } = usePrefs()
  const q = useApi<{ last: Sleep; week: (Omit<Sleep, "stages"> & { date: string })[] }>("/api/sleep")

  return (
    <>
      <PageHeader kicker={t("lastNight")} title={t("sleep")} />
      <Gate q={q}>
        {({ last: s, week }) => {
          const span = s.stages.at(-1)!.start + s.stages.at(-1)!.minutes
          return (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Card i={0} className="lift md:col-span-2 xl:col-span-1">
                <div className="flex flex-col items-center gap-6 text-center">
                  <Rings size={190} stroke={20} rings={[{ value: s.score / 100, color: "var(--sleep)" }]}>
                    <div>
                      <p className="text-5xl font-bold tracking-tight"><CountUp value={s.score} /></p>
                      <p className="text-sm text-muted">{t("sleepScore")}</p>
                    </div>
                  </Rings>
                  <div className="grid w-full grid-cols-3 gap-2">
                    <Stat label={t("duration")} value={<span className="text-lg">{dur(s.minutes)}</span>} />
                    <Stat label={t("bedtime")} value={<span className="num flex items-center justify-center gap-1"><Moon size={16} className="text-sleep" />{digits(s.bedtime)}</span>} />
                    <Stat label={t("wake")} value={<span className="num flex items-center justify-center gap-1"><Sunrise size={16} className="text-eat" />{digits(s.wake)}</span>} />
                  </div>
                </div>
              </Card>

              <Card i={1} className="md:col-span-2">
                <Title>{t("stages")}</Title>
                <div className="flex gap-3">
                  <div aria-hidden className="grid shrink-0 text-xs text-muted" style={{ gridTemplateRows: "repeat(4, 44px)" }}>
                    {ROWS.map((r) => <span key={r} className="flex items-center">{t(r)}</span>)}
                  </div>
                  {/* Visual only: the stage tiles below give the same minutes as text. */}
                  <div aria-hidden className="flex-1">
                  <div dir="ltr" className="relative" style={{ height: 176 }}>
                    {ROWS.map((_, k) => <div key={k} className="absolute inset-x-0 border-t border-dashed border-line" style={{ top: k * 44 + 22 }} />)}
                    {s.stages.map((g, k) => (
                      <div key={k} title={`${t(g.stage)} · ${n(g.minutes)} ${t("min")}`}
                        className="grow-y absolute rounded-md"
                        style={{ left: `${(g.start / span) * 100}%`, width: `max(3px, ${(g.minutes / span) * 100}%)`,
                                 top: ROWS.indexOf(g.stage) * 44 + 8, height: 28, background: STAGE_COLOR[g.stage],
                                 animationDelay: `${k * 25}ms`, boxShadow: `0 0 12px color-mix(in srgb, ${STAGE_COLOR[g.stage]} 50%, transparent)` }} />
                    ))}
                  </div>
                  <div dir="ltr" className="num mt-2 flex justify-between text-xs text-muted"><span>{digits(s.bedtime)}</span><span>{digits(s.wake)}</span></div>
                  </div>
                </div>

                <div aria-hidden dir="ltr" className="fill-x mt-6 flex h-3 overflow-hidden rounded-full">
                  {(["deep", "rem", "light", "awake"] as Stage[]).map((k) => (
                    <div key={k} className="h-full" style={{ width: `${(s[k] / span) * 100}%`, background: STAGE_COLOR[k] }} />
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(["deep", "rem", "light", "awake"] as Stage[]).map((k) => (
                    <div key={k} className="rounded-2xl bg-fill p-3">
                      <p className="flex items-center gap-1.5 text-xs text-muted"><span className="size-2 rounded-full" style={{ background: STAGE_COLOR[k] }} />{t(k)}</p>
                      <p className="mt-1 font-bold">{n(s[k])} <span className="text-xs font-medium text-muted">{t("min")} · {pct((s[k] / span) * 100)}</span></p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card i={2} className="md:col-span-2">
                <Title>{t("twoWeeks")}</Title>
                <Bars values={week.map((w) => w.minutes / 60)} color="var(--sleep)" goal={8} highlight={week.length - 1}
                  fmt={(v) => `${n(v, 1)} ${t("hours")}`} labels={week.map((w) => day(w.date, "narrow"))} />
              </Card>

              <Card i={3} className="lift bg-[linear-gradient(135deg,color-mix(in_srgb,var(--sleep)_22%,transparent),transparent)]">
                <Title action={<Lightbulb className="text-eat" size={20} />}>{t("insights")}</Title>
                <p className="leading-8">{t("sleepTip")}</p>
                <p className="mt-3 text-xs leading-5 text-muted">{t("disclaimer")}</p>
              </Card>
            </div>
          )
        }}
      </Gate>
    </>
  )
}
