"""AIST browser automation agent using Playwright.

Windows fix: Playwright requires ProactorEventLoop but uvicorn uses SelectorEventLoop.
Solution: run the browser in a separate thread with its own event loop.
"""
import asyncio
import concurrent.futures
from pathlib import Path
from typing import Optional
from config import settings


def _run_browser_sync(year: int, month: Optional[int], topics: list,
                      progress_list: list, upload_dir: str,
                      existing_ids: set, download_ids: list) -> list:
    """Runs in a dedicated thread with its own event loop (Windows fix)."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(
            _browser_task(year, month, topics, progress_list, upload_dir, existing_ids, download_ids)
        )
    finally:
        loop.close()


async def _browser_task(year: int, month: Optional[int], topics: list,
                        progress_list: list, upload_dir: str,
                        existing_ids: set, download_ids: list) -> list:
    """Playwright automation: scan catalog, optionally download & process PDFs."""
    def log(msg: str):
        progress_list.append(msg)

    from playwright.async_api import async_playwright

    USER_ID = 'ctl01_TemplateBody_WebPartManager1_gwpciNewContactSignInCommon_ciNewContactSignInCommon_signInUserName'
    PASS_ID = 'ctl01_TemplateBody_WebPartManager1_gwpciNewContactSignInCommon_ciNewContactSignInCommon_signInPassword'
    SUBMIT_ID = 'ctl01_TemplateBody_WebPartManager1_gwpciNewContactSignInCommon_ciNewContactSignInCommon_SubmitButton'

    articles_found = []
    Path(upload_dir).mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        log("Launching browser...")
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(accept_downloads=True)
        page = await context.new_page()

        try:
            # ── Step 1: Login ──────────────────────────────────────────────
            log("Navigating to AIST login page...")
            login_url = 'https://imis.aist.org/AISTmemberportal/Sign_In.aspx?ReturnURL=%2Fstore%2Fcatalog.aspx'
            await page.goto(login_url, timeout=30000)
            await page.wait_for_load_state('domcontentloaded', timeout=20000)

            log("Logging in...")
            await page.fill(f'#{USER_ID}', settings.AIST_USER)
            await page.fill(f'#{PASS_ID}', settings.AIST_PASSWORD)
            await page.click(f'#{SUBMIT_ID}')
            try:
                await page.wait_for_url(
                    lambda url: 'sign_in' not in url.lower() and 'signin' not in url.lower(),
                    timeout=20000
                )
            except Exception:
                pass
            await page.wait_for_load_state('domcontentloaded', timeout=15000)

            if 'sign_in' in page.url.lower():
                log("❌ Login failed — check AIST_USER / AIST_PASSWORD in .env")
                return []
            log("✓ Login successful")

            # ── Step 2: Open catalog ───────────────────────────────────────
            log("Opening Iron & Steel Technology catalog...")
            await page.goto('https://imis.aist.org/store/catalog.aspx#product=full-issue', timeout=30000)
            await page.wait_for_load_state('domcontentloaded', timeout=15000)
            await page.wait_for_timeout(3000)

            # ── Step 3: Scan articles with JS (fast) ───────────────────────
            year_short = str(year)[-2:]
            month_str = f"{month:02d}" if month else None
            id_pattern = f"PR-PM{month_str}{year_short}" if month_str else "PR-PM"
            log(f"Scanning for articles matching: {id_pattern}")
            await page.wait_for_timeout(2000)

            matching = await page.evaluate(f"""
                () => {{
                    const pattern = '{id_pattern}'.toLowerCase();
                    const links = Array.from(document.querySelectorAll('a[href*="detail.aspx"]'));
                    const results = [];
                    const seen = new Set();
                    for (const link of links) {{
                        const href = link.href || '';
                        const idMatch = href.match(/[?&]id=([^&]+)/i);
                        if (!idMatch) continue;
                        const articleId = idMatch[1];
                        if (!articleId.toLowerCase().includes(pattern)) continue;
                        if (seen.has(articleId)) continue;
                        seen.add(articleId);
                        let title = '';
                        let el = link.parentElement;
                        for (let i = 0; i < 6 && el; i++) {{
                            const text = el.textContent.trim();
                            if (text.length > 20) {{
                                const lines = text.split('\\n')
                                    .map(l => l.trim())
                                    .filter(l => l.length > 15 &&
                                        !['add to cart','detail','view','buy','free','download','login'].some(k => l.toLowerCase() === k));
                                if (lines.length > 0) {{ title = lines[0].substring(0, 150); break; }}
                            }}
                            el = el.parentElement;
                        }}
                        if (!title) title = articleId;
                        results.push({{ articleId, href, title }});
                        if (results.length >= 30) break;
                    }}
                    return results;
                }}
            """)

            log(f"Found {len(matching)} matching articles")

            # Fetch titles from detail pages only when count is small (≤10)
            # to avoid timeout when scanning all months
            fetch_titles = len(matching) <= 10

            for item in matching:
                aid = item.get("articleId", "")
                already = aid.upper() in existing_ids
                detail_url = item.get("href") or f"https://imis.aist.org/store/detail.aspx?id={aid}"
                title = aid  # fallback

                if fetch_titles:
                    try:
                        detail_page = await context.new_page()
                        await detail_page.goto(detail_url, timeout=20000)
                        await detail_page.wait_for_load_state('domcontentloaded', timeout=10000)
                        for sel in ['h1.product-title', 'h1', 'h2.product-name', '.product-title', '.item-title', 'h2']:
                            try:
                                t = await detail_page.locator(sel).first.inner_text(timeout=3000)
                                t = t.strip()
                                if t and len(t) > 10 and t.lower() not in ['aist store', 'iron & steel technology']:
                                    title = t
                                    break
                            except Exception:
                                pass
                        await detail_page.close()
                    except Exception:
                        pass
                else:
                    # Use article_id as placeholder — title will be fetched during download
                    title = aid

                articles_found.append({
                    "title": title,
                    "source_url": detail_url,
                    "article_id": aid,
                    "status": "already_imported" if already else "found",
                    "in_db": already,
                })
                mark = "✓ (already in DB)" if already else "▸"
                log(f"  {mark} [{aid}] {title[:70]}")

            if not articles_found:
                log("No articles found. Trying broader scan...")
                fallback = await page.evaluate("""
                    () => Array.from(document.querySelectorAll('a[href*="PR-PM"]'))
                        .slice(0, 20).map(l => ({ href: l.href, title: l.textContent.trim().substring(0, 100) }))
                """)
                for item in fallback:
                    articles_found.append({
                        "title": item.get("title") or item.get("href"),
                        "source_url": item.get("href"),
                        "status": "found",
                        "in_db": False,
                    })
                    log(f"  ▸ {(item.get('title') or '')[:60]}")

            # ── Step 4: Download selected articles ─────────────────────────
            if download_ids:
                log(f"\nDownloading {len(download_ids)} selected articles...")
                for article in articles_found:
                    aid = article.get("article_id", "")
                    if aid not in download_ids:
                        continue

                    detail_url = article.get("source_url") or f"https://imis.aist.org/store/detail.aspx?id={aid}"
                    log(f"  Opening detail page: {aid}")
                    try:
                        await page.goto(detail_url, timeout=30000)
                        await page.wait_for_load_state('domcontentloaded', timeout=15000)
                        await page.wait_for_timeout(1500)

                        # Get title from detail page
                        try:
                            title_el = await page.locator('h1, h2, .product-title, .item-title').first.inner_text(timeout=5000)
                            if title_el and len(title_el.strip()) > 5:
                                article["title"] = title_el.strip()
                                log(f"    Title: {title_el.strip()[:70]}")
                        except Exception:
                            pass

                        # Find download link
                        pdf_filename = f"{aid}.pdf"
                        pdf_path = Path(upload_dir) / pdf_filename
                        download_link = None
                        for sel in ['a[href*=".pdf"]', 'a:has-text("Download")', 'a:has-text("PDF")',
                                    'a:has-text("Free")', 'a:has-text("View")']:
                            try:
                                el = page.locator(sel).first
                                if await el.count() > 0:
                                    download_link = el
                                    break
                            except Exception:
                                pass

                        if download_link:
                            log(f"    Downloading PDF...")
                            async with page.expect_download(timeout=60000) as dl_info:
                                await download_link.click()
                            dl = await dl_info.value
                            await dl.save_as(str(pdf_path))
                            article["pdf_path"] = f"/uploads/{pdf_filename}"
                            article["status"] = "downloaded"
                            log(f"    ✓ Saved: {pdf_filename}")
                        else:
                            article["status"] = "no_download_link"
                            article["pdf_path"] = ""
                            log(f"    ⚠ No download link found (may require purchase)")

                    except Exception as e:
                        log(f"    ❌ Error: {e}")
                        article["status"] = "download_error"
                        article["pdf_path"] = ""

            log("\n✓ Agent complete.")

        except Exception as e:
            log(f"❌ Browser error: {e}")
        finally:
            await browser.close()

    return articles_found


async def run_aist_agent(year: int, month: Optional[int], topics: list,
                         task_id: str, tasks: dict,
                         existing_ids: set = None,
                         download_ids: list = None) -> list:
    """Entry point — offloads Playwright to a thread (Windows event loop fix)."""
    def log(msg: str):
        tasks[task_id]["progress"].append(msg)

    log(f"Starting AIST agent for year={year}, month={month}, topics={topics}")

    try:
        import playwright  # noqa
    except ImportError:
        log("❌ Playwright not installed. Run: pip install playwright && playwright install chromium")
        tasks[task_id]["status"] = "error"
        tasks[task_id]["error"] = "Playwright not installed"
        return []

    upload_dir = str(Path(settings.UPLOAD_DIR).resolve())
    progress_list = tasks[task_id]["progress"]

    loop = asyncio.get_event_loop()
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = loop.run_in_executor(
                executor, _run_browser_sync,
                year, month, topics, progress_list, upload_dir,
                existing_ids or set(), download_ids or []
            )
            results = await asyncio.wait_for(future, timeout=600)
        return results
    except asyncio.TimeoutError:
        log("❌ Agent timed out after 10 minutes")
        tasks[task_id]["status"] = "error"
        tasks[task_id]["error"] = "Timeout"
        return []
    except Exception as e:
        log(f"❌ Playwright error: {e}")
        tasks[task_id]["status"] = "error"
        tasks[task_id]["error"] = str(e)
        return []
