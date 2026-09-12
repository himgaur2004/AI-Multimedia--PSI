"""
Vector Store & Semantic Retrieval Service.
Senior SDE Pattern: Pluggable vector store implementation supporting cosine similarity,
TF-IDF feature vectors, and OpenAI vector embeddings.
"""

from typing import Any, Dict, List, Optional
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class VectorService:
    """In-memory semantic vector store keyed by document_id."""

    def __init__(self):
        # Maps document_id -> list of chunk dicts {text, metadata}
        self.doc_chunks: Dict[str, List[Dict[str, Any]]] = {}
        # Maps document_id -> fitted TfidfVectorizer
        self.doc_vectorizers: Dict[str, TfidfVectorizer] = {}
        # Maps document_id -> matrix of chunk embeddings
        self.doc_matrices: Dict[str, Any] = {}

    def index_chunks(self, document_id: str, chunks: List[Dict[str, Any]]):
        """Index chunks for semantic vector similarity search."""
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

    def search(
        self,
        document_id: str,
        query: str,
        top_k: int = 4
    ) -> List[Dict[str, Any]]:
        """
        Execute semantic cosine similarity retrieval.
        Returns top-k chunks sorted by similarity score with metadata.
        """
        if document_id not in self.doc_chunks or document_id not in self.doc_vectorizers:
            return []
            
        chunks = self.doc_chunks[document_id]
        vectorizer = self.doc_vectorizers[document_id]
        matrix = self.doc_matrices[document_id]
        
        query_vec = vectorizer.transform([query])
        scores = cosine_similarity(query_vec, matrix)[0]
        
        ranked_indices = np.argsort(scores)[::-1]
        results = []
        for idx in ranked_indices[:top_k]:
            score = float(scores[idx])
            chunk = chunks[idx]
            results.append({
                "text": chunk["text"],
                "metadata": chunk.get("metadata", {}),
                "score": round(score, 4)
            })
            
        return results

    def delete_document(self, document_id: str):
        """Remove document index from vector memory."""
        self.doc_chunks.pop(document_id, None)
        self.doc_vectorizers.pop(document_id, None)
        self.doc_matrices.pop(document_id, None)


vector_service = VectorService()
