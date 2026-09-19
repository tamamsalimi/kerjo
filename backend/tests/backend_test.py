"""
Kerjo backend regression tests.
Covers: auth, jobs/workers listing + filters, worker detail, swipe (miss + match),
matches list, messages GET/POST (+auto-reply), complete, review, profile, create job.
"""
import os
import hashlib
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to frontend/.env value if not exported
    from pathlib import Path
    env = Path("/app/frontend/.env").read_text()
    for line in env.splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
            break

TOKEN = "testtoken_kerjo_123"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def _mutual(target_id: str) -> bool:
    return int(hashlib.md5(target_id.encode()).hexdigest(), 16) % 100 < 65


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


# ---------------- Auth ----------------
class TestAuth:
    def test_me_authenticated(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_id"] == "user_testkerjo01"
        assert "has_profile" in data

    def test_me_unauthorized(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 401


# ---------------- Jobs & Workers ----------------
class TestBrowse:
    def test_list_jobs(self, api):
        r = api.get(f"{BASE_URL}/api/jobs", timeout=15)
        assert r.status_code == 200
        jobs = r.json()
        assert isinstance(jobs, list)
        # seeded 20 jobs - excluding already swiped, still expect > 0
        assert len(jobs) >= 1
        j = jobs[0]
        for k in ("id", "title", "business", "category", "pay_amount", "job_type"):
            assert k in j, f"missing {k}"

    def test_list_workers(self, api):
        r = api.get(f"{BASE_URL}/api/workers", timeout=15)
        assert r.status_code == 200
        workers = r.json()
        assert isinstance(workers, list)
        assert len(workers) >= 1
        w = workers[0]
        for k in ("id", "name", "role", "rating", "category"):
            assert k in w

    def test_jobs_category_filter(self, api):
        # Use a category that likely exists in seed set
        r_all = api.get(f"{BASE_URL}/api/jobs", timeout=15).json()
        if not r_all:
            pytest.skip("no jobs to test filter")
        cat = r_all[0]["category"]
        r = api.get(f"{BASE_URL}/api/jobs", params={"category": cat}, timeout=15)
        assert r.status_code == 200
        assert all(j["category"] == cat for j in r.json())

    def test_workers_pay_bracket_filter(self, api):
        r = api.get(f"{BASE_URL}/api/workers", params={"pay_bracket": "100-500"}, timeout=15)
        assert r.status_code == 200
        for w in r.json():
            assert 100000 <= w["pay_amount"] < 500000

    def test_worker_detail_with_reviews(self, api):
        workers = api.get(f"{BASE_URL}/api/workers", timeout=15).json()
        if not workers:
            pytest.skip("no workers")
        wid = workers[0]["id"]
        r = api.get(f"{BASE_URL}/api/workers/{wid}", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == wid
        assert "reviews" in data and isinstance(data["reviews"], list)

    def test_worker_detail_404(self, api):
        r = api.get(f"{BASE_URL}/api/workers/does_not_exist_xxx", timeout=15)
        assert r.status_code == 404


# ---------------- Swipe + Match ----------------
class TestSwipe:
    def test_swipe_left_no_match(self, api):
        # pick a mutual target id and swipe left => no match
        target = "jb_1"
        assert _mutual(target)
        r = api.post(f"{BASE_URL}/api/swipe", json={
            "target_type": "job", "target_id": target, "direction": "left"
        }, timeout=15)
        assert r.status_code == 200
        assert r.json()["matched"] is False

    def test_swipe_right_mutual_match_job(self, api):
        # jb_1 is deterministically mutual per md5
        target = "jb_1"
        assert _mutual(target)
        r = api.post(f"{BASE_URL}/api/swipe", json={
            "target_type": "job", "target_id": target, "direction": "right"
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["matched"] is True
        assert "match" in data
        assert data["match"]["entity_id"] == target
        pytest.match_id_job = data["match"]["id"]

    def test_swipe_right_mutual_match_worker(self, api):
        target = "wk_2"
        assert _mutual(target)
        r = api.post(f"{BASE_URL}/api/swipe", json={
            "target_type": "worker", "target_id": target, "direction": "right"
        }, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["matched"] is True
        pytest.match_id_worker = data["match"]["id"]


# ---------------- Matches, Messages ----------------
class TestMatchesAndChat:
    def test_matches_list_contains_new(self, api):
        r = api.get(f"{BASE_URL}/api/matches", timeout=15)
        assert r.status_code == 200
        ms = r.json()
        assert isinstance(ms, list) and len(ms) >= 1
        ids = {m["id"] for m in ms}
        assert getattr(pytest, "match_id_job", None) in ids

    def test_get_messages_has_greeting(self, api):
        mid = pytest.match_id_job
        r = api.get(f"{BASE_URL}/api/matches/{mid}/messages", timeout=15)
        assert r.status_code == 200
        msgs = r.json()
        assert len(msgs) >= 1
        assert msgs[0]["sender"] == "other"
        assert msgs[0]["text"]

    def test_post_message_generates_auto_reply(self, api):
        mid = pytest.match_id_job
        r = api.post(f"{BASE_URL}/api/matches/{mid}/messages",
                     json={"text": "TEST_hello"}, timeout=15)
        assert r.status_code == 200
        msgs = r.json()
        senders = [m["sender"] for m in msgs[-2:]]
        assert senders == ["user", "other"]
        assert msgs[-2]["text"] == "TEST_hello"

    def test_complete_and_review(self, api):
        mid = pytest.match_id_worker
        r = api.post(f"{BASE_URL}/api/matches/{mid}/complete", timeout=15)
        assert r.status_code == 200 and r.json().get("ok") is True

        r = api.post(f"{BASE_URL}/api/matches/{mid}/review",
                     json={"rating": 5, "comment": "TEST_great worker"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True and data["review"]["rating"] == 5

        # Verify persistence via matches
        m = api.get(f"{BASE_URL}/api/matches/{mid}", timeout=15).json()
        assert m["reviewed"] is True and m["job_done"] is True

    def test_match_404(self, api):
        r = api.get(f"{BASE_URL}/api/matches/nope/messages", timeout=15)
        assert r.status_code == 404


# ---------------- Profile ----------------
class TestProfile:
    def test_upsert_and_get_profile(self, api):
        payload = {"name": "TEST_Tester", "category": "Kebersihan",
                   "experience_label": "1-2 tahun", "availability": "Harian",
                   "bio": "TEST_bio", "rate": "Rp 100rb/hari"}
        r = api.post(f"{BASE_URL}/api/profile", json=payload, timeout=15)
        assert r.status_code == 200
        saved = r.json()
        assert saved["name"] == payload["name"]

        g = api.get(f"{BASE_URL}/api/profile", timeout=15)
        assert g.status_code == 200
        assert g.json()["category"] == "Kebersihan"


# ---------------- Post a Job ----------------
class TestCreateJob:
    def test_create_job_persists(self, api):
        payload = {
            "business": "TEST_Warung",
            "title": "TEST_Kasir",
            "category": "Kasir",
            "pay_amount": 150000,
            "pay_unit": "/hari",
            "distance_km": 1.2,
            "job_type": "Harian",
            "min_experience_label": "Baru",
            "description": "TEST_desc",
        }
        r = api.post(f"{BASE_URL}/api/jobs", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        job = r.json()
        assert job["title"] == "TEST_Kasir"
        assert job["experience_bucket"] == "baru"
        # GET back
        g = api.get(f"{BASE_URL}/api/jobs/{job['id']}", timeout=15)
        assert g.status_code == 200
        assert g.json()["business"] == "TEST_Warung"
