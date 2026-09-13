"""
RAG Synthesizer & Prompt Engineering Helper Module.
Provides prompt construction, smart follow-up generation, and deterministic answer grounding.
"""

import re
from typing import List, Optional
from app.schemas.chat import Citation


def generate_prompt(
    query: str,
    context: str,
    file_type: str,
    chat_history: Optional[List[dict]] = None
) -> str:
    """Create a prompt instructing the LLM to provide timestamps, citations, and follow-ups."""
    citation_instruction = (
        "When referencing specific points in audio or video files, YOU MUST ALWAYS mention the exact timestamp "
        "in square brackets like [01:23] or [00:45] so the user can click to play that segment directly."
        if file_type in {"audio", "video"}
        else "When referencing points from the document, cite the page number like [Page 1] or [Page 2]."
    )

    history_context = ""
    if chat_history:
        recent = chat_history[-4:]
        formatted_turns = []
        for t in recent:
            r = t.get("role", "user")
            c = t.get("content", "")
            formatted_turns.append(f"{r.capitalize()}: {c}")
        history_context = "\nRECENT CONVERSATION HISTORY:\n" + "\n".join(formatted_turns) + "\n"

    prompt = f"""You are PSI, a high-precision AI document and multimedia analysis assistant.
Use the following retrieved context to answer the user's question accurately.

Instructions:
1. Ground your answer strictly in the provided context.
2. {citation_instruction}
3. If the answer cannot be found in the context, state that the information is not present in the document.
4. Keep the explanation clear, professional, well-structured, and use bullet points when summarizing or detailing items.
{history_context}
RETRIEVED CONTEXT:
{context}

USER QUESTION:
{query}

ANSWER:"""
    return prompt


def generate_follow_up_questions(
    query: str,
    context: str,
    file_type: str
) -> List[str]:
    """Generate 3 smart, context-aware follow-up question suggestions."""
    q_lower = query.lower()
    context_lower = context.lower()
    suggestions: List[str] = []

    if file_type in {"audio", "video"}:
        if any(k in q_lower for k in ["transcript", "topic", "chapter"]):
            suggestions = [
                "What was concluded at the end of the presentation?",
                "Can you summarize the core architectural highlights?",
                "What specific tools or libraries were referenced?"
            ]
        elif any(k in q_lower for k in ["summary", "overview", "what is"]):
            suggestions = [
                "What key demonstrations or code snippets were shown?",
                "Which speaker presented the design rationale?",
                "Jump to the main section timestamps"
            ]
        else:
            suggestions = [
                "What was discussed immediately after this timestamp?",
                "Can you provide a bulleted summary of this segment?",
                "What questions were asked during Q&A?"
            ]
    else:
        if any(k in q_lower for k in ["tech", "stack", "framework", "language", "backend", "frontend"]):
            suggestions = [
                "What are the automated test coverage requirements?",
                "Which databases (SQL or NoSQL) are recommended?",
                "How should Docker containerization and CI/CD be setup?"
            ]
        elif any(k in q_lower for k in ["test", "coverage", "pytest", "unit", "automated"]):
            suggestions = [
                "What are the mandatory deliverables for the assignment?",
                "What features should the AI chatbot interface include?",
                "How should rate limiting and caching be implemented?"
            ]
        elif any(k in q_lower for k in ["deliverable", "submission", "github", "demo", "video"]):
            suggestions = [
                "What should be included in the README documentation?",
                "What are the scoring criteria and evaluation points?",
                "What is the expected project completion timeline?"
            ]
        elif any(k in q_lower for k in ["database", "nosql", "sql", "storage"]):
            suggestions = [
                "What vector database or retrieval method is expected?",
                "How should file uploads and storage be managed?",
                "What authentication and security mechanisms are required?"
            ]
        elif any(k in q_lower for k in ["summarize", "summary", "overview", "what is"]):
            suggestions = [
                "What is the core tech stack required for this project?",
                "What is the minimum automated test coverage percentage?",
                "What are the key frontend and backend features to build?"
            ]
        else:
            if "95%" in context or "coverage" in context_lower:
                suggestions.append("What are the automated test coverage requirements?")
            if "backend" in context_lower or "fastapi" in context_lower:
                suggestions.append("What technologies are specified for the backend?")
            if "deliverables" in context_lower or "github" in context_lower:
                suggestions.append("What deliverables must be included in the repository?")

            fallbacks = [
                "Can you summarize the primary objectives?",
                "What is the required test coverage percentage?",
                "What are the frontend and backend requirements?"
            ]
            for f in fallbacks:
                if f not in suggestions and len(suggestions) < 3:
                    suggestions.append(f)

    return suggestions[:3]


def is_assistant_identity_query(query: str) -> bool:
    """Detect if query is asking about the assistant's identity, features, or capabilities."""
    q = query.strip().lower()
    patterns = [
        r"\b(who|what) are you\b",
        r"\bwho made you\b",
        r"\bwho created you\b",
        r"\btell me about (yourself|you)\b",
        r"\binformation (of|about) you\b",
        r"\binfo (of|about) you\b",
        r"\byour information\b",
        r"\bwhat is psi\b",
        r"\bwhat can you do\b",
        r"\bwhat do you do\b",
        r"\bwhat is this (app|system|website|platform|software)\b",
        r"\bhow does this work\b",
        r"\bwhat features do you have\b",
        r"\bintroduce yourself\b",
        r"^(hi|hello|hey|greetings|help)(\s+psi|\s+bot)?$",
    ]
    return any(re.search(pat, q) for pat in patterns)


def generate_identity_response(query: str, active_filename: Optional[str] = None) -> str:
    """Provides an authoritative introduction to PSI, its capabilities, and multimedia features."""
    file_note = (
        f"\nCurrently, you have selected: **{active_filename}**. "
        "You can ask me questions about this file, request a summary, or click any timestamp to seek playback."
        if active_filename
        else "\nYou can upload a PDF, audio, or video file in the left panel to begin your research."
    )
    return (
        "I am **PSI** (**Pan Science Innovation**), your AI Document & Multimedia Research Assistant.\n\n"
        "### Key Capabilities & Features:\n"
        "• **Multimodal Ingestion**: Upload PDFs, video recordings (MP4/WebM/MKV), and audio tracks (MP3/WAV).\n"
        "• **Granular Speech Transcription**: Transcribes speech with millisecond timestamp markers [MM:SS].\n"
        "• **Interactive Media Playback**: Clicking any timestamp badge directly seeks the video/audio player.\n"
        "• **Grounded Citation Reasoning**: Every claim is strictly grounded with [Page X] or [MM:SS] citations.\n"
        "• **Topic & Chapter Breakdown**: Automatically extracts topic chapters and structured outlines.\n"
        f"{file_note}\n\n"
        "How can I assist your research today?"
    )


def generate_deterministic_answer(
    query: str,
    citations: List[Citation],
    file_type: str,
    active_filename: Optional[str] = None
) -> str:
    """Deterministic context-aware answer generator with candidate relevance scoring."""
    if is_assistant_identity_query(query):
        return generate_identity_response(query, active_filename)

    if not citations:
        return (
            "Based on the uploaded file, no specific passages matched your query directly. "
            "Please verify your question or ensure the file contains relevant topics."
        )

    q_lower = query.lower()
    top_citation = citations[0]

    # Extract candidate statements with source metadata
    candidate_items = []
    for c in citations:
        raw_text = c.snippet or ""
        source_page = c.page or 1
        source_ts = c.formatted_timestamp
        
        raw_splits = re.split(r"[\n●•]+", raw_text)
        for chunk in raw_splits:
            cleaned = re.sub(r"\s+", " ", chunk).strip()
            cleaned = re.sub(r"^[0-9]+[\.\)]\s*", "", cleaned).strip()
            if len(cleaned) >= 12:
                candidate_items.append((cleaned, source_page, source_ts))

    stop_words = {
        "what", "is", "the", "for", "and", "a", "an", "to", "in", "of", "how", "can",
        "are", "was", "were", "do", "does", "did", "this", "that", "these", "those",
        "which", "who", "whom", "will", "would", "should", "could", "tell", "me", "about",
        "required", "need", "give", "show"
    }
    q_tokens = [w for w in re.sub(r"[^\w\s]", " ", q_lower).split() if len(w) > 2 and w not in stop_words]

    # Score candidates by keyword overlap and phrase matching
    scored_candidates = []
    for text_item, p_num, ts_val in candidate_items:
        t_lower = text_item.lower()
        score = 0
        for qt in q_tokens:
            if qt in t_lower:
                score += 2
                if re.search(r"\b" + re.escape(qt) + r"\b", t_lower):
                    score += 2
        if len(q_tokens) >= 2:
            for i in range(len(q_tokens) - 1):
                pair = f"{q_tokens[i]} {q_tokens[i+1]}"
                if pair in t_lower:
                    score += 5
        scored_candidates.append((score, text_item, p_num, ts_val))

    scored_candidates.sort(key=lambda x: x[0], reverse=True)
    top_relevant = [item for item in scored_candidates if item[0] > 0]

    is_transcript_request = any(k in q_lower for k in [
        "transcript", "transcipt", "transcription", "transciption",
        "synopsis", "voice meaning", "what does the voice say", "what is said",
        "whole video", "whole recording", "full video", "full audio",
        "spoken words", "speech", "dialogue", "script", "all topics"
    ])
    if is_transcript_request:
        source_label = "recording" if file_type in {"audio", "video"} else "document"
        lines = [f"Here is the complete timestamped transcript & synopsis for the {source_label}:"]
        seen_texts = set()
        for c in citations:
            ts = c.formatted_timestamp or (f"Page {c.page}" if c.page else "00:00")
            txt = (c.snippet or "").strip()
            clean_txt = re.sub(r"^[●•\-\s]+", "", txt).strip()
            if clean_txt and clean_txt not in seen_texts:
                seen_texts.add(clean_txt)
                lines.append(f"• [{ts}] {clean_txt}")
        if file_type in {"audio", "video"}:
            lines.append("\nYou can click any timestamp badge above to jump the player directly to that segment.")
        return "\n".join(lines)

    is_summary = any(k in q_lower for k in ["summar", "overview", "outline", "main point", "key point", "about the", "what is this", "presentation", "talk", "project", "topic", "detail", "tell me"])
    if not top_relevant and not is_summary:
        source_label = "recording" if file_type in {"audio", "video"} else "document"
        return (
            f"Based on the analyzed {source_label}, no specific passages directly address \"{query.strip()}\".\n\n"
            "Here are some suggested topics you can explore from this file:\n"
            "• Ask for an executive summary of the content\n"
            "• Inquire about the key discussion points or architecture\n"
            "• Ask about specific chapters or timestamps indexed in the timeline"
        )

    chosen_candidates = top_relevant if top_relevant else scored_candidates
    if file_type in {"audio", "video"} and top_citation.formatted_timestamp:
        ts = top_citation.formatted_timestamp
        lines = [f"According to the recording around [{ts}]:"]
        chosen_items = chosen_candidates[:4]
        seen = set()
        for score, text_item, page_num, ts_val in chosen_items:
            if text_item not in seen:
                seen.add(text_item)
                point_ts = ts_val or ts
                lines.append(f"• [{point_ts}] {text_item}")
        lines.append(f"\nYou can click the [{ts}] badge or any 'Play' button below to jump the player directly.")
        return "\n".join(lines)
    else:
        page = top_citation.page or 1
        lines = [f"Based on [Page {page}] of the document:"]
        chosen = [item[1] for item in chosen_candidates[:4]]
        seen = set()
        for pt in chosen:
            if pt not in seen:
                seen.add(pt)
                lines.append(f"• {pt}")
        lines.append(f"\nThis directly addresses your inquiry regarding \"{query.strip()}\".")
        return "\n".join(lines)
