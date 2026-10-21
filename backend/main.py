"""UP Iran (آپ‌سلامت) demo API.

Health data is generated deterministically per date (same day -> same numbers),
so charts stay stable across restarts. Meals/water/challenge joins live in memory.

Env: ALLOWED_HOSTS (default localhost,127.0.0.1,backend), ALLOWED_ORIGINS (default none: same-origin
through the Next proxy), ENABLE_DOCS=1 to serve /docs and /openapi.json.
"""
import os
import random
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from itertools import count
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.datastructures import MutableHeaders
from starlette.middleware.trustedhost import TrustedHostMiddleware

# FastAPI skips /docs and /redoc when openapi_url is None.
app = FastAPI(title="UP Iran API", version="0.1.0", openapi_url="/openapi.json" if os.getenv("ENABLE_DOCS") else None)

# ---------- security: every check is O(1) per request ----------

MAX_BODY = 4096  # real bodies are under 100 B
SEC_HEADERS = {"x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "no-referrer"}
CACHE = {"/api/plans": "public, max-age=3600", "/api/org": "public, max-age=3600", "/api/foods": "public, max-age=3600",
         "/api/history": "private, max-age=60", "/api/sleep": "private, max-age=60"}


class Guard:
    """Pure ASGI (no BaseHTTPMiddleware task group per request): limits on the way in, headers on the way out."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                h = MutableHeaders(scope=message)
                h.update(SEC_HEADERS)
                h.setdefault("cache-control", CACHE.get(scope["path"], "no-store") if message["status"] < 400 else "no-store")
            await send(message)

        h = dict(scope["headers"])
        length = h.get(b"content-length", b"0")
        ctype = h.get(b"content-type", b"").split(b";")[0].strip().lower()
        if b"transfer-encoding" in h:  # chunked bodies carry no length to check
            reject = (411, "length required")
        elif not length.isdigit() or len(length) > 6 or int(length) > MAX_BODY:
            reject = (413, "body too large")
        elif scope["method"] == "POST" and ctype != b"application/json":
            # A bodyless or text/plain POST is a CORS "simple request": no preflight, so any site could send it.
            reject = (415, "JSON required")
        else:
            return await self.app(scope, receive, send_with_headers)
        await JSONResponse({"detail": reject[1]}, reject[0])(scope, receive, send_with_headers)


def _env_list(name: str, default: str = "") -> list[str]:
    return [x.strip().lower() for x in os.getenv(name, default).split(",") if x.strip()]


# Each add_middleware wraps the previous ones, so requests pass CORS -> Guard -> TrustedHost -> GZip -> app.
app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=6)
# Blocks DNS rebinding against a locally bound API. Inside Guard, so its 400 still gets the security headers.
app.add_middleware(TrustedHostMiddleware, allowed_hosts=_env_list("ALLOWED_HOSTS", "localhost,127.0.0.1,backend"))
app.add_middleware(Guard)
# CORS only for cross-origin clients (NEXT_PUBLIC_API_URL builds); outermost, so they can read Guard's 411/413/415.
# The web app itself is same-origin through the Next proxy.
if origins := _env_list("ALLOWED_ORIGINS"):
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST", "DELETE"], allow_headers=["Content-Type"])


@app.exception_handler(RequestValidationError)
async def invalid_request(_, exc: RequestValidationError):
    # The default handler echoes each error's `input`: NaN/Infinity then fail JSON rendering (500),
    # and invalid bodies are reflected back in full.
    return JSONResponse({"detail": [{"loc": e["loc"], "msg": e["msg"]} for e in exc.errors()]}, 422)


IRST = timezone(timedelta(hours=3, minutes=30))  # ponytail: Iran has had no DST since 2023; use ZoneInfo if it returns.


def _now() -> datetime:
    return datetime.now(IRST)  # users are in Iran; a UTC container must not shift their day boundary


GOALS = {"steps": 10000, "active_min": 45, "sleep_min": 480, "kcal_in": 2200, "water": 8, "protein": 110}
USER = {"name": {"fa": "سارا", "en": "Sara"}, "device": "UP Iran Pro", "battery": 76, "plan": "premium"}
FA_DIGITS = str.maketrans("0123456789,", "۰۱۲۳۴۵۶۷۸۹٬")


def bi(fa: str, en: str) -> dict:
    return {"fa": fa.translate(FA_DIGITS), "en": en}


# ---------- deterministic generators ----------

def _hour_steps(d: date, h: int) -> int:
    r = random.Random(d.toordinal() * 100 + h)  # nosec B311 # seeded demo data, not security
    base = [0, 0, 0, 0, 0, 0, 40, 450, 900, 520, 380, 420, 700, 800, 360, 340, 420, 650, 1100, 900, 520, 300, 120, 20][h]
    return max(0, int(base * r.uniform(0.5, 1.6)))


@lru_cache(maxsize=1024)  # deterministic per date; the returned dict is shared, callers must not mutate it
def _sleep(d: date) -> dict:
    """Night that ended on the morning of `d`."""
    r = random.Random(d.toordinal() * 7)  # nosec B311 # seeded demo data
    bed = 22 * 60 + 50 + r.randint(0, 95)  # minutes after midnight of the previous day
    segs, t = [], 0
    for cycle in range(r.choice([4, 5, 5, 6])):
        for stage, lo, hi in (("light", 20, 45), ("deep", 10 if cycle > 2 else 25, 20 if cycle > 2 else 50),
                              ("light", 10, 25), ("rem", 8 + cycle * 4, 16 + cycle * 6)):
            m = r.randint(lo, hi)
            segs.append({"stage": stage, "start": t, "minutes": m})
            t += m
        if r.random() < 0.35:
            m = r.randint(3, 12)
            segs.append({"stage": "awake", "start": t, "minutes": m})
            t += m
    total = {s: sum(x["minutes"] for x in segs if x["stage"] == s) for s in ("deep", "rem", "light", "awake")}
    asleep = t - total["awake"]
    score = round(min(100, 45 * min(1, asleep / GOALS["sleep_min"]) + 120 * total["deep"] / t + 60 * total["rem"] / t
                      + 15 - total["awake"] / 2))
    wake = (bed + t) % 1440
    return {"bedtime": f"{bed // 60 % 24:02d}:{bed % 60:02d}", "wake": f"{wake // 60:02d}:{wake % 60:02d}",
            "minutes": asleep, "score": max(40, score), **total, "stages": segs}


@lru_cache(maxsize=1024)  # (date, hours) fully determines the row, today's partial day included
def _day(d: date, n_hours: int) -> dict:
    hours = range(n_hours)
    steps = sum(_hour_steps(d, h) for h in hours)
    r = random.Random(d.toordinal() * 3)  # nosec B311 # seeded demo data
    s = _sleep(d)
    return {"date": d.isoformat(), "steps": steps, "active_min": steps // 190 + r.randint(0, 8),
            "kcal_out": int(1550 * len(hours) / 24 + steps * 0.045), "distance_km": round(steps * 0.00072, 1),
            "resting_hr": 58 + r.randint(0, 7), "sleep_min": s["minutes"], "sleep_score": s["score"],
            "deep": s["deep"], "rem": s["rem"], "light": s["light"], "awake": s["awake"]}


def history(days: int, now: datetime | None = None) -> list[dict]:
    now = now or _now()
    return [_day(now.date() - timedelta(days=i), 24 if i else now.hour + 1) for i in range(days - 1, -1, -1)]


def _night(now: datetime) -> date:
    """The latest night that has ended. Before today's wake time, tonight is still in progress."""
    d = now.date()
    return d if f"{now:%H:%M}" >= _sleep(d)["wake"] else d - timedelta(days=1)


# ---------- catalog & state ----------

FOODS = [
    # id, fa, en, emoji, serving fa, serving en, kcal, protein, carbs, fat
    ("koobideh", "چلوکباب کوبیده", "Chelow Kabab Koobideh", "🍢", "۱ پرس", "1 plate", 750, 38, 85, 28),
    ("ghormeh", "قورمه‌سبزی با برنج", "Ghormeh Sabzi & rice", "🥘", "۱ پرس", "1 plate", 620, 28, 78, 20),
    ("gheymeh", "خورش قیمه با برنج", "Gheymeh & rice", "🍛", "۱ پرس", "1 plate", 580, 24, 80, 18),
    ("joojeh", "جوجه‌کباب", "Joojeh Kabab", "🍗", "۱ سیخ", "1 skewer", 330, 40, 4, 16),
    ("zereshk", "زرشک‌پلو با مرغ", "Zereshk Polo & chicken", "🍚", "۱ پرس", "1 plate", 690, 36, 92, 18),
    ("ash", "آش رشته", "Ash Reshteh", "🍲", "۱ کاسه", "1 bowl", 320, 12, 48, 9),
    ("adasi", "عدسی", "Adasi (lentil soup)", "🥣", "۱ کاسه", "1 bowl", 260, 14, 40, 4),
    ("haleem", "حلیم", "Haleem", "🥣", "۱ کاسه", "1 bowl", 360, 18, 45, 11),
    ("kashk", "کشک بادمجان", "Kashk-e Bademjan", "🍆", "۱ کاسه", "1 bowl", 290, 8, 18, 21),
    ("sangak", "نان سنگک", "Sangak bread", "🫓", "یک‌چهارم", "quarter", 180, 6, 36, 1),
    ("barbari", "نان بربری", "Barbari bread", "🥖", "یک‌چهارم", "quarter", 200, 7, 38, 2),
    ("cheese", "نان و پنیر و گردو", "Bread, cheese & walnuts", "🧀", "۱ لقمه", "1 wrap", 260, 10, 22, 15),
    ("nimroo", "نیمرو", "Fried eggs", "🍳", "۲ عدد", "2 eggs", 180, 12, 1, 14),
    ("shirazi", "سالاد شیرازی", "Shirazi salad", "🥗", "۱ کاسه", "1 bowl", 90, 2, 12, 4),
    ("yogurt", "ماست", "Yogurt", "🥛", "۱ کاسه", "1 bowl", 120, 8, 9, 6),
    ("doogh", "دوغ", "Doogh", "🥛", "۱ لیوان", "1 glass", 70, 4, 6, 3),
    ("tea", "چای با قند", "Tea with sugar cube", "🍵", "۱ استکان", "1 cup", 35, 0, 9, 0),
    ("dates", "خرما", "Dates", "🌴", "۳ عدد", "3 pcs", 70, 1, 18, 0),
    ("ajil", "آجیل", "Mixed nuts (Ajil)", "🥜", "۱ مشت", "1 handful", 170, 5, 6, 15),
    ("watermelon", "هندوانه", "Watermelon", "🍉", "۱ برش", "1 slice", 85, 2, 21, 0),
    ("apple", "سیب", "Apple", "🍎", "۱ عدد", "1 pc", 95, 0, 25, 0),
    ("faloodeh", "فالوده شیرازی", "Faloodeh", "🍧", "۱ لیوان", "1 cup", 210, 1, 50, 0),
]
FOOD = {f[0]: {"id": f[0], "name": bi(f[1], f[2]), "emoji": f[3], "serving": bi(f[4], f[5]),
               "kcal": f[6], "protein": f[7], "carbs": f[8], "fat": f[9]} for f in FOODS}

Meal = Literal["breakfast", "lunch", "dinner", "snack"]
_ids = count(1)
MAX_MEALS = 200  # bounds memory and the O(n) _intake() that every /api/today and /api/meals runs
# ponytail: in-memory state, resets on restart; move to SQLite/Postgres when accounts exist.
MEALS = [{"id": next(_ids), "food_id": f, "servings": s, "meal": m}
         for f, s, m in (("cheese", 1, "breakfast"), ("tea", 2, "breakfast"), ("ghormeh", 1, "lunch"),
                         ("doogh", 1, "lunch"), ("dates", 1, "snack"))]
STATE = {"water": 4, "joined": {"steps50k", "sleep-early"}}


class MealIn(BaseModel):
    food_id: str
    servings: float = Field(1, gt=0, le=10)
    meal: Meal


class WaterIn(BaseModel):
    delta: Literal[-1, 1]


class JoinIn(BaseModel):
    joined: bool


def _meal_view(m: dict) -> dict:
    f = FOOD[m["food_id"]]
    return {**m, "food": f, **{k: round(f[k] * m["servings"]) for k in ("kcal", "protein", "carbs", "fat")}}


def _intake() -> dict:
    ms = [_meal_view(m) for m in MEALS]
    return {k: sum(m[k] for m in ms) for k in ("kcal", "protein", "carbs", "fat")}


# ---------- routes ----------

@app.get("/api/health")
async def health():
    return {"ok": True}


@app.get("/api/today")
def today():
    now = _now()  # one clock read, so the payload never mixes two days
    d = now.date()
    hist = history(30, now)
    t, week = hist[-1], hist[-8:-1]
    night = _night(now)  # the card, the insight and its weekly average all describe the same ended night
    last = _sleep(night)
    hourly = [_hour_steps(d, h) if h <= now.hour else 0 for h in range(24)]
    r = random.Random(d.toordinal())  # nosec B311 # seeded demo data
    hr = [{"t": f"{h // 2:02d}:{h % 2 * 30:02d}",
           "bpm": t["resting_hr"] + int(hourly[h // 2] / 25) + r.randint(-3, 6)} for h in range(now.hour * 2 + 1)]
    streak = 0
    for day in reversed(hist[:-1]):
        if day["steps"] < GOALS["steps"] * 0.8:
            break
        streak += 1
    avg_deep = sum(_sleep(night - timedelta(days=i))["deep"] for i in range(1, 8)) / 7
    avg_steps = sum(x["steps"] for x in week) / 7
    deep_delta = round((last["deep"] - avg_deep) / avg_deep * 100)
    left = GOALS["steps"] - t["steps"]
    intake = _intake()
    insights = [
        {"kind": "sleep", **({"text": bi(f"خواب عمیق دیشب شما {deep_delta}٪ بیشتر از میانگین هفته بود. همین روال را ادامه دهید.",
                                         f"Your deep sleep was {deep_delta}% above your weekly average. Keep it up.")}
                             if deep_delta >= 0 else
                             {"text": bi(f"خواب عمیق دیشب {-deep_delta}٪ کمتر از میانگین بود. امشب زودتر بخوابید و چای را بعد از ساعت ۱۹ کنار بگذارید.",
                                         f"Deep sleep was {-deep_delta}% below average. Try an earlier bedtime and skip tea after 7 pm.")})},
        {"kind": "move", "text": bi(f"میانگین قدم‌های شما در ۷ روز گذشته {round(avg_steps):,} قدم بوده است. "
                                    + (f"تا هدف امروز {left:,} قدم مانده است." if left > 0 else "هدف قدم امروز را کامل کردید."),
                                    f"You averaged {round(avg_steps):,} steps over the last 7 days. "
                                    + (f"{left:,} steps to go for today's goal." if left > 0 else "You reached today's step goal."))},
    ]
    if intake["protein"] < GOALS["protein"]:  # only say it when it is true
        insights.append({"kind": "eat", "text": bi("پروتئین امروز کمتر از هدف است. یک سیخ جوجه‌کباب یا یک کاسه عدسی کمک می‌کند.",
                                                   "Protein is under target today. A Joojeh skewer or a bowl of Adasi would help.")})
    return {"user": USER, "goals": GOALS, "today": t, "sleep": last, "hourly_steps": hourly, "heart": hr,
            "intake": intake, "water": STATE["water"], "streak": streak, "insights": insights, "week": hist[-7:]}


@app.get("/api/history")
def get_history(days: int = 30) -> list[dict]:  # typed return: serialized in pydantic-core, not jsonable_encoder
    return history(max(1, min(days, 365)))


@app.get("/api/sleep")
def sleep():
    d = _night(_now())
    return {"last": _sleep(d), "week": [{"date": (d - timedelta(days=i)).isoformat(), **{k: v for k, v in _sleep(d - timedelta(days=i)).items() if k != "stages"}}
                                        for i in range(13, -1, -1)]}


@app.get("/api/foods")
async def foods(q: str = Query("", max_length=64)):
    q = q.strip().lower()
    return [f for f in FOOD.values() if q in f["name"]["fa"] or q in f["name"]["en"].lower()]


@app.get("/api/meals")
async def meals():
    return {"items": [_meal_view(m) for m in MEALS], "total": _intake(), "goal": GOALS["kcal_in"]}


@app.post("/api/meals", status_code=201)
async def add_meal(body: MealIn):  # async: runs on the event loop, so MEALS never sees two writers at once
    if body.food_id not in FOOD:
        raise HTTPException(404, "food not found")
    if len(MEALS) >= MAX_MEALS:
        raise HTTPException(409, "meal limit reached")
    m = {"id": next(_ids), **body.model_dump()}
    MEALS.append(m)
    return _meal_view(m)


@app.delete("/api/meals/{meal_id}", status_code=204)
async def delete_meal(meal_id: int):
    before = len(MEALS)
    MEALS[:] = [m for m in MEALS if m["id"] != meal_id]
    if len(MEALS) == before:
        raise HTTPException(404, "meal not found")


@app.post("/api/water")
async def water(body: WaterIn):
    STATE["water"] = max(0, min(20, STATE["water"] + body.delta))
    return {"water": STATE["water"]}


CHALLENGES = [
    {"id": "steps50k", "kind": "move", "title": bi("۵۰ هزار قدم تا جمعه", "50K steps by Friday"),
     "desc": bi("هر روز کمی بیشتر راه بروید و با دوستانتان رقابت کنید.", "Walk a bit more every day and race your friends."),
     "goal": 50000, "progress": 34120, "unit": bi("قدم", "steps"), "participants": 128, "days_left": 2},
    {"id": "sleep-early", "kind": "sleep", "title": bi("خواب قبل از نیمه‌شب", "Asleep before midnight"),
     "desc": bi("۷ شب پشت‌سرهم قبل از ساعت ۲۴ بخوابید.", "7 nights in a row, asleep before 12 am."),
     "goal": 7, "progress": 4, "unit": bi("شب", "nights"), "participants": 64, "days_left": 3},
    {"id": "office-walk", "kind": "move", "title": bi("کارزار پیاده‌روی دروگ", "Darvag walking campaign"),
     "desc": bi("کارزار تیمی: مجموع ۲ میلیون قدم برای کل تیم.", "Team campaign: 2 million steps together."),
     "goal": 2000000, "progress": 1384000, "unit": bi("قدم", "steps"), "participants": 212, "days_left": 9},
    {"id": "no-sugar", "kind": "eat", "title": bi("یک ماه بدون قند", "Sugar-free month"),
     "desc": bi("چای را بدون قند بنوشید و شیرینی را با میوه جایگزین کنید.", "Tea without sugar, fruit instead of sweets."),
     "goal": 30, "progress": 0, "unit": bi("روز", "days"), "participants": 340, "days_left": 30},
]
LEADERS = [("مریم", "Maryam", 48210), ("علی", "Ali", 45980), ("سارا", "Sara", 34120), ("رضا", "Reza", 31400),
           ("نیلوفر", "Niloofar", 29870), ("امید", "Omid", 22340)]
BADGES = [("streak7", "۷ روز پیاپی", "7-day streak", "🔥", True), ("early", "سحرخیز", "Early bird", "🌅", True),
          ("marathon", "ماراتنی", "Marathoner", "🏃", True), ("deep", "خواب طلایی", "Golden sleep", "🌙", True),
          ("water", "آب‌رسان", "Hydrated", "💧", False), ("chef", "آشپز سالم", "Healthy chef", "🥗", False),
          ("team", "هم‌تیمی", "Team player", "🤝", True), ("100k", "صد هزار قدم", "100K steps", "🏅", False)]


@app.get("/api/challenges")
async def challenges():
    return {"items": [{**c, "joined": c["id"] in STATE["joined"]} for c in CHALLENGES],
            "leaders": [{"rank": i + 1, "name": bi(fa, en), "steps": s, "me": en == "Sara"} for i, (fa, en, s) in enumerate(LEADERS)],
            "badges": [{"id": i, "name": bi(fa, en), "emoji": e, "earned": ok} for i, fa, en, e, ok in BADGES]}


@app.post("/api/challenges/{cid}/join")
async def join(cid: str, body: JoinIn):
    if cid not in {c["id"] for c in CHALLENGES}:
        raise HTTPException(404, "challenge not found")
    # Desired state, not a toggle: a retried or doubled request can't flip it back.
    (STATE["joined"].add if body.joined else STATE["joined"].discard)(cid)
    return {"id": cid, "joined": cid in STATE["joined"]}


@app.get("/api/plans")
async def plans():
    return {
        "devices": [
            {"id": "lite", "name": "UP Iran Lite", "price": 3_900_000, "color": "#30d158",
             "features": [bi("شمارش قدم و کالری", "Steps & calories"), bi("پایش خواب", "Sleep tracking"),
                          bi("باتری ۱۰ روزه", "10-day battery"), bi("ضدتعریق", "Sweat-proof")]},
            {"id": "pro", "name": "UP Iran Pro", "price": 7_900_000, "color": "#ff375f", "popular": True,
             "features": [bi("همه امکانات Lite", "Everything in Lite"), bi("ضربان قلب ۲۴ ساعته", "24/7 heart rate"),
                          bi("اعلان‌های گوشی", "Phone notifications"), bi("مقاوم در برابر آب تا ۵۰ متر", "Water-resistant 50 m"),
                          bi("۲ سال گارانتی", "2-year warranty")]},
        ],
        "premium": {"price": 149_000, "active": USER["plan"] == "premium", "features": [bi("تحلیل پیشرفته خواب", "Advanced sleep analysis"),
                                                   bi("برنامه غذایی با غذاهای ایرانی", "Meal plans with Iranian food"),
                                                   bi("مربی شخصی هوشمند", "Smart personal coach"),
                                                   bi("گزارش سلامت ماهانه (PDF)", "Monthly health report (PDF)")]},
        "b2b": {"price": 89_000, "features": [bi("پیش‌خوان سلامت سازمان", "Organization health dashboard"),
                                              bi("مدیریت چالش‌ها و کارزارها", "Challenges & campaigns"),
                                              bi("گزارش تجمیعی بدون افشای هویت", "Anonymous aggregate reports"),
                                              bi("اتصال به باشگاه و بیمه تکمیلی", "Gym & insurance partners")]},
    }


@app.get("/api/org")
async def org():
    r = random.Random(1405)  # nosec B311 # seeded demo data
    depts = [("مهندسی", "Engineering", 64), ("فروش", "Sales", 38), ("پشتیبانی", "Support", 42),
             ("مالی", "Finance", 21), ("منابع انسانی", "HR", 15), ("عملیات", "Operations", 60)]
    return {
        "name": bi("شرکت نمونه آریا", "Aria Sample Co."), "members": 240, "active": 186, "wellbeing": 74,
        "avg_steps": 7640, "avg_sleep_min": 412, "challenge_rate": 68,
        "weekly": [{"week": i + 1, "active": 120 + i * 6 + r.randint(-8, 10), "steps": 6200 + i * 120 + r.randint(-300, 300)} for i in range(12)],
        # k-anonymity: departments are only reported as aggregates, never per person.
        "departments": [{"name": bi(fa, en), "members": n, "avg_steps": r.randint(5600, 9800),
                         "sleep_min": r.randint(370, 450), "participation": r.randint(48, 92)} for fa, en, n in depts],
    }
