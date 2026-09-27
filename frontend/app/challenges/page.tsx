"use client"
import { Check, Users } from "lucide-react"
import { api, useApi } from "@/lib/api"
import { usePrefs, type Bi } from "@/lib/prefs"
import { Card, Gate, PageHeader, Progress, Title } from "@/components/ui"

type Data = {
  items: { id: string; kind: "move" | "sleep" | "eat"; title: Bi; desc: Bi; goal: number; progress: number; unit: Bi; participants: number; days_left: number; joined: boolean }[]
  leaders: { rank: number; name: Bi; steps: number; me: boolean }[]
  badges: { id: string; name: Bi; emoji: string; earned: boolean }[]
}
const COLOR = { move: "var(--move)", sleep: "var(--sleep)", eat: "var(--eat)" }
const MEDAL = ["🥇", "🥈", "🥉"]

export default function ChallengesPage() {
  const { t, n, pick, pct } = usePrefs()
  const q = useApi<Data>("/api/challenges")
  const toggle = async (id: string) => {
    q.setData((d) => d && { ...d, items: d.items.map((c) => (c.id === id ? { ...c, joined: !c.joined } : c)) })
    await api(`/api/challenges/${id}/join`, { method: "POST" }).catch(() => q.reload())
  }

  return (
    <>
      <PageHeader kicker={t("tagline")} title={t("challenges")} />
      <Gate q={q}>
        {(d) => (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {d.items.map((c, k) => {
              const color = COLOR[c.kind]
              return (
                <Card key={c.id} i={k} className="lift relative overflow-hidden">
                  <div className="pointer-events-none absolute -end-10 -top-10 size-36 rounded-full opacity-25 blur-2xl" style={{ background: color }} />
                  <div className="mb-3 flex items-center justify-between text-xs font-semibold text-muted">
                    <span className="flex items-center gap-1"><Users size={14} />{n(c.participants)} {t("participants")}</span>
                    <span className="rounded-full bg-fill px-2.5 py-1">{n(c.days_left)} {t("daysLeft")}</span>
                  </div>
                  <h3 className="text-xl font-bold tracking-tight">{pick(c.title)}</h3>
                  <p className="mt-1 mb-5 text-sm leading-6 text-muted">{pick(c.desc)}</p>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="num font-semibold">{n(c.progress)} / {n(c.goal)} {pick(c.unit)}</span>
                    <span className="font-bold" style={{ color }}>{pct((c.progress / c.goal) * 100)}</span>
                  </div>
                  <Progress value={c.progress / c.goal} color={color} />
                  <button onClick={() => toggle(c.id)} aria-pressed={c.joined}
                    className="press mt-5 flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 font-semibold transition-colors"
                    style={c.joined ? { background: "var(--fill)", color } : { background: color, color: "#fff" }}>
                    {c.joined && <Check size={18} />}{t(c.joined ? "joined" : "join")}
                  </button>
                </Card>
              )
            })}

            <Card i={4} className="md:col-span-2 xl:col-span-1 xl:row-span-2">
              <Title>{t("leaderboard")}</Title>
              <ol className="grid gap-2">
                {d.leaders.map((l, k) => (
                  <li key={l.rank} className={`rise flex items-center gap-3 rounded-2xl p-2.5 ${l.me ? "bg-move/12 ring-1 ring-move/40" : "bg-fill"}`}
                    style={{ "--i": k + 4 } as React.CSSProperties}>
                    <span className="grid size-9 place-items-center text-lg font-bold">{MEDAL[k] ?? n(l.rank)}</span>
                    <span className="grid size-9 place-items-center rounded-full bg-[linear-gradient(135deg,var(--move),var(--sleep))] font-bold text-white">
                      {pick(l.name)[0]}
                    </span>
                    <span className="flex-1 font-semibold">{pick(l.name)}{l.me && <span className="ms-1.5 text-xs text-move">({t("you")})</span>}</span>
                    <span className="num text-sm text-muted">{n(l.steps)}</span>
                  </li>
                ))}
              </ol>
            </Card>

            <Card i={5} className="md:col-span-2">
              <Title>{t("badges")}</Title>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
                {d.badges.map((b) => (
                  <div key={b.id} className="flex flex-col items-center gap-1.5 text-center" title={pick(b.name)}>
                    <span className={`grid size-14 place-items-center rounded-full text-2xl transition ${b.earned ? "bg-[conic-gradient(from_180deg,var(--eat),var(--move),var(--sleep),var(--eat))] shadow-lg hover:scale-110" : "bg-fill opacity-40 grayscale"}`}>
                      <span className="grid size-11 place-items-center rounded-full bg-solid">{b.emoji}</span>
                    </span>
                    <span className="text-[11px] leading-4 text-muted">{pick(b.name)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </Gate>
    </>
  )
}
