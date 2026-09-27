"use client"
import { ShieldCheck } from "lucide-react"
import { useApi } from "@/lib/api"
import { usePrefs, type Bi } from "@/lib/prefs"
import { AreaChart, Card, CountUp, Gate, PageHeader, Progress, Rings, Stat, Title } from "@/components/ui"

type Org = {
  name: Bi; members: number; active: number; wellbeing: number; avg_steps: number; avg_sleep_min: number; challenge_rate: number
  weekly: { week: number; active: number; steps: number }[]
  departments: { name: Bi; members: number; avg_steps: number; sleep_min: number; participation: number }[]
}

export default function BusinessPage() {
  const { t, n, pick, pct, dur } = usePrefs()
  const q = useApi<Org>("/api/org")
  return (
    <>
      <PageHeader kicker={q.data ? pick(q.data.name) : t("forOrgs")} title={t("orgDashboard")} />
      <Gate q={q}>
        {(o) => (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card i={0} className="lift md:col-span-2 xl:row-span-2">
              <Title>{t("wellbeing")}</Title>
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <Rings size={180} stroke={18} gap={4} rings={[
                  { value: o.wellbeing / 100, color: "var(--steps)" },
                  { value: o.active / o.members, color: "var(--water)" },
                  { value: o.challenge_rate / 100, color: "var(--move)" },
                ]}>
                  <b className="text-4xl"><CountUp value={o.wellbeing} /></b>
                </Rings>
                <div className="grid flex-1 gap-4">
                  <Stat label={t("wellbeing")} color="var(--steps)" value={<CountUp value={o.wellbeing} />} unit="/ 100" />
                  <Stat label={t("activeUsers")} color="var(--water)" value={<CountUp value={o.active} />} unit={`/ ${n(o.members)}`} />
                  <Stat label={t("participation")} color="var(--move)" value={pct(o.challenge_rate)} />
                </div>
              </div>
            </Card>
            <Card i={1} className="lift"><Stat label={t("members")} value={<CountUp value={o.members} />} /></Card>
            <Card i={2} className="lift"><Stat label={t("avgSteps")} color="var(--move)" value={<CountUp value={o.avg_steps} />} unit={t("steps")} /></Card>
            <Card i={3} className="lift md:col-span-2"><Stat label={t("avgSleep")} color="var(--sleep)" value={dur(o.avg_sleep_min)} /></Card>

            <Card i={4} className="md:col-span-2 xl:col-span-4">
              <Title>{t("weeklyActive")}</Title>
              <AreaChart values={o.weekly.map((w) => w.active)} color="var(--water)" height={200}
                label={(i, v) => `#${n(o.weekly[i].week)} · ${n(v)} ${t("activeUsers")}`} />
            </Card>

            <Card i={5} className="md:col-span-2 xl:col-span-4">
              <Title>{t("departments")}</Title>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {o.departments.map((dp) => (
                  <div key={dp.name.en} className="rounded-2xl bg-fill p-4">
                    <div className="mb-3 flex items-baseline justify-between">
                      <b>{pick(dp.name)}</b><span className="num text-xs text-muted">{n(dp.members)} {t("members")}</span>
                    </div>
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted">{t("avgSteps")}</span><b className="num">{n(dp.avg_steps)}</b></div>
                      <Progress value={dp.avg_steps / 10000} color="var(--move)" />
                      <div className="flex justify-between"><span className="text-muted">{t("participation")}</span><b>{pct(dp.participation)}</b></div>
                      <Progress value={dp.participation / 100} color="var(--steps)" />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 flex items-start gap-2 rounded-2xl bg-steps/10 p-3 text-sm leading-6">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-steps" />{t("privacy")}
              </p>
            </Card>
          </div>
        )}
      </Gate>
    </>
  )
}
