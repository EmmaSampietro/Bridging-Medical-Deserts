"""HTTP fetchers with retries, backoff, robots compliance, and optional Playwright fallback."""

from __future__ import annotations

import hashlib
import logging
import re
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Iterable, List, Optional, Tuple
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser
from uuid import uuid4

try:
    import httpx
except ImportError:  # pragma: no cover
    httpx = None

try:
    from bs4 import BeautifulSoup
except ImportError:  # pragma: no cover
    BeautifulSoup = None

from .document_store import DocumentRecord


@dataclass(frozen=True)
class ScrapeRequest:
    facility_id: str
    facility_name: str
    country: str
    url: str
    source_field: str


@dataclass
class ScraperConfig:
    timeout_sec: float = 30.0
    retries: int = 2
    respect_robots: bool = True
    cache_dir: Path | None = None
    concurrency: int = 4
    user_agent: str = "BMD-Ingestor/0.1"
    # Exponential backoff: sleep backoff_base_sec * (2 ** attempt) before retry (capped by backoff_max_sec).
    backoff_base_sec: float = 1.0
    backoff_max_sec: float = 60.0
    # Retry on these HTTP status codes (e.g. rate limit, server busy).
    retry_on_status: Tuple[int, ...] = (429, 502, 503)
    # Optional: after httpx fails, try Playwright (headless browser) for JS-heavy or bot-resistant sites.
    use_playwright_fallback: bool = False
    # Min seconds between requests to the same host (politeness; 0 = disabled).
    delay_between_requests_per_domain: float = 0.0


class RobotsCache:
    def __init__(self, user_agent: str) -> None:
        self.user_agent = user_agent
        self._cache: dict[str, RobotFileParser] = {}

    def allowed(self, url: str) -> bool:
        parsed = urlparse(url)
        key = f"{parsed.scheme}://{parsed.netloc}"
        parser = self._cache.get(key)
        if parser is None:
            parser = RobotFileParser()
            parser.set_url(f"{key}/robots.txt")
            try:
                parser.read()
            except Exception:
                parser = RobotFileParser()
                parser.parse("User-agent: *\nDisallow:\n".splitlines())
            self._cache[key] = parser
        try:
            return parser.can_fetch(self.user_agent, url)
        except Exception:
            return True


def _clean_html(raw_html: str) -> str:
    if not raw_html:
        return ""
    if BeautifulSoup is not None:
        soup = BeautifulSoup(raw_html, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.extract()
        return soup.get_text(separator="\n", strip=True)
    text = re.sub(r"<[^>]+>", " ", raw_html)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _get_response_text(response: Any) -> str:
    """Get response body as text with robust encoding handling."""
    try:
        return response.text
    except Exception:
        pass
    raw = response.content
    if not raw:
        return ""
    # Fallback: decode as utf-8 with replacement to avoid crashes on bad bytes.
    return raw.decode("utf-8", errors="replace")


def _fetch_with_playwright(request: ScrapeRequest, logger: logging.Logger) -> Optional[DocumentRecord]:
    """Optional fallback: use headless browser for JS-heavy or bot-resistant pages. Requires playwright."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        logger.debug("Playwright not installed; skipping browser fallback.")
        return None
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.set_extra_http_headers({"User-Agent": "BMD-Ingestor/0.1"})
            page.goto(request.url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)  # allow minimal JS to run
            html = page.content()
            browser.close()
        text = _clean_html(html)
        if not text.strip():
            return None
        metadata = {
            "url": request.url,
            "from_cache": False,
            "status_code": 200,
            "source_field": request.source_field,
            "fetched_via": "playwright",
        }
        return DocumentRecord(
            facility_id=request.facility_id,
            facility_name=request.facility_name,
            country=request.country,
            source_type="scraped_web",
            source_ref=request.url,
            text=text,
            metadata=metadata,
        )
    except Exception as exc:
        logger.warning("Playwright fallback failed", extra={"url": request.url, "error": str(exc)})
        return None


class WebScraper:
    """Threaded scraper with caching, exponential backoff, and optional Playwright fallback."""

    def __init__(self, config: ScraperConfig, logger: logging.Logger) -> None:
        if httpx is None:  # pragma: no cover
            raise RuntimeError("httpx is required for scraping. Install via `pip install httpx`.")
        self.config = config
        self.logger = logger
        self.cache_dir = config.cache_dir
        if self.cache_dir:
            Path(self.cache_dir).mkdir(parents=True, exist_ok=True)
        self.robots = RobotsCache(config.user_agent) if config.respect_robots else None
        self.client = httpx.Client(
            timeout=config.timeout_sec,
            follow_redirects=True,
            headers={"User-Agent": config.user_agent},
        )
        self._domain_delay_lock = threading.Lock()
        self._last_request_per_host: dict[str, float] = {}

    def _cache_path(self, url: str) -> Optional[Path]:
        if not self.cache_dir:
            return None
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
        return Path(self.cache_dir) / f"{digest}.html"

    def _read_cache(self, url: str) -> Optional[str]:
        path = self._cache_path(url)
        if path and path.exists():
            return path.read_text(encoding="utf-8")
        return None

    def _write_cache(self, url: str, content: str) -> None:
        path = self._cache_path(url)
        if path:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")

    def _apply_domain_delay(self, url: str) -> None:
        """Enforce minimum delay between requests to the same host (politeness)."""
        delay = getattr(self.config, "delay_between_requests_per_domain", 0.0) or 0.0
        if delay <= 0:
            return
        parsed = urlparse(url)
        host = parsed.netloc or url
        with self._domain_delay_lock:
            now = time.monotonic()
            last = self._last_request_per_host.get(host, 0)
            self._last_request_per_host[host] = now
            wait = max(0, delay - (now - last))
        if wait > 0:
            time.sleep(wait)

    def _fetch(self, request: ScrapeRequest) -> Optional[DocumentRecord]:
        if self.robots and not self.robots.allowed(request.url):
            self.logger.info("Skipping URL due to robots.txt", extra={"url": request.url})
            return None

        cached = self._read_cache(request.url)
        if cached:
            text = _clean_html(cached)
            return self._build_document(request, text, from_cache=True)

        retry_on = getattr(self.config, "retry_on_status", (429, 502, 503)) or ()
        backoff_base = getattr(self.config, "backoff_base_sec", 1.0)
        backoff_max = getattr(self.config, "backoff_max_sec", 60.0)
        last_error: Optional[Exception] = None
        last_status: Optional[int] = None

        for attempt in range(self.config.retries + 1):
            if attempt > 0:
                # Exponential backoff; respect Retry-After if we have it (set by caller when applicable).
                wait = min(backoff_base * (2 ** (attempt - 1)), backoff_max)
                time.sleep(wait)

            self._apply_domain_delay(request.url)

            try:
                response = self.client.get(request.url)
                last_status = response.status_code

                if response.status_code in retry_on and attempt < self.config.retries:
                    # Optional: use Retry-After header if present.
                    retry_after = response.headers.get("Retry-After")
                    if retry_after and retry_after.isdigit():
                        wait = min(int(retry_after), int(backoff_max))
                        time.sleep(wait)
                    self.logger.warning(
                        "Scrape got retryable status, will retry",
                        extra={"url": request.url, "status": response.status_code, "attempt": attempt + 1},
                    )
                    continue

                response.raise_for_status()
                html = _get_response_text(response)
                self._write_cache(request.url, html)
                text = _clean_html(html)
                return self._build_document(request, text, status_code=response.status_code)
            except Exception as exc:
                last_error = exc
                self.logger.warning(
                    "Scrape attempt failed",
                    extra={"url": request.url, "attempt": attempt + 1, "error": str(exc)},
                )

        if getattr(self.config, "use_playwright_fallback", False):
            doc = _fetch_with_playwright(request, self.logger)
            if doc is not None:
                return doc

        if last_error:
            self.logger.error(
                "Failed to scrape URL", extra={"url": request.url, "error": str(last_error)}
            )
        return None

    def _build_document(
        self,
        request: ScrapeRequest,
        text: str,
        *,
        from_cache: bool = False,
        status_code: Optional[int] = None,
    ) -> DocumentRecord:
        metadata = {
            "url": request.url,
            "from_cache": from_cache,
            "status_code": status_code,
            "source_field": request.source_field,
        }
        return DocumentRecord(
            facility_id=request.facility_id,
            facility_name=request.facility_name,
            country=request.country,
            source_type="scraped_web",
            source_ref=request.url,
            text=text,
            metadata=metadata,
        )

    def scrape(self, requests: Iterable[ScrapeRequest]) -> List[DocumentRecord]:
        docs: List[DocumentRecord] = []
        request_list = list(requests)
        if not request_list:
            return docs
        with ThreadPoolExecutor(max_workers=self.config.concurrency or 4) as executor:
            future_map = {executor.submit(self._fetch, req): req for req in request_list}
            for future in as_completed(future_map):
                document = future.result()
                if document:
                    docs.append(document)
        return docs


__all__ = ["ScrapeRequest", "ScraperConfig", "WebScraper"]
