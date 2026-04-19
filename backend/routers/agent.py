from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from database import get_db
from models import Article
import asyncio, uuid

router = APIRouter()
_tasks: dict = {}


class AistSearchRequest(BaseModel):
    year: int
    month: Optional[int] = None
    topics: List[str] = []


class DownloadRequest(BaseModel):
    task_id: str
    article_ids: List[str]
    # Per-article category map: {"PR-PM0226-1": "Steel Making", "PR-PM0226-3": "General"}
    topic_categories: dict = {}
    publication_date: str = ""


@router.post("/search-aist")
async def search_aist(body: AistSearchRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    task_id = str(uuid.uuid4())
    _tasks[task_id] = {"status": "running", "progress": [], "articles": [], "error": None}

    # Collect existing article IDs from DB to mark duplicates
    existing = db.query(Article.pdf_path).all()
    existing_ids = set()
    for (path,) in existing:
        if path:
            # Extract PR-PM ID from path like /uploads/PR-PM0226-2_...pdf
            import re
            m = re.search(r'(PR-PM\d+-\d+)', path, re.IGNORECASE)
            if m:
                existing_ids.add(m.group(1).upper())

    async def run():
        try:
            from services.aist_agent import run_aist_agent
            results = await run_aist_agent(
                body.year, body.month, body.topics, task_id, _tasks,
                existing_ids=existing_ids
            )
            _tasks[task_id]["articles"] = results
        except Exception as e:
            _tasks[task_id]["error"] = str(e)
        finally:
            if _tasks[task_id]["status"] == "running":
                _tasks[task_id]["status"] = "done"

    background_tasks.add_task(run)
    return {"task_id": task_id}


@router.post("/download-and-import")
async def download_and_import(body: DownloadRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Download selected articles, extract text, generate AI metadata, save to DB."""
    # Get the scan results from the existing task
    scan_task = _tasks.get(body.task_id)
    if not scan_task:
        raise HTTPException(status_code=404, detail="Scan task not found — run search first")

    dl_task_id = str(uuid.uuid4())
    _tasks[dl_task_id] = {"status": "running", "progress": [], "articles": [], "imported": [], "error": None}

    # Get year/month from scan task articles to pass back to agent
    scan_articles = scan_task.get("articles", [])
    # Find year/month from article IDs (PR-PM{MM}{YY})
    year, month = 2026, None
    for a in scan_articles:
        aid = a.get("article_id", "")
        import re
        m = re.match(r'PR-PM(\d{2})(\d{2})', aid, re.IGNORECASE)
        if m:
            month = int(m.group(1))
            year = 2000 + int(m.group(2))
            break

    async def run():
        def log(msg):
            _tasks[dl_task_id]["progress"].append(msg)

        try:
            from services.aist_agent import run_aist_agent
            from services.pdf_service import extract_text
            from services.ai_service import generate_article_metadata
            from services.graph_service import rebuild_graph
            from services.vector_service import add_to_vector_store
            from pathlib import Path
            from config import settings

            log(f"Starting download for {len(body.article_ids)} articles...")

            # Re-run agent with download_ids to get PDFs
            results = await run_aist_agent(
                year, month, [], dl_task_id, _tasks,
                existing_ids=set(),
                download_ids=body.article_ids
            )

            imported = []
            for article_data in results:
                aid = article_data.get("article_id", "")
                if aid not in body.article_ids:
                    continue
                if article_data.get("status") not in ("downloaded", "no_download_link"):
                    continue

                log(f"\nProcessing: {aid}")
                pdf_path_str = article_data.get("pdf_path", "")
                text = ""

                if pdf_path_str:
                    full_path = Path(settings.UPLOAD_DIR) / Path(pdf_path_str).name
                    if full_path.exists():
                        log(f"  Extracting text from PDF...")
                        text = extract_text(str(full_path))

                # Generate AI metadata
                log(f"  Generating AI metadata...")
                title = article_data.get("title", aid)
                metadata = await generate_article_metadata(text, title)

                # Build publication_date from article ID
                pub_date = body.publication_date
                if not pub_date:
                    import re
                    m = re.match(r'PR-PM(\d{2})(\d{2})', aid, re.IGNORECASE)
                    if m:
                        pub_date = f"20{m.group(2)}-{m.group(1)}"

                # Save to DB
                article = Article(
                    title=metadata.get("title") or title,
                    summary_en=metadata.get("summary_en", ""),
                    summary_th=metadata.get("summary_th", ""),
                    key_insights=metadata.get("key_insights", []),
                    tags=metadata.get("tags", []),
                    topic_category=body.topic_categories.get(aid, "General"),
                    pdf_path=pdf_path_str,
                    source_url=article_data.get("source_url", ""),
                    publication_date=pub_date,
                )
                db.add(article)
                db.commit()
                db.refresh(article)

                # Vector store + graph
                try:
                    add_to_vector_store(article)
                except Exception:
                    pass

                imported.append({"id": article.id, "title": article.title, "article_id": aid})
                log(f"  ✓ Saved to DB: {article.title[:60]}")

            # Rebuild graph once after all imports
            if imported:
                log("\nRebuilding knowledge graph...")
                rebuild_graph(db)
                log(f"✓ Done! Imported {len(imported)} articles.")

            _tasks[dl_task_id]["imported"] = imported
            _tasks[dl_task_id]["articles"] = results

        except Exception as e:
            _tasks[dl_task_id]["error"] = str(e)
            _tasks[dl_task_id]["progress"].append(f"❌ Error: {e}")
        finally:
            if _tasks[dl_task_id]["status"] == "running":
                _tasks[dl_task_id]["status"] = "done"

    background_tasks.add_task(run)
    return {"task_id": dl_task_id}


@router.get("/status/{task_id}")
def get_status(task_id: str):
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/import-article")
async def import_article(article_data: dict, db: Session = Depends(get_db)):
    from services.vector_service import add_to_vector_store
    from services.graph_service import rebuild_graph
    article = Article(**article_data)
    db.add(article)
    db.commit()
    db.refresh(article)
    try:
        add_to_vector_store(article)
        rebuild_graph(db)
    except Exception:
        pass
    return article


# ── Steel Research Agent endpoints ───────────────────────────────────────────

class ResearchSearchRequest(BaseModel):
    keyword: str
    sources: List[str] = ["arxiv", "core", "semantic_scholar", "doaj"]


class ResearchDownloadRequest(BaseModel):
    task_id: str
    selected_indices: List[int]          # indices into task results list
    topic_categories: dict = {}          # { index_str: category }
    publication_date: str = ""
    visibility: str = "public"


@router.post("/research-search")
async def research_search(body: ResearchSearchRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    _tasks[task_id] = {"status": "running", "progress": [], "articles": [], "error": None}

    async def run():
        try:
            from services.research_agent import run_research_search
            results = await run_research_search(
                keyword=body.keyword,
                sources=body.sources,
                max_per_source=15,
                task_id=task_id,
                tasks=_tasks,
            )
            _tasks[task_id]["articles"] = results
        except Exception as e:
            _tasks[task_id]["error"] = str(e)
            _tasks[task_id]["progress"].append(f"❌ {e}")
        finally:
            _tasks[task_id]["status"] = "done"

    background_tasks.add_task(run)
    return {"task_id": task_id}


@router.post("/research-download")
async def research_download(body: ResearchDownloadRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    scan_task = _tasks.get(body.task_id)
    if not scan_task:
        raise HTTPException(status_code=404, detail="Search task not found")

    dl_task_id = str(uuid.uuid4())
    _tasks[dl_task_id] = {"status": "running", "progress": [], "imported": [], "error": None}

    all_articles = scan_task.get("articles", [])

    async def run():
        def log(msg):
            _tasks[dl_task_id]["progress"].append(msg)

        try:
            from services.research_agent import download_research_pdf
            from services.pdf_service import extract_text
            from services.ai_service import generate_article_metadata
            from services.graph_service import rebuild_graph
            from services.vector_service import add_to_vector_store
            from config import settings

            log(f"Starting import of {len(body.selected_indices)} articles...")
            imported = []

            for idx in body.selected_indices:
                if idx >= len(all_articles):
                    continue
                item = all_articles[idx]
                title = item.get("title", f"Article_{idx}")
                pdf_url = item.get("pdf_url", "")
                log(f"\n[{idx+1}] {title[:60]}")

                # Download PDF
                pdf_path = None
                if pdf_url:
                    log(f"  Downloading PDF...")
                    pdf_path = await download_research_pdf(pdf_url, title, settings.UPLOAD_DIR)
                    if pdf_path:
                        log(f"  ✓ Downloaded")
                    else:
                        log(f"  ⚠️ PDF not available — using abstract only")

                # Extract text
                text = ""
                if pdf_path:
                    try:
                        text = extract_text(pdf_path)
                    except Exception:
                        pass
                if not text:
                    text = f"{title}\n\n{item.get('abstract', '')}"

                # AI metadata
                log(f"  Generating AI metadata...")
                metadata = await generate_article_metadata(text, title)

                # Merge abstract from source if AI didn't get much
                if not metadata.get("summary_en") or len(metadata.get("summary_en", "")) < 50:
                    metadata["summary_en"] = item.get("abstract", "")

                # Category
                category = body.topic_categories.get(str(idx), "General")

                # Publication date
                pub_date = body.publication_date or item.get("year", "") or ""

                # Save to DB
                article = Article(
                    title=metadata.get("title") or title,
                    summary_en=metadata.get("summary_en", ""),
                    summary_th=metadata.get("summary_th", ""),
                    key_insights=metadata.get("key_insights", []),
                    tags=metadata.get("tags", []),
                    topic_category=category,
                    pdf_path=pdf_path or "",
                    source_url=item.get("url", ""),
                    publication_date=pub_date,
                    visibility=body.visibility,
                )
                db.add(article)
                db.commit()
                db.refresh(article)

                try:
                    add_to_vector_store(article)
                except Exception:
                    pass

                imported.append({"id": article.id, "title": article.title, "idx": idx})
                log(f"  ✓ Saved: {article.title[:60]}")

            if imported:
                log("\nRebuilding knowledge graph...")
                rebuild_graph(db)
                log(f"✓ Done! Imported {len(imported)} articles.")

            _tasks[dl_task_id]["imported"] = imported

        except Exception as e:
            _tasks[dl_task_id]["error"] = str(e)
            _tasks[dl_task_id]["progress"].append(f"❌ Error: {e}")
        finally:
            _tasks[dl_task_id]["status"] = "done"

    background_tasks.add_task(run)
    return {"task_id": dl_task_id}
