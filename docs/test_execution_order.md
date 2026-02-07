# Ordered Test Execution Checklist

Run the checks in this exact order to validate environment, code quality, pipeline consistency, and outputs.

## 0. Environment checks
1. Activate environment.
```bash
source .venv/bin/activate
```
2. Verify core dependencies.
```bash
python -c "import pandas, omegaconf, pyarrow; print('deps_ok')"
```

## 1. Static and import checks
1. Compile key scripts/modules.
```bash
python -m compileall scripts src
```
2. Sanity run script CLIs with help.
```bash
python scripts/ingest_data.py --help
python scripts/build_text2med.py --help
python scripts/verify_capabilities.py --help
python scripts/aggregate_regions.py --help
python scripts/run_planning.py --help
python scripts/eval_suite.py --help
python scripts/launch_ui.py --help
```

## 2. Unit and integration tests
1. Run full pytest suite.
```bash
pytest -q
```
2. Optional targeted suites.
```bash
pytest -q tests/test_text2med_pipeline.py
pytest -q tests/test_planning_pipeline.py
pytest -q tests/test_loc2med_ux.py
pytest -q tests/test_verify_eval_logic.py
```

## 3. Pipeline dry runs
1. Ingest dry run.
```bash
python scripts/ingest_data.py --config-name environments/local --dry-run
```
2. Text2Med dry run.
```bash
python scripts/build_text2med.py --config-name environments/local --dry-run
```
3. Verify dry run.
```bash
python scripts/verify_capabilities.py --config-name environments/local --dry-run
```
4. Region aggregation dry run.
```bash
python scripts/aggregate_regions.py --config-name environments/local --dry-run
```
5. Planning dry run.
```bash
python scripts/run_planning.py --config-name environments/local --dry-run
```
6. Eval dry run.
```bash
python scripts/eval_suite.py --config-name environments/local --dry-run
```
7. Loc2Med preview dry run equivalent (writes preview payload only).
```bash
python scripts/launch_ui.py --config-name environments/local --mode preview
```

## 4. Full artifact run
Run end-to-end to generate all outputs.
```bash
python scripts/ingest_data.py --config-name environments/local
python scripts/build_text2med.py --config-name environments/local
python scripts/verify_capabilities.py --config-name environments/local
python scripts/aggregate_regions.py --config-name environments/local
python scripts/run_planning.py --config-name environments/local
python scripts/eval_suite.py --config-name environments/local --fail-on-check
python scripts/launch_ui.py --config-name environments/local --mode preview
```

## 5. Required output assertions
Confirm each file exists after full run:
1. `data/interim/raw_documents.parquet`
2. `data/interim/text_chunks.parquet`
3. `data/interim/facility_capabilities_raw.parquet`
4. `data/processed/facility_capabilities.parquet`
5. `data/processed/capability_anomalies.parquet` (may be empty/not created if no anomalies)
6. `data/processed/region_coverage.parquet`
7. `data/processed/planning_recommendations.parquet`
8. `outputs/reports/verify_summary.json`
9. `outputs/reports/eval_summary.json`
10. `outputs/reports/planning_summary.csv`
11. `outputs/reports/loc2med_preview.json`

## 6. Quality gates
1. `eval_summary.json` must report `overall_passed: true`.
2. No critical check failures in eval summary.
3. `facility_capabilities.parquet` confidence values must be within `[0, 1]`.
4. Non-absent claims should include evidence IDs.
