"""Shared helpers for mapping facilities to canonical regions and computing coverage."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import pandas as pd

from src.common.geo import load_region_lookup, normalize_region_name


def map_facilities_to_regions(
    facilities: pd.DataFrame,
    *,
    region_field: str,
    lookup_path: Optional[Path] = None,
) -> pd.DataFrame:
    """Return a copy of facilities with `region_id` + `region_name` columns."""

    frame = facilities.copy()
    if region_field not in frame.columns:
        raise ValueError(f"Facility data missing region field '{region_field}'.")

    frame["region_name"] = frame[region_field].fillna("Unknown Region")
    frame["region_id"] = frame["region_name"].apply(normalize_region_name)

    if lookup_path:
        lookup = load_region_lookup(lookup_path)
        region_map = lookup.set_index("region_name_norm")
        mapped_ids = []
        mapped_names = []
        for _, row in frame.iterrows():
            norm = normalize_region_name(row[region_field])
            if norm and norm in region_map.index:
                entry = region_map.loc[norm]
                mapped_ids.append(str(entry["region_id"]))
                mapped_names.append(str(entry["region_name"]))
            else:
                mapped_ids.append(norm or "unknown_region")
                mapped_names.append(row["region_name"])
        frame["region_id"] = mapped_ids
        frame["region_name"] = mapped_names

    frame["region_id"] = frame["region_id"].fillna("").replace("", "unknown_region")
    return frame


def aggregate_region_coverage(facilities: pd.DataFrame) -> pd.DataFrame:
    """Group facility capabilities by region/capability with coverage metrics."""

    required = {"region_id", "region_name", "capability", "facility_id", "confidence"}
    missing = required - set(facilities.columns)
    if missing:
        raise ValueError(f"Facilities missing columns: {', '.join(sorted(missing))}")

    grouped = (
        facilities.groupby(["region_id", "region_name", "capability"])
        .agg(
            facility_count=("facility_id", "nunique"),
            coverage_score=("confidence", "sum"),
            confirmed_count=("confidence", lambda s: (s >= 0.7).sum()),
            probable_count=("confidence", lambda s: ((s >= 0.45) & (s < 0.7)).sum()),
            avg_confidence=("confidence", "mean"),
        )
        .reset_index()
    )
    return grouped


def apply_desert_labels(
    coverage: pd.DataFrame,
    *,
    hard_threshold: float,
    soft_percentile: float,
) -> pd.DataFrame:
    """Annotate coverage frame with `desert_flag` column."""

    frame = coverage.copy()
    frame["desert_flag"] = "none"

    if hard_threshold > 0:
        frame.loc[frame["coverage_score"] <= hard_threshold, "desert_flag"] = "hard"

    if 0 < soft_percentile < 100:
        for capability, subset in frame.groupby("capability"):
            threshold = subset["coverage_score"].quantile(soft_percentile / 100.0)
            mask = (frame["capability"] == capability) & (frame["coverage_score"] <= threshold)
            frame.loc[mask & (frame["desert_flag"] == "none"), "desert_flag"] = "soft"
    return frame


__all__ = [
    "map_facilities_to_regions",
    "aggregate_region_coverage",
    "apply_desert_labels",
]
