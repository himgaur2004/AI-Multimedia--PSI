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


def generate_deterministic_answer(
    query: str,
    citations: List[Citation],
    file_type: str
) -> str:
    """Deterministic context-aware answer generator with candidate relevance scoring."""
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

    if file_type in {"audio", "video"} and top_citation.formatted_timestamp:
        ts = top_citation.formatted_timestamp
        lines = [f"According to the recording around [{ts}]:"]
        chosen_items = top_relevant[:4] if top_relevant else scored_candidates[:4]
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
        chosen = [item[1] for item in (top_relevant[:4] if top_relevant else scored_candidates[:4])]
        seen = set()
        for pt in chosen:
            if pt not in seen:
                seen.add(pt)
                lines.append(f"• {pt}")
        lines.append(f"\nThis directly addresses your inquiry regarding \"{query.strip()}\".")
        return "\n".join(lines)
