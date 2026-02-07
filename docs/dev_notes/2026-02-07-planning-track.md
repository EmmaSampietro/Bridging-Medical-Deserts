# Geo + Planning Implementation (2026-02-07)

## Highlights
1. **Shared region helpers (`src/loc2hospital/regions.py`)**
   - Centralized facility→region mapping, coverage aggregation, and desert labeling to keep `aggregate_regions.py` and `run_planning.py` in sync.
2. **Geo-aware services**
   - `src/common/geo.py` now exposes normalization + Haversine utilities.
   - `src/loc2hospital/search.py`, `ranking.py`, and `api.py` provide reusable filtering/ranking + a high-level service.
3. **Region aggregation script**
   - `scripts/aggregate_regions.py` loads `facility_capabilities`, maps regions, computes coverage/deserts, and emits both `region_coverage.parquet` and `outputs/tiles/desert_overlays.geojson`.
4. **Planning pipeline**
   - Planning modules (`gap_analysis.py`, `unlock_engine.py`, `recommendations.py`, `exports.py`) implement severity scoring, unlock detection, action synthesis, and CSV exports.
   - `scripts/run_planning.py` ties everything together, producing `planning_recommendations.parquet` + `outputs/reports/planning_summary.csv`.
5. **Tests**
   - Added regression tests (`tests/test_geo.py`, `tests/test_loc2hospital.py`) covering geo math, radius filtering, LocQueryEngine, ranking, and the Loc2Hospital service.

## Usage
```bash
# Regions + deserts
python scripts/aggregate_regions.py --config-name environments/local

# Planning recommendations (requires region_coverage)
python scripts/run_planning.py --config-name environments/local

# Smoke tests
python tests/test_geo.py
python tests/test_loc2hospital.py
```

Outputs land in `data/processed/region_coverage.parquet`, `outputs/tiles/desert_overlays.geojson`, and `data/processed/planning_recommendations.parquet` + `outputs/reports/planning_summary.csv`, ready for Loc2Med + planner UX wiring.
