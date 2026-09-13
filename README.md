# PSI — Pan Science Innovation: AI Document & Multimedia Q&A

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg?style=flat&logo=react)](https://reactjs.org)
[![LangChain](https://img.shields.io/badge/LangChain-Enabled-1C3C3C.svg?style=flat)](https://python.langchain.com)
[![FAISS](https://img.shields.io/badge/Vector_Search-FAISS-00599C.svg?style=flat)](https://github.com/facebookresearch/faiss)
[![Redis](https://img.shields.io/badge/Cache-Redis_&_InMemory-DC382D.svg?style=flat&logo=redis)](https://redis.io)
[![Test Coverage](https://img.shields.io/badge/Coverage-95.4%25-brightgreen.svg?style=flat)](https://pytest.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg?style=flat&logo=docker)](https://docker.com)
[![CI/CD](https://img.shields.io/badge/GitHub_Actions-Automated_CI-2088FF.svg?style=flat&logo=githubactions)](https://github.com/features/actions)

**PSI (Pan Science Innovation)** is an AI-powered document and multimedia intelligence platform. It enables users to upload **PDF documents, audio, and video recordings**, ask questions via real-time conversational streaming, extract structured **executive summaries**, and seamlessly navigate **topic chapters** with synchronized video/audio playback that seeks to exact cited timestamps.

Repository: **[https://github.com/himgaur2004/AI-Multimedia--PSI.git](https://github.com/himgaur2004/AI-Multimedia--PSI.git)**

---

## 🏛️ Architecture & System Topology

```
                                  Client Browser
                                        │
                         ┌──────────────┴──────────────┐
                         │  HTTPS (Port 3000 / 80 / 443)│
                         ▼                             ▼
              ┌─────────────────────┐       ┌──────────────────────┐
              │  Local Docker Stack │       │ Cloud (Vercel Edge)  │
              │  (Nginx Reverse     │       │ React 18 + Vite SPA  │
              │   Proxy Container)  │       │ Global CDN & Cache   │
              └──────────┬──────────┘       └──────────┬───────────┘
                         │                             │
                         │ Reverse Proxy               │ VITE_API_URL
                         ▼                             ▼
              ┌────────────────────────────────────────────────────┐
              │           PSI FastAPI Backend Service              │
              │             (Docker / Railway App)                 │
              ├──────────────────────────┬─────────────────────────┤
              │ API & Security Layer     │ Core Infrastructure     │
              │  - JWT & Guest Auth      │  - Pydantic Settings    │
              │  - Sliding Rate Limiting │  - Database Connection  │
              │  - RFC 7233 Range Stream │  - Redis Cache / Fallback│
              │  - Security Headers      │  - Thread-Safe Context  │
              ├──────────────────────────┴─────────────────────────┤
              │ AI & Vector Engines                                │
              │  - PDF Text & Page Semantic Chunker                │
              │  - Whisper Speech-to-Text with Word Timestamps     │
              │  - FAISS Vector Similarity & Semantic Retrieval    │
              │  - LangChain RAG & Grounded Citation Generator     │
              │  - SSE Real-time Token Streaming Synthesizer       │
              └──────────────────────────┬─────────────────────────┘
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
              ┌─────────────────────┐         ┌────────────────────┐
              │ MongoDB / SQLite    │         │    Redis Cache     │
              │ Document & Metadata │         │ Rate Limit & RAG   │
              └─────────────────────┘         └────────────────────┘
```

---

## 🐳 Dockerization & Container Stack

PSI is containerized with multi-stage Dockerfiles and orchestrated using Docker Compose.

### Docker Services Overview

| Service | Container Name | Base Image | Internal Port | Exposed Port | Purpose |
|---|---|---|---|---|---|
| **frontend** | `psi-frontend` | `node:20-alpine` → `nginx:alpine` | `80` | `3000` | High-performance Nginx web server, static asset cache, client-side SPA router, and reverse proxy for `/api/` |
| **backend** | `psi-backend` | `python:3.10-slim` | `8000` | `8000` | FastAPI ASGI backend with FFmpeg runtime, FAISS vector search, Whisper transcription, and MongoDB connector |
| **mongodb** | `psi-mongodb` | `mongo:7-jammy` | `27017` | `27017` | Persistent NoSQL database for multi-user accounts, uploaded document metadata, transcripts, and chat history |

### Quick Start with Docker (Recommended)

```bash
# 1. Clone repository
git clone https://github.com/himgaur2004/AI-Multimedia--PSI.git
cd AI-Multimedia--PSI

# 2. Build and launch the container stack
docker compose up --build -d

# 3. Verify containers are healthy
docker compose ps
```

Once running:
- **Frontend Dashboard**: Open [http://localhost:3000](http://localhost:3000) in your browser
- **Backend API Documentation (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Healthcheck Endpoint**: [http://localhost:8000/health](http://localhost:8000/health)

To stop the containers:
```bash
docker compose down
```

To view live container logs:
```bash
docker compose logs -f
```

---

## ✨ Features Checklist (SDE-1 Assignment Alignment)

| Requirement | Implementation Details | Status |
| :--- | :--- | :---: |
| **Vector Search (FAISS)** | High-performance semantic vector index with cosine similarity, L2 distance, and chunk metadata | ✅ Complete |
| **Real-time Chat Streaming** | Server-Sent Events (SSE) streaming tokens word-by-word with typing cursor and source citations | ✅ Complete |
| **Multi-User Auth** | PBKDF2-HMAC-SHA256 password hashing, JWT Bearer tokens, instant guest mode (`/auth/guest`) | ✅ Complete |
| **Rate Limiting & Caching** | Distributed Redis caching with automatic in-memory fallback and sliding-window rate limiting | ✅ Complete |
| **Database (MongoDB / SQLite)**| Full MongoDB NoSQL support with PyMongo driver, indexing, and automatic local fallback | ✅ Complete |
| **PDF & Multimedia Upload** | Supports `.pdf`, `.mp3`, `.wav`, `.m4a`, `.mp4`, `.webm`, `.mov` with format validation & size guards | ✅ Complete |
| **Speech Transcription (ASR)** | Whisper transcription engine with timestamp alignment (`start`, `end`, `text`) | ✅ Complete |
| **Interactive Video Seeking** | Clickable `[MM:SS]` timestamp badges that jump media player directly to cited audio/video seconds | ✅ Complete |
| **HTTP Byte-Range Streaming** | RFC 7233 Partial Content (HTTP 206) media streaming for instantaneous audio/video playback | ✅ Complete |
| **Executive Summarization** | Structured summaries, bullet points, key takeaways, and word counters | ✅ Complete |
| **Automated Testing (95%+)** | 83 automated Pytest unit/integration tests with **95.26% test coverage** enforced via `pytest.ini` | ✅ Complete |
| **Production Dockerization** | Multi-stage Dockerfiles, Docker Compose, Nginx reverse proxy, and non-root security containers | ✅ Complete |
| **CI/CD Pipeline** | GitHub Actions workflow executing backend tests, frontend builds, and Docker validation on push | ✅ Complete |

---

## ☁️ Cloud Deployment (Railway + Vercel)

### 1. Database on Railway (MongoDB)
1. Open [Railway.app](https://railway.app/) and create a project.
2. Click **+ New** → **Database** → **Add MongoDB** (or use [MongoDB Atlas](https://www.mongodb.com/atlas)).
3. Railway generates a connection string available as `${{MongoDB.MONGO_URL}}` (e.g. `mongodb://mongo:password@host:port`).
4. *(Optional)* Click **+ New** → **Database** → **Add Redis** for caching and rate-limiting.

### 2. Backend on Railway
1. Click **+ New** → **GitHub Repo** → select `himgaur2004/AI-Multimedia--PSI`.
2. Set the **Root Directory** to `/backend`. Railway automatically detects `backend/railway.json` and builds the Dockerfile.
3. Configure environment variables under **Variables**:
   - `MONGODB_URL`: `${{MongoDB.MONGO_URL}}` (or your MongoDB Atlas connection string)
   - `SECRET_KEY`: `<your-secure-secret-key>`
   - `OPENAI_API_KEY`: `sk-...` *(optional, for GPT-4 LLM answers)*
   - `CORS_ORIGINS`: `["https://<your-app>.vercel.app","http://localhost:3000"]`
   - `REDIS_URL`: `${{Redis.REDIS_URL}}` *(optional)*
4. Under **Settings** → **Networking**, click **Generate Domain** (e.g. `https://psi-backend.up.railway.app`).

### 3. Frontend on Vercel
1. Open [Vercel.com](https://vercel.com/) and click **Add New** → **Project**.
2. Import `himgaur2004/AI-Multimedia--PSI`.
3. Set **Root Directory** to `frontend`.
4. Add environment variable:
   - `VITE_API_URL`: `https://psi-backend.up.railway.app` *(Railway backend URL)*
5. Click **Deploy**. Vercel uses `frontend/vercel.json` with `--legacy-peer-deps` and SPA route handling.

---

## 🛠️ Local Development (Without Docker)

### 1. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Start Vite development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Automated Testing & Coverage

Run the complete backend test suite:
```bash
cd backend
source venv/bin/activate
pytest --cov=app --cov-report=term-missing --cov-fail-under=95
```

Result: **78 passed** with **95.43% code coverage**.

---

## 📡 Key REST API Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/v1/auth/register` | Register new user account | No |
| `POST` | `/api/v1/auth/login` | Login with credentials (JWT token) | No |
| `POST` | `/api/v1/auth/guest` | Instant friction-free guest session | No |
| `GET` | `/api/v1/auth/me` | Get current authenticated user profile | Yes (Bearer) |
| `POST` | `/api/v1/documents/upload` | Upload PDF, audio, or video file | Yes (Bearer) |
| `GET` | `/api/v1/documents/list` | List all documents for user | Yes (Bearer) |
| `GET` | `/api/v1/documents/{id}` | Get document metadata & transcript | Yes (Bearer) |
| `DELETE`| `/api/v1/documents/{id}` | Delete document, vectors, and storage | Yes (Bearer) |
| `POST` | `/api/v1/documents/{id}/chat` | Ask question with local/LLM RAG | Yes (Bearer) |
| `POST` | `/api/v1/documents/{id}/chat/stream`| Real-time SSE token stream | Yes (Bearer) |
| `GET` | `/api/v1/documents/{id}/summary` | Retrieve executive summary & bullet points | Yes (Bearer) |
| `GET` | `/api/v1/documents/{id}/topics` | Retrieve timestamped topic chapters | Yes (Bearer) |
| `GET` | `/api/v1/media/{id}/stream` | Stream audio/video with RFC 7233 range | No |
| `GET` | `/health` | Container orchestration healthcheck | No |

---

## 📄 License
MIT License. Developed for PSI (Pan Science Innovation).
