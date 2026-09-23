import os
import redis
import logging
from rq import Worker, Queue
from dotenv import load_dotenv
import assemblyai as aai
import json

load_dotenv()
aai.settings.api_key = os.getenv("ASSEMBLYAI_API_KEY")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load Redis URL from .env or fallback to localhost
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_conn = redis.from_url(redis_url)

def start_transcription(job_id: str, audio_url: str, webhook_url: str):
    """
    Background job to upload the file and submit to AssemblyAI.
    """
    logger.info(f"[{job_id}] Starting transcription job in worker...")
    try:
        # Update status in Redis
        redis_conn.set(f"job:{job_id}:status", "processing")
        
        # Configure transcription options with Webhook
        config = aai.TranscriptionConfig(
            speaker_labels=True,
            language_detection=True,
            webhook_url=webhook_url
        )
        
        transcriber = aai.Transcriber(config=config)
        
        logger.info(f"[{job_id}] Submitting Cloudinary URL to AssemblyAI...")
        # .submit() takes the Cloudinary URL and starts transcription asynchronously
        transcript_submission = transcriber.submit(audio_url)
        
        # Store AssemblyAI internal ID and mapping for webhooks (expires in 24 hrs)
        assemblyai_id = transcript_submission.id
        redis_conn.set(f"job:{job_id}:assemblyai_id", assemblyai_id)
        redis_conn.setex(f"aai_map:{assemblyai_id}", 86400, job_id)
        
        logger.info(f"[{job_id}] Successfully submitted to AssemblyAI. ID: {assemblyai_id}")
        
    except Exception as e:
        logger.error(f"[{job_id}] Error submitting transcription: {e}")
        redis_conn.set(f"job:{job_id}:status", "error")
        redis_conn.set(f"job:{job_id}:result", json.dumps({"error": str(e)}))

from rq import Queue, SimpleWorker  # <-- Import SimpleWorker

if __name__ == '__main__':
    queues = [Queue('default', connection=redis_conn)]
    # Use SimpleWorker instead of Worker on Windows
    worker = SimpleWorker(queues, connection=redis_conn)
    logger.info("Starting RQ SimpleWorker (Windows compatible)...")
    worker.work()