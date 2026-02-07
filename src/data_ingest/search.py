"""Search-based expansion for facility scrape requests using DuckDuckGo."""

from __future__ import annotations

import logging
import urllib.parse
from dataclasses import dataclass, field
from typing import Iterable, List, Optional, Set

import httpx
import pandas as pd
from bs4 import BeautifulSoup

from .scraper import ScrapeRequest


@dataclass(frozen=True)
class SearchExpansionConfig:
    enabled: bool = False
    max_results: int = 3
    extra_terms: List[str] = field(default_factory=lambda: ["hospital"])
    country_hint: str = "Ghana"
    max_core_terms: int = 3
    user_agent: str = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36"
    )


class DuckDuckGoSearchClient:
    """Minimal DuckDuckGo HTML search client (no API key required)."""

    ENDPOINT = "https://duckduckgo.com/html/"

    def __init__(self, user_agent: str, timeout: float = 15.0) -> None:
        self.client = httpx.Client(
            headers={"User-Agent": user_agent},
            timeout=timeout,
            follow_redirects=True,
        )

    @staticmethod
    def _extract_url(href: str) -> Optional[str]:
        if not href:
            return None
        if href.startswith("/l/?"):
            parsed = urllib.parse.urlparse(href)
            query = urllib.parse.parse_qs(parsed.query)
            uddg = query.get("uddg", [])
            if uddg:
                return urllib.parse.unquote(uddg[0])
            return None
        return href

    def search(self, query: str, max_results: int) -> List[str]:
        response = self.client.get(self.ENDPOINT, params={"q": query})
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        urls: List[str] = []
        for anchor in soup.select("a.result__a"):
            url = self._extract_url(anchor.get("href", ""))
            if not url:
                continue
            if not url.startswith(("http://", "https://")):
                continue
            urls.append(url)
            if len(urls) >= max_results:
                break
        return urls


class SearchExpander:
    """Build additional scrape requests by searching facility metadata."""

    def __init__(
        self,
        config: SearchExpansionConfig,
        logger: logging.Logger,
    ) -> None:
        self.config = config
        self.logger = logger
        self.client = DuckDuckGoSearchClient(user_agent=config.user_agent)

    def _build_query(self, row: pd.Series) -> Optional[str]:
        priority_fields = ["facility_name", "name", "city", "district", "region"]
        terms: List[str] = []
        seen = set()
        for field in priority_fields:
            value = row.get(field)
            if not isinstance(value, str):
                continue
            cleaned = value.strip()
            if not cleaned:
                continue
            canonical = cleaned.lower()
            if canonical in seen:
                continue
            seen.add(canonical)
            terms.append(cleaned)
            if len(terms) >= max(1, self.config.max_core_terms):
                break

        if not terms:
            return None

        for term in self.config.extra_terms:
            if not term:
                continue
            canonical = term.lower()
            if canonical in seen:
                continue
            seen.add(canonical)
            terms.append(term)
            if len(terms) >= self.config.max_core_terms + 1:
                break

        if self.config.country_hint:
            country = self.config.country_hint.strip()
            if country and country.lower() not in seen:
                terms.append(country)

        query = " ".join(terms[: self.config.max_core_terms + 2])
        return query if query else None

    def expand(
        self,
        facilities: pd.DataFrame,
        *,
        existing_urls: Optional[Set[str]] = None,
    ) -> List[ScrapeRequest]:
        """Return new ScrapeRequest list derived from web search results."""

        if not self.config.enabled:
            return []

        url_set = set(existing_urls or [])
        requests: List[ScrapeRequest] = []
        for row in facilities.itertuples(index=False):
            query = self._build_query(pd.Series(row._asdict()))
            if not query:
                continue
            try:
                urls = self.client.search(query, self.config.max_results)
            except Exception as exc:  # pragma: no cover - network variability
                self.logger.warning(
                    "Search query failed",
                    extra={"query": query, "error": str(exc)},
                )
                continue
            for url in urls:
                if url in url_set:
                    continue
                url_set.add(url)
                requests.append(
                    ScrapeRequest(
                        facility_id=str(getattr(row, "facility_id")),
                        facility_name=str(
                            getattr(row, "facility_name", getattr(row, "name", "Unknown Facility"))
                        ),
                        country=str(getattr(row, "country", self.config.country_hint)),
                        url=url,
                        source_field="search_query",
                    )
                )
        return requests


__all__ = ["SearchExpansionConfig", "SearchExpander"]
