"""Gap analysis utilities for planner recommendations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

import pandas as pd


@dataclass(frozen=True)
class GapAnalysisConfig:
    top_n_missing: int = 5
    coverage_floor: float = 1.0


def compute_gap_table(
    region_coverage: pd.DataFrame,
    *,
    config: GapAnalysisConfig,
) -> pd.DataFrame:
    """Return top missing capabilities per region with severity scores."""

    required_cols = {
        "region_id",
        "region_name",
        "capability",
        "coverage_score",
        "desert_flag",
        "facility_count",
    }
    missing = required_cols - set(region_coverage.columns)
    if missing:
        raise ValueError(f"region_coverage missing columns: {', '.join(sorted(missing))}")

    rows: List[dict[str, object]] = []
    for (region_id, region_name), subset in region_coverage.groupby(["region_id", "region_name"]):
        ranked = []
        for row in subset.itertuples(index=False):
            coverage_score = float(getattr(row, "coverage_score", 0.0))
            facility_count = int(getattr(row, "facility_count", 0))
            desert_flag = str(getattr(row, "desert_flag", "none"))

            deficit = max(0.0, config.coverage_floor - coverage_score)
            severity = deficit + (0.75 if desert_flag == "soft" else 0.0)
            if desert_flag == "hard":
                severity += 1.5
            severity += 0.1 if facility_count == 0 else 0.0

            reason = f"coverage={coverage_score:.2f}, facilities={facility_count}, desert={desert_flag}"
            ranked.append(
                {
                    "region_id": region_id,
                    "region_name": region_name,
                    "capability": row.capability,
                    "severity_score": severity,
                    "reason": reason,
                    "coverage_score": coverage_score,
                    "desert_flag": desert_flag,
                }
            )

        ranked.sort(key=lambda item: item["severity_score"], reverse=True)
        rows.extend(ranked[: config.top_n_missing])

    return pd.DataFrame(rows)


__all__ = ["GapAnalysisConfig", "compute_gap_table"]
