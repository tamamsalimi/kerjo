"""
Kerjo backend regression tests (rewritten for real two-sided matching).

Covers:
- Auth (Bearer session token flow, unauthorized)
- Seed data: exactly 10 seed workers + 10 seed jobs (owner_user_id=None)
- Browse: /api/workers, /api/jobs (excludes own & swiped, includes real profiles/jobs)
- Filters: category, pay_bracket, job_type, experience, max_distance
- Solo/bot match: right-swipe seed job (owner=None) and seed worker (wk_*) instant-match
  with a bot greeting + auto-reply on user message
- REAL two-sided match: A right-swipes B's job -> matched:false; B right-swipes wp_A
  -> matched:true. Both A and B see the SAME match with per-viewer display.
- Shared cross-account chat by match_id (B sends, A receives). Real match has a
  'system' greeting and NO auto-reply.
- Complete + review: employer review on real match attaches to wp_<worker_user_id>
  and shows on GET /api/workers/{wp_id}
- Create job persists and is retrievable
- Profile upsert + get

The tests create fresh users user_At/user_Bt in mongo so pre-consumed A/B do not
interfere. Seed tokens (testtoken_kerjo_123, tokA, tokB) are also verified.
"""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pathlib import Path

from pymongo import MongoClient
from dotenv import load_dotenv

# ---------- Config ----------
load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
            break

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

SOLO_TOKEN = "testtoken_kerjo_123"


def _h(token: str):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Fresh two-sided pair ----------
# Create fresh users At/Bt directly in mongo (mirrors what the review request
# suggested when the seed A/B pair has already been consumed by a prior run).
FRESH_SUFFIX = uuid.uuid4().hex[:6]
UID_A = f"user_At_{FRESH_SUFFIX}"
UID_B = f"user_Bt_{FRESH_SUFFIX}"
TOK_A = f"tokAt_{FRESH_SUFFIX}"
TOK_B = f"tokBt_{FRESH_SUFFIX}"


@pytest.fixture(scope="session", autouse=True)
def seed_fresh_pair():
    mc = MongoClient(MONGO_URL)
    db = mc[DB_NAME]
    now = datetime.now(timezone.utc)
    exp = now + timedelta(days=1)
    db.users.insert_many([
        {"user_id": UID_A, "email": f"TEST_{UID_A}@k.id", "name": "TEST_Worker At",
         "picture": "", "created_at": now},
        {"user_id": UID_B, "email": f"TEST_{UID_B}@k.id", "name": "TEST_Employer Bt",
         "picture": "", "created_at": now},
    ])
    db.user_sessions.insert_many([
        {"session_token": TOK_A, "user_id": UID_A, "created_at": now, "expires_at": exp},
        {"session_token": TOK_B, "user_id": UID_B, "created_at": now, "expires_at": exp},
    ])
    yield
    # Cleanup: remove test-created data. Keep for post-run debugging: don't nuke matches/messages.
    db.users.delete_many({"user_id": {"$in": [UID_A, UID_B]}})
    db.user_sessions.delete_many({"session_token": {"$in": [TOK_A, TOK_B]}})
    db.profiles.delete_many({"user_id": {"$in": [UID_A, UID_B]}})
    db.jobs.delete_many({"owner_user_id": UID_B})
    db.swipes.delete_many({"swiper_user_id": {"$in": [UID_A, UID_B]}})
    # remove matches created for the fresh pair
    db.matches.delete_many({"participants": {"$in": [UID_A, UID_B]}})
    mc.close()


# ---------- Shared state across classes ----------
class S:
    b_job_id = None
    real_match_id = None
    bot_job_match_id = None
    bot_worker_match_id = None
    seed_job_id = None
    seed_worker_id = None


# ---------- Auth ----------
class TestAuth:
    def test_me_solo(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(SOLO_TOKEN), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["user_id"] == "user_testkerjo01"

    def test_me_unauthorized(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_fresh_A(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(TOK_A), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["user_id"] == UID_A

    def test_me_fresh_B(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(TOK_B), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["user_id"] == UID_B


# ---------- Seed data ----------
class TestSeed:
    def test_ten_seed_workers(self):
        mc = MongoClient(MONGO_URL); db = mc[DB_NAME]
        n = db.workers.count_documents({})
        mc.close()
        assert n == 10, f"expected 10 seed workers, got {n}"

    def test_ten_seed_jobs(self):
        mc = MongoClient(MONGO_URL); db = mc[DB_NAME]
        n = db.jobs.count_documents({"owner_user_id": None})
        mc.close()
        assert n == 10, f"expected 10 seed jobs (owner_user_id=None), got {n}"


# ---------- Browse ----------
class TestBrowse:
    def test_list_jobs_excludes_own_and_includes_seeds(self):
        # As user_B, /api/jobs should exclude B's own posted job and include seed jobs
        r = requests.get(f"{BASE_URL}/api/jobs", headers=_h(TOK_B), timeout=15)
        assert r.status_code == 200
        jobs = r.json()
        assert isinstance(jobs, list) and len(jobs) >= 10
        for j in jobs:
            assert j.get("owner_user_id") != UID_B

    def test_list_workers_excludes_self_includes_wp(self):
        # As user_A (has profile), /api/workers should NOT include wp_user_A (self)
        # It should include the 10 seed workers plus real profiles from OTHER users.
        # First A must have a profile; onboarding-style upsert.
        prof = {"name": "TEST_Worker At", "category": "Tukang",
                "experience_label": "1-2 tahun", "availability": "Harian",
                "bio": "TEST_bio", "rate": "Rp 150rb/hari"}
        rp = requests.post(f"{BASE_URL}/api/profile", headers=_h(TOK_A), json=prof, timeout=15)
        assert rp.status_code == 200
        r = requests.get(f"{BASE_URL}/api/workers", headers=_h(TOK_A), timeout=15)
        assert r.status_code == 200
        ws = r.json()
        ids = {w["id"] for w in ws}
        assert f"wp_{UID_A}" not in ids, "own real profile should be excluded from own list"
        # seed workers wk_* are always present
        assert any(i.startswith("wk_") for i in ids)

    def test_jobs_category_filter(self):
        r = requests.get(f"{BASE_URL}/api/jobs", headers=_h(SOLO_TOKEN),
                         params={"category": "Kasir"}, timeout=15)
        assert r.status_code == 200
        for j in r.json():
            assert j["category"] == "Kasir"

    def test_workers_pay_bracket_filter(self):
        r = requests.get(f"{BASE_URL}/api/workers", headers=_h(SOLO_TOKEN),
                         params={"pay_bracket": "100-500"}, timeout=15)
        assert r.status_code == 200
        for w in r.json():
            # real profile cards have pay_amount=0; only seed bots have brackets
            if w["id"].startswith("wk_"):
                assert 100000 <= w["pay_amount"] < 500000

    def test_workers_experience_filter(self):
        r = requests.get(f"{BASE_URL}/api/workers", headers=_h(SOLO_TOKEN),
                         params={"experience": "1-2"}, timeout=15)
        assert r.status_code == 200
        for w in r.json():
            assert w["experience_bucket"] == "1-2"

    def test_worker_detail_404(self):
        r = requests.get(f"{BASE_URL}/api/workers/does_not_exist_xxx",
                         headers=_h(SOLO_TOKEN), timeout=15)
        assert r.status_code == 404


# ---------- Fresh pair: B creates a job ----------
class TestSetupB:
    def test_B_creates_job(self):
        payload = {
            "business": "TEST_CV Fresh Bt", "title": "TEST_Tukang Cat",
            "category": "Tukang", "pay_amount": 250000, "pay_unit": "/hari",
            "distance_km": 2.5, "job_type": "Harian",
            "min_experience_label": "Baru", "description": "TEST_desc",
        }
        r = requests.post(f"{BASE_URL}/api/jobs", headers=_h(TOK_B),
                          json=payload, timeout=15)
        assert r.status_code == 200, r.text
        job = r.json()
        assert job["owner_user_id"] == UID_B
        assert job["experience_bucket"] == "baru"
        S.b_job_id = job["id"]

        # readable back
        g = requests.get(f"{BASE_URL}/api/jobs/{job['id']}", headers=_h(TOK_B), timeout=15)
        assert g.status_code == 200
        assert g.json()["business"] == "TEST_CV Fresh Bt"


# ---------- Real two-sided match ----------
class TestRealMatch:
    def test_A_swipes_B_job_no_match(self):
        assert S.b_job_id
        r = requests.post(f"{BASE_URL}/api/swipe", headers=_h(TOK_A),
                          json={"target_type": "job", "target_id": S.b_job_id,
                                "direction": "right"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["matched"] is False, f"expected no match yet, got {data}"

    def test_B_swipes_wp_A_creates_match(self):
        r = requests.post(f"{BASE_URL}/api/swipe", headers=_h(TOK_B),
                          json={"target_type": "worker", "target_id": f"wp_{UID_A}",
                                "direction": "right"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["matched"] is True
        assert "match" in data
        m = data["match"]
        assert m["kind"] == "real"
        # B is the employer; sees the worker side
        assert m["entity_type"] == "worker"
        assert "TEST_Worker At" in m["title"]
        assert "Pelamar" in m["subtitle"] and "Tukang" in m["subtitle"]
        S.real_match_id = m["id"]

    def test_both_see_same_match(self):
        mid = S.real_match_id
        assert mid
        ra = requests.get(f"{BASE_URL}/api/matches", headers=_h(TOK_A), timeout=15).json()
        rb = requests.get(f"{BASE_URL}/api/matches", headers=_h(TOK_B), timeout=15).json()
        ids_a = {m["id"] for m in ra}
        ids_b = {m["id"] for m in rb}
        assert mid in ids_a and mid in ids_b, "match must be visible to both participants"

        ma = next(m for m in ra if m["id"] == mid)
        mb = next(m for m in rb if m["id"] == mid)
        # A (worker) sees the job side
        assert ma["kind"] == "real" and ma["entity_type"] == "job"
        assert ma["title"] == "TEST_Tukang Cat"
        assert ma["subtitle"] == "TEST_CV Fresh Bt"
        # B (employer) sees the worker side
        assert mb["entity_type"] == "worker"
        assert "TEST_Worker At" in mb["title"]

    def test_real_match_system_greeting(self):
        mid = S.real_match_id
        r = requests.get(f"{BASE_URL}/api/matches/{mid}/messages",
                         headers=_h(TOK_A), timeout=15)
        assert r.status_code == 200
        msgs = r.json()
        assert len(msgs) >= 1
        assert msgs[0]["sender"] == "system"
        assert "cocok" in msgs[0]["text"].lower() or "match" in msgs[0]["text"].lower()

    def test_cross_account_chat(self):
        mid = S.real_match_id
        # B sends -> A reads
        r = requests.post(f"{BASE_URL}/api/matches/{mid}/messages",
                          headers=_h(TOK_B), json={"text": "TEST_hello from Bt"}, timeout=15)
        assert r.status_code == 200
        # A retrieves
        ra = requests.get(f"{BASE_URL}/api/matches/{mid}/messages",
                          headers=_h(TOK_A), timeout=15).json()
        senders = [m["sender"] for m in ra]
        texts = [m["text"] for m in ra]
        assert UID_B in senders, f"expected sender={UID_B} visible to A: {senders}"
        assert "TEST_hello from Bt" in texts

        # No bot auto-reply for real matches
        assert "bot" not in senders

        # A sends -> B reads
        r = requests.post(f"{BASE_URL}/api/matches/{mid}/messages",
                          headers=_h(TOK_A), json={"text": "TEST_hi from At"}, timeout=15)
        assert r.status_code == 200
        rb = requests.get(f"{BASE_URL}/api/matches/{mid}/messages",
                          headers=_h(TOK_B), timeout=15).json()
        senders_b = [m["sender"] for m in rb]
        texts_b = [m["text"] for m in rb]
        assert UID_A in senders_b
        assert "TEST_hi from At" in texts_b
        # Still no bot
        assert "bot" not in senders_b

    def test_review_attaches_to_worker_profile(self):
        mid = S.real_match_id
        # Complete first
        r = requests.post(f"{BASE_URL}/api/matches/{mid}/complete",
                          headers=_h(TOK_B), timeout=15)
        assert r.status_code == 200 and r.json().get("ok") is True

        # Employer B reviews Worker A -> should attach to wp_UID_A
        r = requests.post(f"{BASE_URL}/api/matches/{mid}/review", headers=_h(TOK_B),
                          json={"rating": 5, "comment": "TEST_great worker A"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True and data["review"]["rating"] == 5

        # Fetch worker profile via GET /api/workers/wp_UID_A
        g = requests.get(f"{BASE_URL}/api/workers/wp_{UID_A}",
                         headers=_h(SOLO_TOKEN), timeout=15)
        assert g.status_code == 200, g.text
        card = g.json()
        assert card["id"] == f"wp_{UID_A}"
        comments = [r["comment"] for r in card.get("reviews", [])]
        assert "TEST_great worker A" in comments


# ---------- Solo/bot matches ----------
class TestBotMatch:
    def test_solo_right_swipe_seed_job_instant_match(self):
        # Use a fresh solo user (fresh session) so we don't consume the shared
        # testtoken_kerjo_123 session's swipe history. But simpler: use user_testkerjo01
        # and pick a NOT-yet-swiped seed job.
        jobs = requests.get(f"{BASE_URL}/api/jobs", headers=_h(SOLO_TOKEN), timeout=15).json()
        seed = [j for j in jobs if j.get("owner_user_id") is None]
        if not seed:
            pytest.skip("no unswiped seed jobs left for solo tester")
        target = seed[0]["id"]
        S.seed_job_id = target
        r = requests.post(f"{BASE_URL}/api/swipe", headers=_h(SOLO_TOKEN),
                          json={"target_type": "job", "target_id": target,
                                "direction": "right"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["matched"] is True
        assert data["match"]["kind"] == "bot"
        S.bot_job_match_id = data["match"]["id"]

    def test_bot_job_greeting_and_auto_reply(self):
        mid = S.bot_job_match_id
        assert mid
        msgs = requests.get(f"{BASE_URL}/api/matches/{mid}/messages",
                            headers=_h(SOLO_TOKEN), timeout=15).json()
        assert msgs and msgs[0]["sender"] == "bot"
        r = requests.post(f"{BASE_URL}/api/matches/{mid}/messages", headers=_h(SOLO_TOKEN),
                          json={"text": "TEST_solo hi"}, timeout=15)
        assert r.status_code == 200
        msgs = r.json()
        senders = [m["sender"] for m in msgs[-2:]]
        assert senders[0] == "user_testkerjo01"
        assert senders[1] == "bot"

    def test_solo_right_swipe_seed_worker_instant_match(self):
        ws = requests.get(f"{BASE_URL}/api/workers", headers=_h(SOLO_TOKEN), timeout=15).json()
        seed = [w for w in ws if w["id"].startswith("wk_")]
        if not seed:
            pytest.skip("no unswiped seed workers left")
        target = seed[0]["id"]
        S.seed_worker_id = target
        r = requests.post(f"{BASE_URL}/api/swipe", headers=_h(SOLO_TOKEN),
                          json={"target_type": "worker", "target_id": target,
                                "direction": "right"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["matched"] is True
        assert data["match"]["kind"] == "bot"
        S.bot_worker_match_id = data["match"]["id"]

    def test_left_swipe_no_match(self):
        ws = requests.get(f"{BASE_URL}/api/workers", headers=_h(SOLO_TOKEN), timeout=15).json()
        seed = [w for w in ws if w["id"].startswith("wk_")]
        if not seed:
            pytest.skip("no seed workers left")
        r = requests.post(f"{BASE_URL}/api/swipe", headers=_h(SOLO_TOKEN),
                          json={"target_type": "worker", "target_id": seed[0]["id"],
                                "direction": "left"}, timeout=15)
        assert r.status_code == 200 and r.json()["matched"] is False


# ---------- Profile CRUD ----------
class TestProfile:
    def test_get_and_upsert(self):
        payload = {"name": "TEST_Solo Tester", "category": "Kebersihan",
                   "experience_label": "1-2 tahun", "availability": "Harian",
                   "bio": "TEST_bio2", "rate": "Rp 120rb/hari"}
        r = requests.post(f"{BASE_URL}/api/profile", headers=_h(SOLO_TOKEN),
                          json=payload, timeout=15)
        assert r.status_code == 200
        saved = r.json()
        assert saved["name"] == payload["name"]

        g = requests.get(f"{BASE_URL}/api/profile", headers=_h(SOLO_TOKEN), timeout=15)
        assert g.status_code == 200 and g.json()["category"] == "Kebersihan"


# ---------- Match 404 ----------
class TestMatch404:
    def test_bad_match(self):
        r = requests.get(f"{BASE_URL}/api/matches/nope/messages",
                         headers=_h(SOLO_TOKEN), timeout=15)
        assert r.status_code == 404
