import copy
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import main
from main import app

c = TestClient(app, base_url="http://localhost")  # TrustedHost rejects TestClient's default "testserver"
NOW = datetime(2026, 10, 9, 14, 30, tzinfo=main.IRST)


@pytest.fixture(autouse=True)
def isolate(monkeypatch):
    monkeypatch.setattr(main, "_now", lambda: NOW)  # no midnight flake
    saved = copy.deepcopy((main.STATE, main.MEALS))
    yield
    main.STATE.clear()
    main.STATE.update(saved[0])
    main.MEALS[:] = saved[1]


def test_flow():
    t = c.get("/api/today").json()
    assert t["today"]["steps"] >= 0 and len(t["hourly_steps"]) == 24 and t["sleep"]["stages"]
    assert c.get("/api/history?days=30").json()[-1]["date"] == t["today"]["date"] == "2026-10-09"
    assert any(f["id"] == "ash" for f in c.get("/api/foods?q=آش").json())

    before = c.get("/api/meals").json()["total"]["kcal"]
    m = c.post("/api/meals", json={"food_id": "joojeh", "servings": 2, "meal": "dinner"}).json()
    assert m["kcal"] == 660
    assert c.get("/api/meals").json()["total"]["kcal"] == before + 660
    assert c.delete(f"/api/meals/{m['id']}").status_code == 204
    assert c.delete(f"/api/meals/{m['id']}").status_code == 404
    assert c.post("/api/meals", json={"food_id": "nope", "meal": "lunch"}).status_code == 404
    assert c.post("/api/meals", json={"food_id": "ash", "servings": 0, "meal": "lunch"}).status_code == 422

    w = t["water"]
    assert c.post("/api/water", json={"delta": 1}).json()["water"] == min(w + 1, 20)
    assert c.post("/api/water", json={"delta": 5}).status_code == 422

    join = "/api/challenges/no-sugar/join"
    assert c.post(join, json={"joined": True}).json()["joined"] is True
    assert c.post(join, json={"joined": True}).json()["joined"] is True  # desired state, not a toggle
    assert c.post(join, json={"joined": False}).json()["joined"] is False
    for p in ("/api/plans", "/api/org", "/api/sleep", "/api/challenges"):
        assert c.get(p).status_code == 200


def test_headers_docs_and_cache_policy():
    r = c.get("/api/health")
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"
    assert r.headers["referrer-policy"] == "no-referrer" and r.headers["cache-control"] == "no-store"
    assert c.get("/api/plans").headers["cache-control"] == "public, max-age=3600"
    assert c.get("/api/history?days=abc").headers["cache-control"] == "no-store"  # errors are never cached
    assert c.get("/api/history?days=365", headers={"Accept-Encoding": "gzip"}).headers["content-encoding"] == "gzip"
    for p in ("/docs", "/redoc", "/openapi.json"):
        assert c.get(p).status_code == 404


def test_cors_and_host_allowlists():
    assert "access-control-allow-origin" not in c.get("/api/meals", headers={"Origin": "https://evil.example"}).headers
    r = c.get("/api/health", headers={"Host": "attacker.example"})
    assert r.status_code == 400 and r.headers["x-content-type-options"] == "nosniff"  # DNS rebinding, still hardened
    assert c.get("/api/health", headers={"Host": "backend:8000"}).status_code == 200  # what the Next proxy sends


def test_request_limits():
    meal = {"food_id": "tea", "meal": "snack"}
    assert c.post("/api/meals", json={**meal, "pad": "x" * 5000}).status_code == 413
    chunked = c.post("/api/meals", content=(b for b in [b'{"food_id":"tea","meal":"snack"}']),
                     headers={"content-type": "application/json"})
    assert chunked.status_code == 411
    # Requests a browser sends cross-site without a preflight: form post, text/plain, no content type.
    assert c.post("/api/challenges/no-sugar/join", data={"joined": "true"}).status_code == 415
    assert c.post("/api/water", content=b'{"delta":1}', headers={"content-type": "text/plain"}).status_code == 415
    assert c.post("/api/water", content=b'{"delta":1}').status_code == 415
    for bad in ("NaN", "Infinity", "-Infinity"):
        r = c.post("/api/meals", content=f'{{"food_id":"tea","meal":"snack","servings":{bad}}}',
                   headers={"content-type": "application/json"})
        assert r.status_code == 422 and "input" not in r.json()["detail"][0]
    assert c.get("/api/foods", params={"q": "x" * 65}).status_code == 422


def test_meal_cap():
    main.MEALS[:] = [{"id": i, "food_id": "tea", "servings": 1, "meal": "snack"} for i in range(main.MAX_MEALS)]
    assert c.post("/api/meals", json={"food_id": "tea", "meal": "snack"}).status_code == 409


def test_cached_days_and_night_boundary():
    yesterday, today = main.history(2, NOW)
    d = NOW.date()
    assert yesterday["steps"] == sum(main._hour_steps(d - timedelta(days=1), h) for h in range(24))
    assert today["steps"] == sum(main._hour_steps(d, h) for h in range(NOW.hour + 1))  # partial day, not a full one
    assert main.history(2, NOW) == [yesterday, today]
    assert main._night(NOW.replace(hour=0, minute=0)) == d - timedelta(days=1)  # tonight has not ended yet
    assert main._night(NOW.replace(hour=23, minute=59)) == d


def test_today_describes_one_night(monkeypatch):
    early = NOW.replace(hour=3, minute=0)  # before this morning's wake time: last night is still in progress
    monkeypatch.setattr(main, "_now", lambda: early)
    assert c.get("/api/today").json()["sleep"] == main._sleep(early.date() - timedelta(days=1))
