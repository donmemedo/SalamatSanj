import { NextResponse, type NextRequest } from "next/server"

// DNS-rebinding guard. The /api rewrite replaces Host with the backend's, so the backend's own Host check
// never sees what the browser sent. Set ALLOWED_HOSTS (comma-separated) to every name the app is served under.
const HOSTS = (process.env.ALLOWED_HOSTS ?? "localhost,127.0.0.1").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean)

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").replace(/:\d+$/, "").toLowerCase()
  return HOSTS.includes(host) ? NextResponse.next() : new NextResponse("Invalid host", { status: 400 })
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] }
