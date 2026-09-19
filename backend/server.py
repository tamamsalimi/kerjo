from fastapi import FastAPI, APIRouter, Header, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import hashlib
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("kerjo")

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

EXP_BUCKET = {"Tidak wajib": "any", "Baru": "baru", "1-2 tahun": "1-2", "3-5 tahun": "3-5", "5+ tahun": "5+"}
JOB_EXP_BUCKET = {"Min. Tidak wajib": "any", "Min. Baru": "baru", "Min. 1 tahun": "1-2",
                  "Min. 2 tahun": "1-2", "Min. 3 tahun": "3-5", "Min. 5 tahun": "5+"}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def ensure_aware(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class SessionRequest(BaseModel):
    session_id: str


class SwipeRequest(BaseModel):
    target_type: str  # 'job' | 'worker'
    target_id: str
    direction: str  # 'right' | 'left'


class MessageRequest(BaseModel):
    text: str


class ReviewRequest(BaseModel):
    rating: int
    comment: str = ""


class ProfileRequest(BaseModel):
    name: str
    category: str
    experience_label: str = "Baru"
    availability: str = ""
    bio: str = ""
    rate: str = ""


class JobRequest(BaseModel):
    business: str
    title: str
    category: str
    pay_amount: int
    pay_unit: str = "/hari"
    distance_km: float = 2.0
    job_type: str = "Harian"
    min_experience_label: str = "Tidak wajib"
    description: str = ""


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
async def get_current_user(authorization: Optional[str]):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    if ensure_aware(session["expires_at"]) < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def user_has_profile(user_id: str) -> bool:
    return await db.profiles.find_one({"user_id": user_id}, {"_id": 0}) is not None


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/session")
async def create_session(payload: SessionRequest):
    async with httpx.AsyncClient(timeout=15) as hc:
        resp = await hc.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": payload.session_id})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = resp.json()
    email = data["email"]
    name = data.get("name", email.split("@")[0])
    picture = data.get("picture", "")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": name,
            "picture": picture, "created_at": now_utc(),
        })

    await db.user_sessions.insert_one({
        "session_token": session_token, "user_id": user_id,
        "created_at": now_utc(), "expires_at": now_utc() + timedelta(days=7),
    })

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    user["has_profile"] = await user_has_profile(user_id)
    return {"session_token": session_token, "user": user}


@api_router.get("/auth/me")
async def me(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    user["has_profile"] = await user_has_profile(user["user_id"])
    return user


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------
@api_router.get("/profile")
async def get_profile(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    return await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})


@api_router.post("/profile")
async def upsert_profile(payload: ProfileRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    doc = payload.dict()
    doc["user_id"] = user["user_id"]
    doc["updated_at"] = now_utc()
    await db.profiles.update_one({"user_id": user["user_id"]}, {"$set": doc}, upsert=True)
    return await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})


# ---------------------------------------------------------------------------
# Worker profile -> swipeable card
# ---------------------------------------------------------------------------
async def profile_to_card(p) -> dict:
    uid = p["user_id"]
    u = await db.users.find_one({"user_id": uid}, {"_id": 0})
    reviews = await db.reviews.find({"worker_id": "wp_" + uid}, {"_id": 0}).to_list(200)
    n = len(reviews)
    rating = round(sum(r["rating"] for r in reviews) / n, 1) if n else 0
    h = int(hashlib.md5(uid.encode()).hexdigest(), 16)
    dist = round(0.5 + (h % 60) / 10.0, 1)
    avatar = (u or {}).get("picture") or f"https://i.pravatar.cc/600?u={uid}"
    return {
        "id": "wp_" + uid,
        "name": p.get("name", "Pekerja"),
        "category": p.get("category", ""),
        "role": p.get("category", ""),
        "experience_label": p.get("experience_label", "Baru"),
        "experience_bucket": EXP_BUCKET.get(p.get("experience_label", "Baru"), "baru"),
        "distance_km": dist,
        "pay_amount": 0,
        "pay_unit": "",
        "pay_display": p.get("rate", ""),
        "rating": rating,
        "jobs_completed": n,
        "verified": True,
        "is_new": n == 0,
        "avatar": avatar,
        "bio": p.get("bio", ""),
        "availability": p.get("availability", ""),
        "owner_user_id": uid,
        "is_real": True,
    }


# ---------------------------------------------------------------------------
# Browse jobs / workers with filters
# ---------------------------------------------------------------------------
def matches_filters(item, category, job_type, max_distance, pay_bracket, experience):
    if category and category != "Semua" and item.get("category") != category:
        return False
    if job_type and job_type != "Semua" and item.get("job_type") != job_type:
        return False
    if max_distance and item.get("distance_km", 0) > float(max_distance):
        return False
    if experience and experience != "Semua" and item.get("experience_bucket") != experience:
        return False
    if pay_bracket and pay_bracket != "Semua":
        amt = item.get("pay_amount", 0)
        if pay_bracket == "<100" and not (amt < 100000):
            return False
        if pay_bracket == "100-500" and not (100000 <= amt < 500000):
            return False
        if pay_bracket == "500-2jt" and not (500000 <= amt < 2000000):
            return False
        if pay_bracket == ">2jt" and not (amt >= 2000000):
            return False
    return True


@api_router.get("/jobs")
async def list_jobs(authorization: Optional[str] = Header(None), category: str = "Semua",
                    job_type: str = "Semua", max_distance: float = 0, pay_bracket: str = "Semua",
                    experience: str = "Semua"):
    user = await get_current_user(authorization)
    uid = user["user_id"]
    swiped = await db.swipes.find({"swiper_user_id": uid, "target_type": "job"}, {"_id": 0, "target_id": 1}).to_list(2000)
    swiped_ids = {s["target_id"] for s in swiped}
    # seed jobs (owner None) + real jobs from OTHER users
    jobs = await db.jobs.find({"deleted_at": None}, {"_id": 0}).to_list(2000)
    result = [
        j for j in jobs
        if j["id"] not in swiped_ids
        and j.get("owner_user_id") != uid
        and matches_filters(j, category, job_type, max_distance, pay_bracket, experience)
    ]
    return result


@api_router.get("/workers")
async def list_workers(authorization: Optional[str] = Header(None), category: str = "Semua",
                       job_type: str = "Semua", max_distance: float = 0, pay_bracket: str = "Semua",
                       experience: str = "Semua"):
    user = await get_current_user(authorization)
    uid = user["user_id"]
    swiped = await db.swipes.find({"swiper_user_id": uid, "target_type": "worker"}, {"_id": 0, "target_id": 1}).to_list(2000)
    swiped_ids = {s["target_id"] for s in swiped}

    cards = await db.workers.find({"deleted_at": None}, {"_id": 0}).to_list(2000)  # seed bots
    # real worker profiles from OTHER users
    profiles = await db.profiles.find({"user_id": {"$ne": uid}}, {"_id": 0}).to_list(2000)
    for p in profiles:
        cards.append(await profile_to_card(p))

    result = [
        c for c in cards
        if c["id"] not in swiped_ids and matches_filters(c, category, job_type, max_distance, pay_bracket, experience)
    ]
    return result


@api_router.get("/workers/{worker_id}")
async def get_worker(worker_id: str, authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    if worker_id.startswith("wp_"):
        p = await db.profiles.find_one({"user_id": worker_id[3:]}, {"_id": 0})
        if not p:
            raise HTTPException(status_code=404, detail="Worker not found")
        card = await profile_to_card(p)
        card["reviews"] = await db.reviews.find({"worker_id": worker_id}, {"_id": 0}).to_list(200)
        return card
    w = await db.workers.find_one({"id": worker_id}, {"_id": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Worker not found")
    w["reviews"] = await db.reviews.find({"worker_id": worker_id}, {"_id": 0}).to_list(200)
    return w


@api_router.get("/jobs/{job_id}")
async def get_job(job_id: str, authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    j = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    return j


# ---------------------------------------------------------------------------
# Swipe + REAL two-sided match logic (+ bot matches for seed entities)
# ---------------------------------------------------------------------------
BOT_GREETING_WORKER = "Halo! Terima kasih sudah tertarik. Saya siap kerja dan bisa mulai secepatnya 🙏"
BOT_GREETING_JOB = "Halo! Terima kasih sudah apply. Boleh cerita sedikit pengalaman kamu?"
SYSTEM_MATCH_MSG = "Kalian cocok! 🎉 Mulai obrolan dan sepakati detail pekerjaannya."

AUTO_REPLIES = [
    "Siap, boleh! Kapan kira-kira bisa ketemu?",
    "Oke noted ya 🙏 Saya tunggu kabarnya.",
    "Bisa banget. Lokasinya di mana ya?",
    "Baik, terima kasih infonya!",
    "Wah cocok nih, lanjut ya 😊",
]


async def create_bot_match(uid, target_type, entity):
    existing = await db.matches.find_one(
        {"kind": "bot", "user_id": uid, "entity_type": target_type, "entity_id": entity["id"]}, {"_id": 0})
    if existing:
        return existing
    if target_type == "job":
        title, subtitle, image, greeting = entity["title"], entity["business"], "", BOT_GREETING_JOB
    else:
        title, subtitle, image, greeting = entity["name"], entity["role"], entity.get("avatar", ""), BOT_GREETING_WORKER
    mid = f"match_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": mid, "kind": "bot", "user_id": uid, "participants": [uid],
        "entity_type": target_type, "entity_id": entity["id"],
        "title": title, "subtitle": subtitle, "image": image,
        "category": entity.get("category", ""),
        "job_done": False, "reviewed": False, "created_at": now_utc(),
    }
    await db.matches.insert_one(doc.copy())
    await db.messages.insert_one({"match_id": mid, "sender": "bot", "text": greeting, "created_at": now_utc()})
    doc.pop("_id", None)
    return doc


async def create_real_match(worker_uid, employer_uid, job):
    existing = await db.matches.find_one(
        {"kind": "real", "worker_user_id": worker_uid, "employer_user_id": employer_uid, "job_id": job["id"]},
        {"_id": 0})
    if existing:
        return existing
    wp = await db.profiles.find_one({"user_id": worker_uid}, {"_id": 0})
    wcard = await profile_to_card(wp) if wp else {}
    worker_user = await db.users.find_one({"user_id": worker_uid}, {"_id": 0})
    mid = f"match_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": mid, "kind": "real", "participants": [worker_uid, employer_uid],
        "worker_user_id": worker_uid, "employer_user_id": employer_uid, "job_id": job["id"],
        "worker_name": (wp or {}).get("name") or (worker_user or {}).get("name", "Pekerja"),
        "worker_category": (wp or {}).get("category", ""),
        "worker_avatar": wcard.get("avatar", ""),
        "job_title": job["title"], "job_business": job["business"], "job_category": job.get("category", ""),
        "job_done": False, "reviewed_by": [], "created_at": now_utc(),
    }
    await db.matches.insert_one(doc.copy())
    await db.messages.insert_one({"match_id": mid, "sender": "system", "text": SYSTEM_MATCH_MSG, "created_at": now_utc()})
    doc.pop("_id", None)
    return doc


def display_for(m, uid):
    if m["kind"] == "bot":
        return {
            "id": m["id"], "kind": "bot", "entity_type": m["entity_type"],
            "title": m["title"], "subtitle": m["subtitle"], "image": m.get("image", ""),
            "category": m.get("category", ""),
            "job_done": m.get("job_done", False), "reviewed": m.get("reviewed", False),
            "created_at": m.get("created_at"),
        }
    # real
    if uid == m["worker_user_id"]:
        title, subtitle, image, ent = m["job_title"], m["job_business"], "", "job"
        category = m["job_category"]
    else:
        title, subtitle, image, ent = m["worker_name"], "Pelamar • " + m["worker_category"], m["worker_avatar"], "worker"
        category = m["worker_category"]
    return {
        "id": m["id"], "kind": "real", "entity_type": ent,
        "title": title, "subtitle": subtitle, "image": image, "category": category,
        "job_done": m.get("job_done", False),
        "reviewed": uid in m.get("reviewed_by", []),
        "created_at": m.get("created_at"),
    }


@api_router.post("/swipe")
async def swipe(payload: SwipeRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    uid = user["user_id"]

    await db.swipes.update_one(
        {"swiper_user_id": uid, "target_type": payload.target_type, "target_id": payload.target_id},
        {"$set": {"swiper_user_id": uid, "target_type": payload.target_type,
                  "target_id": payload.target_id, "direction": payload.direction, "created_at": now_utc()}},
        upsert=True,
    )

    if payload.direction != "right":
        return {"matched": False}

    # ------ worker swiping on a JOB ------
    if payload.target_type == "job":
        job = await db.jobs.find_one({"id": payload.target_id}, {"_id": 0})
        if not job:
            return {"matched": False}
        owner = job.get("owner_user_id")
        if not owner:  # seed bot job
            m = await create_bot_match(uid, "job", job)
            return {"matched": True, "match": display_for(m, uid)}
        # real job: match if employer already liked this worker's profile
        recip = await db.swipes.find_one({
            "swiper_user_id": owner, "target_type": "worker",
            "target_id": "wp_" + uid, "direction": "right"})
        if recip:
            m = await create_real_match(uid, owner, job)
            return {"matched": True, "match": display_for(m, uid)}
        return {"matched": False}

    # ------ employer swiping on a WORKER ------
    if payload.target_type == "worker":
        if not payload.target_id.startswith("wp_"):  # seed bot worker
            w = await db.workers.find_one({"id": payload.target_id}, {"_id": 0})
            if not w:
                return {"matched": False}
            m = await create_bot_match(uid, "worker", w)
            return {"matched": True, "match": display_for(m, uid)}
        # real worker: match if that worker already liked ANY job owned by me
        worker_uid = payload.target_id[3:]
        my_jobs = await db.jobs.find({"owner_user_id": uid, "deleted_at": None}, {"_id": 0}).to_list(500)
        my_job_ids = {j["id"]: j for j in my_jobs}
        if my_job_ids:
            liked = await db.swipes.find_one({
                "swiper_user_id": worker_uid, "target_type": "job",
                "target_id": {"$in": list(my_job_ids.keys())}, "direction": "right"})
            if liked:
                job = my_job_ids[liked["target_id"]]
                m = await create_real_match(worker_uid, uid, job)
                return {"matched": True, "match": display_for(m, uid)}
        return {"matched": False}

    return {"matched": False}


@api_router.get("/matches")
async def list_matches(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    uid = user["user_id"]
    raw = await db.matches.find({"participants": uid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    out = []
    for m in raw:
        d = display_for(m, uid)
        last = await db.messages.find({"match_id": m["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1)
        d["last_message"] = last[0]["text"] if last else ""
        out.append(d)
    return out


async def _match_for_user(match_id, uid):
    m = await db.matches.find_one({"id": match_id, "participants": uid}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    return m


@api_router.get("/matches/{match_id}")
async def get_match(match_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    m = await _match_for_user(match_id, user["user_id"])
    return display_for(m, user["user_id"])


@api_router.get("/matches/{match_id}/messages")
async def get_messages(match_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await _match_for_user(match_id, user["user_id"])
    return await db.messages.find({"match_id": match_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)


@api_router.post("/matches/{match_id}/messages")
async def send_message(match_id: str, payload: MessageRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    uid = user["user_id"]
    m = await _match_for_user(match_id, uid)
    await db.messages.insert_one({"match_id": match_id, "sender": uid, "text": payload.text, "created_at": now_utc()})
    # only seed/bot matches auto-reply; real matches are human-to-human
    if m["kind"] == "bot":
        count = await db.messages.count_documents({"match_id": match_id, "sender": uid})
        reply = AUTO_REPLIES[count % len(AUTO_REPLIES)]
        await db.messages.insert_one({"match_id": match_id, "sender": "bot", "text": reply, "created_at": now_utc()})
    return await db.messages.find({"match_id": match_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)


@api_router.post("/matches/{match_id}/complete")
async def complete_job(match_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await _match_for_user(match_id, user["user_id"])
    await db.matches.update_one({"id": match_id}, {"$set": {"job_done": True}})
    return {"ok": True}


@api_router.post("/matches/{match_id}/review")
async def review_match(match_id: str, payload: ReviewRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    uid = user["user_id"]
    m = await _match_for_user(match_id, uid)

    review = {
        "id": f"rev_{uuid.uuid4().hex[:10]}",
        "author": user.get("name", "Pengguna"),
        "rating": payload.rating,
        "comment": payload.comment,
        "date": now_utc().strftime("%b %Y"),
    }
    if m["kind"] == "bot":
        if m["entity_type"] == "worker":
            review["worker_id"] = m["entity_id"]
            await db.reviews.insert_one(review.copy())
        await db.matches.update_one({"id": match_id}, {"$set": {"reviewed": True, "job_done": True}})
    else:
        # real: attach review to the OTHER participant's worker profile (if they are the worker)
        target_worker = None
        if uid == m["employer_user_id"]:
            target_worker = m["worker_user_id"]
        if target_worker:
            review["worker_id"] = "wp_" + target_worker
            await db.reviews.insert_one(review.copy())
        await db.matches.update_one(
            {"id": match_id}, {"$set": {"job_done": True}, "$addToSet": {"reviewed_by": uid}})
    review.pop("_id", None)
    return {"ok": True, "review": review}


@api_router.post("/jobs")
async def create_job(payload: JobRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    label = payload.min_experience_label
    job = payload.dict()
    job["id"] = f"job_{uuid.uuid4().hex[:10]}"
    job["role"] = payload.title
    job["experience_bucket"] = EXP_BUCKET.get(label, "any")
    job["min_experience_label"] = f"Min. {label}"
    job["owner_user_id"] = user["user_id"]
    job["deleted_at"] = None
    job["created_at"] = now_utc()
    await db.jobs.insert_one(job.copy())
    job.pop("_id", None)
    return job


@api_router.get("/")
async def root():
    return {"message": "Kerjo API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware, allow_credentials=True, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Seed data (only when empty). First 10 workers + first 10 jobs.
# ---------------------------------------------------------------------------
def exp_bucket_from_years(years: int) -> str:
    if years <= 0:
        return "baru"
    if years <= 2:
        return "1-2"
    if years < 5:
        return "3-5"
    return "5+"


from seed_data import WORKERS, JOBS, REVIEW_POOL, REVIEW_AUTHORS


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.matches.create_index("participants")

    if await db.workers.count_documents({}) == 0:
        docs, review_docs = [], []
        for i, w in enumerate(WORKERS[:10]):
            w = dict(w)
            w["deleted_at"] = None
            w["experience_bucket"] = exp_bucket_from_years(w["experience_years"])
            docs.append(w)
            if w["verified"] and not w["is_new"]:
                n = 2 + (i % 2)
                for k in range(n):
                    idx = (i * 3 + k) % len(REVIEW_POOL)
                    aidx = (i * 2 + k) % len(REVIEW_AUTHORS)
                    r = min(5, max(4, round(w["rating"]) - (k % 2)))
                    review_docs.append({
                        "id": f"rev_seed_{i}_{k}", "worker_id": w["id"],
                        "author": REVIEW_AUTHORS[aidx], "rating": r,
                        "comment": REVIEW_POOL[idx], "date": "2024",
                    })
        await db.workers.insert_many(docs)
        if review_docs:
            await db.reviews.insert_many(review_docs)
        logger.info("Seeded %d workers, %d reviews", len(docs), len(review_docs))

    # seed jobs only if there are no seed (bot) jobs yet
    if await db.jobs.count_documents({"owner_user_id": None}) == 0:
        jdocs = []
        for j in JOBS[:10]:
            j = dict(j)
            j["deleted_at"] = None
            j["owner_user_id"] = None
            j["role"] = j["title"]
            j["experience_bucket"] = JOB_EXP_BUCKET.get(j["min_experience_label"], "any")
            jdocs.append(j)
        await db.jobs.insert_many(jdocs)
        logger.info("Seeded %d jobs", len(jdocs))


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
