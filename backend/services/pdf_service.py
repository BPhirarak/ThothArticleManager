"""PDF text extraction using PyMuPDF."""
from pathlib import Path


def extract_text(pdf_path: str, max_chars: int = 50000) -> str:
    """Extract and clean text from a PDF file."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(pdf_path)
        pages = []
        for page in doc:
            text = page.get_text("text")
            pages.append(text)
        doc.close()
        full_text = "\n".join(pages)
        # Basic cleanup
        lines = [l.strip() for l in full_text.splitlines() if l.strip()]
        cleaned = "\n".join(lines)
        return cleaned[:max_chars]
    except Exception as e:
        return f"[PDF extraction failed: {e}]"


def get_pdf_metadata(pdf_path: str) -> dict:
    """Extract basic metadata from PDF."""
    try:
        import fitz
        doc = fitz.open(pdf_path)
        meta = doc.metadata
        page_count = doc.page_count
        doc.close()
        return {"pages": page_count, "title": meta.get("title", ""), "author": meta.get("author", "")}
    except Exception:
        return {"pages": 0, "title": "", "author": ""}
