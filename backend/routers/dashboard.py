from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Article
from services.ai_service import generate_report_markdown
import tempfile, os, uuid
from pathlib import Path

router = APIRouter()


class ReportRequest(BaseModel):
    article_ids: List[int]
    format: str = "markdown"
    title: str = "SYS Knowledge Hub — Research Report"
    language: Optional[str] = "en"  # "en" | "th"


@router.post("/report")
async def generate_report(body: ReportRequest, db: Session = Depends(get_db)):
    articles = db.query(Article).filter(Article.id.in_(body.article_ids)).all()
    if not articles:
        raise HTTPException(status_code=404, detail="No articles found")
    md = await generate_report_markdown(articles, body.title, language=body.language or "en")
    return {"markdown": md, "article_count": len(articles)}


@router.post("/presentation")
async def generate_presentation(body: ReportRequest, db: Session = Depends(get_db)):
    articles = db.query(Article).filter(Article.id.in_(body.article_ids)).all()
    if not articles:
        raise HTTPException(status_code=404, detail="No articles found")
    from services.ai_service import generate_pptx
    path = await generate_pptx(articles, body.title)
    return FileResponse(path, media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
                        filename="report.pptx")
