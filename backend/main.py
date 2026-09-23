import os
import hashlib
import logging
import uuid
import json
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import redis
from rq import Queue
import assemblyai as aai

# Import our worker function
from worker import start_transcription

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

aai.settings.api_key = os.getenv("ASSEMBLYAI_API_KEY")

# Setup Redis connection and RQ Queue
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_conn = redis.from_url(redis_url)
task_queue = Queue('default', connection=redis_conn)

# Create an absolute uploads directory
UPLOAD_DIR = os.path.abspath("uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="Audio Transcription Tool API")

# Tighten CORS: Allow frontend dev server (both localhost and 127.0.0.1)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_AUDIO_TYPES = [
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/mp3",
    "audio/ogg",
    "audio/flac",
    "audio/aac",
    "audio/m4a",
    "video/mp4",
]
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    # 1. Validate file type
    if file.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}.")

    content = await file.read()
    
    # 2. Validate file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max size is 25MB.")

    # 3. Compute Hash (laying groundwork for Phase 3 caching)
    file_hash = hashlib.sha256(content).hexdigest()
    logger.info(f"File uploaded. Hash: {file_hash}")

    # Generate a unique job ID
    job_id = str(uuid.uuid4())
    
    # Save file with absolute path
    file_path = os.path.join(UPLOAD_DIR, f"{job_id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        buffer.write(content)
        
    # Get base URL from .env and build webhook target
    base_webhook = os.getenv("WEBHOOK_URL", "").rstrip("/")
    webhook_full_url = f"{base_webhook}/webhook" if base_webhook else ""
    if not webhook_full_url:
        logger.warning("WEBHOOK_URL is not set. AssemblyAI will not be able to callback.")

    # 4. Initialize job in Redis
    redis_conn.set(f"job:{job_id}:status", "queued")
    
    # 5. Enqueue the background job
    task_queue.enqueue(start_transcription, job_id, file_path, webhook_full_url)

    logger.info(f"[{job_id}] Job enqueued.")
    
    return {"job_id": job_id, "status": "queued"}

@app.get("/transcribe/{job_id}")
async def get_job_status(job_id: str):
    """
    Endpoint for frontend to poll job status.
    """
    status_bytes = redis_conn.get(f"job:{job_id}:status")
    if not status_bytes:
        raise HTTPException(status_code=404, detail="Job not found")
        
    status = status_bytes.decode('utf-8')
    
    response = {"job_id": job_id, "status": status}
    
    if status == "completed":
        result_bytes = redis_conn.get(f"job:{job_id}:result")
        if result_bytes:
            response["transcript"] = json.loads(result_bytes.decode('utf-8'))
    elif status == "error":
        result_bytes = redis_conn.get(f"job:{job_id}:result")
        if result_bytes:
            response["error"] = json.loads(result_bytes.decode('utf-8'))
            
    return response

@app.post("/webhook")
async def assemblyai_webhook(request: Request):
    """
    Webhook receiver for AssemblyAI.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or empty JSON body")

    logger.info(f"Webhook received: {payload}")
    
    # The payload usually contains a transcript_id, status, etc.
    # Wait, the problem is AssemblyAI doesn't send our custom job_id back by default, 
    # unless we pass it in metadata or something.
    # Actually, we can look up our internal job_id using the AssemblyAI transcript ID
    # if we mapped it in Redis.
    transcript_id = payload.get("transcript_id")
    if not transcript_id:
        return {"status": "ignored"}
        
    status = payload.get("status")
    
    # Find our job_id from the assemblyai_id
    # We can scan redis or maintain a reverse mapping.
    # To keep it simple, let's just find the job_id by scanning keys, or better, 
    # the worker can set an assemblyai_id -> job_id mapping.
    job_id_bytes = redis_conn.get(f"aai_map:{transcript_id}")
    
    if not job_id_bytes:
        logger.warning(f"Received webhook for unknown transcript ID: {transcript_id}. Fallback scanning...")
        # Fallback if mapping wasn't fast enough
        job_id = None
        for key in redis_conn.scan_iter("job:*:assemblyai_id"):
            if redis_conn.get(key).decode('utf-8') == transcript_id:
                job_id = key.decode('utf-8').split(":")[1]
                break
        if not job_id:
            return {"status": "unknown_job"}
    else:
        job_id = job_id_bytes.decode('utf-8')

    logger.info(f"[{job_id}] Webhook update: status={status}")

    if status == "completed":
        # Fetch the full transcript from AssemblyAI
        try:
            transcript = aai.Transcript.get_by_id(transcript_id)
            redis_conn.set(f"job:{job_id}:result", json.dumps(transcript.json_response))
            redis_conn.set(f"job:{job_id}:status", "completed")
            logger.info(f"[{job_id}] Marked as completed via webhook.")
        except Exception as e:
            logger.error(f"[{job_id}] Error fetching completed transcript: {e}")
            redis_conn.set(f"job:{job_id}:status", "error")
            redis_conn.set(f"job:{job_id}:result", json.dumps({"error": str(e)}))
            
    elif status == "error":
        error_msg = payload.get("error", "Unknown AssemblyAI error")
        redis_conn.set(f"job:{job_id}:status", "error")
        redis_conn.set(f"job:{job_id}:result", json.dumps({"error": error_msg}))
        logger.error(f"[{job_id}] Marked as error via webhook.")
        
    return {"status": "ok"}
