"""ChromaDB vector store for semantic search / RAG."""
from config import settings

_client = None
_collection = None


def _get_collection():
    global _client, _collection
    if _collection is None:
        import chromadb
        _client = chromadb.PersistentClient(path=settings.CHROMA_DIR)
        _collection = _client.get_or_create_collection(
            name="articles",
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def add_to_vector_store(article) -> None:
    col = _get_collection()
    text = f"{article.title}\n{article.summary_en}\n{' '.join(article.tags or [])}"
    col.upsert(
        ids=[str(article.id)],
        documents=[text],
        metadatas=[{
            "title": article.title,
            "topic": article.topic_category or "",
            "tags": ", ".join(article.tags or []),
        }],
    )


def delete_from_vector_store(article_id: str) -> None:
    col = _get_collection()
    col.delete(ids=[article_id])


def search_similar(query: str, n: int = 5) -> list:
    col = _get_collection()
    try:
        results = col.query(query_texts=[query], n_results=min(n, col.count()))
        docs = []
        for i, doc in enumerate(results["documents"][0]):
            meta = results["metadatas"][0][i]
            docs.append({
                "id": results["ids"][0][i],
                "title": meta.get("title", ""),
                "topic": meta.get("topic", ""),
                "content": doc,
                "distance": results["distances"][0][i] if results.get("distances") else 0,
            })
        return docs
    except Exception:
        return []
