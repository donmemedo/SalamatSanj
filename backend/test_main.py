from fastapi.testclient import TestClient

from main import app

c = TestClient(app)


def test_flow():
    t = c.get("/api/today").json()
    assert t["today"]["steps"] >= 0 and len(t["hourly_steps"]) == 24 and t["sleep"]["stages"]
    assert c.get("/api/history?days=30").json()[-1]["date"] == t["today"]["date"]
    assert any(f["id"] == "ash" for f in c.get("/api/foods?q=آش").json())

    before = c.get("/api/meals").json()["total"]["kcal"]
    m = c.post("/api/meals", json={"food_id": "joojeh", "servings": 2, "meal": "dinner"}).json()
    assert m["kcal"] == 660
    assert c.get("/api/meals").json()["total"]["kcal"] == before + 660
    assert c.delete(f"/api/meals/{m['id']}").status_code == 204
    assert c.delete(f"/api/meals/{m['id']}").status_code == 404
    assert c.post("/api/meals", json={"food_id": "nope", "meal": "lunch"}).status_code == 404
    assert c.post("/api/meals", json={"food_id": "ash", "servings": 0, "meal": "lunch"}).status_code == 422

    w = c.get("/api/today").json()["water"]
    assert c.post("/api/water", json={"delta": 1}).json()["water"] == w + 1
    assert c.post("/api/water", json={"delta": 5}).status_code == 422

    j = c.post("/api/challenges/no-sugar/join").json()["joined"]
    assert c.post("/api/challenges/no-sugar/join").json()["joined"] is not j
    for p in ("/api/plans", "/api/org", "/api/sleep", "/api/challenges"):
        assert c.get(p).status_code == 200
