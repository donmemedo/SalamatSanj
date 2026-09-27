"use client"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { dict, type Key, type Lang } from "./i18n"

export type Theme = "system" | "light" | "dark"
export type Bi = { fa: string; en: string }

// Runs before paint (see layout) so dir/theme never flash.
// ?lang=en&theme=dark in the URL overrides and persists (shareable links, screenshots).
export const bootScript = `(function(){try{var d=document.documentElement,u=new URLSearchParams(location.search),s=localStorage;/^(fa|en)$/.test(u.get('lang'))&&s.setItem('lang',u.get('lang'));/^(system|light|dark)$/.test(u.get('theme'))&&s.setItem('theme',u.get('theme'));var l=s.getItem('lang')==='en'?'en':'fa',t=s.getItem('theme')||'system';d.lang=l;d.dir=l==='fa'?'rtl':'ltr';d.dataset.theme=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch(e){}})()`

const resolve = (t: Theme) =>
  t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light"

function usePrefsState() {
  const [lang, setLangState] = useState<Lang>("fa")
  const [theme, setThemeState] = useState<Theme>("system")

  useEffect(() => {
    try {
      setLangState(localStorage.getItem("lang") === "en" ? "en" : "fa")
      const th = localStorage.getItem("theme")
      setThemeState(th === "light" || th === "dark" ? th : "system")
    } catch {}
  }, [])

  useEffect(() => {
    if (theme !== "system") return
    const mq = matchMedia("(prefers-color-scheme: dark)")
    const on = () => (document.documentElement.dataset.theme = resolve("system"))
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [theme])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    document.documentElement.lang = l
    document.documentElement.dir = l === "fa" ? "rtl" : "ltr"
    try { localStorage.setItem("lang", l) } catch {}
  }, [])

  // Circular reveal from the tapped point, where the View Transitions API exists.
  const setTheme = useCallback((t: Theme, origin?: { x: number; y: number }) => {
    const apply = () => {
      setThemeState(t)
      document.documentElement.dataset.theme = resolve(t)
      try { localStorage.setItem("theme", t) } catch {}
    }
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }
    if (!doc.startViewTransition || !origin || matchMedia("(prefers-reduced-motion: reduce)").matches) return apply()
    const r = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y))
    doc.startViewTransition(apply).ready.then(() =>
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${r}px at ${origin.x}px ${origin.y}px)`] },
        { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)", pseudoElement: "::view-transition-new(root)" },
      ),
    )
  }, [])

  return useMemo(() => {
    const locale = lang === "fa" ? "fa-IR" : "en-US"
    return {
      lang, theme, setLang, setTheme,
      t: (k: Key) => dict[lang][k],
      pick: (b: Bi) => b[lang],
      digits: (s: string) => (lang === "fa" ? s.replace(/\d/g, (c) => "۰۱۲۳۴۵۶۷۸۹"[+c]) : s),
      pct: (x: number) => new Intl.NumberFormat(locale).format(Math.round(x)) + (lang === "fa" ? "٪" : "%"),
      n: (x: number, digits = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(x),
      day: (iso: string, weekday: "short" | "narrow" = "short") =>
        new Intl.DateTimeFormat(lang === "fa" ? "fa-IR-u-ca-persian" : "en-US", { weekday }).format(new Date(iso + "T12:00")),
      short: (iso: string) =>
        new Intl.DateTimeFormat(lang === "fa" ? "fa-IR-u-ca-persian" : "en-US", { day: "numeric", month: "short" }).format(new Date(iso + "T12:00")),
      longDate: () =>
        new Intl.DateTimeFormat(lang === "fa" ? "fa-IR-u-ca-persian" : "en-US", { weekday: "long", day: "numeric", month: "long" }).format(new Date()),
      dur: (m: number) => (lang === "fa" ? `${new Intl.NumberFormat(locale).format(Math.floor(m / 60))} ساعت و ${new Intl.NumberFormat(locale).format(m % 60)} دقیقه` : `${Math.floor(m / 60)}h ${m % 60}m`),
    }
  }, [lang, theme, setLang, setTheme])
}

type Prefs = ReturnType<typeof usePrefsState>
const Ctx = createContext<Prefs | null>(null)

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={usePrefsState()}>{children}</Ctx.Provider>
}

export const usePrefs = () => useContext(Ctx)!
