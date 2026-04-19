from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
import shutil
import uuid
import json

from database import get_db
from models import Article, ArticleRelationship
from services.pdf_service import extract_text
from services.ai_service import generate_article_metadata
from services.graph_service import rebuild_graph
from services.vector_service import add_to_vector_store, delete_from_vector_store
from config import settings

router = APIRouter()

TOPIC_CATEGORIES = [
    "Safety & Environment",
    "Energy, Control & Digitalization",
    "Plant Services & Reliability",
    "Material Movement & Transportation",
    "Iron Making",
    "Steel Making",
    "Rolling & Processing",
    "General",
]

# In-memory custom categories (persisted via DB query on startup)
_custom_categories: list = []


def get_all_categories(db: Session) -> list:
    """Return default + custom categories, excluding deleted ones."""
    from sqlalchemy import text
    # Get deleted categories
    try:
        deleted = {r[0] for r in db.execute(text("SELECT name FROM deleted_categories")).fetchall()}
    except Exception:
        deleted = set()
    # Get explicitly added custom categories
    try:
        custom = {r[0] for r in db.execute(text("SELECT name FROM custom_categories")).fetchall()}
    except Exception:
        custom = set()
    # Get categories that have articles (may include renamed ones)
    db_cats = {r[0] for r in db.query(Article.topic_category).distinct().all() if r[0]}

    # Start with defaults (minus deleted)
    combined = [c for c in TOPIC_CATEGORIES if c not in deleted]
    # Add custom + db categories (minus deleted)
    for c in sorted(custom | db_cats):
        if c not in combined and c not in deleted:
            combined.append(c)
    return combined


class ArticleCreate(BaseModel):
    title: str
    summary_en: Optional[str] = ""
    summary_th: Optional[str] = ""
    key_insights: Optional[list] = []
    tags: Optional[list] = []
    topic_category: Optional[str] = "General"
    pdf_path: Optional[str] = ""
    source_url: Optional[str] = ""
    publication_date: Optional[str] = ""
    visibility: Optional[str] = "public"
    owner: Optional[str] = "system"


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    summary_en: Optional[str] = None
    summary_th: Optional[str] = None
    key_insights: Optional[list] = None
    tags: Optional[list] = None
    topic_category: Optional[str] = None
    publication_date: Optional[str] = None


@router.get("/")
def list_articles(
    search: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Article)
    if search:
        term = f"%{search}%"
        q = q.filter(
            or_(
                Article.title.ilike(term),
                Article.summary_en.ilike(term),
                Article.summary_th.ilike(term),
            )
        )
    if topic:
        q = q.filter(Article.topic_category == topic)
    articles = q.order_by(Article.created_at.desc()).all()
    if tag:
        articles = [a for a in articles if tag in (a.tags or [])]
    return articles


@router.get("/tags/all")
def get_all_tags(db: Session = Depends(get_db)):
    articles = db.query(Article).all()
    tags = set()
    for a in articles:
        for t in (a.tags or []):
            tags.add(t)
    return sorted(list(tags))


@router.get("/topics")
def get_topics(db: Session = Depends(get_db)):
    return get_all_categories(db)


class TagRenameRequest(BaseModel):
    old_tag: str
    new_tag: str


@router.post("/admin/tags/rename")
def rename_tag(body: TagRenameRequest, db: Session = Depends(get_db)):
    """Rename a tag across all articles."""
    articles = db.query(Article).all()
    updated = 0
    for a in articles:
        tags = a.tags or []
        if body.old_tag in tags:
            a.tags = [body.new_tag if t == body.old_tag else t for t in tags]
            updated += 1
    db.commit()
    return {"updated_articles": updated}


@router.delete("/admin/tags/{tag}")
def delete_tag(tag: str, db: Session = Depends(get_db)):
    """Remove a tag from all articles."""
    articles = db.query(Article).all()
    updated = 0
    for a in articles:
        tags = a.tags or []
        if tag in tags:
            a.tags = [t for t in tags if t != tag]
            updated += 1
    db.commit()
    return {"updated_articles": updated}


# ── Admin: Category management ─────────────────────────────────────────────
class CategoryRenameRequest(BaseModel):
    old_category: str
    new_category: str


@router.post("/admin/categories/rename")
def rename_category(body: CategoryRenameRequest, db: Session = Depends(get_db)):
    """Rename a category across all articles."""
    articles = db.query(Article).filter(Article.topic_category == body.old_category).all()
    for a in articles:
        a.topic_category = body.new_category
    db.commit()
    return {"updated_articles": len(articles)}


@router.delete("/admin/categories/{category}")
def delete_category(category: str, reassign_to: str = "General", db: Session = Depends(get_db)):
    """Delete a category — reassign articles and mark as deleted."""
    from sqlalchemy import text
    # Reassign articles
    articles = db.query(Article).filter(Article.topic_category == category).all()
    for a in articles:
        a.topic_category = reassign_to
    db.commit()
    # Remove from custom_categories
    try:
        db.execute(text("DELETE FROM custom_categories WHERE name = :n"), {"n": category})
        db.commit()
    except Exception:
        pass
    # Add to deleted_categories so it's excluded from get_all_categories
    try:
        db.execute(text("INSERT OR IGNORE INTO deleted_categories (name) VALUES (:n)"), {"n": category})
        db.commit()
    except Exception:
        pass
    return {"updated_articles": len(articles), "deleted": category}


@router.post("/admin/categories")
def add_category(body: dict, db: Session = Depends(get_db)):
    """Add a new custom category (persisted even without articles)."""
    name = (body.get("name") or "").strip()
    if not name:
        from fastapi import HTTPException
        raise HTTPException(400, "Category name required")
    from sqlalchemy import text
    try:
        db.execute(text("INSERT OR IGNORE INTO custom_categories (name) VALUES (:n)"), {"n": name})
        db.commit()
    except Exception as e:
        pass
    return {"ok": True, "name": name}


@router.get("/{article_id}")
def get_article(article_id: int, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article


@router.post("/")
def create_article(data: ArticleCreate, db: Session = Depends(get_db)):
    article = Article(**data.model_dump())
    db.add(article)
    db.commit()
    db.refresh(article)
    try:
        add_to_vector_store(article)
        rebuild_graph(db)
    except Exception:
        pass
    return article


@router.put("/{article_id}")
def update_article(article_id: int, data: ArticleUpdate, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(article, field, value)
    db.commit()
    db.refresh(article)
    return article


@router.delete("/{article_id}")
def delete_article(article_id: int, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    try:
        delete_from_vector_store(str(article_id))
    except Exception:
        pass
    db.delete(article)
    db.commit()
    try:
        rebuild_graph(db)
    except Exception:
        pass
    return {"message": "Article deleted"}


@router.post("/upload")
async def upload_article(
    file: UploadFile = File(...),
    topic_category: str = Form("General"),
    publication_date: str = Form(""),
    db: Session = Depends(get_db),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    unique_name = f"{uuid.uuid4()}_{file.filename}"
    file_path = upload_dir / unique_name

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    text = extract_text(str(file_path))
    metadata = await generate_article_metadata(text, file.filename)

    article = Article(
        title=metadata.get("title", file.filename.replace(".pdf", "")),
        summary_en=metadata.get("summary_en", ""),
        summary_th=metadata.get("summary_th", ""),
        key_insights=metadata.get("key_insights", []),
        tags=metadata.get("tags", []),
        topic_category=topic_category,
        pdf_path=f"/uploads/{unique_name}",
        publication_date=publication_date,
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    try:
        add_to_vector_store(article)
        rebuild_graph(db)
    except Exception:
        pass
    return article


@router.get("/{article_id}/pdf")
def get_pdf(article_id: int, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article or not article.pdf_path:
        raise HTTPException(status_code=404, detail="PDF not found")
    path = Path(settings.UPLOAD_DIR) / Path(article.pdf_path).name
    if not path.exists():
        raise HTTPException(status_code=404, detail="PDF file missing on disk")
    return FileResponse(str(path), media_type="application/pdf")
