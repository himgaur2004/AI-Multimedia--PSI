# PSI — Pan Science Innovation: AI Document & Multimedia Q&A

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?style=flat&logo=react)](https://reactjs.org)
[![LangChain](https://img.shields.io/badge/LangChain-Enabled-1C3C3C.svg?style=flat)](https://python.langchain.com)
[![FAISS](https://img.shields.io/badge/Vector_Search-FAISS-00599C.svg?style=flat)](https://github.com/facebookresearch/faiss)
[![Redis](https://img.shields.io/badge/Cache-Redis_&_InMemory-DC382D.svg?style=flat&logo=redis)](https://redis.io)
[![Test Coverage](https://img.shields.io/badge/Coverage-95.01%25-brightgreen.svg?style=flat)](https://pytest.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg?style=flat&logo=docker)](https://docker.com)
[![AWS EC2](https://img.shields.io/badge/AWS-EC2_Production-FF9900.svg?style=flat&logo=amazonaws)](https://aws.amazon.com/ec2/)
[![SSL](https://img.shields.io/badge/SSL-Let's_Encrypt_Auto_TLS-003A70.svg?style=flat&logo=letsencrypt)](https://letsencrypt.org)
[![CI/CD](https://img.shields.io/badge/GitHub_Actions-Automated_CI-2088FF.svg?style=flat&logo=githubactions)](https://github.com/features/actions)

**PSI (Pan Science Innovation)** is an enterprise-grade AI-powered document and multimedia intelligence portal. It enables researchers, engineers, and students to upload **PDF documents, video recordings (MP4/WebM/MKV), and audio tracks (MP3/WAV)**, query them via conversational real-time streaming, extract structured **executive summaries**, and seamlessly navigate synchronized **topic chapters** with interactive video seeking to exact cited timecodes.

---

### 🌐 Live Production Deployments

| Component | Service | URL | Status |
|---|---|---|:---:|
| **Frontend Web App** | Vercel Global Edge CDN | **[https://ai-multimedia-psi.vercel.app/](https://ai-multimedia-psi.vercel.app/)** | 🟢 Live |
| **Backend API (HTTPS)** | AWS EC2 + Caddy Reverse Proxy | **[https://15.252.181.80.nip.io](https://15.252.181.80.nip.io)** | 🟢 Live |
| **Interactive API Docs** | Swagger UI | **[https://15.252.181.80.nip.io/docs](https://15.252.181.80.nip.io/docs)** | 🟢 Live |
| **Backend Healthcheck** | JSON Health Probe | **[https://15.252.181.80.nip.io/health](https://15.252.181.80.nip.io/health)** | 🟢 Live |
| **Primary Database** | MongoDB Atlas Cluster | `cluster0.ieebzgz.mongodb.net` | 🟢 Live |
| **Source Repository** | GitHub | **[himgaur2004/AI-Multimedia--PSI](https://github.com/himgaur2004/AI-Multimedia--PSI)** | 🟢 Active |

---

## 🏛️ System Topology & Architecture

```
                                      Client Browser
                                            │
                             ┌──────────────┴──────────────┐
                             │  HTTPS (Port 443 / 80)      │
                             ▼                             ▼
                  ┌──────────────────────┐      ┌──────────────────────┐
                  │ Cloud (Vercel Edge)  │      │ Local Docker Stack   │
                  │ React 18 + Vite SPA  │      │ (Nginx Reverse Proxy)│
                  │ Global CDN & Assets  │      │ Port 3000            │
                  └──────────┬───────────┘      └──────────┬───────────┘
                             │                             │
                             │ HTTPS API Calls (CORS)      │
                             ▼                             ▼
                  ┌────────────────────────────────────────────────────┐
                  │          AWS EC2 Cloud Host (15.252.181.80)        │
                  │  ┌──────────────────────────────────────────────┐  │
                  │  │ Caddy 2 Reverse Proxy (Auto Let's Encrypt)   │  │
                  │  │ 15.252.181.80.nip.io                         │  │
                  │  └──────────────────────┬───────────────────────┘  │
                  │                         │ Internal Bridge Network  │
                  │                         ▼                          │
                  │  ┌──────────────────────────────────────────────┐  │
                  │  │        PSI FastAPI Backend Service           │  │
                  │  │        Port 8000 (Python 3.10 + FFmpeg)      │  │
                  │  ├──────────────────────────┬───────────────────┤  │
                  │  │ API & Security Layer     │ Core Engines      │  │
                  │  │  - JWT & Guest Auth      │  - FAISS Vector   │  │
                  │  │  - Sliding Rate Limiting │  - SpeechRecog ASR│  │
                  │  │  - RFC 7233 Range Stream │  - LangChain RAG  │  │
                  │  │  - Security Headers      │  - SSE Streaming  │  │
                  │  └──────────────┬───────────────────┬───────────┘  │
                  └─────────────────┼───────────────────┼──────────────┘
                                    │                   │
                     ┌──────────────┴───┐       ┌───────┴──────────────┐
                     ▼                  ▼       ▼                      ▼
           ┌──────────────────┐  ┌─────────────┐┌──────────────┐  ┌───────────┐
           │  MongoDB Atlas   │  │ Persistent  ││ Redis Cache  │  │ OpenAI    │
           │  Cloud Database  │  │ SQLite Vol  ││ (Distributed/│  │ GPT-4o    │
           │  (Multi-User/Doc)│  │ /app/uploads││ In-Memory)   │  │ (Optional)│
           └──────────────────┘  └─────────────┘└──────────────┘  └───────────┘
```

---

## ⚡ Key Innovations & Features

### 1. Dual-Engine RAG (Retrieval-Augmented Generation)
- **Mode 1: Inbuilt RAG / FAISS Semantic Search ($0.00 Cost)**
  - Runs 100% locally with zero external API fees.
  - Generates TF-IDF sparse matrices and dense vector projections normalized via FAISS L2 indexing (`IndexFlatIP`).
  - Employs **morphological stem-aware keyword boosting** (automatically matches plural/singular variants like `"projects"` ↔ `"project"`).
  - Synthesizes grounded multi-bullet answers citing exact `[Page X]` or `[MM:SS]` timecodes.
- **Mode 2: GPT LLM Mode (Conversational AI)**
  - Connects to OpenAI `gpt-4o-mini` or `gpt-4o` using real-time **Server-Sent Events (SSE)** token streaming.
  - Automatically falls back to the Inbuilt FAISS Engine if OpenAI API credits are exhausted (`insufficient_quota`), displaying the exact reason on the engine status badge.

### 2. Multimedia Intelligence & Synchronized Video Player
- **Granular Speech-to-Text (ASR)**: Uses local chunked `SpeechRecognition` (powered by FFmpeg/WAV audio slicing) and Whisper models to transcribe spoken dialogue with millisecond precision.
- **Interactive Player Seeking**: Clicking any timestamp badge (`[01:23]`) in the chat or topics panel immediately seeks the audio/video player to that exact second.
- **RFC 7233 Byte-Range Media Streaming**: Custom media router supporting HTTP `206 Partial Content` requests for instant scrubbing without downloading full video files.

### 3. Dynamic Extractive Document Summarization
- Performs sentence importance scoring based on information density, quantitative metrics, and bulleted takeaways.
- Produces a coherent **Executive Summary** and **4–5 specific key takeaways** extracted from the uploaded content.
- Automatically generates timestamped **Topic Chapters** for multimedia recordings.

### 4. Enterprise Multi-User Auth & Security
- **Authentication**: PBKDF2-HMAC-SHA256 password hashing with JSON Web Tokens (JWT).
- **Instant Guest Mode**: Frictionless 1-click `/auth/guest` entry for prospective reviewers and guest sessions.
- **Sliding-Window Rate Limiting**: Enforces 60 requests/minute per IP across protected endpoints.
- **Multi-Tenant Isolation**: Rigorous row-level access control preventing cross-user document leakage.

---

## 📋 Features Checklist (Assignment Deliverables Alignment)

| Requirement | Implementation Details | Status |
| :--- | :--- | :---: |
| **Vector Search (FAISS)** | L2-normalized FAISS `IndexFlatIP` vector index with cosine similarity and metadata chunk mapping | ✅ Complete |
| **Real-time Chat Streaming** | Server-Sent Events (SSE) streaming tokens word-by-word with live typing cursor and citations | ✅ Complete |
| **Multi-User Auth** | JWT Bearer tokens, secure password hashing, instant guest mode (`/auth/guest`), and API keys | ✅ Complete |
| **Rate Limiting & Caching** | Distributed Redis caching with automatic thread-safe in-memory fallback and sliding-window limiter | ✅ Complete |
| **Database (MongoDB / SQLite)** | Primary cloud MongoDB Atlas integration with resilient persistent volume SQLite fallback | ✅ Complete |
| **PDF & Multimedia Upload** | Supports `.pdf`, `.mp3`, `.wav`, `.m4a`, `.mp4`, `.webm`, `.mov`, `.txt` with extension and size guards | ✅ Complete |
| **Speech Transcription (ASR)** | Local chunked speech recognition (FFmpeg) + Whisper integration with timestamp alignment | ✅ Complete |
| **Interactive Video Seeking** | Interactive `[MM:SS]` badges in chat and summary panels that jump player to cited timestamps | ✅ Complete |
| **HTTP Byte-Range Streaming** | RFC 7233 Partial Content (HTTP 206) media streaming for instantaneous audio/video playback | ✅ Complete |
| **Executive Summarization** | Dynamic extractive document summarizer with bullet points, topic chapters, and word metrics | ✅ Complete |
| **Automated Testing (95%+)** | **88 automated Pytest unit & integration tests with 95.01% coverage** enforced via `pytest.ini` | ✅ Complete |
| **Production Dockerization** | Lean single-stage Dockerfile, Docker Compose, Nginx reverse proxy, and unprivileged user | ✅ Complete |
| **AWS EC2 Production Stack** | Live on AWS EC2 (`15.252.181.80`) with automatic HTTPS Let's Encrypt SSL via Caddy + nip.io | ✅ Complete |
| **CI/CD Pipeline** | GitHub Actions workflow executing backend tests, frontend builds, and Docker validation on push | ✅ Complete |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & npm
- **FFmpeg** (for audio/video transcription: `brew install ffmpeg` on macOS or `sudo apt install ffmpeg` on Ubuntu)

### 1. Clone the Repository
```bash
git clone https://github.com/himgaur2004/AI-Multimedia--PSI.git
cd AI-Multimedia--PSI
```

### 2. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install test and production dependencies
pip install -r requirements-test.txt

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```
API Documentation will be live at: [http://localhost:8000/docs](http://localhost:8000/docs)

### 3. Frontend Setup
```bash
cd ../frontend

# Install dependencies
npm install --legacy-peer-deps

# Start Vite dev server
npm run dev
```
Dashboard will be live at: [http://localhost:5173](http://localhost:5173)

---

## 🐳 Docker Stack (Local Deployment)

Launch the full stack locally using Docker Compose:

```bash
# Build and run all services in detached mode
docker compose up --build -d

# Verify container status
docker compose ps

# View live container logs
docker compose logs -f
```

- **Frontend Web Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend API (Swagger Docs)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Healthcheck**: [http://localhost:8000/health](http://localhost:8000/health)

---

## ☁️ AWS EC2 Production Deployment

The production backend runs on an **AWS EC2** instance (`15.252.181.80`) with automatic TLS/SSL provided by Caddy and `nip.io`.

### EC2 Production Configuration (`docker-compose.ec2.yml`):
```yaml
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: psi-backend
    restart: always
    environment:
      - DATABASE_URL=mongodb+srv://...
      - CORS_ORIGINS=https://ai-multimedia-psi.vercel.app,http://localhost:5173
      - PORT=8000
    volumes:
      - psi_uploads:/app/uploads
    networks:
      - psi-net

  caddy:
    image: caddy:2-alpine
    container_name: psi-caddy-ssl
    restart: always
    ports:
      - "80:80"
      - "443:443"
    environment:
      - DOMAIN=15.252.181.80.nip.io
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
    networks:
      - psi-net
```

### 1-Line Update Command on EC2:
```bash
cd /opt/psi-app && \
sudo git pull origin main && \
sudo docker compose -f docker-compose.ec2.yml build backend && \
sudo docker compose -f docker-compose.ec2.yml up -d
```

---

## 🧪 Automated Testing & Coverage

The test suite enforces a strict **95%+ code coverage threshold** via `pytest.ini` and `pytest-cov`.

```bash
cd backend
source venv/bin/activate
pytest --cov=app --cov-report=term-missing --cov-fail-under=95
```

### Test Results Breakdown:
```text
---------- coverage: platform darwin, python 3.10.14 ----------
Name                                    Stmts   Miss  Cover   Missing
---------------------------------------------------------------------
app/api/v1/auth.py                         97      0   100%
app/api/v1/chat.py                         81      4    95%   141-142, 156-157
app/api/v1/documents.py                    94      3    97%   38, 271-272
app/api/v1/media.py                        42      1    98%   36
app/api/v1/router.py                       12      0   100%
app/api/v1/summary.py                      53      2    96%   53-54
app/core/cache.py                         105      5    95%   19-20, 37, 58-59
app/core/config.py                         42      0   100%
app/core/database.py                       54      3    94%   22, 30-31
app/core/mongo.py                         121      9    93%   65-66, 78-80, 91-92, 178-179
app/core/rate_limit.py                     49      1    98%   46
app/core/security.py                       74      3    96%   65-66, 117
app/main.py                                50      4    92%   68, 85, 99-100
app/schemas/auth.py                        39      0   100%
app/schemas/chat.py                        32      0   100%
app/schemas/document.py                    28      0   100%
app/schemas/summary.py                     22      0   100%
app/services/document_service.py          122      8    93%   75, 106, 131-132, 156-158, 192
app/services/rag_service.py               191     10    95%   28-30, 49-53, 204, 337
app/services/rag_synthesizer.py           133      1    99%   186
app/services/summary_service.py           143     15    90%   17-19, 36-40, 85-86, 156-157, 218, 276, 290
app/services/transcription_service.py     135     15    89%   19-21, 25-26, 61-65, 112, 156-157, 173-174
app/services/vector_service.py            146      9    94%   15-16, 67-68, 74, 93-94, 129-130
---------------------------------------------------------------------
TOTAL                                    1865     93    95%

============================= 88 passed in 10.10s ==============================
Required test coverage of 95% reached. Total coverage: 95.01%
```

---

## 📡 REST API Reference

All endpoints are prefixed with `/api/v1`.

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/auth/register` | Register a new user account | No |
| `POST` | `/auth/login` | Login with username/password to receive JWT token | No |
| `POST` | `/auth/guest` | Instant friction-free guest session creation | No |
| `GET` | `/auth/me` | Fetch authenticated user profile | Yes (Bearer) |
| `POST` | `/documents/upload` | Upload PDF, audio (MP3/WAV), or video (MP4/WebM) | Yes (Bearer) |
| `GET` | `/documents/list` | List all indexed documents for authenticated user | Yes (Bearer) |
| `GET` | `/documents/{id}` | Retrieve document metadata, text, and speech transcripts | Yes (Bearer) |
| `DELETE`| `/documents/{id}` | Delete document, associated vectors, and stored media | Yes (Bearer) |
| `POST` | `/documents/{id}/chat` | Query document using RAG (Inbuilt FAISS or GPT LLM) | Yes (Bearer) |
| `POST` | `/documents/{id}/chat/stream` | Stream grounded answers token-by-token via SSE | Yes (Bearer) |
| `GET` | `/documents/{id}/messages` | Fetch complete conversation history for document | Yes (Bearer) |
| `GET` | `/documents/{id}/summary` | Retrieve dynamic executive summary and key points | Yes (Bearer) |
| `GET` | `/documents/{id}/topics` | Retrieve timestamped topic chapters for media | Yes (Bearer) |
| `GET` | `/media/{id}/stream` | Stream audio/video with RFC 7233 byte-range support | No |
| `GET` | `/health` | Container & MongoDB orchestration healthcheck | No |

---

## 📁 Repository Structure

```
multimedia-qa-app/
├── .github/workflows/
│   └── ci.yml                 # Automated CI/CD pipeline (Tests + Build + GHCR)
├── backend/
│   ├── app/
│   │   ├── api/v1/            # API Route handlers (auth, documents, chat, media, summary)
│   │   ├── core/              # Config, database manager, security, rate limiting, cache
│   │   ├── schemas/           # Pydantic data contracts (auth, document, chat, summary)
│   │   └── services/          # Business logic (vector_service, rag_service, summary_service)
│   ├── tests/                 # Comprehensive test suite (88 tests, 95.01% coverage)
│   ├── Dockerfile             # Production lean single-stage Dockerfile
│   ├── requirements.txt       # Production dependencies
│   ├── requirements-test.txt  # Test dependencies (pytest, pytest-cov, pytest-mock)
│   ├── pytest.ini             # Pytest configuration with 95% coverage enforcement
│   └── start.py               # Production ASGI application entrypoint
├── frontend/
│   ├── src/
│   │   ├── components/        # React UI components (TopBar, ChatPanel, SummaryPanel, etc.)
│   │   ├── hooks/             # Custom React hooks (useChatStream, etc.)
│   │   ├── services/          # API client with SSE streaming & auth management
│   │   └── App.jsx            # Master 3-column workspace & layout manager
│   ├── public/                # Static assets (favicons, logos, icons)
│   ├── Dockerfile             # Multi-stage production Nginx container
│   ├── package.json           # Frontend dependencies & build scripts
│   └── vite.config.js         # Vite bundler configuration
├── docker-compose.yml         # Local development container orchestration
├── docker-compose.ec2.yml     # AWS EC2 production stack (FastAPI + Caddy SSL)
├── Caddyfile                  # Caddy automatic HTTPS configuration
└── README.md                  # Comprehensive project documentation
```

---

## 📄 License
MIT License. Developed for **PSI (Pan Science Innovation)**.
