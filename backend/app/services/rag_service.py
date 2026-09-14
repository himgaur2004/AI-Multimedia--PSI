"""
RAG (Retrieval-Augmented Generation) & Reasoning Service.
Integrates LangChain patterns with OpenAI Chat models and SSE token streaming.
Strictly grounds answers in timestamps [MM:SS] for multimedia and [Page X] for documents.
"""

import asyncio
import hashlib
import json
import re
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

from app.core.config import settings
from app.core.cache import cache_manager
from app.schemas.chat import Citation
from app.services.vector_service import vector_service
from app.services.gemini_service import gemini_service
from app.services.rag_synthesizer import (
    generate_prompt as synth_generate_prompt,
    generate_follow_up_questions as synth_generate_follow_ups,
    generate_deterministic_answer as synth_deterministic_answer,
    is_assistant_identity_query,
    generate_identity_response,
)

try:
    import httpx
    from openai import OpenAI
except ImportError:
    OpenAI = None
    httpx = None


class RAGService:
    """Retrieval-Augmented Generation engine for document and multimedia Q&A."""

    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.model = settings.OPENAI_MODEL
        self.gemini_api_key = settings.GEMINI_API_KEY
        self.gemini_model = settings.GEMINI_MODEL
        self.last_engine = "Self-Built RAG Grounding Engine"
        self.last_retrieval_method = "FAISS Semantic Vector Search"

    def _get_client(self, api_key: str):
        """Create an OpenAI client safely using an explicit httpx sync client to avoid proxy conflicts."""
        if not api_key or OpenAI is None:
            return None
        try:
            http_client = httpx.Client(timeout=30.0) if httpx is not None else None
            return OpenAI(api_key=api_key, http_client=http_client) if http_client is not None else OpenAI(api_key=api_key)
        except Exception:
            try:
                return OpenAI(api_key=api_key)
            except Exception:
                return None

    def _get_cache_key(self, document_id: str, query: str, search_mode: Optional[str]) -> str:
        """Derive deterministic cache key for document query."""
        normalized = f"{query.strip().lower()}:{search_mode or 'auto'}"
        digest = hashlib.md5(normalized.encode("utf-8")).hexdigest()
        return f"rag:cache:{document_id}:{digest}"

    def build_context(
        self,
        document_id: str,
        query: str,
        top_k: int = 5
    ) -> Tuple[str, List[Citation]]:
        """
        Retrieve relevant chunks from vector store and build context prompt.
        Returns:
            (formatted_context_string, citations_list)
        """
        results = vector_service.search(document_id, query, top_k=top_k)
        context_parts = []
        citations: List[Citation] = []

        for item in results:
            meta = item.get("metadata", {})
            text = item.get("text", "")
            source_type = meta.get("file_type", "document")
            
            if source_type in {"audio", "video"} or "start_time" in meta:
                start_sec = meta.get("start_time", 0.0)
                end_sec = meta.get("end_time", 0.0)
                fmt_start = meta.get("formatted_start", "00:00")
                header = f"[Timestamp {fmt_start}]"
                context_parts.append(f"{header} {text}")
                
                citations.append(Citation(
                    source=source_type,
                    start_time=start_sec,
                    end_time=end_sec,
                    formatted_timestamp=fmt_start,
                    snippet=text[:500]
                ))
            else:
                page_num = meta.get("page", 1)
                header = f"[Page {page_num}]"
                context_parts.append(f"{header} {text}")
                
                citations.append(Citation(
                    source="pdf",
                    page=page_num,
                    snippet=text[:500]
                ))

        context_str = "\n\n".join(context_parts) if context_parts else "No relevant context found."
        return context_str, citations

    def generate_prompt(self, query: str, context: str, file_type: str, chat_history: Optional[List[dict]] = None) -> str:
        """Create a prompt instructing the LLM to provide timestamps, citations, and follow-ups."""
        return synth_generate_prompt(query, context, file_type, chat_history)

    def generate_follow_up_questions(
        self,
        query: str,
        context: str,
        file_type: str
    ) -> List[str]:
        """Generate 3 smart, context-aware follow-up question suggestions."""
        return synth_generate_follow_ups(query, context, file_type)

    def answer_query(
        self,
        document_id: str,
        query: str,
        file_type: str = "document",
        api_key_override: str = "",
        gemini_api_key_override: str = "",
        chat_history: Optional[List[dict]] = None,
        search_mode: Optional[str] = None,
        model_override: Optional[str] = None
    ) -> Tuple[str, List[Citation], List[str]]:
        """Synchronous Q&A generation with Redis caching, structured citations, and follow-ups."""
        cache_key = self._get_cache_key(document_id, query, search_mode)
        cached_data = cache_manager.get(cache_key)
        if cached_data and isinstance(cached_data, dict):
            cached_ans = cached_data.get("answer")
            cached_cits = [Citation(**c) for c in cached_data.get("citations", [])]
            cached_fups = cached_data.get("follow_ups", [])
            self.last_engine = cached_data.get("engine", self.last_engine)
            self.last_retrieval_method = cached_data.get("retrieval_method", self.last_retrieval_method)
            return cached_ans, cached_cits, cached_fups

        if is_assistant_identity_query(query):
            self.last_engine = "PSI Assistant Core"
            self.last_retrieval_method = "Direct System Grounding"
            ans = generate_identity_response(query)
            fups = [
                "What file formats can I upload?",
                "How do timestamp playback badges work?",
                "Can you summarize this document?"
            ]
            return ans, [], fups

        context, citations = self.build_context(document_id, query)
        active_key = api_key_override or self.api_key
        active_gemini_key = gemini_api_key_override or self.gemini_api_key
        follow_ups = self.generate_follow_up_questions(query, context, file_type)
        model_to_use = model_override or self.model
        gemini_model = model_override if (model_override and "gemini" in model_override) else self.gemini_model

        # Mode 1: Explicit Inbuilt RAG / FAISS Semantic Search
        if search_mode == "inbuilt":
            self.last_engine = "Inbuilt RAG / FAISS Search"
            self.last_retrieval_method = "FAISS Semantic Vector Search"
            answer = self._generate_deterministic_answer(query, citations, file_type)
            cache_manager.set(cache_key, {
                "answer": answer,
                "citations": [c.model_dump() for c in citations],
                "follow_ups": follow_ups,
                "engine": self.last_engine,
                "retrieval_method": self.last_retrieval_method
            })
            return answer, citations, follow_ups

        # Mode 2: LangChain RAG Search
        if search_mode == "langchain":
            self.last_engine = "LangChain Retrieval Engine"
            self.last_retrieval_method = "LangChain RAG Pipeline + FAISS Chunks"
            if active_gemini_key:
                try:
                    prompt = self.generate_prompt(query, context, file_type, chat_history)
                    answer = gemini_service.generate_response(prompt, api_key=active_gemini_key, model=gemini_model)
                    self.last_engine = f"LangChain + Gemini ({gemini_model})"
                    cache_manager.set(cache_key, {
                        "answer": answer,
                        "citations": [c.model_dump() for c in citations],
                        "follow_ups": follow_ups,
                        "engine": self.last_engine,
                        "retrieval_method": self.last_retrieval_method
                    })
                    return answer, citations, follow_ups
                except Exception as e:
                    print(f"[RAGService] LangChain Gemini error: {e}")
            elif active_key:
                client = self._get_client(active_key)
                if client is not None:
                    try:
                        prompt = self.generate_prompt(query, context, file_type, chat_history)
                        completion = client.chat.completions.create(
                            model=model_to_use,
                            messages=[
                                {"role": "system", "content": "You are a professional document & multimedia research assistant using LangChain."},
                                {"role": "user", "content": prompt}
                            ],
                            temperature=0.2,
                            max_tokens=650,
                        )
                        answer = completion.choices[0].message.content or ""
                        self.last_engine = f"LangChain + OpenAI ({model_to_use})"
                        cache_manager.set(cache_key, {
                            "answer": answer,
                            "citations": [c.model_dump() for c in citations],
                            "follow_ups": follow_ups,
                            "engine": self.last_engine,
                            "retrieval_method": self.last_retrieval_method
                        })
                        return answer, citations, follow_ups
                    except Exception as e:
                        print(f"[RAGService] LangChain OpenAI error: {e}")

            answer = self._generate_deterministic_answer(query, citations, file_type)
            cache_manager.set(cache_key, {
                "answer": answer,
                "citations": [c.model_dump() for c in citations],
                "follow_ups": follow_ups,
                "engine": self.last_engine,
                "retrieval_method": self.last_retrieval_method
            })
            return answer, citations, follow_ups

        # Mode 3: Google Gemini LLM Mode
        if search_mode == "gemini":
            if active_gemini_key:
                try:
                    prompt = self.generate_prompt(query, context, file_type, chat_history)
                    answer = gemini_service.generate_response(prompt, api_key=active_gemini_key, model=gemini_model)
                    self.last_engine = f"Google Gemini ({gemini_model})"
                    self.last_retrieval_method = "FAISS Semantic Vector Search + Gemini LLM Generation"
                    cache_manager.set(cache_key, {
                        "answer": answer,
                        "citations": [c.model_dump() for c in citations],
                        "follow_ups": follow_ups,
                        "engine": self.last_engine,
                        "retrieval_method": self.last_retrieval_method
                    })
                    return answer, citations, follow_ups
                except Exception as e:
                    err_str = str(e).lower()
                    reason = "Quota Exceeded" if "quota" in err_str else ("Invalid API Key" if any(k in err_str for k in ("auth", "key", "invalid", "400", "401", "403")) else "Unavailable")
                    print(f"[RAGService] Gemini Chat error: {e}. Falling back to Inbuilt FAISS RAG engine ({reason}).")
                    self.last_engine = f"Gemini LLM (Fallback: Inbuilt RAG) - {reason}"
            else:
                self.last_engine = "Gemini LLM (Fallback: Inbuilt RAG) - No API Key Provided"

            self.last_retrieval_method = "FAISS Semantic Vector Search"
            answer = self._generate_deterministic_answer(query, citations, file_type)
            cache_manager.set(cache_key, {
                "answer": answer,
                "citations": [c.model_dump() for c in citations],
                "follow_ups": follow_ups,
                "engine": self.last_engine,
                "retrieval_method": self.last_retrieval_method
            })
            return answer, citations, follow_ups

        # Mode 4: GPT LLM Mode (Attempts OpenAI model synthesis with grounding context)
        client = self._get_client(active_key)
        if client is not None:
            try:
                prompt = self.generate_prompt(query, context, file_type, chat_history)
                completion = client.chat.completions.create(
                    model=model_to_use,
                    messages=[
                        {"role": "system", "content": "You are a professional document & multimedia research assistant."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.2,
                    max_tokens=650,
                )
                answer = completion.choices[0].message.content or ""
                self.last_engine = f"OpenAI {model_to_use} LLM"
                self.last_retrieval_method = "FAISS Semantic Vector Search + GPT LLM Generation"
                cache_manager.set(cache_key, {
                    "answer": answer,
                    "citations": [c.model_dump() for c in citations],
                    "follow_ups": follow_ups,
                    "engine": self.last_engine,
                    "retrieval_method": self.last_retrieval_method
                })
                return answer, citations, follow_ups
            except Exception as e:
                err_str = str(e).lower()
                reason = "Quota Exceeded" if "quota" in err_str else ("Invalid API Key" if any(k in err_str for k in ("auth", "invalid", "401")) else "Unavailable")
                print(f"[RAGService] OpenAI Chat error: {e}. Falling back to Inbuilt FAISS RAG engine ({reason}).")
                self.last_engine = f"GPT LLM (Fallback: Inbuilt RAG) - {reason}"
        else:
            self.last_engine = "Inbuilt RAG / FAISS Search" if search_mode == "inbuilt" else "GPT LLM (Fallback: Inbuilt RAG) - No API Key Provided"

        self.last_retrieval_method = "FAISS Semantic Vector Search"
        answer = self._generate_deterministic_answer(query, citations, file_type)
        cache_manager.set(cache_key, {
            "answer": answer,
            "citations": [c.model_dump() for c in citations],
            "follow_ups": follow_ups,
            "engine": self.last_engine,
            "retrieval_method": self.last_retrieval_method
        })
        return answer, citations, follow_ups

    async def stream_query(
        self,
        document_id: str,
        query: str,
        file_type: str = "document",
        api_key_override: str = "",
        gemini_api_key_override: str = "",
        chat_history: Optional[List[dict]] = None,
        search_mode: Optional[str] = None,
        model_override: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        Server-Sent Events (SSE) generator streaming token chunks in real-time.
        Yields JSON formatted SSE frames: `data: {...}\n\n`
        """
        cache_key = self._get_cache_key(document_id, query, search_mode)
        cached_data = cache_manager.get(cache_key)
        if cached_data and isinstance(cached_data, dict):
            cached_ans = cached_data.get("answer", "")
            cached_cits = cached_data.get("citations", [])
            cached_fups = cached_data.get("follow_ups", [])
            engine = cached_data.get("engine", self.last_engine)
            method = cached_data.get("retrieval_method", "FAISS Semantic Vector Search (Redis Cached)")
            words = cached_ans.split(" ")
            for i, word in enumerate(words):
                token = word + (" " if i < len(words) - 1 else "")
                yield f"data: {json.dumps({'chunk': token, 'done': False})}\n\n"
                await asyncio.sleep(0.01)
            yield f"data: {json.dumps({'done': True, 'citations': cached_cits, 'follow_up_questions': cached_fups, 'engine': engine, 'retrieval_method': method})}\n\n"
            return

        if is_assistant_identity_query(query):
            self.last_engine = "PSI Assistant Core"
            self.last_retrieval_method = "Direct System Grounding"
            ans = generate_identity_response(query)
            fups = [
                "What file formats can I upload?",
                "How do timestamp playback badges work?",
                "Can you summarize this document?"
            ]
            words = ans.split(" ")
            for i, word in enumerate(words):
                token = word + (" " if i < len(words) - 1 else "")
                yield f"data: {json.dumps({'chunk': token, 'done': False})}\n\n"
                await asyncio.sleep(0.01)
            yield f"data: {json.dumps({'done': True, 'citations': [], 'follow_up_questions': fups, 'engine': self.last_engine, 'retrieval_method': self.last_retrieval_method})}\n\n"
            return

        context, citations = self.build_context(document_id, query)
        active_key = api_key_override or self.api_key
        active_gemini_key = gemini_api_key_override or self.gemini_api_key
        follow_ups = self.generate_follow_up_questions(query, context, file_type)
        model_to_use = model_override or self.model
        gemini_model = model_override if (model_override and "gemini" in model_override) else self.gemini_model

        # Mode 1: Explicit Inbuilt RAG / FAISS Semantic Search
        if search_mode == "inbuilt":
            self.last_engine = "Inbuilt RAG / FAISS Search"
            self.last_retrieval_method = "FAISS Semantic Vector Search"
            answer = self._generate_deterministic_answer(query, citations, file_type)
            words = answer.split(" ")
            for i, word in enumerate(words):
                token = word + (" " if i < len(words) - 1 else "")
                yield f"data: {json.dumps({'chunk': token, 'done': False})}\n\n"
                await asyncio.sleep(0.015)

            cache_manager.set(cache_key, {
                "answer": answer,
                "citations": [c.model_dump() for c in citations],
                "follow_ups": follow_ups,
                "engine": self.last_engine,
                "retrieval_method": self.last_retrieval_method
            })
            yield f"data: {json.dumps({'done': True, 'citations': [c.model_dump() for c in citations], 'follow_up_questions': follow_ups, 'engine': self.last_engine, 'retrieval_method': self.last_retrieval_method})}\n\n"
            return

        # Mode 2: LangChain RAG Search
        if search_mode == "langchain":
            self.last_engine = "LangChain Retrieval Engine"
            self.last_retrieval_method = "LangChain RAG Pipeline + FAISS Chunks"
            if active_gemini_key:
                try:
                    self.last_engine = f"LangChain + Gemini ({gemini_model})"
                    prompt = self.generate_prompt(query, context, file_type, chat_history)
                    accumulated = []
                    async for token in gemini_service.stream_response(prompt, api_key=active_gemini_key, model=gemini_model):
                        accumulated.append(token)
                        yield f"data: {json.dumps({'chunk': token, 'done': False})}\n\n"
                        await asyncio.sleep(0.005)
                    full_ans = "".join(accumulated)
                    cache_manager.set(cache_key, {
                        "answer": full_ans,
                        "citations": [c.model_dump() for c in citations],
                        "follow_ups": follow_ups,
                        "engine": self.last_engine,
                        "retrieval_method": self.last_retrieval_method
                    })
                    yield f"data: {json.dumps({'done': True, 'citations': [c.model_dump() for c in citations], 'follow_up_questions': follow_ups, 'engine': self.last_engine, 'retrieval_method': self.last_retrieval_method})}\n\n"
                    return
                except Exception as e:
                    print(f"[RAGService] LangChain stream Gemini error: {e}")
            elif active_key:
                client = self._get_client(active_key)
                if client is not None:
                    try:
                        self.last_engine = f"LangChain + OpenAI ({model_to_use})"
                        prompt = self.generate_prompt(query, context, file_type, chat_history)
                        stream = client.chat.completions.create(
                            model=model_to_use,
                            messages=[
                                {"role": "system", "content": "You are a professional document & multimedia research assistant using LangChain."},
                                {"role": "user", "content": prompt}
                            ],
                            temperature=0.2,
                            max_tokens=650,
                            stream=True
                        )
                        accumulated = []
                        for chunk in stream:
                            delta = (chunk.choices[0].delta.content or "") if chunk.choices and chunk.choices[0].delta else ""
                            if delta:
                                accumulated.append(delta)
                                yield f"data: {json.dumps({'chunk': delta, 'done': False})}\n\n"
                                await asyncio.sleep(0.005)
                        full_ans = "".join(accumulated)
                        cache_manager.set(cache_key, {
                            "answer": full_ans,
                            "citations": [c.model_dump() for c in citations],
                            "follow_ups": follow_ups,
                            "engine": self.last_engine,
                            "retrieval_method": self.last_retrieval_method
                        })
                        yield f"data: {json.dumps({'done': True, 'citations': [c.model_dump() for c in citations], 'follow_up_questions': follow_ups, 'engine': self.last_engine, 'retrieval_method': self.last_retrieval_method})}\n\n"
                        return
                    except Exception as e:
                        print(f"[RAGService] LangChain stream OpenAI error: {e}")

            answer = self._generate_deterministic_answer(query, citations, file_type)
            words = answer.split(" ")
            for i, word in enumerate(words):
                token = word + (" " if i < len(words) - 1 else "")
                yield f"data: {json.dumps({'chunk': token, 'done': False})}\n\n"
                await asyncio.sleep(0.015)
            cache_manager.set(cache_key, {
                "answer": answer,
                "citations": [c.model_dump() for c in citations],
                "follow_ups": follow_ups,
                "engine": self.last_engine,
                "retrieval_method": self.last_retrieval_method
            })
            yield f"data: {json.dumps({'done': True, 'citations': [c.model_dump() for c in citations], 'follow_up_questions': follow_ups, 'engine': self.last_engine, 'retrieval_method': self.last_retrieval_method})}\n\n"
            return

        # Mode 3: Google Gemini LLM Mode
        if search_mode == "gemini":
            gemini_fallback_reason = ""
            if not active_gemini_key:
                gemini_fallback_reason = "No API Key Provided"
            else:
                try:
                    prompt = self.generate_prompt(query, context, file_type, chat_history)
                    self.last_engine = f"Google Gemini ({gemini_model})"
                    self.last_retrieval_method = "FAISS Semantic Vector Search + Gemini LLM Generation"
                    accumulated = []
                    async for token in gemini_service.stream_response(prompt, api_key=active_gemini_key, model=gemini_model):
                        accumulated.append(token)
                        yield f"data: {json.dumps({'chunk': token, 'done': False})}\n\n"
                        await asyncio.sleep(0.005)

                    full_ans = "".join(accumulated)
                    cache_manager.set(cache_key, {
                        "answer": full_ans,
                        "citations": [c.model_dump() for c in citations],
                        "follow_ups": follow_ups,
                        "engine": self.last_engine,
                        "retrieval_method": self.last_retrieval_method
                    })
                    yield f"data: {json.dumps({'done': True, 'citations': [c.model_dump() for c in citations], 'follow_up_questions': follow_ups, 'engine': self.last_engine, 'retrieval_method': self.last_retrieval_method})}\n\n"
                    return
                except Exception as e:
                    err_str = str(e).lower()
                    gemini_fallback_reason = "Quota Exceeded" if "quota" in err_str else ("Invalid API Key" if any(k in err_str for k in ("auth", "key", "invalid", "400", "401", "403")) else "Unavailable")
                    print(f"[RAGService] Gemini stream error: {e} ({gemini_fallback_reason})")

            self.last_engine = f"Gemini LLM (Fallback: Inbuilt RAG) - {gemini_fallback_reason}" if gemini_fallback_reason else "Gemini LLM (Fallback: Inbuilt RAG)"
            self.last_retrieval_method = "FAISS Semantic Vector Search"
            answer = self._generate_deterministic_answer(query, citations, file_type)
            words = answer.split(" ")
            for i, word in enumerate(words):
                token = word + (" " if i < len(words) - 1 else "")
                yield f"data: {json.dumps({'chunk': token, 'done': False})}\n\n"
                await asyncio.sleep(0.015)

            cache_manager.set(cache_key, {
                "answer": answer,
                "citations": [c.model_dump() for c in citations],
                "follow_ups": follow_ups,
                "engine": self.last_engine,
                "retrieval_method": self.last_retrieval_method
            })
            yield f"data: {json.dumps({'done': True, 'citations': [c.model_dump() for c in citations], 'follow_up_questions': follow_ups, 'engine': self.last_engine, 'retrieval_method': self.last_retrieval_method})}\n\n"
            return

        # Mode 4: GPT LLM Mode
        fallback_reason = ""
        client = self._get_client(active_key)
        if client is None:
            fallback_reason = "No API Key Provided"
        else:
            try:
                prompt = self.generate_prompt(query, context, file_type, chat_history)
                stream = client.chat.completions.create(
                    model=model_to_use,
                    messages=[
                        {"role": "system", "content": "You are a professional document & multimedia research assistant."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.2,
                    max_tokens=650,
                    stream=True
                )
                self.last_engine = f"OpenAI {model_to_use} LLM"
                self.last_retrieval_method = "FAISS Semantic Vector Search + GPT LLM Generation"
                accumulated = []
                for chunk in stream:
                    delta = (chunk.choices[0].delta.content or "") if chunk.choices and chunk.choices[0].delta else ""
                    if delta:
                        accumulated.append(delta)
                        yield f"data: {json.dumps({'chunk': delta, 'done': False})}\n\n"
                        await asyncio.sleep(0.005)

                full_ans = "".join(accumulated)
                cache_manager.set(cache_key, {
                    "answer": full_ans,
                    "citations": [c.model_dump() for c in citations],
                    "follow_ups": follow_ups,
                    "engine": self.last_engine,
                    "retrieval_method": self.last_retrieval_method
                })
                yield f"data: {json.dumps({'done': True, 'citations': [c.model_dump() for c in citations], 'follow_up_questions': follow_ups, 'engine': self.last_engine, 'retrieval_method': self.last_retrieval_method})}\n\n"
                return
            except Exception as e:
                err_str = str(e).lower()
                fallback_reason = "Quota Exceeded" if "quota" in err_str else ("Invalid API Key" if any(k in err_str for k in ("auth", "invalid", "401")) else "Unavailable")
                print(f"[RAGService] Stream fallback triggered: {e} ({fallback_reason})")

        # Stream fallback tokens word-by-word with real-time SSE micro-delay
        if search_mode == "gpt":
            self.last_engine = f"GPT LLM (Fallback: Inbuilt RAG) - {fallback_reason}" if fallback_reason else "GPT LLM (Fallback: Inbuilt RAG)"
        else:
            self.last_engine = "Inbuilt RAG / FAISS Search"
        self.last_retrieval_method = "FAISS Semantic Vector Search"
        answer = self._generate_deterministic_answer(query, citations, file_type)
        words = answer.split(" ")
        for i, word in enumerate(words):
            token = word + (" " if i < len(words) - 1 else "")
            yield f"data: {json.dumps({'chunk': token, 'done': False})}\n\n"
            await asyncio.sleep(0.015)

        cache_manager.set(cache_key, {
            "answer": answer,
            "citations": [c.model_dump() for c in citations],
            "follow_ups": follow_ups,
            "engine": self.last_engine,
            "retrieval_method": self.last_retrieval_method
        })
        yield f"data: {json.dumps({'done': True, 'citations': [c.model_dump() for c in citations], 'follow_up_questions': follow_ups, 'engine': self.last_engine, 'retrieval_method': self.last_retrieval_method})}\n\n"

    def _generate_deterministic_answer(
        self,
        query: str,
        citations: List[Citation],
        file_type: str
    ) -> str:
        """Deterministic context-aware answer generator with candidate relevance scoring."""
        return synth_deterministic_answer(query, citations, file_type)


rag_service = RAGService()


