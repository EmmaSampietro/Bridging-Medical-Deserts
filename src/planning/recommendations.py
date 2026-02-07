"""Combine gaps and unlock candidates into planner-ready recommendations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

import pandas as pd


@dataclass(frozen=True)
class RecommendationConfig:
    min_alternatives: int = 1


def _select_alternative(facilities: pd.DataFrame, capability: str, region_id: str) -> dict[str, object] | None:
    subset = facilities[
        (facilities["capability"] == capability) & (facilities["status"] == "present")
    ].sort_values(by="confidence", ascending=False)
    if subset.empty:
        return None
    top = subset.iloc[0]
    return {
        "facility_id": top["facility_id"],
        "facility_name": top["facility_name"],
        "region_id": top.get("region_id"),
        "confidence": top.get("confidence"),
    }


def generate_recommendations(
    gap_table: pd.DataFrame,
    unlock_candidates: pd.DataFrame,
    facility_capabilities: pd.DataFrame,
    *,
    config: RecommendationConfig,
) -> pd.DataFrame:
    """Produce final planning recommendations with unlocks/referrals."""

    records: List[dict[str, object]] = []
    unlock_key = ["region_id", "capability"]
    unlock_groups = unlock_candidates.groupby(unlock_key) if not unlock_candidates.empty else []

    for gap in gap_table.itertuples(index=False):
        unlock_group = (
            unlock_candidates[
                (unlock_candidates["region_id"] == gap.region_id)
                & (unlock_candidates["capability"] == gap.capability)
            ]
            if not isinstance(unlock_groups, list)
            else pd.DataFrame()
        )

        if not unlock_group.empty:
            best = unlock_group.iloc[0]
            records.append(
                {
                    "region_id": gap.region_id,
                    "region_name": gap.region_name,
                    "capability": gap.capability,
                    "recommendation_type": "unlock",
                    "facility_id": best.facility_id,
                    "facility_name": best.facility_name,
                    "action": best.recommended_action,
                    "severity_score": gap.severity_score,
                    "rationale": gap.reason,
                }
            )
        else:
            alternative = _select_alternative(facility_capabilities, gap.capability, gap.region_id)
            if alternative:
                action = (
                    f"Refer patients to {alternative['facility_name']} "
                    f"(confidence {alternative['confidence']:.2f})"
                )
            else:
                action = "Escalate to national coordination team (no alternatives available)"

            records.append(
                {
                    "region_id": gap.region_id,
                    "region_name": gap.region_name,
                    "capability": gap.capability,
                    "recommendation_type": "refer",
                    "facility_id": alternative["facility_id"] if alternative else None,
                    "facility_name": alternative["facility_name"] if alternative else None,
                    "action": action,
                    "severity_score": gap.severity_score,
                    "rationale": gap.reason,
                }
            )

    return pd.DataFrame(records)


__all__ = ["RecommendationConfig", "generate_recommendations"]
