"""Identify facilities that could deliver missing capabilities with minimal support."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

import pandas as pd


@dataclass(frozen=True)
class UnlockConfig:
    max_prerequisites_missing: int = 2
    min_confidence: float = 0.2
    rank_by: str = "feasibility"  # feasibility | coverage_proxy


def _missing_prereq_count(value: object) -> int:
    if isinstance(value, list):
        return len(value)
    return 0


def find_unlock_candidates(
    facility_capabilities: pd.DataFrame,
    gap_table: pd.DataFrame,
    *,
    config: UnlockConfig,
) -> pd.DataFrame:
    """Return facilities that can unlock target capabilities with small interventions."""

    required_facility_cols = {
        "facility_id",
        "facility_name",
        "region_id",
        "capability",
        "status",
        "confidence",
        "missing_prerequisites",
    }
    missing = required_facility_cols - set(facility_capabilities.columns)
    if missing:
        raise ValueError(f"facility_capabilities missing columns: {', '.join(sorted(missing))}")

    unlock_rows: List[dict[str, object]] = []
    gap_targets = gap_table[["region_id", "capability"]].drop_duplicates()

    facility_subset = facility_capabilities[
        facility_capabilities["status"].isin(["uncertain", "absent"])
        & (facility_capabilities["confidence"] >= config.min_confidence)
    ].copy()
    facility_subset["missing_count"] = facility_subset["missing_prerequisites"].apply(_missing_prereq_count)
    rank_by = (config.rank_by or "feasibility").strip().lower()

    for row in gap_targets.itertuples(index=False):
        candidates = facility_subset[
            (facility_subset["region_id"] == row.region_id)
            & (facility_subset["capability"] == row.capability)
            & (facility_subset["missing_count"] <= config.max_prerequisites_missing)
        ]
        if rank_by == "coverage_proxy":
            candidates = candidates.sort_values(
                by=["confidence", "missing_count"],
                ascending=[False, True],
            )
        else:
            candidates = candidates.sort_values(
                by=["missing_count", "confidence"],
                ascending=[True, False],
            )

        for candidate in candidates.itertuples(index=False):
            missing_prereqs = candidate.missing_prerequisites or []
            action = (
                f"Provide prerequisites: {', '.join(missing_prereqs)}"
                if missing_prereqs
                else "Verify equipment/staff readiness"
            )
            unlock_rows.append(
                {
                    "region_id": candidate.region_id,
                    "facility_id": candidate.facility_id,
                    "facility_name": candidate.facility_name,
                    "capability": candidate.capability,
                    "missing_prerequisites": missing_prereqs,
                    "recommended_action": action,
                    "confidence": candidate.confidence,
                    "missing_count": candidate.missing_count,
                }
            )

    return pd.DataFrame(unlock_rows)


__all__ = ["UnlockConfig", "find_unlock_candidates"]
