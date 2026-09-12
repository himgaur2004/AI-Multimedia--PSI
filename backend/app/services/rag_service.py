"""
RAG (Retrieval-Augmented Generation) & Reasoning Service.
Integrates LangChain patterns with OpenAI Chat models and SSE token streaming.
Strictly grounds answers in timestamps [MM:SS] for multimedia and [Page X] for documents.
"""

import json
import re
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

from app.core.config import settings
from app.schemas.chat import Citation
from app.services.vector_service import vector_service

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


class RAGService:
    """Retrieval-Augmented Generation engine for document and multimedia Q&A."""

    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.model = settings.OPENAI_MODEL

    def build_context(
        self,
        document_id: str,
        query: str,
        top_k: int = 4
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
                    snippet=text[:150]
                ))
            else:
                page_num = meta.get("page", 1)
                header = f"[Page {page_num}]"
                context_parts.append(f"{header} {text}")
                
                citations.append(Citation(
                    source="pdf",
                    page=page_num,
                    snippet=text[:150]
                ))

        context_str = "\n\n".join(context_parts) if context_parts else "No relevant context found."
        return context_str, citations

    def generate_prompt(self, query: str, context: str, file_type: str) -> str:
        """Create a prompt instructing the LLM to provide timestamps and citations."""
        citation_instruction = (
            "When referencing specific points in audio or video files, YOU MUST ALWAYS mention the exact timestamp "
            "in square brackets like [01:23] or [00:45] so the user can click to play that segment directly."
            if file_type in {"audio", "video"}
            else "When referencing points from the document, cite the page number like [Page 1] or [Page 2]."
        )

        prompt = f"""You are OmniMind, a high-precision AI document and multimedia analysis assistant.
Use the following retrieved context to answer the user's question accurately.

Instructions:
1. Ground your answer strictly in the provided context.
2. {citation_instruction}
3. If the answer cannot be found in the context, politely state that the information is not present.
4. Keep the explanation clear, professional, and well-structured.

CONTEXT:
{context}

USER QUESTION:
{query}

ANSWER:"""
        return prompt

    def answer_query(
        self,
        document_id: str,
        query: str,
        file_type: str = "document",
        api_key_override: str = ""
    ) -> Tuple[str, List[Citation]]:
        """Synchronous Q&A generation returning answer text and structured citations."""
        context, citations = self.build_context(document_id, query)
        active_key = api_key_override or self.api_key

        if active_key and OpenAI is not None:
            try:
                client = OpenAI(api_key=active_key)
                prompt = self.generate_prompt(query, context, file_type)
                completion = client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a professional document & multimedia research assistant."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.2,
                    max_tokens=600,
                )
                answer = completion.choices[0].message.content or ""
                return answer, citations
            except Exception as e:
                print(f"[RAGService] OpenAI Chat error: {e}. Falling back to deterministic RAG engine.")

        # Deterministic RAG engine fallback (offline/CI/CD mode)
        answer = self._generate_deterministic_answer(query, citations, file_type)
        return answer, citations

    async def stream_query(
        self,
        document_id: str,
        query: str,
        file_type: str = "document",
        api_key_override: str = ""
    ) -> AsyncGenerator[str, None]:
        """
        Server-Sent Events (SSE) generator streaming token chunks in real-time.
        Yields JSON formatted SSE frames: `data: {...}\\n\\n`
        """
        context, citations = self.build_context(document_id, query)
        active_key = api_key_override or self.api_key

        if active_key and OpenAI is not None:
            try:
                client = OpenAI(api_key=active_key)
                prompt = self.generate_prompt(query, context, file_type)
                stream = client.chat.completions.stream(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a professional document & multimedia research assistant."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.2,
                    max_tokens=600,
                )
                for chunk in stream:
                    delta = chunk.choices[0].delta.content if chunk.choices else ""
                    if delta:
                        yield f"data: {json.dumps({'chunk': delta, 'done': False})}\n\n"
                        
                # Send terminal frame with citations
                yield f"data: {json.dumps({'done': True, 'citations': [c.model_dump() for c in citations]})}\n\n"
                return
            except Exception as e:
                print(f"[RAGService] Stream fallback triggered: {e}")

        # Stream fallback tokens word-by-word
        answer = self._generate_deterministic_answer(query, citations, file_type)
        words = answer.split(" ")
        for i, word in enumerate(words):
            token = word + (" " if i < len(words) - 1 else "")
            yield f"data: {json.dumps({'chunk': token, 'done': False})}\n\n"

        yield f"data: {json.dumps({'done': True, 'citations': [c.model_dump() for c in citations]})}\n\n"

    def _generate_deterministic_answer(
        self,
        query: str,
        citations: List[Citation],
        file_type: str
    ) -> str:
        """Deterministic context-aware answer generator for testing and offline environments."""
        if not citations:
            return (
                "Based on the uploaded file, no specific passages matched your query directly. "
                "Please verify your question or ensure the file contains relevant topics."
            )

        top_citation = citations[0]
        if file_type in {"audio", "video"} and top_citation.formatted_timestamp:
            ts = top_citation.formatted_timestamp
            return (
                f"According to the recording at timestamp [{ts}], the discussion focuses directly on this topic: "
                f"\"{top_citation.snippet.strip()}\". "
                f"You can click the [{ts}] badge or the Play button above to listen to this exact segment."
            )
        else:
            page = top_citation.page or 1
            return (
                f"Based on [Page {page}] of the document, the text highlights: "
                f"\"{top_citation.snippet.strip()}\". "
                f"This addresses your inquiry regarding \"{query.strip()}\"."
            )


rag_service = RAGService()
