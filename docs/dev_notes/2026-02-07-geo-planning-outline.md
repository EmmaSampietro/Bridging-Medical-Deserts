# Geo + Planning Track Implementation Plan (2026-02-07)

Goal: deliver the remaining pieces that turn facility-level capabilities into geographic coverage signals, planner recommendations, and UX-ready outputs. This track covers `src/common/geo.py`, `src/loc2hospital/*`, `src/planning/*`, `scripts/aggregate_regions.py`, `scripts/run_planning.py`, and supporting configs/exports.

---

## 1. Scope & dependencies
- **Inputs:** `data/processed/facility_capabilities.parquet` (from Text2Med), admin boundary metadata (CSV/GeoJSON TBD), optional population proxies.
- **Outputs:** 
  - `data/processed/region_coverage.parquet` (region × capability metrics)
  - `outputs/tiles/*.geojson` (desert overlays for Loc2Med)
  - `data/processed/planning_recommendations.parquet`
  - `outputs/reports/planning_summary.csv` (and future PDF)
- **Upstream readiness:** ingestion + Text2Med done. Need final hooks to re-run verification/scores if facility data changes.

---

## 2. Module-by-module plan

### 2.1 `src/common/geo.py`
1. **Data loaders**
   - `load_region_geometries(path: Path) -> gpd.GeoDataFrame`
   - `load_region_lookup(csv_path)` to map facility admins to standardized region IDs.
2. **Utility functions**
   - `normalize_region_name(value: str) -> str`
   - `assign_region(facility_row, lookup) -> str`
   - `compute_centroid(lat, lon)` for missing geos.
   - Distance helpers (haversine) for radius queries if lat/lon present.
3. **Caching & validation**
   - Ensure shapefiles/geojson exist; raise descriptive errors otherwise.

### 2.2 `src/loc2hospital/search.py`
1. Implement `filter_by_region(frame, region_id)` and `filter_by_radius(frame, lat, lon, radius_km)` using geo helpers.
2. Add `apply_capability_filter(frame, capability_id, min_confidence)` returning ranked subset.
3. Provide a `LocQueryEngine` class that wraps these filters for use by CLI/UI.

### 2.3 `src/loc2hospital/ranking.py`
1. Functions to compute scores:
   - `confidence_rank(frame)` sorts by confidence/updated_at.
   - `completeness_rank(frame)` penalizes missing prerequisites/flags.
2. Optionally expose composite ranking weights configured via `config/pipelines/loc2hospital.yaml`.

### 2.4 `src/loc2hospital/api.py`
1. Provide service-style functions consumed by UI/CLI:
   - `search_facilities(query: LocQuery) -> pd.DataFrame`
   - `get_facility_detail(facility_id)` with evidence snippets.
2. Wire logging and caching for repeated queries.

### 2.5 `scripts/aggregate_regions.py`
1. CLI structure mirrors other scripts (`--config-name`, overrides, dry-run).
2. Steps:
   - Load config + logging.
   - Read facility capabilities + region lookup.
   - Aggregate per region × capability:
     - metrics: facility count, sum of confidence, count of confirmed/probable.
   - Compute desert flags (hard/soft) based on config thresholds.
   - Write `data/processed/region_coverage.parquet`.
   - Generate GeoJSON overlays (choropleth + top-gaps) into `outputs/tiles/`.
3. Logging: record stats per region, highlight missing geos.

### 2.6 `src/planning/*`
1. `gap_analysis.py`
   - Input: region coverage + facility capabilities.
   - Output: top missing capabilities per region with severity score.
2. `unlock_engine.py`
   - Identify facilities that are “almost ready” (e.g., missing ≤2 prerequisites).
   - Evaluate interventions (equipment, staff, training) from config heuristics.
3. `recommendations.py`
   - Combine gaps + unlocks + referral options into human-readable actions.
4. `exports.py`
   - CSV writer w/ citations columns and optional PDF stub for future extension.

### 2.7 `scripts/run_planning.py`
1. CLI structure like other scripts.
2. Steps:
   - Load config/logging.
   - Read `region_coverage` (run aggregate first) + `facility_capabilities`.
   - Call planning modules to produce `planning_recommendations`.
   - Save parquet + CSV exports.
   - Optionally emit JSON for UI preview.

---

## 3. Data flow & contracts
```
facility_capabilities.parquet
   └─ aggregate_regions.py
        ├─ region_coverage.parquet
        └─ outputs/tiles/desert_overlay.geojson
               └─ run_planning.py (reads region_coverage + facility_capabilities)
                      ├─ planning_recommendations.parquet
                      └─ outputs/reports/planning_summary.csv
```

- All intermediate tables include `region_id`, `region_name`, `capability`, `coverage_score`, `desert_flag`, `top_facilities`.
- Planning outputs include references back to facility IDs and citation IDs for trust.

---

## 4. Configuration needs
- Extend `config/pipelines/loc2hospital.yaml` with:
  - `region_lookup_path`, `geojson_path`, `population_field`.
  - Ranking weights / thresholds.
- Extend `config/pipelines/planning.yaml` with:
  - `intervention_rules` (equipment/staff/training templates).
  - `export` settings (CSV name, include_evidence bool).

---

## 5. Testing strategy
1. **Unit tests (Pytest)**
   - `tests/common/test_geo.py`: normalization + distance helpers.
   - `tests/loc2hospital/test_search.py`: filter logic using dummy data.
   - `tests/planning/test_gap_analysis.py`: ensure deterministic ranking.
2. **Integration smoke tests**
   - `python scripts/aggregate_regions.py --dry-run` with sample CSV.
   - `python scripts/run_planning.py --dry-run`.
3. **Validation rules**
   - Assert every region in coverage table has at least one capability entry.
   - Ensure planning recommendations carry citations/evidence IDs.

---

## 6. Parallelization guide
- **Person B1 (Geo/Region)**
  1. Implement `src/common/geo.py`.
  2. Finish `src/loc2hospital/search.py` + `ranking.py`.
  3. Build `scripts/aggregate_regions.py` + GeoJSON exports.
- **Person B2 (Planning)**
  1. Flesh out `src/planning/*`.
  2. Implement `scripts/run_planning.py`.
  3. Coordinate with B1 for region coverage schema; mock data until ready.

Exchange artifacts via `data/processed/region_coverage.parquet` and agree on column names early.

---

## 7. Open questions / next actions
1. Do we have region boundary data (GeoJSON/shapefile)? If not, source Ghana (or chosen country) admin boundaries from VF assets or public datasets.
2. Decide on population proxies (if any) to prioritize deserts—maybe use facility counts if population unavailable.
3. Align on citation strategy for planning recommendations (likely reuse `src/common/citations.py`).
4. Schedule code review between B1 and B2 once each module hits MVP to keep interfaces stable.
