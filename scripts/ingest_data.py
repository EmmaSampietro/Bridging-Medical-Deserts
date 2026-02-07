#!/usr/bin/env python3
"""Ingest VF CSV + optional web content, producing raw_documents.parquet."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys
from typing import List, Sequence

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.common import load_config, setup_logging
from src.data_ingest import ChunkerConfig, TextChunker, WebScraper, write_raw_documents
from src.data_ingest.document_store import DocumentRecord
from src.data_ingest.scraper import ScrapeRequest, ScraperConfig
from src.data_ingest.search import SearchExpander, SearchExpansionConfig
from src.data_ingest.vf_loader import load_vf_data


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="VF data ingestion pipeline")
    parser.add_argument(
        "--config-name",
        action="append",
        default=[],
        help="Additional config overlays (e.g., environments/local).",
    )
    parser.add_argument(
        "--override",
        action="append",
        default=[],
        help="OmegaConf-style overrides (e.g., chunker.max_chars=600).",
    )
    parser.add_argument(
        "--reload-config",
        action="store_true",
        help="Force reload of cached configuration.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run pipeline without writing outputs.",
    )
    return parser.parse_args()


def _merge_config_names(names: Sequence[str]) -> List[str]:
    base = [name for name in names if name]
    if "pipelines/ingest" not in base:
        base.append("pipelines/ingest")
    return base


def main() -> None:
    args = _parse_args()
    config_names = _merge_config_names(args.config_name)
    cfg = load_config(config_name=config_names, overrides=args.override, reload=args.reload_config)
    log_setup = setup_logging(cfg, run_name="ingest_data")
    logger = log_setup.logger

    sources_cfg = getattr(cfg, "sources", {}) or {}
    csv_root = Path(sources_cfg.get("vf_csv_path", cfg.paths.data_raw))
    country = sources_cfg.get("country")
    scrape_enabled = bool(sources_cfg.get("scrape_enabled", True))
    search_allowed = bool(sources_cfg.get("search_enabled", True))
    scrape_cache = Path(sources_cfg.get("scrape_cache_dir", csv_root / "scraped"))

    logger.info(
        "Loading VF data",
        extra={"csv_root": str(csv_root), "country": country, "scrape_enabled": scrape_enabled},
    )
    ingest_result = load_vf_data(csv_root, country)
    documents = list(ingest_result.documents)

    logger.info(
        "Structured VF rows loaded",
        extra={
            "row_count": len(ingest_result.dataframe),
            "document_count": len(documents),
            "scrape_candidates": len(ingest_result.scrape_requests),
        },
    )

    scraped_documents: List[DocumentRecord] = []
    scraper_settings = getattr(cfg, "scraper", {}) or {}

    scrape_requests: List[ScrapeRequest] = []
    search_settings = getattr(cfg, "search", {}) or {}
    if search_allowed and search_settings.get("enabled", False):
        search_config = SearchExpansionConfig(
            enabled=True,
            max_results=int(search_settings.get("max_results", 3)),
            extra_terms=list(search_settings.get("extra_terms", ["hospital"])),
            country_hint=str(search_settings.get("country_hint", country or "Ghana")),
            user_agent=str(
                search_settings.get(
                    "user_agent",
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
                )
            ),
        )
        expander = SearchExpander(search_config, logger)
        existing_urls = {req.url for req in scrape_requests}
        expanded_requests = expander.expand(
            ingest_result.dataframe,
            existing_urls=existing_urls,
        )
        scrape_requests.extend(expanded_requests)
        logger.info(
            "Search expansion complete",
            extra={"new_requests": len(expanded_requests), "total_requests": len(scrape_requests)},
        )

    if not scrape_requests:
        logger.info(
            "No scrape requests generated (search disabled or no search results); proceeding with CSV-only text.",
            extra={"search_allowed": search_allowed},
        )

    if scrape_enabled and scrape_requests:
        def _tuple_or_default(key: str, default: tuple) -> tuple:
            val = scraper_settings.get(key, default)
            if val is None:
                return default
            return tuple(val) if isinstance(val, (list, tuple)) else default

        scraper_cfg = ScraperConfig(
            timeout_sec=float(scraper_settings.get("timeout_sec", 30)),
            retries=int(scraper_settings.get("retries", 2)),
            respect_robots=bool(scraper_settings.get("respect_robots", True)),
            cache_dir=scrape_cache,
            concurrency=int(scraper_settings.get("concurrency", 4)),
            user_agent=str(scraper_settings.get("user_agent", "BMD-Ingestor/0.1")),
            backoff_base_sec=float(scraper_settings.get("backoff_base_sec", 1.0)),
            backoff_max_sec=float(scraper_settings.get("backoff_max_sec", 60)),
            retry_on_status=_tuple_or_default("retry_on_status", (429, 502, 503)),
            use_playwright_fallback=bool(scraper_settings.get("use_playwright_fallback", False)),
            delay_between_requests_per_domain=float(
                scraper_settings.get("delay_between_requests_per_domain", 0.0)
            ),
        )
        scraper = WebScraper(scraper_cfg, logger)
        logger.info(
            "Starting scrape jobs",
            extra={"requests": len(scrape_requests), "cache_dir": str(scrape_cache)},
        )
        scraped_documents = scraper.scrape(scrape_requests)
        total_urls = len(scrape_requests)
        succeeded = len(scraped_documents)
        logger.info(
            "Scraping complete",
            extra={
                "scraped_docs": succeeded,
                "total_urls": total_urls,
                "failed": total_urls - succeeded,
            },
        )
        if total_urls and succeeded == 0:
            logger.warning(
                "No URLs could be scraped; only CSV-derived documents will be used. "
                "Failures may be due to timeouts, robots.txt, or server errors. "
                "To skip scraping and avoid these messages, set sources.scrape_enabled=false.",
            )
        documents.extend(scraped_documents)
    else:
        logger.info(
            "Skipping scrape step",
            extra={"scrape_enabled": scrape_enabled, "scrape_requests": len(scrape_requests)},
        )

    chunker_settings = getattr(cfg, "chunker", {}) or {}
    chunker_cfg = ChunkerConfig(
        max_chars=int(chunker_settings.get("max_chars", 900)),
        min_chars=int(chunker_settings.get("min_chars", 120)),
        overlap_chars=int(chunker_settings.get("overlap_chars", 120)),
    )
    chunker = TextChunker(chunker_cfg)

    output_path = Path(cfg.paths.data_interim) / "raw_documents.parquet"
    if args.dry_run:
        logger.info(
            "Dry-run mode; skipping write",
            extra={"documents": len(documents), "output_path": str(output_path)},
        )
        return

    written_path = write_raw_documents(documents, chunker, output_path)
    logger.info(
        "Ingestion complete",
        extra={
            "documents_written": len(documents),
            "output_path": str(written_path),
            "scraped_docs": len(scraped_documents),
        },
    )


if __name__ == "__main__":
    main()
