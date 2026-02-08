# Pipeline overview — Bridging Medical Deserts

This document describes the main pipeline stages, their inputs/outputs, and how to regenerate artifacts. Inspired by the agentic hospital pipeline that produced pre-computed assets for policy, staff, and desert analysis.

---

## Inputs and outputs by stage

| Stage | Inputs | Outputs | Config |
|-------|--------|---------|--------|
| **Ingest** | VF CSV in `data/raw/`, optional scrape | `data/interim/raw_documents.parquet`, `data/raw/scraped/*` | `config/pipelines/ingest.yaml` |
| **Text2Med** | `raw_documents.parquet` | `data/interim/text_chunks.parquet`, `data/processed/facility_capabilities.parquet` | `config/pipelines/text2med.yaml`, `config/ontology/*.yaml` |
| **Verify** | `facility_capabilities.parquet` | Updated capabilities, `capability_anomalies.parquet`, `outputs/reports/verify_summary.json` | `config/pipelines/text2med.yaml` (verification section) |
| **Loc2Hospital / Aggregate** | `facility_capabilities.parquet` | `data/processed/region_coverage.parquet`, `outputs/tiles/desert_overlays.geojson` | `config/pipelines/loc2hospital.yaml` |
| **Planning** | `region_coverage.parquet`, capability tables | `data/processed/planning_recommendations.parquet`, `outputs/reports/*` | `config/pipelines/planning.yaml` |

---

## Joining facilities to regions

- **facility_capabilities.parquet**: Use `facility_id`, `facility_name`, and the region field configured in `config/pipelines/loc2hospital.yaml` (`geo.region_field`, e.g. `region`).
- **region_coverage.parquet**: One row per (region_id, capability) with `coverage_score`, `facility_count`, `desert_flag`. Join to facility-level data via `region_id` / `region_name`.
- **Optional region lookup**: If `geo.region_lookup_path` is set (CSV under `data/raw/`), use it to map facility region strings to canonical `region_id` / `region_name`.

---

## Pre-computed / key columns

**facility_capabilities.parquet (after verify):**
- Identity: `facility_id`, `facility_name`, `country`, `region` (or as in config)
- Claim: `capability`, `status` (present/absent/uncertain), `confidence`, `confidence_label`
- Evidence: `evidence_ids`, `evidence_source_refs`, `citations`, `flags` (e.g. `missing_prerequisite`, `inconsistent_claim`)

**region_coverage.parquet:**
- `region_id`, `region_name`, `capability`, `coverage_score`, `facility_count`, `desert_flag`
- Desert logic: `config/pipelines/loc2hospital.yaml` → `desert.hard_threshold`, `desert.soft_percentile`

---

## How to regenerate

Run from project root. Ensure `data/raw/` contains the VF CSV (e.g. `ghana.csv`) and required dirs exist (`make dirs`).

```bash
# Full pipeline (ingest → text2med → verify → aggregate)
make regenerate

# Or step by step:
make dirs
make ingest      # → raw_documents.parquet
make text2med    # → text_chunks.parquet, facility_capabilities.parquet
make verify      # → updated capabilities, anomalies, verify_summary.json
make aggregate   # → region_coverage.parquet, desert_overlays.geojson
make plan        # → planning_recommendations, reports
make demo        # → launch Loc2Med UI
```

Dry-run (no writes):

```bash
python scripts/ingest_data.py --dry-run
python scripts/build_text2med.py --dry-run
python scripts/verify_capabilities.py --dry-run
python scripts/aggregate_regions.py --dry-run
```

---

## Suggested use (downstream / agent)

1. **Desert detection**: Use `region_coverage.parquet` and `desert_overlays.geojson`; filter by `desert_flag` and `capability`.
2. **Facility ranking**: Use `facility_capabilities.parquet` with `confidence` and capability completeness; join to region via `region` field for policy context.
3. **Planning / NGO budget**: Use planning outputs and `region_coverage`; prioritize regions with low `coverage_score` and high gap counts.
4. **Evidence and citations**: Use `citations`, `evidence_source_refs`, and `outputs/traces/` for auditing and “threats to sanity” checks.

For a reference agentic pipeline that produced hospital-level scores and region-level policy metrics (e.g. threat flags, policy_composite_gap_score), see `AGENT_HOSPITAL/` in this repo.
