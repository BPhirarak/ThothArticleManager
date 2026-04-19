"""NetworkX-based knowledge graph service."""
import networkx as nx
from sqlalchemy.orm import Session
from models import Article, ArticleRelationship
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np


TOPIC_COLORS = {
    "Safety & Environment": "#ef4444",
    "Energy, Control & Digitalization": "#3b82f6",
    "Plant Services & Reliability": "#f59e0b",
    "Material Movement & Transportation": "#8b5cf6",
    "Iron Making": "#6b7280",
    "Steel Making": "#64748b",
    "Rolling & Processing": "#0ea5e9",
    "General": "#10b981",
}


def compute_similarity(a1: Article, a2: Article) -> tuple[float, list]:
    """Compute similarity weight and shared tags between two articles."""
    tags1 = set(a1.tags or [])
    tags2 = set(a2.tags or [])
    shared = list(tags1 & tags2)
    tag_sim = len(shared) / max(len(tags1 | tags2), 1)

    # Text similarity
    texts = [
        f"{a1.title} {' '.join(a1.tags or [])} {a1.summary_en[:200]}",
        f"{a2.title} {' '.join(a2.tags or [])} {a2.summary_en[:200]}",
    ]
    try:
        vec = TfidfVectorizer(min_df=1, stop_words="english")
        tfidf = vec.fit_transform(texts)
        text_sim = float(cosine_similarity(tfidf[0], tfidf[1])[0][0])
    except Exception:
        text_sim = 0.0

    weight = round(0.4 * tag_sim + 0.6 * text_sim, 4)
    return weight, shared


def rebuild_graph(db: Session, min_weight: float = 0.01):
    """Rebuild all article relationships in DB."""
    # Remove existing
    db.query(ArticleRelationship).delete()
    db.commit()

    articles = db.query(Article).all()
    if len(articles) < 2:
        return

    for i, a1 in enumerate(articles):
        for a2 in articles[i + 1:]:
            weight, shared = compute_similarity(a1, a2)
            if weight >= min_weight:
                rel = ArticleRelationship(
                    source_id=a1.id,
                    target_id=a2.id,
                    relationship_type="similarity",
                    weight=weight,
                    shared_tags=shared,
                )
                db.add(rel)
    db.commit()


def get_graph_data(db: Session) -> dict:
    """Return nodes and edges for frontend visualization."""
    articles = db.query(Article).all()
    relationships = db.query(ArticleRelationship).all()

    nodes = [
        {
            "id": str(a.id),
            "label": a.title[:40] + ("..." if len(a.title) > 40 else ""),
            "title": a.title,
            "topic": a.topic_category,
            "color": TOPIC_COLORS.get(a.topic_category, "#10b981"),
            "tags": a.tags or [],
            "publication_date": a.publication_date,
        }
        for a in articles
    ]

    edges = [
        {
            "id": str(r.id),
            "source": str(r.source_id),
            "target": str(r.target_id),
            "weight": r.weight,
            "shared_tags": r.shared_tags or [],
            "width": max(1, int(r.weight * 10)),
        }
        for r in relationships
    ]

    return {"nodes": nodes, "edges": edges}


def get_related_articles(db: Session, article_id: int, limit: int = 5) -> list:
    """Get related articles sorted by similarity weight."""
    rels = (
        db.query(ArticleRelationship)
        .filter(
            (ArticleRelationship.source_id == article_id) |
            (ArticleRelationship.target_id == article_id)
        )
        .order_by(ArticleRelationship.weight.desc())
        .limit(limit)
        .all()
    )
    result = []
    for r in rels:
        other_id = r.target_id if r.source_id == article_id else r.source_id
        other = db.query(Article).filter(Article.id == other_id).first()
        if other:
            result.append({
                "id": other.id,
                "title": other.title,
                "topic_category": other.topic_category,
                "weight": r.weight,
                "shared_tags": r.shared_tags,
            })
    return result
