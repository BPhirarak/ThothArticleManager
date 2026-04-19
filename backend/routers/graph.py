from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Article, ArticleRelationship
from services.graph_service import rebuild_graph, get_graph_data, get_related_articles

router = APIRouter()


@router.get("/")
def graph_data(db: Session = Depends(get_db)):
    return get_graph_data(db)


@router.get("/{article_id}/related")
def related(article_id: int, limit: int = 5, db: Session = Depends(get_db)):
    return get_related_articles(db, article_id, limit)


@router.post("/rebuild")
def rebuild(db: Session = Depends(get_db)):
    rebuild_graph(db)
    return {"message": "Graph rebuilt"}
