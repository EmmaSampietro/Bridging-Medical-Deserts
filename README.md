# Bridging Medical Deserts

Agentic healthcare intelligence pipeline for extracting facility capabilities, verifying evidence quality, mapping care deserts, and generating planning recommendations.

## Repository purpose
- Ingest noisy facility data (structured + optional scraped text).
- Extract medical capability claims with citations.
- Verify prerequisites/contradictions and score confidence.
- Aggregate region-level coverage + desert signals.
- Produce planner-ready recommendations and exports.
- Serve map/UX payloads for planner interactions.

## Quick start
1. Create and activate an environment.
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
2. Run pipelines in order.
```bash
python scripts/ingest_data.py --config-name environments/local
python scripts/build_text2med.py --config-name environments/local
python scripts/verify_capabilities.py --config-name environments/local
python scripts/aggregate_regions.py --config-name environments/local
python scripts/run_planning.py --config-name environments/local
python scripts/eval_suite.py --config-name environments/local
python scripts/launch_ui.py --config-name environments/local --mode preview
```

## Main scripts
- `scripts/ingest_data.py`: load VF CSV data and produce `data/interim/raw_documents.parquet`.
- `scripts/build_text2med.py`: run chunk/ontology/extraction/verification/confidence pipeline.
- `scripts/verify_capabilities.py`: re-verify and re-score existing processed capabilities.
- `scripts/aggregate_regions.py`: compute region coverage and desert overlays.
- `scripts/run_planning.py`: generate gap analysis, unlock candidates, recommendations.
- `scripts/eval_suite.py`: run regression + acceptance checks and write eval summary.
- `scripts/launch_ui.py`: launch Loc2Med in preview/API/Streamlit mode.

## Output artifacts
- `data/interim/raw_documents.parquet`
- `data/interim/text_chunks.parquet`
- `data/interim/facility_capabilities_raw.parquet`
- `data/processed/facility_capabilities.parquet`
- `data/processed/region_coverage.parquet`
- `data/processed/planning_recommendations.parquet`
- `outputs/reports/eval_summary.json`
- `outputs/reports/planning_summary.csv`
- `outputs/reports/loc2med_preview.json`

## Testing
Use the ordered test checklist in `docs/test_execution_order.md`.
