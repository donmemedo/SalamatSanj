"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, Building2, House, Languages, Monitor, Moon, ShoppingBag, Sun, Trophy, Utensils, BedDouble, type LucideIcon } from "lucide-react"
import { usePrefs, type Theme } from "@/lib/prefs"
import type { Key } from "@/lib/i18n"

const NAV: { href: string; key: Key; icon: LucideIcon; color: string; tab?: boolean }[] = [
  { href: "/", key: "today", icon: House, color: "var(--accent)", tab: true },
  { href: "/activity", key: "activity", icon: Activity, color: "var(--steps)", tab: true },
  { href: "/sleep", key: "sleep", icon: BedDouble, color: "var(--sleep)", tab: true },
  { href: "/nutrition", key: "nutrition", icon: Utensils, color: "var(--eat)", tab: true },
  { href: "/challenges", key: "challenges", icon: Trophy, color: "var(--move)", tab: true },
  { href: "/store", key: "store", icon: ShoppingBag, color: "var(--accent)" },
  { href: "/business", key: "business", icon: Building2, color: "var(--sleep)" },
]
const NEXT_THEME: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" }
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon }
const THEME_LABEL: Record<Theme, Key> = { system: "system", light: "lightMode", dark: "darkMode" }

function Logo() {
  const { t } = usePrefs()
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-[11px] bg-[conic-gradient(from_200deg,var(--move),var(--eat),var(--steps),var(--sleep),var(--move))] shadow-lg">
        <span className="size-4 rounded-full border-[3px] border-white/90" />
      </span>
      <span className="leading-tight">
        <b className="block text-[1.0625rem] tracking-tight">{t("brand")}</b>
        <span className="hidden text-[0.6875rem] tracking-[0.01em] text-muted sm:block">{t("tagline")}</span>
      </span>
    </Link>
  )
}

function Controls() {
  const { t, lang, setLang, theme, setTheme } = usePrefs()
  const Icon = THEME_ICON[theme]
  const btn = "press glass grid size-11 place-items-center rounded-full"
  return (
    <div className="flex items-center gap-2">
      <button className={btn} aria-label={`${t("theme")}: ${t(THEME_LABEL[theme])}`} title={`${t("theme")}: ${t(THEME_LABEL[theme])}`}
        onClick={(e) => setTheme(NEXT_THEME[theme], { x: e.clientX, y: e.clientY })}>
        <Icon key={theme} size={18} className="rise" />
      </button>
      <button lang={lang === "fa" ? "en" : "fa"} className="press glass flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold" onClick={() => setLang(lang === "fa" ? "en" : "fa")}>
        <Languages size={16} />{t("lang")}
      </button>
    </div>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const { t } = usePrefs()
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href))

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="glass no-scrollbar fixed inset-y-3 start-3 z-30 hidden w-64 flex-col overflow-y-auto rounded-[30px] p-4 lg:flex">
        <div className="px-2 pt-1 pb-6"><Logo /></div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, key, icon: Icon, color }) => {
            const on = isActive(href)
            return (
              <Link key={href} href={href} aria-current={on ? "page" : undefined}
                className={`press flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[0.9375rem] font-medium ${on ? "bg-fill" : "text-muted hover:bg-fill/60"}`}>
                <span className="grid size-8 place-items-center rounded-xl text-white transition" style={{ background: on ? color : "var(--fill)", color: on ? "#fff" : color }}>
                  <Icon size={17} />
                </span>
                <span className={on ? "text-fg" : ""}>{t(key)}</span>
              </Link>
            )
          })}
        </nav>
        <div className="mt-auto rounded-3xl bg-fill p-4">
          <p className="text-xs text-muted">{t("yourBand")}</p>
          {/* Only honest status here: battery and sync state are not known to the shell. */}
          <p className="mt-0.5 font-semibold">UP Iran Pro</p>
        </div>
      </aside>

      {/* Top bar */}
      {/* Scroll-edge fade instead of a hard bar: content scrolling under the header stays legible. */}
      <header className="sticky top-0 z-20 bg-linear-to-b from-bg via-bg/85 to-transparent px-4 pt-3 pb-3 lg:ps-72 lg:pe-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="lg:hidden"><Logo /></div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            {NAV.filter((n) => !n.tab).map(({ href, key, icon: Icon }) => (
              <Link key={href} href={href} aria-label={t(key)} aria-current={isActive(href) ? "page" : undefined}
                className={`press glass grid size-11 place-items-center rounded-full lg:hidden ${isActive(href) ? "text-accent" : ""}`}>
                <Icon size={18} />
              </Link>
            ))}
            <Controls />
          </div>
        </div>
      </header>

      <main className="px-4 pt-6 pb-32 lg:ps-72 lg:pe-6 lg:pb-12">
        <div key={path} className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Mobile tab bar */}
      <nav className="glass fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md justify-around rounded-[28px] p-1.5 lg:hidden">
        {NAV.filter((n) => n.tab).map(({ href, key, icon: Icon, color }) => {
          const on = isActive(href)
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined}
              className="press flex min-h-11 flex-1 flex-col items-center gap-0.5 rounded-[22px] py-1.5 text-[0.6875rem] font-medium tracking-[0.01em]"
              style={{ color: on ? color : "var(--muted)", background: on ? "var(--fill)" : undefined }}>
              <Icon size={22} strokeWidth={on ? 2.4 : 1.8} />
              {t(key)}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
