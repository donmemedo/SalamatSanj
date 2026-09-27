"use client"
import { useRef, useState } from "react"
import { Minus, Plus, Search, Trash2, X } from "lucide-react"
import { api, useApi } from "@/lib/api"
import { usePrefs } from "@/lib/prefs"
import type { Food, Macros, MealItem, MealKind } from "@/lib/types"
import { Card, CountUp, Gate, PageHeader, Progress, Rings, Segmented, Title } from "@/components/ui"

const MEALS: MealKind[] = ["breakfast", "lunch", "dinner", "snack"]
const MACROS = [
  { key: "protein", goal: 110, color: "var(--move)" },
  { key: "carbs", goal: 260, color: "var(--eat)" },
  { key: "fat", goal: 70, color: "var(--water)" },
] as const

export default function NutritionPage() {
  const p = usePrefs()
  const { t, n, pick } = p
  const q = useApi<{ items: MealItem[]; total: Macros; goal: number }>("/api/meals")
  const foods = useApi<Food[]>("/api/foods")
  const dlg = useRef<HTMLDialogElement>(null)
  const [meal, setMeal] = useState<MealKind>("lunch")
  const [servings, setServings] = useState(1)
  const [search, setSearch] = useState("")

  const open = (m: MealKind) => { setMeal(m); setServings(1); setSearch(""); dlg.current?.showModal() }
  const add = async (food_id: string) => {
    await api("/api/meals", { method: "POST", body: JSON.stringify({ food_id, servings, meal }) })
    dlg.current?.close()
    q.reload()
  }
  const remove = async (id: number) => {
    q.setData((d) => d && { ...d, items: d.items.filter((m) => m.id !== id) }) // optimistic
    await api(`/api/meals/${id}`, { method: "DELETE" }).catch(() => {})
    q.reload()
  }
  const list = (foods.data ?? []).filter((f) => `${f.name.fa} ${f.name.en}`.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <>
      <PageHeader kicker={t("tagline")} title={t("nutrition")}
        action={<button onClick={() => open("lunch")} className="press flex items-center gap-1.5 rounded-full bg-eat px-5 py-2.5 font-semibold text-white shadow-lg shadow-eat/30"><Plus size={18} />{t("addFood")}</button>} />
      <Gate q={q}>
        {(d) => (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card i={0} className="lift md:col-span-2 xl:col-span-1">
              <div className="flex flex-col items-center gap-6">
                <Rings size={190} stroke={20} rings={[{ value: d.total.kcal / d.goal, color: "var(--eat)" }]}>
                  <div>
                    <p className="text-4xl font-bold tracking-tight"><CountUp value={d.total.kcal} /></p>
                    <p className="text-sm text-muted">/ {n(d.goal)} {t("kcal")}</p>
                  </div>
                </Rings>
                <p className="rounded-full bg-fill px-4 py-1.5 text-sm font-semibold">
                  {t("remaining")}: <span className="num">{n(Math.max(0, d.goal - d.total.kcal))}</span> {t("kcal")}
                </p>
                <div className="grid w-full gap-4">
                  {MACROS.map((m) => (
                    <div key={m.key}>
                      <div className="mb-1.5 flex justify-between text-sm">
                        <span className="font-medium">{t(m.key)}</span>
                        <span className="num text-muted">{n(d.total[m.key])} / {n(m.goal)} g</span>
                      </div>
                      <Progress value={d.total[m.key] / m.goal} color={m.color} />
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
              {MEALS.map((m, k) => {
                const items = d.items.filter((x) => x.meal === m)
                return (
                  <Card key={m} i={k + 1}>
                    <Title action={
                      <button aria-label={`${t("add")} ${t(m)}`} onClick={() => open(m)} className="press grid size-8 place-items-center rounded-full bg-fill text-eat"><Plus size={18} /></button>
                    }>
                      {t(m)} <span className="num ms-1 text-sm font-medium text-muted">{n(items.reduce((a, b) => a + b.kcal, 0))} {t("kcal")}</span>
                    </Title>
                    {items.length === 0 && <p className="py-4 text-center text-sm text-muted">{t("noMeals")}</p>}
                    <ul className="grid gap-2">
                      {items.map((x) => (
                        <li key={x.id} className="rise group flex items-center gap-3 rounded-2xl bg-fill p-2.5">
                          <span className="grid size-11 place-items-center rounded-xl bg-solid text-2xl">{x.food.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{pick(x.food.name)}</p>
                            <p className="text-xs text-muted">{n(x.servings, 2)} × {pick(x.food.serving)}</p>
                          </div>
                          <b className="num text-sm">{n(x.kcal)}</b>
                          <button aria-label={t("delete")} onClick={() => remove(x.id)} className="press grid size-8 place-items-center rounded-full text-muted hover:bg-heart/15 hover:text-heart">
                            <Trash2 size={16} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )
              })}
            </div>
          </div>
        )}
      </Gate>

      <dialog ref={dlg} onClick={(e) => e.target === dlg.current && dlg.current.close()}
        className="glass m-auto mb-0 w-full max-w-lg rounded-t-[32px] p-0 text-fg sm:mb-auto sm:rounded-[32px]">
        <div className="flex max-h-[85dvh] flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{t("addFood")}</h2>
            <button aria-label={t("cancel")} onClick={() => dlg.current?.close()} className="press grid size-8 place-items-center rounded-full bg-fill"><X size={16} /></button>
          </div>
          <label className="flex items-center gap-2 rounded-2xl bg-fill px-3.5 py-2.5">
            <Search size={18} className="text-muted" />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")}
              className="w-full bg-transparent outline-none placeholder:text-muted" />
          </label>
          <Segmented value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: t(m) }))} />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t("servings")}</span>
            <div className="flex items-center gap-3">
              <button aria-label="-" onClick={() => setServings((s) => Math.max(0.5, s - 0.5))} className="press grid size-9 place-items-center rounded-full bg-fill"><Minus size={16} /></button>
              <b className="num w-8 text-center">{n(servings, 1)}</b>
              <button aria-label="+" onClick={() => setServings((s) => Math.min(10, s + 0.5))} className="press grid size-9 place-items-center rounded-full bg-fill"><Plus size={16} /></button>
            </div>
          </div>
          <ul className="no-scrollbar -mx-1 grid flex-1 grid-cols-2 gap-2 overflow-y-auto px-1 pb-1 sm:grid-cols-3">
            {list.map((f) => (
              <li key={f.id}>
                <button onClick={() => add(f.id)} className="press flex h-full w-full flex-col items-start gap-1 rounded-2xl bg-fill p-3 text-start hover:bg-eat/15">
                  <span className="text-3xl">{f.emoji}</span>
                  <span className="text-sm leading-6 font-semibold">{pick(f.name)}</span>
                  <span className="num text-xs text-muted">{n(Math.round(f.kcal * servings))} {t("kcal")} · {pick(f.serving)}</span>
                </button>
              </li>
            ))}
            {foods.data && list.length === 0 && <li className="col-span-full py-6 text-center text-sm text-muted">{t("noResults")}</li>}
          </ul>
        </div>
      </dialog>
    </>
  )
}
