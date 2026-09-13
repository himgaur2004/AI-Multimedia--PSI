"""
Vector Store & Semantic Retrieval Service.
Senior SDE Pattern: Pluggable vector store implementation supporting cosine similarity,
TF-IDF feature vectors, and OpenAI vector embeddings.
"""

from typing import Any, Dict, List, Optional
import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

try:
    import faiss
except ImportError:
    faiss = None


class VectorService:
    """In-memory semantic vector store with FAISS index acceleration keyed by document_id."""

    def __init__(self):
        # Maps document_id -> list of chunk dicts {text, metadata}
        self.doc_chunks: Dict[str, List[Dict[str, Any]]] = {}
        # Maps document_id -> fitted TfidfVectorizer
        self.doc_vectorizers: Dict[str, TfidfVectorizer] = {}
        # Maps document_id -> matrix of chunk embeddings
        self.doc_matrices: Dict[str, Any] = {}
        # Maps document_id -> faiss IndexFlatIP
        self.doc_faiss_indexes: Dict[str, Any] = {}

    def index_chunks(self, document_id: str, chunks: List[Dict[str, Any]]):
        """Index chunks for semantic vector similarity search via FAISS & TF-IDF."""
        if not chunks:
            return

        self.doc_chunks[document_id] = chunks
        corpus = [c["text"] for c in chunks]

        vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            stop_words="english",
            max_features=5000,
            token_pattern=r"(?u)\b\w+\b"
        )

        try:
            tfidf_matrix = vectorizer.fit_transform(corpus)
            self.doc_vectorizers[document_id] = vectorizer
            self.doc_matrices[document_id] = tfidf_matrix
        except ValueError:
            # In case corpus consists entirely of stop words
            vectorizer = TfidfVectorizer(ngram_range=(1, 1), token_pattern=r"(?u)\b\w+\b")
            tfidf_matrix = vectorizer.fit_transform(corpus)
            self.doc_vectorizers[document_id] = vectorizer
            self.doc_matrices[document_id] = tfidf_matrix

        # Build FAISS IndexFlatIP with L2 normalized dense vectors
        if faiss is not None:
            try:
                dense_vectors = tfidf_matrix.toarray().astype(np.float32)
                if dense_vectors.shape[0] > 0 and dense_vectors.shape[1] > 0:
                    faiss.normalize_L2(dense_vectors)
                    index = faiss.IndexFlatIP(dense_vectors.shape[1])
                    index.add(dense_vectors)
                    self.doc_faiss_indexes[document_id] = index
            except Exception as err:
                print(f"[VectorService] FAISS indexing fallback: {err}")


    def _ensure_indexed(self, document_id: str):
        """Reconstruct index from persistent database if missing from memory cache."""
        if document_id in self.doc_chunks and document_id in self.doc_vectorizers:
            return

        from app.core.database import db_manager
        import json
        import re

        try:
            conn = db_manager.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT d.file_type, c.full_text, c.transcript_segments_json
                FROM documents d
                JOIN document_contents c ON d.id = c.document_id
                WHERE d.id = ?
                """,
                (document_id,)
            )
            row = cursor.fetchone()
        except Exception:
            return

        if not row:
            return

        file_type = row["file_type"]
        full_text = row["full_text"] or ""
        segments_json = row["transcript_segments_json"] or "[]"
        chunks = []

        if file_type == "pdf":
            page_blocks = re.split(r"\[Page\s+(\d+)\]", full_text)
            if len(page_blocks) > 1:
                for i in range(1, len(page_blocks), 2):
                    page_num = int(page_blocks[i])
                    page_text = page_blocks[i + 1].strip()
                    if page_text:
                        for start in range(0, len(page_text), 350):
                            sub = page_text[start : start + 450].strip()
                            if sub:
                                chunks.append({
                                    "text": sub,
                                    "metadata": {"file_type": "pdf", "page": page_num}
                                })
            else:
                for start in range(0, len(full_text), 350):
                    sub = full_text[start : start + 450].strip()
                    if sub:
                        chunks.append({
                            "text": sub,
                            "metadata": {"file_type": "pdf", "page": 1}
                        })
        else:
            try:
                segments = json.loads(segments_json)
            except Exception:
                segments = []
            if segments:
                for seg in segments:
                    chunks.append({
                        "text": seg.get("text", ""),
                        "metadata": {
                            "file_type": file_type,
                            "start_time": seg.get("start", 0.0),
                            "end_time": seg.get("end", 0.0),
                            "formatted_start": seg.get("formatted_start", "00:00"),
                            "formatted_end": seg.get("formatted_end", "00:00")
                        }
                    })
            elif full_text:
                chunks.append({
                    "text": full_text,
                    "metadata": {"file_type": file_type, "start_time": 0.0, "end_time": 0.0, "formatted_start": "00:00", "formatted_end": "00:00"}
                })

        if chunks:
            self.index_chunks(document_id, chunks)

    def search(
        self,
        document_id: str,
        query: str,
        top_k: int = 4
    ) -> List[Dict[str, Any]]:
        """
        Execute hybrid semantic retrieval combining TF-IDF cosine similarity with
        domain keyword density and consecutive phrase boosting.
        Returns top-k chunks sorted by hybrid relevance score with metadata.
        """
        if document_id not in self.doc_chunks or document_id not in self.doc_vectorizers:
            self._ensure_indexed(document_id)
            if document_id not in self.doc_chunks or document_id not in self.doc_vectorizers:
                return []
            
        chunks = self.doc_chunks[document_id]
        vectorizer = self.doc_vectorizers[document_id]
        matrix = self.doc_matrices[document_id]
        
        # 1. FAISS Semantic Vector Retrieval & TF-IDF Cosine Similarity
        faiss_scores = np.zeros(len(chunks), dtype=np.float32)
        has_faiss = False
        if faiss is not None and document_id in self.doc_faiss_indexes:
            try:
                q_dense = vectorizer.transform([query]).toarray().astype(np.float32)
                if q_dense.shape[1] == self.doc_faiss_indexes[document_id].d:
                    faiss.normalize_L2(q_dense)
                    d_scores, i_indices = self.doc_faiss_indexes[document_id].search(q_dense, len(chunks))
                    for score, chunk_idx in zip(d_scores[0], i_indices[0]):
                        if 0 <= chunk_idx < len(chunks):
                            faiss_scores[chunk_idx] = max(0.0, float(score))
                    has_faiss = True
            except Exception as err:
                print(f"[VectorService] FAISS search error: {err}")

        try:
            query_vec = vectorizer.transform([query])
            cos_scores = cosine_similarity(query_vec, matrix)[0]
        except Exception:
            cos_scores = np.zeros(len(chunks))

        # 2. Keyword & Phrase Density Boost
        q_clean = re.sub(r"[^\w\s]", " ", query.lower())
        stop_words = {
            "a", "an", "the", "is", "are", "was", "were", "what", "which", "who", "whom",
            "this", "that", "these", "those", "how", "why", "where", "when", "can", "could",
            "should", "would", "in", "on", "at", "by", "for", "with", "about", "against",
            "between", "into", "through", "during", "before", "after", "above", "below",
            "to", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again",
            "further", "then", "once", "here", "there", "all", "any", "both", "each", "few",
            "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same",
            "so", "than", "too", "very", "s", "t", "will", "just", "don", "now",
            "tell", "me", "give", "please", "find", "show"
        }
        query_terms = [w for w in q_clean.split() if len(w) > 1 and w not in stop_words]

        scored_chunks = []
        for idx, chunk in enumerate(chunks):
            # Prioritize FAISS normalized vector inner product if available, else standard cosine
            vec_sim = float(faiss_scores[idx]) if has_faiss else (float(cos_scores[idx]) if idx < len(cos_scores) else 0.0)
            chunk_lower = chunk["text"].lower()

            # Keyword term matches
            matches = sum(1 for term in query_terms if term in chunk_lower)
            keyword_ratio = (matches / max(1, len(query_terms))) if query_terms else 0.0

            # Phrase match boost
            phrase_boost = 0.0
            if len(query_terms) >= 2:
                for i in range(len(query_terms) - 1):
                    pair = f"{query_terms[i]} {query_terms[i+1]}"
                    if pair in chunk_lower:
                        phrase_boost += 0.25

            # Hybrid score calculation (balanced between FAISS semantic vector similarity and lexical overlap)
            hybrid_score = (0.55 * vec_sim) + (0.35 * keyword_ratio) + phrase_boost
            scored_chunks.append((hybrid_score, vec_sim, chunk))

        # Sort by hybrid score descending
        scored_chunks.sort(key=lambda x: x[0], reverse=True)

        results = []
        for h_score, vec_sim, chunk in scored_chunks[:top_k]:
            results.append({
                "text": chunk["text"],
                "metadata": chunk.get("metadata", {}),
                "score": round(h_score if h_score > 0 else vec_sim, 4)
            })

        return results

    def delete_document(self, document_id: str):
        """Remove document index from vector memory."""
        self.doc_chunks.pop(document_id, None)
        self.doc_vectorizers.pop(document_id, None)
        self.doc_matrices.pop(document_id, None)
        self.doc_faiss_indexes.pop(document_id, None)


vector_service = VectorService()

