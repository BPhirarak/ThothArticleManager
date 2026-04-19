"""
Steel Research Agent — searches open academic sources for papers/articles.

Sources:
  - arXiv          : public API (no key needed)
  - CORE           : public API (no key needed, rate-limited)
  - Semantic Scholar: public API (no key needed)
  - DOAJ           : public REST API (no key needed)
  - Google Scholar : HTML scrape (best-effort, may be rate-limited)
"""
import asyncio
import re
import urllib.parse
import urllib.request
import json
import httpx
from typing import List, Optional


# ── helpers ──────────────────────────────────────────────────────────────────

def _strip_html(text: str) -> str:
    result, in_tag = [], False
    for ch in text:
        if ch == '<':
            in_tag = True
        elif ch == '>':
            in_tag = False
        elif not in_tag:
            result.append(ch)
    return re.sub(r'\s+', ' ', ''.join(result)).strip()


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}


# ── per-source search functions ───────────────────────────────────────────────

async def search_arxiv(keyword: str, max_results: int = 15) -> List[dict]:
    """arXiv Atom API — reliable, no key needed."""
    try:
        q = urllib.parse.quote(keyword)
        url = (
            f"https://export.arxiv.org/api/query"
            f"?search_query=all:{q}&start=0&max_results={max_results}"
            f"&sortBy=relevance&sortOrder=descending"
        )
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url, headers={"User-Agent": HEADERS["User-Agent"]})
        xml = r.text
        results = []
        entries = xml.split("<entry>")[1:]
        for entry in entries:
            def _tag(t):
                m = re.search(rf"<{t}[^>]*>(.*?)</{t}>", entry, re.DOTALL)
                return _strip_html(m.group(1)) if m else ""
            title = _tag("title")
            summary = _tag("summary")[:300]
            published = _tag("published")[:10]
            # PDF link
            pdf_url = ""
            for link in re.findall(r'<link[^>]+>', entry):
                if 'type="application/pdf"' in link or 'title="pdf"' in link:
                    m = re.search(r'href="([^"]+)"', link)
                    if m:
                        pdf_url = m.group(1)
            # Abstract page
            abs_url = ""
            m = re.search(r'<id>(.*?)</id>', entry)
            if m:
                abs_url = m.group(1).strip()
            if not pdf_url and abs_url:
                pdf_url = abs_url.replace("/abs/", "/pdf/") + ".pdf"
            if title:
                results.append({
                    "source": "arXiv",
                    "title": title,
                    "abstract": summary,
                    "authors": [],
                    "year": published[:4],
                    "url": abs_url,
                    "pdf_url": pdf_url,
                    "open_access": True,
                })
        return results
    except Exception as e:
        print(f"[Research] arXiv error: {e}")
        return []


async def search_core(keyword: str, max_results: int = 15) -> List[dict]:
    """CORE.ac.uk public API v3 — open access full-text."""
    try:
        url = "https://api.core.ac.uk/v3/search/works"
        params = {"q": keyword, "limit": max_results, "offset": 0}
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url, params=params, headers=HEADERS)
        data = r.json()
        results = []
        for item in data.get("results", []):
            pdf_url = item.get("downloadUrl") or item.get("fullTextIdentifier") or ""
            results.append({
                "source": "CORE",
                "title": item.get("title", ""),
                "abstract": (item.get("abstract") or "")[:300],
                "authors": [a.get("name", "") for a in (item.get("authors") or [])[:3]],
                "year": str(item.get("yearPublished") or ""),
                "url": item.get("sourceFulltextUrls", [None])[0] or item.get("id", ""),
                "pdf_url": pdf_url,
                "open_access": True,
            })
        return results
    except Exception as e:
        print(f"[Research] CORE error: {e}")
        return []


async def search_semantic_scholar(keyword: str, max_results: int = 15) -> List[dict]:
    """Semantic Scholar public API."""
    try:
        q = urllib.parse.quote(keyword)
        url = (
            f"https://api.semanticscholar.org/graph/v1/paper/search"
            f"?query={q}&limit={max_results}"
            f"&fields=title,abstract,authors,year,openAccessPdf,externalIds,url"
        )
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url, headers=HEADERS)
        data = r.json()
        results = []
        for item in data.get("data", []):
            oa = item.get("openAccessPdf") or {}
            pdf_url = oa.get("url", "")
            paper_id = item.get("paperId", "")
            page_url = f"https://www.semanticscholar.org/paper/{paper_id}" if paper_id else ""
            results.append({
                "source": "Semantic Scholar",
                "title": item.get("title", ""),
                "abstract": (item.get("abstract") or "")[:300],
                "authors": [a.get("name", "") for a in (item.get("authors") or [])[:3]],
                "year": str(item.get("year") or ""),
                "url": page_url,
                "pdf_url": pdf_url,
                "open_access": bool(pdf_url),
            })
        return results
    except Exception as e:
        print(f"[Research] Semantic Scholar error: {e}")
        return []


async def search_doaj(keyword: str, max_results: int = 15) -> List[dict]:
    """DOAJ — Directory of Open Access Journals."""
    try:
        q = urllib.parse.quote(keyword)
        url = f"https://doaj.org/api/search/articles/{q}?pageSize={max_results}"
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url, headers=HEADERS)
        data = r.json()
        results = []
        for item in data.get("results", []):
            bib = item.get("bibjson", {})
            title = bib.get("title", "")
            abstract = (bib.get("abstract") or "")[:300]
            year = str(bib.get("year") or "")
            authors = [a.get("name", "") for a in (bib.get("author") or [])[:3]]
            # Links
            pdf_url, page_url = "", ""
            for lnk in bib.get("link", []):
                if lnk.get("type") == "fulltext":
                    page_url = lnk.get("url", "")
                if lnk.get("content_type") == "application/pdf":
                    pdf_url = lnk.get("url", "")
            if not pdf_url:
                pdf_url = page_url
            if title:
                results.append({
                    "source": "DOAJ",
                    "title": title,
                    "abstract": abstract,
                    "authors": authors,
                    "year": year,
                    "url": page_url,
                    "pdf_url": pdf_url,
                    "open_access": True,
                })
        return results
    except Exception as e:
        print(f"[Research] DOAJ error: {e}")
        return []


async def search_google_scholar(keyword: str, max_results: int = 10) -> List[dict]:
    """
    Google Scholar HTML scrape — best-effort.
    Returns results but PDF download is usually not available directly.
    """
    try:
        q = urllib.parse.quote_plus(keyword)
        url = f"https://scholar.google.com/scholar?q={q}&hl=en&num={max_results}"
        req = urllib.request.Request(url, headers={
            "User-Agent": HEADERS["User-Agent"],
            "Accept-Language": "en-US,en;q=0.9",
        })
        import urllib.request as ur
        with ur.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="ignore")

        results = []
        # Each result block starts with <div class="gs_r gs_or gs_scl"
        blocks = re.split(r'<div class="gs_r gs_or', html)[1:]
        for block in blocks[:max_results]:
            # Title + link
            title_m = re.search(r'<h3[^>]*class="gs_rt"[^>]*>.*?<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', block, re.DOTALL)
            title = _strip_html(title_m.group(2)) if title_m else ""
            page_url = title_m.group(1) if title_m else ""
            # Snippet
            snip_m = re.search(r'<div class="gs_rs">(.*?)</div>', block, re.DOTALL)
            abstract = _strip_html(snip_m.group(1)) if snip_m else ""
            # Authors / year
            meta_m = re.search(r'<div class="gs_a">(.*?)</div>', block, re.DOTALL)
            meta = _strip_html(meta_m.group(1)) if meta_m else ""
            year_m = re.search(r'\b(19|20)\d{2}\b', meta)
            year = year_m.group(0) if year_m else ""
            # PDF link (gs_or_ggsm block)
            pdf_m = re.search(r'href="(https?://[^"]+\.pdf[^"]*)"', block)
            pdf_url = pdf_m.group(1) if pdf_m else ""
            if title:
                results.append({
                    "source": "Google Scholar",
                    "title": title,
                    "abstract": abstract[:300],
                    "authors": [],
                    "year": year,
                    "url": page_url,
                    "pdf_url": pdf_url,
                    "open_access": bool(pdf_url),
                })
        return results
    except Exception as e:
        print(f"[Research] Google Scholar error: {e}")
        return []


# ── main entry point ──────────────────────────────────────────────────────────

SOURCE_MAP = {
    "arxiv": search_arxiv,
    "core": search_core,
    "semantic_scholar": search_semantic_scholar,
    "doaj": search_doaj,
    "google_scholar": search_google_scholar,
}


async def run_research_search(
    keyword: str,
    sources: List[str],
    max_per_source: int = 15,
    task_id: str = "",
    tasks: dict = {},
) -> List[dict]:
    """Search all selected sources concurrently and return merged results."""

    def log(msg):
        if task_id and tasks:
            tasks[task_id]["progress"].append(msg)

    log(f"Searching for: \"{keyword}\"")
    log(f"Sources: {', '.join(sources)}")

    # Run all selected sources concurrently
    coros = []
    source_names = []
    for src in sources:
        fn = SOURCE_MAP.get(src)
        if fn:
            coros.append(fn(keyword, max_per_source))
            source_names.append(src)

    results_per_source = await asyncio.gather(*coros, return_exceptions=True)

    all_results = []
    for src, res in zip(source_names, results_per_source):
        if isinstance(res, Exception):
            log(f"  ⚠️ {src}: error — {res}")
            continue
        log(f"  ✓ {src}: {len(res)} results")
        all_results.extend(res)

    # Deduplicate by title similarity (simple lowercase match)
    seen_titles = set()
    deduped = []
    for item in all_results:
        key = re.sub(r'\W+', '', item["title"].lower())[:60]
        if key and key not in seen_titles:
            seen_titles.add(key)
            deduped.append(item)

    log(f"Total unique results: {len(deduped)}")
    return deduped


async def download_research_pdf(url: str, title: str, upload_dir: str) -> Optional[str]:
    """Download a PDF from a URL into the upload directory. Returns saved filename or None."""
    if not url:
        return None
    try:
        import os
        from pathlib import Path

        # Sanitize filename
        safe_title = re.sub(r'[^\w\s-]', '', title)[:60].strip().replace(' ', '_')
        filename = f"research_{safe_title}.pdf"
        dest = Path(upload_dir) / filename

        async with httpx.AsyncClient(
            timeout=60,
            follow_redirects=True,
            headers={"User-Agent": HEADERS["User-Agent"]},
        ) as client:
            r = await client.get(url)
            if r.status_code == 200 and (
                "pdf" in r.headers.get("content-type", "").lower()
                or url.lower().endswith(".pdf")
                or len(r.content) > 10_000
            ):
                dest.write_bytes(r.content)
                return str(dest)
    except Exception as e:
        print(f"[Research] PDF download error for {url}: {e}")
    return None
