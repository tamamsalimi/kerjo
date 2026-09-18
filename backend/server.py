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


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


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
    p = await db.profiles.find_one({"user_id": user_id}, {"_id": 0})
    return p is not None


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
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": now_utc(),
        })

    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(days=7),
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
    p = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return p


@api_router.post("/profile")
async def upsert_profile(payload: ProfileRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    doc = payload.dict()
    doc["user_id"] = user["user_id"]
    doc["updated_at"] = now_utc()
    await db.profiles.update_one({"user_id": user["user_id"]}, {"$set": doc}, upsert=True)
    saved = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return saved


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
    swiped = await db.swipes.find({"user_id": user["user_id"], "target_type": "job"}, {"_id": 0, "target_id": 1}).to_list(1000)
    swiped_ids = {s["target_id"] for s in swiped}
    jobs = await db.jobs.find({"deleted_at": None}, {"_id": 0}).to_list(1000)
    result = [j for j in jobs if j["id"] not in swiped_ids and matches_filters(j, category, job_type, max_distance, pay_bracket, experience)]
    return result


@api_router.get("/workers")
async def list_workers(authorization: Optional[str] = Header(None), category: str = "Semua",
                       job_type: str = "Semua", max_distance: float = 0, pay_bracket: str = "Semua",
                       experience: str = "Semua"):
    user = await get_current_user(authorization)
    swiped = await db.swipes.find({"user_id": user["user_id"], "target_type": "worker"}, {"_id": 0, "target_id": 1}).to_list(1000)
    swiped_ids = {s["target_id"] for s in swiped}
    workers = await db.workers.find({"deleted_at": None}, {"_id": 0}).to_list(1000)
    result = [w for w in workers if w["id"] not in swiped_ids and matches_filters(w, category, job_type, max_distance, pay_bracket, experience)]
    return result


@api_router.get("/workers/{worker_id}")
async def get_worker(worker_id: str, authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    w = await db.workers.find_one({"id": worker_id}, {"_id": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Worker not found")
    reviews = await db.reviews.find({"worker_id": worker_id}, {"_id": 0}).to_list(100)
    w["reviews"] = reviews
    return w


@api_router.get("/jobs/{job_id}")
async def get_job(job_id: str, authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    j = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    return j


# ---------------------------------------------------------------------------
# Swipe + match logic
# ---------------------------------------------------------------------------
def is_mutual(target_id: str) -> bool:
    h = int(hashlib.md5(target_id.encode()).hexdigest(), 16)
    return (h % 100) < 65


GREETINGS_WORKER = "Halo! Terima kasih sudah tertarik. Saya siap kerja dan bisa mulai secepatnya 🙏"
GREETINGS_JOB = "Halo! Terima kasih sudah apply. Boleh cerita sedikit pengalaman kamu?"


@api_router.post("/swipe")
async def swipe(payload: SwipeRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await db.swipes.insert_one({
        "user_id": user["user_id"],
        "target_type": payload.target_type,
        "target_id": payload.target_id,
        "direction": payload.direction,
        "created_at": now_utc(),
    })

    if payload.direction != "right":
        return {"matched": False}

    if not is_mutual(payload.target_id):
        return {"matched": False}

    coll = db.jobs if payload.target_type == "job" else db.workers
    entity = await coll.find_one({"id": payload.target_id}, {"_id": 0})
    if not entity:
        return {"matched": False}

    existing = await db.matches.find_one(
        {"user_id": user["user_id"], "entity_type": payload.target_type, "entity_id": payload.target_id},
        {"_id": 0},
    )
    if existing:
        return {"matched": True, "match": existing}

    if payload.target_type == "job":
        title = entity["title"]
        subtitle = entity["business"]
        image = ""
        greeting = GREETINGS_JOB
    else:
        title = entity["name"]
        subtitle = entity["role"]
        image = entity.get("avatar", "")
        greeting = GREETINGS_WORKER

    match_id = f"match_{uuid.uuid4().hex[:12]}"
    match_doc = {
        "id": match_id,
        "user_id": user["user_id"],
        "entity_type": payload.target_type,
        "entity_id": payload.target_id,
        "title": title,
        "subtitle": subtitle,
        "image": image,
        "category": entity.get("category", ""),
        "job_done": False,
        "reviewed": False,
        "created_at": now_utc(),
    }
    await db.matches.insert_one(match_doc.copy())
    await db.messages.insert_one({
        "match_id": match_id,
        "sender": "other",
        "text": greeting,
        "created_at": now_utc(),
    })
    match_doc.pop("_id", None)
    return {"matched": True, "match": match_doc}


AUTO_REPLIES = [
    "Siap, boleh! Kapan kira-kira bisa ketemu?",
    "Oke noted ya 🙏 Saya tunggu kabarnya.",
    "Bisa banget. Lokasinya di mana ya?",
    "Baik, terima kasih infonya!",
    "Wah cocok nih, lanjut ya 😊",
]


@api_router.get("/matches")
async def list_matches(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    matches = await db.matches.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for m in matches:
        last = await db.messages.find({"match_id": m["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1)
        m["last_message"] = last[0]["text"] if last else ""
    return matches


@api_router.get("/matches/{match_id}")
async def get_match(match_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    m = await db.matches.find_one({"id": match_id, "user_id": user["user_id"]}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    return m


@api_router.get("/matches/{match_id}/messages")
async def get_messages(match_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    m = await db.matches.find_one({"id": match_id, "user_id": user["user_id"]}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    msgs = await db.messages.find({"match_id": match_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return msgs


@api_router.post("/matches/{match_id}/messages")
async def send_message(match_id: str, payload: MessageRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    m = await db.matches.find_one({"id": match_id, "user_id": user["user_id"]}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    await db.messages.insert_one({
        "match_id": match_id,
        "sender": "user",
        "text": payload.text,
        "created_at": now_utc(),
    })
    count = await db.messages.count_documents({"match_id": match_id, "sender": "user"})
    reply = AUTO_REPLIES[count % len(AUTO_REPLIES)]
    await db.messages.insert_one({
        "match_id": match_id,
        "sender": "other",
        "text": reply,
        "created_at": now_utc(),
    })
    msgs = await db.messages.find({"match_id": match_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return msgs


@api_router.post("/matches/{match_id}/complete")
async def complete_job(match_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    m = await db.matches.find_one({"id": match_id, "user_id": user["user_id"]}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    await db.matches.update_one({"id": match_id}, {"$set": {"job_done": True}})
    return {"ok": True}


@api_router.post("/matches/{match_id}/review")
async def review_match(match_id: str, payload: ReviewRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    m = await db.matches.find_one({"id": match_id, "user_id": user["user_id"]}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    review = {
        "id": f"rev_{uuid.uuid4().hex[:10]}",
        "author": user.get("name", "Pengguna"),
        "rating": payload.rating,
        "comment": payload.comment,
        "date": now_utc().strftime("%b %Y"),
    }
    if m["entity_type"] == "worker":
        review["worker_id"] = m["entity_id"]
        await db.reviews.insert_one(review.copy())
    await db.matches.update_one({"id": match_id}, {"$set": {"reviewed": True, "job_done": True}})
    review.pop("_id", None)
    return {"ok": True, "review": review}


@api_router.post("/jobs")
async def create_job(payload: JobRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    exp_map = {"Tidak wajib": "any", "Baru": "baru", "1-2 tahun": "1-2", "3-5 tahun": "3-5", "5+ tahun": "5+"}
    job = payload.dict()
    label = payload.min_experience_label
    job["id"] = f"job_{uuid.uuid4().hex[:10]}"
    job["role"] = payload.title
    job["experience_bucket"] = exp_map.get(label, "any")
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
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Seed data
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

    if await db.workers.count_documents({}) == 0:
        docs = []
        review_docs = []
        for i, w in enumerate(WORKERS):
            w = dict(w)
            w["deleted_at"] = None
            w["experience_bucket"] = exp_bucket_from_years(w["experience_years"])
            docs.append(w)
            if w["verified"] and not w["is_new"]:
                n = 2 + (i % 2)
                base = w["rating"]
                for k in range(n):
                    idx = (i * 3 + k) % len(REVIEW_POOL)
                    aidx = (i * 2 + k) % len(REVIEW_AUTHORS)
                    r = min(5, max(4, round(base) - (k % 2)))
                    review_docs.append({
                        "id": f"rev_seed_{i}_{k}",
                        "worker_id": w["id"],
                        "author": REVIEW_AUTHORS[aidx],
                        "rating": r,
                        "comment": REVIEW_POOL[idx],
                        "date": "2024",
                    })
        await db.workers.insert_many(docs)
        if review_docs:
            await db.reviews.insert_many(review_docs)
        logger.info("Seeded %d workers, %d reviews", len(docs), len(review_docs))

    if await db.jobs.count_documents({}) == 0:
        jdocs = []
        exp_map = {"Min. Tidak wajib": "any", "Min. Baru": "baru", "Min. 1 tahun": "1-2",
                   "Min. 2 tahun": "1-2", "Min. 3 tahun": "3-5", "Min. 5 tahun": "5+"}
        for j in JOBS:
            j = dict(j)
            j["deleted_at"] = None
            j["owner_user_id"] = None
            j["role"] = j["title"]
            j["experience_bucket"] = exp_map.get(j["min_experience_label"], "any")
            jdocs.append(j)
        await db.jobs.insert_many(jdocs)
        logger.info("Seeded %d jobs", len(jdocs))


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
