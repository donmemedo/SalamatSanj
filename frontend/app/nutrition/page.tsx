"use client"
import { useEffect, useRef, useState } from "react"
import { Minus, Plus, Search, Trash2, X } from "lucide-react"
import { api, useApi } from "@/lib/api"
import { usePrefs } from "@/lib/prefs"
import type { Food, Macros, MealItem, MealKind } from "@/lib/types"
import { Card, CountUp, Gate, PageHeader, Progress, Rings, Segmented, SheetHandle, Title } from "@/components/ui"

const MEALS: MealKind[] = ["breakfast", "lunch", "dinner", "snack"]
const MACROS = [
  { key: "protein", goal: 110, color: "var(--move)" },
  { key: "carbs", goal: 260, color: "var(--eat)" },
  { key: "fat", goal: 70, color: "var(--water)" },
] as const
const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
// Persian search: ignore spaces and ZWNJ, and fold Arabic yeh/kaf into Persian ones.
const norm = (s: string) => s.toLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[\s‌]/g, "")

export default function NutritionPage() {
  const p = usePrefs()
  const { t, n, pick } = p
  const q = useApi<{ items: MealItem[]; total: Macros; goal: number }>("/api/meals")
  const foods = useApi<Food[]>("/api/foods")
  const dlg = useRef<HTMLDialogElement>(null)
  const [meal, setMeal] = useState<MealKind>("lunch")
  const [servings, setServings] = useState(1)
  const [search, setSearch] = useState("")
  const [failed, setFailed] = useState(false)
  const [undo, setUndo] = useState<MealItem | null>(null)
  const busy = useRef(false)
  const deletes = useRef(new Map<number, Promise<boolean>>()) // meal id -> did its DELETE succeed
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const hideLater = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setUndo(null), 8000) }
  useEffect(() => { if (undo) hideLater(); return () => clearTimeout(timer.current) }, [undo])

  const open = (m: MealKind) => {
    setMeal(m); setServings(1); setSearch(""); setFailed(false)
    if (dlg.current) { dlg.current.style.translate = ""; dlg.current.showModal() }
  }
  const add = async (food_id: string) => {
    if (busy.current) return // a double tap must not log the meal twice
    busy.current = true
    setFailed(false)
    try {
      await api("/api/meals", { method: "POST", body: JSON.stringify({ food_id, servings, meal }) })
      dlg.current?.close()
      q.reload()
    } catch { setFailed(true) } finally { busy.current = false }
  }
  // Undo instead of a confirmation dialog: delete at once, offer to bring it back.
  const remove = (m: MealItem) => {
    setFailed(false)
    q.setData((d) => d && { ...d, items: d.items.filter((x) => x.id !== m.id) })
    setUndo(m)
    deletes.current.set(m.id, api(`/api/meals/${m.id}`, { method: "DELETE" }).then(() => true, () => {
      setUndo((u) => (u?.id === m.id ? null : u)) // only this meal's toast; a newer one keeps its Undo
      setFailed(true)
      q.reload()
      return false
    }))
  }
  const restore = async () => {
    const m = undo
    setUndo(null)
    if (!m) return
    const deleted = await deletes.current.get(m.id) // wait for the DELETE: re-adding before it fails would log twice
    deletes.current.delete(m.id)
    if (!deleted) return
    await api("/api/meals", { method: "POST", body: JSON.stringify({ food_id: m.food_id, servings: m.servings, meal: m.meal }) })
      .then(q.reload, () => setFailed(true))
  }
  const list = (foods.data ?? []).filter((f) => norm(f.name.fa + f.name.en).includes(norm(search)))
  const status = failed ? t("saveFailed") : ""

  return (
    <>
      <PageHeader kicker={t("tagline")} title={t("nutrition")}
        action={<button onClick={() => open("lunch")} className="press flex min-h-11 items-center gap-1.5 rounded-full bg-eat px-5 py-2.5 font-semibold text-black shadow-lg shadow-eat/30"><Plus size={18} />{t("addFood")}</button>} />
      <Gate q={q}>
        {(d) => {
          // Totals follow the visible items, so an optimistic delete never leaves them stale.
          const total = d.items.reduce((a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }), ZERO)
          return (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Card i={0} className="lift md:col-span-2 xl:col-span-1">
                <div className="flex flex-col items-center gap-6">
                  <Rings size={190} stroke={20} rings={[{ value: total.kcal / d.goal, color: "var(--eat)" }]}>
                    <div>
                      <p className="text-4xl font-bold tracking-tight"><CountUp value={total.kcal} /></p>
                      <p className="text-sm text-muted">/ {n(d.goal)} {t("kcal")}</p>
                    </div>
                  </Rings>
                  <p className="rounded-full bg-fill px-4 py-1.5 text-sm font-semibold">
                    {t("remaining")}: <span className="num">{n(Math.max(0, d.goal - total.kcal))}</span> {t("kcal")}
                  </p>
                  <div className="grid w-full gap-4">
                    {MACROS.map((m) => (
                      <div key={m.key}>
                        <div className="mb-1.5 flex justify-between text-sm">
                          <span className="font-medium">{t(m.key)}</span>
                          <span className="num text-muted">{n(total[m.key])} / {n(m.goal)} {t("gram")}</span>
                        </div>
                        <Progress value={total[m.key] / m.goal} color={m.color} label={t(m.key)} />
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
                        <button aria-label={`${t("add")} ${t(m)}`} onClick={() => open(m)} className="press grid size-11 place-items-center rounded-full bg-fill text-eat"><Plus size={18} /></button>
                      }>
                        {t(m)} <span className="num ms-1 text-sm font-medium text-muted">{n(items.reduce((a, b) => a + b.kcal, 0))} {t("kcal")}</span>
                      </Title>
                      {items.length === 0 && <p className="py-4 text-center text-sm text-muted">{t("noMeals")}</p>}
                      <ul className="grid gap-2">
                        {items.map((x) => (
                          <li key={x.id} className="rise group flex items-center gap-3 rounded-2xl bg-fill p-2.5">
                            <span aria-hidden className="grid size-11 place-items-center rounded-xl bg-solid text-2xl">{x.food.emoji}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{pick(x.food.name)}</p>
                              <p className="text-xs text-muted">{n(x.servings, 2)} × {pick(x.food.serving)}</p>
                            </div>
                            <b className="num text-sm">{n(x.kcal)}</b>
                            <button aria-label={`${t("delete")} ${pick(x.food.name)}`} onClick={() => remove(x)} className="press grid size-11 place-items-center rounded-full text-muted hover:bg-heart/15 hover:text-heart">
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
          )
        }}
      </Gate>

      {/* Persistent live region: completion (undo) and error feedback are announced, not just shown. */}
      <div role="status" className="pointer-events-none fixed inset-x-4 bottom-28 z-40 mx-auto flex max-w-sm justify-center lg:bottom-6">
        {undo ? (
          <div className="glass pointer-events-auto flex w-full items-center gap-3 rounded-2xl py-2 ps-4 pe-2 text-sm font-medium"
            onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={hideLater}
            onFocus={() => clearTimeout(timer.current)} onBlur={hideLater}>
            <span className="flex-1 truncate">{pick(undo.food.name)} {t("deleted")}</span>
            <button onClick={restore} className="press min-h-11 rounded-full px-4 font-semibold text-accent">{t("undo")}</button>
          </div>
        ) : status && <p className="rounded-2xl bg-solid px-4 py-3 text-sm font-medium text-heart shadow-lg">{status}</p>}
      </div>

      <dialog ref={dlg} aria-labelledby="add-food-title" onClick={(e) => e.target === dlg.current && dlg.current.close()}
        className="glass m-auto mb-0 w-full max-w-lg rounded-t-[32px] p-0 text-fg sm:mb-auto sm:rounded-[32px]">
        <div className="flex max-h-[85dvh] flex-col gap-4 p-5">
          <SheetHandle sheet={dlg} />
          <div className="flex items-center justify-between">
            <h2 id="add-food-title" className="text-xl font-bold">{t("addFood")}</h2>
            <button aria-label={t("cancel")} onClick={() => dlg.current?.close()} className="press grid size-11 place-items-center rounded-full bg-fill"><X size={16} /></button>
          </div>
          <label className="flex items-center gap-2 rounded-2xl bg-fill px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-accent">
            <Search aria-hidden size={18} className="text-muted" />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} aria-label={t("search")}
              className="w-full bg-transparent outline-none placeholder:text-muted" />
          </label>
          <Segmented label={t("meal")} value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: t(m) }))} />
          <div className="flex items-center justify-between">
            <span id="servings-label" className="text-sm font-medium">{t("servings")}</span>
            <div className="flex items-center gap-2">
              <button aria-label={`${t("decrease")} ${t("servings")}`} onClick={() => setServings((s) => Math.max(0.5, s - 0.5))} className="press grid size-11 place-items-center rounded-full bg-fill"><Minus size={16} /></button>
              <b aria-live="polite" aria-labelledby="servings-label" className="num w-8 text-center">{n(servings, 1)}</b>
              <button aria-label={`${t("increase")} ${t("servings")}`} onClick={() => setServings((s) => Math.min(10, s + 0.5))} className="press grid size-11 place-items-center rounded-full bg-fill"><Plus size={16} /></button>
            </div>
          </div>
          <p role="status" className="text-sm font-medium text-heart">{status}</p>
          <ul className="no-scrollbar -mx-1 grid flex-1 grid-cols-2 gap-2 overflow-y-auto px-1 pb-1 sm:grid-cols-3">
            {list.map((f) => (
              <li key={f.id}>
                <button onClick={() => add(f.id)} className="press flex h-full w-full flex-col items-start gap-1 rounded-2xl bg-fill p-3 text-start hover:bg-eat/15">
                  <span aria-hidden className="text-3xl">{f.emoji}</span>
                  <span className="text-sm leading-6 font-semibold">{pick(f.name)}</span>
                  <span className="num text-xs text-muted">{n(Math.round(f.kcal * servings))} {t("kcal")} · {pick(f.serving)}</span>
                </button>
              </li>
            ))}
            {foods.data && list.length === 0 && <li className="col-span-full py-6 text-center text-sm text-muted">{t("noResults")}</li>}
            {foods.error && (
              <li className="col-span-full py-6 text-center">
                <button onClick={foods.reload} className="press min-h-11 rounded-full bg-fill px-5 font-semibold">{t("retry")}</button>
              </li>
            )}
          </ul>
        </div>
      </dialog>
    </>
  )
}
