# Data Ingestion Backbone (2026-02-07)

## Why
- Needed a deterministic way to read Virtue Foundation CSV exports (restricted to a single country defined in config) and turn them into normalized, citation-friendly documents.
- Scraping hooks must exist even if we do not yet have URLs — the architecture now supports advanced fetching with caching, robots checks, retries, and future extension.
- Downstream Text2Med expects chunk-level artifacts (`raw_documents.parquet`), so chunking + document storage has to be solid before extraction rules land.

## What was built
1. **Config updates (`config/pipelines/ingest.yaml`)**
   - Added `country`, scraper concurrency/user-agent, and chunker parameters so every input is editable without touching code.

2. **Chunking + document store (`src/data_ingest/chunker.py`, `document_store.py`)**
   - Sentence-aware chunker with overlap + minimum length enforcement.
   - `DocumentRecord` abstraction and Parquet writer that produces per-chunk rows with metadata + ISO timestamps.

3. **VF loader (`src/data_ingest/vf_loader.py`)**
   - Reads every CSV under `data/raw`, normalizes column names, infers facility IDs, filters by config-defined country, and assembles multi-field text bundles.
   - Emits both structured `DocumentRecord`s (source type `vf_row`) and `ScrapeRequest`s derived from URL columns (cleaned + deduplicated).

4. **Scraper (`src/data_ingest/scraper.py`)**
   - Advanced HTTP client (httpx) with robots.txt respect, caching, retry logic, concurrency, and HTML-to-text cleaning (BeautifulSoup fallback).
   - Converts each fetched page into `DocumentRecord`s tagged as `scraped_web`.

5. **Ingest script (`scripts/ingest_data.py`)**
   - CLI supporting additional config overlays/overrides, dry-run mode, and logging/MLflow hooks.
   - Runs loader → optional scraper → chunker → Parquet writer, logging counts at each step and writing to `data/interim/raw_documents.parquet`.

## Usage
```bash
python scripts/ingest_data.py \
  --config-name environments/local \
  --override chunker.max_chars=700 \
  --dry-run
```

Outputs land in `data/interim/raw_documents.parquet`, ready for the Text2Med pipeline. Scraper caching happens under `data/raw/scraped` by default, and you can swap to another country simply by editing `config/pipelines/ingest.yaml`.
