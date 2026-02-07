"""HTTP fetchers with retries, robots compliance, and caching for facility pages."""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Iterable, List, Optional
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


class WebScraper:
    """Threaded scraper with caching + robots awareness."""

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

    def _fetch(self, request: ScrapeRequest) -> Optional[DocumentRecord]:
        if self.robots and not self.robots.allowed(request.url):
            self.logger.info("Skipping URL due to robots.txt", extra={"url": request.url})
            return None

        cached = self._read_cache(request.url)
        if cached:
            text = _clean_html(cached)
            return self._build_document(request, text, from_cache=True)

        last_error: Optional[Exception] = None
        for attempt in range(self.config.retries + 1):
            try:
                response = self.client.get(request.url)
                response.raise_for_status()
                html = response.text
                self._write_cache(request.url, html)
                text = _clean_html(html)
                return self._build_document(request, text, status_code=response.status_code)
            except Exception as exc:  # pragma: no cover - network variability
                last_error = exc
                self.logger.warning(
                    "Scrape attempt failed",
                    extra={"url": request.url, "attempt": attempt + 1, "error": str(exc)},
                )
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
