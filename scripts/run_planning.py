#!/usr/bin/env python3
"""Generate planner-ready recommendations using region coverage + facility data."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import List, Sequence

import pandas as pd

from src.common import load_config, setup_logging
from src.common.storage import read_parquet, write_parquet
from src.loc2hospital.regions import map_facilities_to_regions
from src.planning.exports import export_recommendations_csv
from src.planning.gap_analysis import GapAnalysisConfig, compute_gap_table
from src.planning.recommendations import RecommendationConfig, generate_recommendations
from src.planning.unlock_engine import UnlockConfig, find_unlock_candidates


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run planning gap analysis + recommendations")
    parser.add_argument("--config-name", action="append", default=[])
    parser.add_argument("--override", action="append", default=[])
    parser.add_argument("--reload-config", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def _ensure_config(names: Sequence[str]) -> List[str]:
    merged = [name for name in names if name]
    if "pipelines/planning" not in merged:
        merged.append("pipelines/planning")
    return merged


def _load_facilities(path: Path) -> pd.DataFrame:
    required = [
        "facility_id",
        "facility_name",
        "capability",
        "status",
        "confidence",
        "missing_prerequisites",
    ]
    return read_parquet(path, required_columns=required)


def main() -> None:
    args = _parse_args()
    config_names = _ensure_config(args.config_name)
    cfg = load_config(config_name=config_names, overrides=args.override, reload=args.reload_config)
    logger = setup_logging(cfg, run_name="run_planning").logger

    facility_path = Path(cfg.paths.data_processed) / "facility_capabilities.parquet"
    region_coverage_path = Path(cfg.paths.data_processed) / "region_coverage.parquet"

    facilities = _load_facilities(facility_path)
    region_coverage = read_parquet(region_coverage_path)

    region_cfg = getattr(cfg, "regions", {}) or {}
    region_field = str(region_cfg.get("region_field", "region"))
    lookup_path = region_cfg.get("region_lookup_path")
    lookup_path_obj = None
    if lookup_path:
        lookup_path_obj = Path(lookup_path)
        if not lookup_path_obj.is_absolute():
            lookup_path_obj = Path(cfg.paths.data_raw) / lookup_path

    facilities = map_facilities_to_regions(
        facilities,
        region_field=region_field,
        lookup_path=lookup_path_obj,
    )

    gap_cfg = getattr(cfg, "gap_analysis", {}) or {}
    gap_config = GapAnalysisConfig(
        top_n_missing=int(gap_cfg.get("top_n_missing", 5)),
        coverage_floor=float(gap_cfg.get("coverage_floor", 1.0)),
    )
    gap_table = compute_gap_table(region_coverage, config=gap_config)

    unlock_cfg = getattr(cfg, "unlock", {}) or {}
    unlock_config = UnlockConfig(
        max_prerequisites_missing=int(unlock_cfg.get("max_prerequisites_missing", 2)),
        min_confidence=float(unlock_cfg.get("min_confidence", 0.2)),
    )
    unlock_candidates = find_unlock_candidates(facilities, gap_table, config=unlock_config)

    recommendation_cfg = getattr(cfg, "recommendations", {}) or {}
    recommendation_config = RecommendationConfig(
        min_alternatives=int(recommendation_cfg.get("min_alternatives", 1))
    )
    recommendations = generate_recommendations(
        gap_table,
        unlock_candidates,
        facilities,
        config=recommendation_config,
    )

    logger.info(
        "Planning outputs prepared",
        extra={
            "gaps": len(gap_table),
            "unlock_candidates": len(unlock_candidates),
            "recommendations": len(recommendations),
        },
    )

    if args.dry_run:
        logger.info("Dry-run mode; skipping writes.")
        return

    output_parquet = Path(cfg.paths.data_processed) / "planning_recommendations.parquet"
    write_parquet(recommendations, output_parquet, index=False)
    logger.info("Recommendations written", extra={"path": str(output_parquet)})

    exports_cfg = getattr(cfg, "exports", {}) or {}
    if exports_cfg.get("csv", True):
        csv_path = Path(cfg.paths.outputs_reports) / "planning_summary.csv"
        export_recommendations_csv(recommendations, csv_path)
        logger.info("CSV export written", extra={"path": str(csv_path)})


if __name__ == "__main__":
    main()
