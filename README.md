# OmniMind — AI-Powered Document & Multimedia Q&A System

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg?style=flat&logo=react)](https://reactjs.org)
[![LangChain](https://img.shields.io/badge/LangChain-Enabled-1C3C3C.svg?style=flat)](https://python.langchain.com)
[![Test Coverage](https://img.shields.io/badge/Coverage-96%25-brightgreen.svg?style=flat)](https://pytest.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg?style=flat&logo=docker)](https://docker.com)
[![CI/CD](https://img.shields.io/badge/GitHub_Actions-Automated_CI-2088FF.svg?style=flat&logo=githubactions)](https://github.com/features/actions)

OmniMind is a production-grade, full-stack AI web application that enables users to upload **PDF documents, audio, and video files**, interact with an AI-powered conversational assistant with **real-time token streaming**, extract structured **executive summaries**, and navigate **topic timestamps** with an integrated multimedia player that automatically seeks to the exact video/audio segment cited in the chatbot's answer.

---

## 🏛️ System Architecture

```
                        ┌────────────────────────────────────────────────────────┐
                        │                   React Frontend                       │
                        │  - PDF & Multimedia Upload (drag & drop, preview)      │
                        │  - Synchronized Audio/Video Player with Timestamp Seek │
                        │  - Chatbot with Real-time Token Streaming (SSE)        │
                        │  - Summary & Extracted Topic Timestamps Navigator      │
                        │  - Auth & API Key Config (JWT / Guest / Custom Keys)   │
                        └───────────────────────────┬────────────────────────────┘
                                                    │ REST / SSE
                                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                FastAPI Backend Service                                 │
├────────────────────────────────┬───────────────────────────────────────────────────────┤
│ API Layer                      │ Core & Infrastructure                                 │
│  - /api/v1/auth (JWT / OAuth)  │  - Pydantic Settings & Config                         │
│  - /api/v1/documents (Upload)  │  - Sliding-Window Rate Limiter                        │
│  - /api/v1/chat (SSE Stream)   │  - Thread-Safe SQLite / Connection Pooling            │
│  - /api/v1/media (RFC 7233)    │  - Clean Service Layer & Dependency Injection         │
├────────────────────────────────┴───────────────────────────────────────────────────────┤
│ Processing & AI Engines                                                                │
│  - Document Pipeline: PDF extraction & semantic chunking (RecursiveCharacterSplitter) │
│  - Multimedia Pipeline: Whisper ASR with word & segment timestamp alignment            │
│  - Vector Store: Semantic TF-IDF + Cosine similarity vector search                     │
│  - LLM Reasoning: RAG chain with timestamp grounding & SSE token streaming             │
│  - Topic & Timestamp Extractor: LLM structured topic segmentation with start/end time  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Features Checklist (SDE-1 Assignment Alignment)

| Requirement | Implementation Details | Status |
| :--- | :--- | :---: |
| **PDF & Multimedia Upload** | Supports `.pdf`, `.mp3`, `.wav`, `.m4a`, `.mp4`, `.webm`, `.mov` with format validation & size guards | ✅ Complete |
| **Speech Transcription (ASR)** | OpenAI Whisper API integration with granular segment timestamps (`start`, `end`, `text`) + offline fallback | ✅ Complete |
| **LLM-Powered Chatbot** | LangChain RAG pipeline strictly grounding answers in timestamps `[MM:SS]` and citations | ✅ Complete |
| **Real-Time Token Streaming** | Server-Sent Events (SSE) streaming tokens word-by-word with live typing cursor | ✅ Complete |
| **Content Summarization** | Structured executive summaries with key takeaway bullet points and word counting | ✅ Complete |
| **Topic Timestamps Extraction**| Topic chapter extraction with exact start/end times and formatted indicators (`00:15 - 00:45`) | ✅ Complete |
| **Interactive Play Button** | Clickable `[01:23]` badges in chat & topic cards that jump the media player to that exact second | ✅ Complete |
| **HTTP Byte-Range Streaming** | RFC 7233 Partial Content (HTTP 206) media streaming for instantaneous player seeking | ✅ Complete |
| **Automated Testing (95%+)** | Comprehensive Pytest suite with **95.55% total test coverage** enforced via `pytest.ini` | ✅ Complete |
| **Containerization** | Multi-stage Dockerfiles and `docker-compose.yml` for unified local & cloud deployment | ✅ Complete |
| **CI/CD Pipeline** | GitHub Actions workflow executing backend test coverage, frontend builds, and Docker validation | ✅ Complete |
| **Authentication & Security** | PBKDF2-HMAC-SHA256 password hashing, JWT access tokens, instant guest mode, rate limiting | ✅ Complete |

---

## 🚀 Quick Start Guide

### Option 1: Running with Docker Compose (Recommended)

```bash
# Clone and navigate into project directory
git clone https://github.com/your-username/multimedia-qa-app.git
cd multimedia-qa-app

# Launch multi-container system (Backend + Frontend)
docker-compose up --build
```
- Frontend UI: `http://localhost:3000`
- Backend API Docs: `http://localhost:8000/docs`

---

### Option 2: Running Locally

#### 1. Backend Setup (FastAPI)
```bash
cd backend

# Create and activate Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run FastAPI development server
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend Setup (React + Vite)
```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Automated Testing & 95%+ Coverage

The test suite includes 52 automated tests covering authentication, document parsing, multimedia transcription, vector search, streaming chat, media range streaming, and error fallbacks.

```bash
cd backend
source venv/bin/activate

# Run test suite with coverage report
pytest --cov=app --cov-report=term-missing --cov-fail-under=95
```

### Coverage Report Summary
```
Name                                    Stmts   Miss  Cover
-----------------------------------------------------------
app/api/v1/auth.py                         62      1    98%
app/api/v1/chat.py                         52      0   100%
app/api/v1/documents.py                    82      3    96%
app/api/v1/media.py                        42      1    98%
app/api/v1/router.py                       12      0   100%
app/api/v1/summary.py                      36      0   100%
app/core/config.py                         23      0   100%
app/core/database.py                       44      0   100%
app/core/rate_limit.py                     25      1    96%
app/core/security.py                       65      3    95%
app/main.py                                23      2    91%
app/schemas/auth.py                        25      0   100%
app/schemas/chat.py                        24      0   100%
app/schemas/document.py                    28      0   100%
app/schemas/summary.py                     19      0   100%
app/services/document_service.py          115     16    86%
app/services/rag_service.py                85      4    95%
app/services/summary_service.py            70      6    91%
app/services/transcription_service.py      45      3    93%
app/services/vector_service.py             44      1    98%
-----------------------------------------------------------
TOTAL                                     921     41  95.55%
```

---

## 📡 REST API Reference

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/v1/auth/register` | Register a new user account | No |
| `POST` | `/api/v1/auth/login` | Login with username/email & password | No |
| `POST` | `/api/v1/auth/guest` | Instant friction-free guest session | No |
| `GET` | `/api/v1/auth/me` | Get current user profile | Yes (JWT) |
| `POST` | `/api/v1/documents/upload` | Upload PDF, audio, or video file | Yes (JWT) |
| `GET` | `/api/v1/documents/list` | List all documents for current user | Yes (JWT) |
| `GET` | `/api/v1/documents/{id}` | Get full document details & transcript | Yes (JWT) |
| `DELETE`| `/api/v1/documents/{id}` | Delete document, vectors, and media file | Yes (JWT) |
| `POST` | `/api/v1/documents/{id}/chat` | Ask a question (JSON response) | Yes (JWT) |
| `POST` | `/api/v1/documents/{id}/chat/stream` | Ask a question with SSE token streaming | Yes (JWT) |
| `GET` | `/api/v1/documents/{id}/messages` | Get chronological chat history | Yes (JWT) |
| `GET` | `/api/v1/documents/{id}/summary` | Retrieve executive summary & bullet points | Yes (JWT) |
| `GET` | `/api/v1/documents/{id}/topics` | Retrieve timestamped topic chapters | Yes (JWT) |
| `GET` | `/api/v1/media/{id}/stream` | Stream audio/video with RFC 7233 Range | No |
| `GET` | `/health` | Healthcheck for container orchestration | No |

---

## 🎬 Video Walkthrough & Presentation Structure

For the assignment demo submission:
1. **Introduction & Architecture**: Explain the clean architecture separation between FastAPI backend, LangChain RAG pipeline, and React frontend.
2. **File Ingestion Demo**: Upload a PDF and a video/audio recording. Highlight automatic speech transcription and topic chapter extraction.
3. **Interactive Player & Timestamp Jump**: Ask a question in the chat, show the streaming response with citation badges, and click the `[MM:SS]` badge to demonstrate the video player immediately jumping to that exact moment.
4. **Summary & Chapters**: Showcase executive summary and the clickable chapter timeline.
5. **Quality & Tests**: Run `pytest --cov=app --cov-fail-under=95` on terminal showing 95%+ coverage passing.

---

## 📄 License
MIT License. Crafted for the SDE-1 Assignment.
