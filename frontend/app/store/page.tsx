"use client"
import Link from "next/link"
import { useState } from "react"
import { Building2, Check, Crown, ShoppingBag } from "lucide-react"
import { useApi } from "@/lib/api"
import { usePrefs, type Bi } from "@/lib/prefs"
import { Card, Gate, PageHeader } from "@/components/ui"

type Plan = { price: number; features: Bi[] }
type Data = { devices: (Plan & { id: string; name: string; color: string; popular?: boolean })[]; premium: Plan; b2b: Plan }

function Band({ color }: { color: string }) {
  return (
    <div className="float relative mx-auto h-60 w-28">
      <div className="absolute inset-x-4 inset-y-0 rounded-[44px]"
        style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${color} 55%, #000), ${color} 30%, ${color} 70%, color-mix(in srgb, ${color} 55%, #000))` }} />
      <div className="absolute inset-x-0 top-1/2 grid h-36 -translate-y-1/2 place-items-center rounded-[34px] bg-[#0b0b0f] shadow-2xl ring-1 ring-white/15">
        <div className="text-center text-white" dir="ltr">
          <p className="num text-3xl font-bold tracking-tight">08:42</p>
          <p className="mt-1 flex items-center justify-center gap-1 text-[11px] font-semibold" style={{ color }}>
            <span className="size-1.5 animate-pulse rounded-full" style={{ background: color }} />8,420
          </p>
        </div>
      </div>
    </div>
  )
}

const Features = ({ items, color }: { items: Bi[]; color: string }) => {
  const { pick } = usePrefs()
  return (
    <ul className="grid gap-2.5 text-[15px]">
      {items.map((f) => (
        <li key={f.en} className="flex items-center gap-2">
          <span className="grid size-5 shrink-0 place-items-center rounded-full text-white" style={{ background: color }}><Check size={13} strokeWidth={3} /></span>
          {pick(f)}
        </li>
      ))}
    </ul>
  )
}

export default function StorePage() {
  const { t, n } = usePrefs()
  const q = useApi<Data>("/api/plans")
  // ponytail: basket is local UI state only; checkout (Rial gateway) comes with accounts.
  const [basket, setBasket] = useState<string[]>([])
  const price = (v: number) => <><span className="num">{n(v)}</span> <span className="text-base font-medium text-muted">{t("toman")}</span></>

  return (
    <>
      <PageHeader kicker={t("devices")} title={t("store")}
        action={basket.length > 0 && <span className="rise flex items-center gap-1.5 rounded-full bg-fill px-4 py-2 font-semibold"><ShoppingBag size={18} />{n(basket.length)}</span>} />
      <Gate q={q}>
        {(d) => (
          <div className="grid gap-4 md:grid-cols-2">
            {d.devices.map((dev, k) => {
              const added = basket.includes(dev.id)
              return (
                <Card key={dev.id} i={k} className="lift relative overflow-hidden">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-30 blur-3xl" style={{ background: `radial-gradient(circle at 50% 40%, ${dev.color}, transparent 65%)` }} />
                  {dev.popular && <span className="absolute top-5 start-5 rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: dev.color }}>{t("popular")}</span>}
                  <div className="relative py-6"><Band color={dev.color} /></div>
                  <h3 className="relative text-2xl font-bold tracking-tight"><bdi>{dev.name}</bdi></h3>
                  <p className="mt-1 mb-5 text-3xl font-bold tracking-tight">{price(dev.price)}</p>
                  <Features items={dev.features} color={dev.color} />
                  <button disabled={added} onClick={() => setBasket((b) => [...b, dev.id])}
                    className="press mt-6 flex w-full items-center justify-center gap-2 rounded-full py-3 font-semibold text-white disabled:opacity-80"
                    style={{ background: dev.color }}>
                    {added ? <Check size={18} /> : <ShoppingBag size={18} />}{t(added ? "added" : "addToBasket")}
                  </button>
                </Card>
              )
            })}

            <Card i={2} className="lift relative overflow-hidden">
              <div className="pointer-events-none absolute inset-0 opacity-20 bg-[linear-gradient(135deg,var(--eat),var(--move),var(--sleep))]" />
              <div className="relative">
                <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--eat),var(--move))] text-white shadow-lg"><Crown size={24} /></span>
                <div className="flex items-center gap-2">
                  <h3 className="gradient-text text-2xl font-extrabold tracking-tight">{t("premium")}</h3>
                  <span className="rounded-full bg-steps/15 px-2.5 py-0.5 text-xs font-bold text-steps">{t("active")}</span>
                </div>
                <p className="mt-1 mb-5 text-3xl font-bold tracking-tight">{price(d.premium.price)} <span className="text-sm text-muted">/ {t("perMonth")}</span></p>
                <Features items={d.premium.features} color="var(--move)" />
              </div>
            </Card>

            <Card i={3} className="lift relative overflow-hidden">
              <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-sleep text-white shadow-lg"><Building2 size={24} /></span>
              <h3 className="text-2xl font-bold tracking-tight">{t("forOrgs")}</h3>
              <p className="mt-1 mb-5 text-3xl font-bold tracking-tight">{price(d.b2b.price)} <span className="text-sm text-muted">/ {t("perUser")}</span></p>
              <Features items={d.b2b.features} color="var(--sleep)" />
              <Link href="/business" className="press mt-6 flex w-full items-center justify-center rounded-full bg-sleep py-3 font-semibold text-white">
                {t("orgDashboard")}
              </Link>
            </Card>
          </div>
        )}
      </Gate>
    </>
  )
}
