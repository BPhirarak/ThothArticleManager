"""Chat router with article filtering, online search, and persistent session history."""
import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Article
from services.ai_service import answer_question
from services.vector_service import search_similar

router = APIRouter()

# In-memory sessions: { session_id: [messages] }
_sessions: dict = {}


class ChatMessage(BaseModel):
    message: str
    model: str = "openai"
    session_id: str = "default"
    # Article/category filter
    article_ids: Optional[List[int]] = None   # specific articles; None = all (RAG)
    category: Optional[str] = None            # filter by category; None = all
    # Features
    web_search: bool = False


class SessionCreate(BaseModel):
    session_id: str
    messages: list = []
    preview: str = ""


def _get_session(session_id: str) -> list:
    return _sessions.setdefault(session_id, [])


@router.post("/sessions")
def save_session(body: SessionCreate):
    _sessions[body.session_id] = body.messages
    return {"ok": True}


@router.get("/sessions")
def list_sessions():
    return [
        {
            "session_id": sid,
            "message_count": len(msgs),
            "preview": next((m["content"][:60] for m in msgs if m["role"] == "user"), ""),
        }
        for sid, msgs in _sessions.items()
        if msgs
    ]


def _build_context_from_articles(articles: list) -> list:
    """Build context_docs from Article ORM objects."""
    return [
        {
            "id": str(a.id),
            "title": a.title,
            "topic": a.topic_category,
            "content": f"{a.summary_en}\n\nKey Insights:\n" + "\n".join(f"- {i}" for i in (a.key_insights or [])),
        }
        for a in articles
    ]


async def _web_search(query: str) -> list:
    """
    Web search backends (in priority order):
    1. Gemini with Google Search grounding — needs only GOOGLE_API_KEY, no CSE_ID
    2. DuckDuckGo via ddgs package — no API key needed
    3. DuckDuckGo HTML scrape fallback
    """
    from config import settings

    # ── 1. Gemini Google Search Grounding (API key only, no CSE needed) ────
    if settings.GOOGLE_API_KEY:
        try:
            from google import genai
            from google.genai.types import Tool, GoogleSearch

            client = genai.Client(api_key=settings.GOOGLE_API_KEY)
            response = client.models.generate_content(
                model="gemini-3.1-flash-lite-preview",
                contents=query,
                config={"tools": [Tool(google_search=GoogleSearch())]},
            )

            results = []
            try:
                gm = response.candidates[0].grounding_metadata
                for chunk in (gm.grounding_chunks or [])[:6]:
                    web = getattr(chunk, "web", None)
                    if web:
                        uri = getattr(web, "uri", "") or ""
                        title = getattr(web, "title", "") or ""
                        results.append({
                            "title": title,
                            "content": "",
                            "source_url": uri,
                        })
                # Fill in content snippets from grounding supports
                for support in (gm.grounding_supports or []):
                    seg = getattr(support, "segment", None)
                    indices = getattr(support, "grounding_chunk_indices", []) or []
                    if seg and indices:
                        for idx in indices:
                            if idx < len(results) and not results[idx]["content"]:
                                results[idx]["content"] = getattr(seg, "text", "")[:400]
            except Exception:
                pass

            # Always return Gemini answer even if no grounding URLs
            if not results and response.text:
                results.append({
                    "title": f"Google (Gemini): {query[:60]}",
                    "content": response.text[:800],
                    "source_url": f"https://www.google.com/search?q={query.replace(' ', '+')}",
                })
            elif results and response.text:
                # Prepend the synthesized answer as first result
                results.insert(0, {
                    "title": f"Google Search Summary",
                    "content": response.text[:800],
                    "source_url": f"https://www.google.com/search?q={query.replace(' ', '+')}",
                })

            if results:
                print(f"[WebSearch] Gemini returned {len(results)} results")
                return results
        except Exception as e:
            print(f"[WebSearch] Gemini grounding error: {e}")

    # ── 2. DuckDuckGo package ──────────────────────────────────────────────
    try:
        from ddgs import DDGS
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=8):
                title = r.get("title", "")
                url = r.get("href", "")
                # Skip results that look like spam/unrelated (Thai entertainment, etc.)
                if not url.startswith("http"):
                    continue
                # Skip if title has mostly non-ASCII (Thai/Chinese spam)
                ascii_ratio = sum(1 for c in title if ord(c) < 128) / max(len(title), 1)
                if ascii_ratio < 0.5:
                    continue
                results.append({
                    "title": title,
                    "content": r.get("body", "")[:400],
                    "source_url": url,
                })
        if results:
            return results
    except ImportError:
        pass
    except Exception as e:
        print(f"[WebSearch] DuckDuckGo error: {e}")

    # ── 3. DuckDuckGo HTML scrape fallback ─────────────────────────────────
    try:
        import urllib.parse, urllib.request

        def strip_tags(text):
            result, in_tag = [], False
            for ch in text:
                if ch == '<': in_tag = True
                elif ch == '>': in_tag = False
                elif not in_tag: result.append(ch)
            return "".join(result).replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")

        encoded = urllib.parse.quote_plus(query)
        url = f"https://html.duckduckgo.com/html/?q={encoded}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="ignore")

        results = []
        parts = html.split('<a class="result__a"')
        for part in parts[1:6]:
            href_start = part.find('href="') + 6
            href_end = part.find('"', href_start)
            href = part[href_start:href_end]
            title_start = part.find('>') + 1
            title_end = part.find('</a>', title_start)
            title = strip_tags(part[title_start:title_end]).strip()
            snip_start = part.find('result__snippet">')
            snippet = ""
            if snip_start != -1:
                snip_start += len('result__snippet">')
                snip_end = part.find('</a>', snip_start)
                snippet = strip_tags(part[snip_start:snip_end])[:400].strip()
            if href and title:
                results.append({"title": title, "content": snippet, "source_url": href})
        return results
    except Exception as e:
        print(f"[WebSearch] Scrape error: {e}")

    return []


@router.post("/message")
async def chat(body: ChatMessage, db: Session = Depends(get_db)):
    history = _get_session(body.session_id)

    # ── Build context ──────────────────────────────────────────────────────
    context_docs = []

    if body.article_ids:
        # Specific articles selected
        articles = db.query(Article).filter(Article.id.in_(body.article_ids)).all()
        context_docs = _build_context_from_articles(articles)
    elif body.category and body.category != "__all__":
        # Filter by category
        articles = db.query(Article).filter(Article.topic_category == body.category).all()
        context_docs = _build_context_from_articles(articles)
    else:
        # RAG: semantic search across all articles
        context_docs = search_similar(body.message, n=5)

    # ── Online search (optional) ───────────────────────────────────────────
    web_results = []
    if body.web_search:
        search_query = body.message

        # Always enrich query with article context when context is available
        if context_docs:
            keywords = []
            for doc in context_docs[:2]:
                title = doc.get("title", "")
                if title and title not in ["Unknown"]:
                    keywords.append(title[:50])
            if keywords and len(body.message.split()) < 15:
                context_hint = " | ".join(keywords[:2])
                search_query = f"{body.message} {context_hint}"
                print(f"[WebSearch] Enriched query: {search_query[:100]}")

        raw_results = await _web_search(search_query)
        # Filter: keep only results with real URL and non-spam title (mostly ASCII)
        def is_valid_result(r):
            url = r.get("source_url", "")
            title = r.get("title", "")
            if not url.startswith("http"):
                return False
            # Skip titles that are mostly non-ASCII (Thai/Chinese spam from DDG)
            if title:
                ascii_ratio = sum(1 for c in title if ord(c) < 128) / len(title)
                if ascii_ratio < 0.5:
                    return False
            return True
        web_results = [r for r in raw_results if is_valid_result(r)]

    # ── Answer ────────────────────────────────────────────────────────────
    response = await answer_question(
        question=body.message,
        context_docs=context_docs,
        web_results=web_results,
        history=history[-10:],
        model=body.model,
    )

    # Save to session
    history.append({"role": "user", "content": body.message})
    history.append({"role": "assistant", "content": response["answer"]})

    return {
        "answer": response["answer"],
        "sources": response.get("sources", []),
        "web_sources": response.get("web_sources", []),
        "related_articles": context_docs[:3],
        "session_id": body.session_id,
    }


@router.get("/sessions/{session_id}")
def get_session(session_id: str):
    return _sessions.get(session_id, [])


@router.post("/sessions")
def save_session(body: SessionCreate):
    _sessions[body.session_id] = body.messages
    return {"ok": True}


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str):
    _sessions.pop(session_id, None)
    return {"ok": True}


@router.get("/history")
def get_history():
    return _sessions.get("default", [])


@router.delete("/history")
def clear_history():
    _sessions.pop("default", None)
    return {"message": "History cleared"}
