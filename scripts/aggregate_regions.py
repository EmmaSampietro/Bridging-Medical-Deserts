#!/usr/bin/env python3
"""Produce region coverage tables + desert overlays for the Loc2Med map."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Dict, List, Sequence

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.common import load_config, setup_logging
from src.common.storage import read_parquet, write_parquet
from src.loc2hospital.regions import (
    aggregate_region_coverage,
    apply_desert_labels,
    map_facilities_to_regions,
)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Aggregate region coverage/deserts")
    parser.add_argument("--config-name", action="append", default=[])
    parser.add_argument("--override", action="append", default=[])
    parser.add_argument("--reload-config", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def _ensure_config_name(names: Sequence[str]) -> List[str]:
    merged = [name for name in names if name]
    if "pipelines/loc2hospital" not in merged:
        merged.append("pipelines/loc2hospital")
    return merged


def _load_facility_capabilities(path: Path) -> pd.DataFrame:
    required_cols = [
        "facility_id",
        "facility_name",
        "country",
        "capability",
        "confidence",
    ]
    frame = read_parquet(path, required_columns=required_cols)
    return frame


def _build_geojson(
    coverage: pd.DataFrame,
    facilities: pd.DataFrame,
    output_path: Path,
) -> Path:
    if {"latitude", "longitude"}.issubset(facilities.columns):
        facilities_geo = facilities.dropna(subset=["latitude", "longitude"])
    else:
        facilities_geo = pd.DataFrame(columns=facilities.columns)

    features: List[Dict[str, object]] = []
    for region_id, region_rows in coverage.groupby("region_id"):
        region_name = region_rows.iloc[0]["region_name"]
        region_facilities = facilities_geo[facilities_geo["region_id"] == region_id]
        if not region_facilities.empty:
            lat = float(region_facilities["latitude"].mean())
            lon = float(region_facilities["longitude"].mean())
            geometry = {"type": "Point", "coordinates": [lon, lat]}
        else:
            geometry = None

        capability_stats = {
            row.capability: {
                "coverage_score": row.coverage_score,
                "facility_count": row.facility_count,
                "desert_flag": row.desert_flag,
            }
            for row in region_rows.itertuples(index=False)
        }
        feature = {
            "type": "Feature",
            "properties": {
                "region_id": region_id,
                "region_name": region_name,
                "capabilities": capability_stats,
            },
            "geometry": geometry,
        }
        features.append(feature)

    geojson = {"type": "FeatureCollection", "features": features}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(geojson, indent=2))
    return output_path


def main() -> None:
    args = _parse_args()
    config_names = _ensure_config_name(args.config_name)
    cfg = load_config(config_name=config_names, overrides=args.override, reload=args.reload_config)
    logger = setup_logging(cfg, run_name="aggregate_regions").logger

    facility_path = Path(cfg.paths.data_processed) / "facility_capabilities.parquet"
    facilities = _load_facility_capabilities(facility_path)

    geo_cfg = getattr(cfg, "geo", {}) or {}
    region_field = str(geo_cfg.get("region_field", "region"))
    lookup_path_value = geo_cfg.get("region_lookup_path")
    lookup_path = Path(lookup_path_value) if lookup_path_value else None

    if lookup_path and not lookup_path.is_absolute():
        lookup_path = Path(cfg.paths.data_raw) / lookup_path

    facilities = map_facilities_to_regions(
        facilities,
        region_field=region_field,
        lookup_path=lookup_path,
    )
    filter_cfg = getattr(cfg, "filter", {}) or {}
    min_confidence = float(filter_cfg.get("min_confidence", 0.0))
    if min_confidence > 0:
        facilities = facilities[facilities["confidence"] >= min_confidence].copy()

    coverage = aggregate_region_coverage(facilities)
    desert_cfg = getattr(cfg, "desert", {}) or {}
    coverage = apply_desert_labels(
        coverage,
        hard_threshold=float(desert_cfg.get("hard_threshold", 0.0)),
        soft_percentile=float(desert_cfg.get("soft_percentile", 25)),
    )

    logger.info(
        "Computed region coverage",
        extra={
            "regions": coverage["region_id"].nunique(),
            "region_capability_rows": len(coverage),
        },
    )

    if args.dry_run:
        logger.info("Dry-run mode; skipping writes.")
        return

    coverage_path = Path(cfg.paths.data_processed) / "region_coverage.parquet"
    write_parquet(coverage, coverage_path, index=False)
    logger.info("Region coverage written", extra={"path": str(coverage_path)})

    geojson_path = Path(cfg.paths.outputs_tiles) / "desert_overlays.geojson"
    _build_geojson(coverage, facilities, geojson_path)
    logger.info("GeoJSON overlays written", extra={"path": str(geojson_path)})


if __name__ == "__main__":
    main()
