"""Combine gaps and unlock candidates into planner-ready recommendations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

import pandas as pd


@dataclass(frozen=True)
class RecommendationConfig:
    min_alternatives: int = 1


def _select_alternatives(
    facilities: pd.DataFrame,
    capability: str,
    region_id: str,
) -> pd.DataFrame:
    subset = facilities[
        (facilities["capability"] == capability) & (facilities["status"] == "present")
    ].copy()
    if subset.empty:
        return subset

    same_region = subset[subset.get("region_id") == region_id]
    if not same_region.empty:
        return same_region.sort_values(by="confidence", ascending=False)
    return subset.sort_values(by="confidence", ascending=False)


def generate_recommendations(
    gap_table: pd.DataFrame,
    unlock_candidates: pd.DataFrame,
    facility_capabilities: pd.DataFrame,
    *,
    config: RecommendationConfig,
) -> pd.DataFrame:
    """Produce final planning recommendations with unlocks/referrals."""

    records: List[dict[str, object]] = []

    for gap in gap_table.itertuples(index=False):
        unlock_group = unlock_candidates[
            (unlock_candidates["region_id"] == gap.region_id)
            & (unlock_candidates["capability"] == gap.capability)
        ]

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
            alternatives = _select_alternatives(
                facility_capabilities, gap.capability, gap.region_id
            )
            if len(alternatives) >= config.min_alternatives:
                top = alternatives.iloc[0]
                action = (
                    f"Refer patients to {top['facility_name']} "
                    f"(confidence {float(top['confidence']):.2f}); "
                    f"{len(alternatives)} alternatives available."
                )
            else:
                action = "Escalate to national coordination team (no alternatives available)"

            records.append(
                {
                    "region_id": gap.region_id,
                    "region_name": gap.region_name,
                    "capability": gap.capability,
                    "recommendation_type": "refer",
                    "facility_id": top["facility_id"] if len(alternatives) >= config.min_alternatives else None,
                    "facility_name": top["facility_name"] if len(alternatives) >= config.min_alternatives else None,
                    "action": action,
                    "severity_score": gap.severity_score,
                    "rationale": gap.reason,
                }
            )

    return pd.DataFrame(records)


__all__ = ["RecommendationConfig", "generate_recommendations"]
