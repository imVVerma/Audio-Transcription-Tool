# StudioScribe Archaeology Report

This document contains a detailed investigation of the Audio Transcription Tool (StudioScribe) repository.

## Answers to Investigation Questions

**1. What is this project?**
An AI-powered audio transcription web application called "StudioScribe" that takes audio files and generates transcriptions featuring speaker labels and timestamps.

**2. What problem was it intended to solve?**
It provides a user-friendly frontend (featuring an interactive waveform player) to upload audio and receive structured transcripts. It offloads heavy transcription processing to a third-party AI provider (AssemblyAI) and manages long-running tasks asynchronously.

**3. What evidence in the code supports that interpretation?**
- `frontend/src/App.jsx` defines the UI title "StudioScribe" and the subtitle "AI-Powered Transcription".
- `frontend/src/components/TranscriptViewer.jsx` parses and displays utterances with speaker labels and timestamps.
- The backend (`main.py` and `worker.py`) handles audio uploads, submits them to AssemblyAI, and manages a background job queue using Redis and RQ.

**4. What are the main technologies used?**
- **Backend:** Python, FastAPI, RQ (Redis Queue), Redis.
- **Frontend:** React (Vite), Framer Motion, WaveSurfer.js.
- **External APIs:** AssemblyAI (transcription API), Cloudinary (temporary file storage).

**5. What is the architecture?**
It is a client-server architecture with asynchronous background processing. 
- The React frontend sends audio files to the FastAPI backend.
- The backend uploads the file to Cloudinary, enqueues a background transcription task in Redis via RQ, and returns a Job ID.
- The RQ worker submits the Cloudinary URL to AssemblyAI along with a webhook URL.
- AssemblyAI processes the audio and POSTs to the backend webhook.
- The backend updates the Redis job status and stores the final transcript.
- The frontend polls the backend for job status and displays the result when ready.

**6. What are the major components?**
- **Frontend App (`frontend/`):** A Vite + React app with components like `App.jsx`, `UploadZone.jsx`, `WaveformPlayer.jsx`, `StatusTracker.jsx`, and `TranscriptViewer.jsx`.
- **Backend API (`backend/main.py`):** A FastAPI server handling uploads, polling endpoints, and AssemblyAI webhook processing.
- **Background Worker (`backend/worker.py`):** An RQ worker script that submits tasks to AssemblyAI.
- **Redis (`docker-compose.yml`):** Used as the message broker for RQ and for temporarily storing job states and transcripts.

**7. What is the data flow?**
1. User selects an audio file in the browser -> Frontend uploads to `/transcribe`.
2. Backend uploads file to Cloudinary -> Cloudinary returns a secure, public URL.
3. Backend enqueues an RQ job with the Cloudinary URL and Webhook URL -> Returns a Job ID to Frontend.
4. Frontend starts polling `/transcribe/{job_id}`.
5. Background Worker picks up the job -> Submits Cloudinary URL to AssemblyAI.
6. AssemblyAI processes the transcription asynchronously.
7. AssemblyAI POSTs transcript ID and status to `/webhook` on the Backend.
8. Backend fetches the full JSON transcript from AssemblyAI -> Saves it to Redis.
9. Frontend polls and receives the completed transcript -> Renders it in the UI.

**8. What can the current implementation actually do?**
*(Confirmed from code)* It can upload audio/video files (up to 25MB) to Cloudinary, queue a job, submit it to AssemblyAI, process webhooks, poll for completion, and display the transcript using a waveform player with color-coded speaker labels and clickable timestamps. It also has basic deduplication caching (by file hash) so the same file doesn't get transcribed twice within 30 days.

**9. What appears unfinished?**
*(Confirmed from code / Strongly inferred)*
- The README explicitly says "Phase 1 (Foundation)" and "No Persistence", meaning transcripts aren't saved in a permanent database, just Redis.
- The README states the architecture is "Synchronous" and "waits for the transcription to complete." This is drastically outdated, as the actual code uses RQ, Redis, Webhooks, and polling.
- The deduplication cache logic uses a 30-day expiry, but the transcript is stored without a defined expiry for the result itself.
- Cloudinary API keys are hardcoded in `main.py` as default fallback values.

**10. What appears broken?**
*(Strongly inferred)*
- The webhook logic inherently depends on a public URL (`WEBHOOK_URL`). If you run this purely on `localhost` without a tunnel (like ngrok), AssemblyAI will never be able to reach the webhook, and the frontend will poll forever.

**11. What appears to be experimental/prototype code?**
*(Strongly inferred)*
- Hardcoded Cloudinary credentials in `main.py`.
- Using Redis for both the job queue and storing the final large JSON transcripts.
- The deduplication hash mapping logic in the webhook (`redis_conn.setex(f"hash:{file_hash}", 2592000, job_id)`) feels slightly tacked-on.
- Frontend polling every 3 seconds instead of using WebSockets.

**12. What external APIs/services does it depend on?**
- **AssemblyAI:** For Speech-to-Text.
- **Cloudinary:** For hosting audio files securely so AssemblyAI can access them.
- A **webhook tunnel service** (like ngrok) if running locally.

**13. What configuration or environment variables does it require?**
- `ASSEMBLYAI_API_KEY`
- `REDIS_URL`
- `WEBHOOK_URL`
- (Optional but used via fallbacks) `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

**14. How would I run it locally?**
1. Start Redis using Docker: `docker-compose up -d`.
2. Start ngrok on port 8000 to get a public URL for the webhook (e.g., `ngrok http 8000`).
3. Update `.env` with `ASSEMBLYAI_API_KEY` and the ngrok `WEBHOOK_URL`.
4. In the `backend` folder, run `pip install -r requirements.txt` and start the server: `uvicorn main:app --reload --port 8000`.
5. In another terminal, navigate to `backend` and run the worker: `python worker.py`.
6. In the `frontend` folder, run `npm install` and `npm run dev`.
7. Open the local Vite URL (`http://localhost:5173`).

**15. What would I see if it runs successfully?**
A sleek web UI titled "StudioScribe". You would upload an audio file, see a status tracker while it processes (uploading -> processing). Once completed, you would see a waveform player for the audio and a synchronized transcript viewer with color-coded speaker labels and clickable timestamps to seek through the audio.

**16. What are the most important files and what does each do?**
- `backend/main.py`: The FastAPI server. Handles uploads, Cloudinary integration, queueing, and webhook receiving.
- `backend/worker.py`: The background processor. Submits tasks to AssemblyAI.
- `frontend/src/App.jsx`: The main React component orchestrating state, file uploads, and polling.
- `frontend/src/components/TranscriptViewer.jsx`: Renders the AI-generated transcript with speaker diarization.
- `docker-compose.yml`: Provisions the Redis instance required for the backend queue and state.

**17. Is there evidence of the original motivation or design decisions?**
Yes. The README mentions "Phase 1 (Foundation)" and "testing the core STT loop". Comments in `main.py` explicitly mention "laying groundwork for Phase 3 caching". This suggests an iterative design aiming towards a much more complex system. Furthermore, the massive shift from a synchronous loop (described in README) to a complex asynchronous queue with Cloudinary and webhooks shows a pivot halfway through development to handle long-running AssemblyAI tasks more robustly.

**18. What technical concepts was I probably trying to learn?**
- Asynchronous task queues (Redis + RQ in Python).
- Webhook handling for long-running third-party API tasks.
- Frontend HTTP polling logic.
- Audio visualization (WaveSurfer.js).
- Cloud storage integration (Cloudinary).

**19. What would be required to turn this into a clean, presentable project?**
- Remove hardcoded API keys from `main.py`.
- Add a real persistent database (PostgreSQL/MongoDB) instead of just Redis.
- Update the README to accurately reflect the asynchronous architecture.
- Add user authentication to manage personal transcripts.
- Replace frontend HTTP polling with WebSockets or Server-Sent Events (SSE).
- Ensure Cloudinary files are deleted after successful transcription to save space.

**20. What would you recommend I do with it:**
- **Finish / Extract an idea:** It's an incredibly solid foundation. The most valuable asset here is the async workflow (Cloudinary -> RQ -> AssemblyAI -> Webhook -> React). Extracting this specific asynchronous architecture pattern could be extremely useful for other AI-based web apps. Alternatively, you can finish it by hooking up a real database and authentication.

---

## Final Deliverables

### A. 5-Sentence Explanation
This project, named StudioScribe, is an AI-powered audio transcription web application. It allows users to upload audio files up to 25MB, which are then processed in the background to generate highly accurate transcripts with speaker labels. The backend uses FastAPI, Redis, and RQ to manage the asynchronous workload and webhook callbacks. Audio transcription is offloaded to AssemblyAI, and temporary file hosting is handled by Cloudinary. The frontend is built with React and features a dynamic waveform player that syncs with the generated transcript text.

### B. Suggested GitHub README Structure
1. **Title and Tagline** (StudioScribe: AI-Powered Transcription)
2. **Features** (Async transcription, Speaker Diarization, Interactive Waveform player)
3. **Architecture Diagram / Explanation** (React -> FastAPI -> Redis/RQ -> AssemblyAI -> Webhooks)
4. **Prerequisites** (Python, Node, Redis, ngrok)
5. **Environment Setup** (.env variables)
6. **Local Development Instructions** (Running Redis, Backend, Worker, Frontend, and Ngrok)
7. **Future Work / Roadmap** (Adding Database, Auth, WebSockets)

### C. 5 Most Important Concepts to Understand Before Claiming
1. How **RQ (Redis Queue)** and background workers operate in Python to avoid blocking the main API thread.
2. The concept of **Webhooks** and why they are strictly necessary for long-running third-party API processes like AssemblyAI.
3. How to expose a local server to the public internet using a tool like **ngrok** to receive webhook callbacks.
4. The basics of **React state management** and `useEffect` for HTTP polling an API endpoint.
5. Why **Cloudinary** is used (AssemblyAI needs a publicly accessible URL to download and process the audio file).

### D. Unanswered Questions
- Why are Cloudinary API keys hardcoded in `main.py` with fallback default values? Were they test keys that should have been revoked?
- Why does the README claim the tool is "Synchronous" when the code clearly implements background workers, webhooks, and polling?
- What was the intended plan for "Phase 2" and "Phase 3" since the code mentions "laying groundwork for Phase 3 caching"?
- Are there any automated cleanup jobs to remove temporary audio files from Cloudinary after transcription is complete?
