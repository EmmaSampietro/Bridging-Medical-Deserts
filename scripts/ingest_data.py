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
from src.data_ingest.scraper import ScrapeRequest, ScraperConfig
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

    scraped_documents = []
    scraper_settings = getattr(cfg, "scraper", {}) or {}
    if scrape_enabled and ingest_result.scrape_requests:
        scraper_cfg = ScraperConfig(
            timeout_sec=float(scraper_settings.get("timeout_sec", 30)),
            retries=int(scraper_settings.get("retries", 2)),
            respect_robots=bool(scraper_settings.get("respect_robots", True)),
            cache_dir=scrape_cache,
            concurrency=int(scraper_settings.get("concurrency", 4)),
            user_agent=str(scraper_settings.get("user_agent", "BMD-Ingestor/0.1")),
        )
        scraper = WebScraper(scraper_cfg, logger)
        logger.info(
            "Starting scrape jobs",
            extra={"requests": len(ingest_result.scrape_requests), "cache_dir": str(scrape_cache)},
        )
        scraped_documents = scraper.scrape(ingest_result.scrape_requests)
        logger.info("Scraping complete", extra={"scraped_docs": len(scraped_documents)})
        documents.extend(scraped_documents)
    else:
        logger.info("Skipping scrape step", extra={"scrape_enabled": scrape_enabled})

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
