# Security, performance and UX audit: SalamatSanj (UP Iran)

Branch `security-perf-ux-hardening`, against `main` at `34d6402`. October 2026.

## Summary

The app is a demo with fake, deterministic health data and no accounts. Nothing critical was exploitable, but the API accepted anything from anywhere. Any website could drive it through permissive CORS. Any Host header was accepted, which is the precondition for DNS rebinding. Bodies of any size were read. NaN in a body crashed requests into a 500. Meals grew without a limit. One request for a year of history cost about 190 ms of CPU, with no cache and no compression.

All of these are fixed and covered by tests. The frontend now sends a CSP and the other security headers, refuses unknown Host names, and no longer advertises its framework. The production dependency on Next.js 16.3.6 carried six published advisories, one of them high severity; the branch upgrades it to 16.3.8 (see "Dependency upgrade" for status).

Every security control was kept cheap: header checks are O(1), the guard is pure ASGI rather than `BaseHTTPMiddleware`, and the CSP is static so every page stays prerendered.

## Method

| Step | What ran |
|---|---|
| Red team, live | Black-box probes against the running API on 127.0.0.1 (P1 to P18 below), light load, all state restored afterwards |
| Blue team review | Multi-agent defensive review: hardening, performance, Apple design with accessibility, correctness. Each reviewer's findings went to a skeptic verifier |
| SAST | bandit, semgrep (security-audit, dockerfile, plus the original python/typescript/react/nextjs run in `handoff/scans/`) |
| Dependencies | OSV batch queries for all 13 pinned Python packages and all 57 production npm packages (npm's own audit endpoint was unreachable from this network) |
| Regression review | Two reviewers over the final diff: one for regressions, one for complexity (ponytail) |
| Verification | pytest, TypeScript check, production `next build`, live probes of the production frontend |

Skills applied: security-auditor, security-audit, security-scanning-security-sast, red-team-tools, red-team-tactics, apple-design, ponytail and ponytail-review, graphify.

### What was skipped, and why

- **Attack tree and the offensive agent prompts.** A safety classifier stopped the attack-tree output and the red-team agent instructions twice. As requested, I skipped that part rather than switching models. The live red-team probes I ran directly are complete and listed below.
- **Live backend after the fixes.** The host ran out of memory (swap full, load average up to 140), and Claude Code stopped the backend server with an instruction not to restart it unasked. The backend fixes are therefore verified in-process with FastAPI's TestClient, which exercises the same middleware stack. The frontend was verified live on a production build.
- **Docker.** `docker compose config` validates, but no image was built or run.
- **Manual browser pass.** There was no browser here. The light/dark, fa/en, reduced-motion and reduced-transparency modes were checked by code review and build output only.

## Live pen test, before the fixes

Full table: `handoff/scans/baseline/probes-live.md` (not committed, kept with the handoff).

| ID | Probe | Before | After |
|---|---|---|---|
| P1 | Security headers | none, `server: uvicorn` | nosniff, X-Frame-Options DENY, Referrer-Policy, Cache-Control; banner off |
| P2, P3 | Origin `evil.example`, preflight DELETE | `allow-origin: *`, every method and header | no CORS grant (CORS only for `ALLOWED_ORIGINS`) |
| P4 | /docs, /redoc, /openapi.json | 200 | 404 unless `ENABLE_DOCS=1` |
| P5 | Host `attacker.rebind.example` | 200 | 400, on the API and on the web origin |
| P7b | Cross-site form POST to join | 200, state changed | 415 (JSON required) |
| P7c | POST with no Content-Type (a no-preflight request FastAPI still parses as JSON) | not probed live | 415 |
| P8 | `servings: NaN` / `Infinity` | 500 and an 80-line traceback per request | 422, error body no longer echoes input |
| P15 | 2 MB body | 201 | 413 over 4 KB; chunked bodies 411 |
| P16 | 40 meal POSTs | list grew without limit | 409 at 200 meals |
| P17 | Burst of 40 requests | all 200 | unchanged by design, see "Rate limiting" |
| P18 | PUT, PATCH, TRACE | 405 | 405 |

## Findings and fixes

Severity is after skeptic verification. "Verified" means a test or a probe proves the fix.

### Backend (`backend/main.py`)

| ID | Sev | Finding | Fix | Verified |
|---|---|---|---|---|
| S1 | low | CORS `*` for every origin, method, header | Allowlist from `ALLOWED_ORIGINS`, default none; GET/POST/DELETE and Content-Type only | test |
| S3 | medium | Unbounded in-memory meal list; every read walks it | Cap at 200, 409 beyond | test |
| S4 | medium | ~190 ms CPU per year of history, no cache | `lru_cache` on day and night generators, keyed by (date, hours) so today's partial day is exact | output byte-identical to the original; test |
| S5 | low | API docs public | `openapi_url=None` unless `ENABLE_DOCS` | test |
| S6 | info | No security headers, server banner | Pure-ASGI guard adds headers; `--no-server-header` | test |
| S7 | medium | No body limit; a Content-Length check alone is bypassed by chunked bodies | 413 over 4 KB, 411 for chunked | test |
| S8 | low | No Host allowlist (DNS rebinding) | `TrustedHostMiddleware` from `ALLOWED_HOSTS` | test |
| S9 | low | NaN/Infinity turned a 422 into a 500; 422 echoed whole bodies | Validation handler returns only `loc` and `msg` | test |
| NEW | low | Join endpoint toggled with no body, so any site could flip it with a form post | Body `{joined: bool}` sets the state (idempotent); POSTs must be JSON | test |
| NEW | low | Race between threadpool workers on the shared lists | Mutating handlers are `async`, so they run one at a time on the event loop | review |
| C4 | medium | Naive server time: a UTC container shifts Iranian days by 3h30 | Fixed +03:30 clock, read once per request | test |
| NEW | low | Between midnight and wake time, "last night" was a night still in progress | Last ended night drives the card, the insight and its weekly average | test |
| NEW | low | "Protein is under target" was always shown; "a 20-minute walk gets you to goal" was never checked | Both computed from today's numbers | review |
| — | — | Copy: «پویش» and «کارزار» mixed, «ضدآب» overstated, «گزارش پزشکی» implied medical advice | «کارزار», «مقاوم در برابر آب», «گزارش سلامت» | review |

### Frontend

| ID | Sev | Finding | Fix | Verified |
|---|---|---|---|---|
| F1, F2 | low | No CSP or frame protection, `X-Powered-By` | Static CSP with `frame-ancestors 'none'`, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy; `poweredByHeader: false` | live on production build |
| NEW | low | The /api rewrite replaces Host, so the backend's Host check can't stop rebinding through the web origin | `proxy.ts` Host allowlist from `ALLOWED_HOSTS` | live: evil Host gets 400 |
| F5 | low | Dev and start servers listened on every interface | `-H 127.0.0.1` | — |
| F6 | high | next 16.3.6: 6 advisories (1 high SSRF in image optimization, 4 moderate, 1 low); sharp 0.35.4 and source-map-js 1.2.1 also flagged | Upgrade to next 16.3.8 and sharp 0.35.5 | see "Dependency upgrade" |
| C1, P7 | medium | `useApi` let a slow old response overwrite a newer one | Sequence guard in the shared hook | review |
| NEW | medium | AreaChart crashed when data shrank under a hover | Bounds guard | review |
| NEW | medium | Home page prerendered the build day and greeting | Rendered only from client data | build output |
| NEW | medium | Adding a meal: no double-tap guard, errors swallowed | In-flight guard, announced error | review |
| C2, U9 | medium | Failed water update rolled back to a stale value, silently | Server value re-read when a burst of taps settles; error announced | review |
| C5, U10 | medium | Delete couldn't be undone; totals went stale | Undo toast (Apple prefers undo to a confirmation); totals follow visible items; delete/undo race handled | review |
| NEW | low | Persian search missed ZWNJ, spaces and Arabic ي/ك | Normalized search | review |

### Infrastructure and supply chain

| ID | Sev | Finding | Fix |
|---|---|---|---|
| I1 | low | Both containers ran as root | `USER 10001` and `USER node`, files stay root-owned |
| I2 | medium | API published on every host interface | Not published; the frontend reaches it on the compose network |
| I3 | low | No container hardening | `read_only`, `cap_drop: [ALL]`, `no-new-privileges`, pids, memory and CPU limits, tmpfs |
| I4 | low | `httpx` unpinned and shipped to production | Hashed, exact pins of the tested versions; test tools in `requirements-dev.txt` |
| I6 | info | No CI | GitHub Actions: pytest, bandit, pip-audit, tsc, npm audit, build; read-only token |
| NEW | info | A future `.env` would be committed and baked into the image | `.env*` in `.gitignore` and both `.dockerignore` files |
| NEW | info | `tsconfig.tsbuildinfo` tracked | Untracked and ignored |

### Performance

| Measure | Before | After |
|---|---|---|
| history, 365 days, CPU per call | 188 ms | 0.89 ms warm |
| today, CPU per call | 37 ms | 0.74 ms warm |
| history, 365 days, bytes on the wire | 64,946 | 9,584 (gzip level 6) |
| today, bytes on the wire | 3,643 | 1,272 |
| Full-viewport `blur(80px)` aurora animated forever | every frame | removed (it painted under the body background anyway) |
| `backdrop-filter` surfaces per page | ~33 to 37 | chrome only (sidebar, controls, tab bar, sheet) |
| Entrance animation | animated `filter: blur` | transform and opacity only |
| Progress fill | animated `width` (layout per frame) | `transform: scaleX` |
| Intl formatters | rebuilt on every call, every CountUp frame | built once per language |

CPU is measured with `process_time`, so host contention doesn't skew it. The backend test suite went from 64 s to about 10 s.

### Apple design and accessibility

Applied from the apple-design guidance:

- **Materials.** Glass only on chrome; content cards are solid, so translucency never stacks. Tooltips are solid.
- **Motion.** Press feedback is instant and critically damped (no overshoot on a tap). The sheet enters and exits along the same path, and its transitions retarget from the live value. It can be dragged down with 1:1 tracking, an upward rubber-band, and Apple's momentum projection (0.998 deceleration) on release.
- **Reduced motion, transparency and contrast.** Reduced motion cross-fades and drops every delay. Reduced transparency and increased contrast get solid surfaces; increased contrast also gets defined borders and stronger secondary text.
- **Typography.** Fixed pixel sizes became rem, so the user's text size is respected. Small text has slightly positive tracking.
- **Honest status.** The hard-coded 76 % battery, "synced just now" and always-"Active" Premium badge are gone.
- **Accessibility.** Touch targets are at least 44 px. Charts, bars and progress bars have text alternatives. Every route has its own title, so Next's route announcer speaks it. The segmented control has arrow keys (mirrored in RTL) and a single tab stop. Errors, completion and loading are announced through live regions. White-on-color text that failed WCAG contrast now uses colors that pass 4.5:1 in both themes. A health disclaimer sits under the insights and the sleep tip.

## Verification

| Check | Result |
|---|---|
| `pytest` (backend) | 7 passed |
| bandit | 0 issues (5 justified `nosec B311`: seeded demo data) |
| semgrep, security-audit and dockerfile rules on changed files | 0 findings (before: 3) |
| OSV, 13 pinned Python packages | no known vulnerabilities |
| OSV, 57 production npm packages | before upgrade: next 16.3.6 (6), sharp (1), source-map-js (1) |
| `tsc --noEmit` | clean |
| `next build` | passes; all 8 routes still static |
| Live production frontend | CSP and headers present, no `X-Powered-By`, evil Host gets 400, `frame-ancestors 'none'` |

## Decisions and open items

- **No authentication (S2).** This is the one item that becomes critical with real data. Every visitor shares one user. Add accounts and per-user storage before any real health data.
- **Rate limiting.** Deliberately not added. Behind the Next rewrite every request comes from the frontend's IP, so a per-IP bucket becomes one global bucket that lets one client lock out everyone. The cache removed the CPU amplification that motivated it. Add it at the edge (reverse proxy) when the app is public.
- **CSP uses `'unsafe-inline'` for scripts.** Nonces would force dynamic rendering of every page. Nothing renders user-supplied HTML, so the static policy is the better trade today. The upgrade path is noted in `next.config.ts`.
- **500 responses** come from Starlette's outermost error middleware and carry no security headers. They are JSON-free plain text, so the gap is cosmetic.
- **Question for you: `network: host` in both image builds (I5).** It looks like a DNS workaround on your machine. It gives build steps access to host loopback services. I left it in place; if DNS is the reason, set DNS in the Docker daemon config and drop it.
- **Ponytail suggestions not applied.** The sheet's drag-to-dismiss was flagged as optional; I kept it because the Apple guidance you asked for makes it the expected sheet behavior. The unused `total` field in `/api/meals` stays to keep the API stable.
- **Base images** are pinned by tag, not digest. Pin by digest (and let Dependabot bump it) when you deploy.
- **Docker build and a manual browser pass** still need to be run on a machine with headroom.
