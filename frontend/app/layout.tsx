import type { Metadata, Viewport } from "next"
import "@fontsource-variable/vazirmatn"
import "@fontsource-variable/inter"
import "./globals.css"
import { PrefsProvider, bootScript } from "@/lib/prefs"
import { Shell } from "@/components/shell"

export const metadata: Metadata = {
  title: "آپ‌سلامت · UP Iran",
  description: "Sleep, activity and nutrition insights for Iran — پایش خواب، حرکت و تغذیه",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <PrefsProvider>
          <Shell>{children}</Shell>
        </PrefsProvider>
      </body>
    </html>
  )
}
