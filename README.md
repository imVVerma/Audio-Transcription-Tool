# Audio Transcription Tool - Phase 1 (Foundation)

This is Phase 1 of the Audio Transcription Tool project. It implements a basic, synchronous, end-to-end transcription loop using AssemblyAI as the STT provider.

## Constraints & Considerations for Phase 1
- **Synchronous**: The file is uploaded to AssemblyAI, and the server waits for the transcription to complete before returning the result. This is only meant for testing the core STT loop. Do not upload huge files yet!
- **No Persistence**: The transcript is only returned to the frontend. It is not saved in a database yet.
- **Provider Limits**: AssemblyAI's free tier allows for a certain number of transcription hours per month (typically ~10 hours).
- **File Limits**: We enforce a 25MB file size limit and allow only audio/mp4 formats to keep things manageable.

## Prerequisites

- Python 3.10+
- Node.js 18+
- An AssemblyAI API Key

## Setup & Running

### 1. Environment Variables
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Open `.env` and paste your actual AssemblyAI API key.

### 2. Backend (FastAPI)
Navigate to the `backend` directory and install dependencies:
```bash
cd backend
pip install -r requirements.txt
```

Run the FastAPI dev server:
```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend (React + Vite)
In a new terminal window, navigate to the `frontend` directory, install dependencies, and run the Vite dev server:
```bash
cd frontend
npm install
npm run dev
```

### 4. Usage
Open the local URL provided by Vite (e.g., `http://localhost:5173`).
Select an audio file and click "Upload and Transcribe". Wait for the JSON transcript to appear.
