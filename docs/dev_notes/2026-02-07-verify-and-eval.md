# Verification + Eval Track (2026-02-07)

## Why
- `scripts/verify_capabilities.py` and `scripts/eval_suite.py` were still stubs.
- We needed a way to re-verify and re-score `data/processed/facility_capabilities.parquet` without rerunning ingestion/extraction.
- We also needed acceptance/regression scaffolding so ontology and scoring tweaks can be validated quickly.

## What was implemented
1. `scripts/verify_capabilities.py`
   - Loads existing `facility_capabilities.parquet`.
   - Normalizes list-like fields (`flags`, `missing_prerequisites`, `evidence_ids`, etc.) for compatibility across older/newer artifacts.
   - Reconstructs match counts from `raw_explanation` when present.
   - Re-runs verification logic (`src/text2med/verifier.py`) and confidence scoring (`src/text2med/confidence.py`).
   - Writes updated capabilities back to processed output and emits:
     - `data/processed/capability_anomalies.parquet`
     - `outputs/reports/verify_summary.json`

2. `scripts/eval_suite.py`
   - Runs regression checks directly on processed capabilities:
     - required columns
     - non-empty dataset
     - duplicate facility/capability rows
     - confidence range and label consistency
     - citation-required checks for non-absent claims
     - verification flag consistency checks
   - Supports question-based acceptance checks from `inputs/questions/*.json`.
   - Falls back to default VF-style acceptance questions if no JSON specs are found.
   - Writes `outputs/reports/eval_summary.json`.
   - Optional `--fail-on-check` exits non-zero when critical checks or required questions fail.

## Compatibility notes
- Both scripts operate only on `data/processed/facility_capabilities.parquet`, so they are independent of geo/planning modules.
- Field normalization handles list columns stored as real lists, JSON strings, Python-list strings, or comma-separated text.
- If `strong/weak/negative` counts are absent, verification still runs with safe defaults.

## Usage
```bash
./venv/bin/python scripts/verify_capabilities.py --config-name environments/local
./venv/bin/python scripts/eval_suite.py --config-name environments/local
```

Optional gate mode:
```bash
./venv/bin/python scripts/eval_suite.py --config-name environments/local --fail-on-check
```
