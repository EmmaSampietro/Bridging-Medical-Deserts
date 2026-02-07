import pathlib
import sys

import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.planning.gap_analysis import GapAnalysisConfig, compute_gap_table
from src.planning.recommendations import RecommendationConfig, generate_recommendations
from src.planning.unlock_engine import UnlockConfig, find_unlock_candidates


def _coverage_frame():
    return pd.DataFrame(
        [
            {
                "region_id": "north",
                "region_name": "North",
                "capability": "icu",
                "coverage_score": 0.2,
                "desert_flag": "hard",
                "facility_count": 0,
            },
            {
                "region_id": "north",
                "region_name": "North",
                "capability": "c_section",
                "coverage_score": 0.6,
                "desert_flag": "soft",
                "facility_count": 1,
            },
            {
                "region_id": "south",
                "region_name": "South",
                "capability": "icu",
                "coverage_score": 1.4,
                "desert_flag": "none",
                "facility_count": 2,
            },
        ]
    )


def _facilities_frame():
    return pd.DataFrame(
        [
            {
                "region_id": "north",
                "facility_id": "f1",
                "facility_name": "Alpha Clinic",
                "capability": "icu",
                "status": "uncertain",
                "confidence": 0.5,
                "missing_prerequisites": ["oxygen_supply"],
            },
            {
                "region_id": "south",
                "facility_id": "f2",
                "facility_name": "South Referral",
                "capability": "icu",
                "status": "present",
                "confidence": 0.85,
                "missing_prerequisites": [],
            },
        ]
    )


def test_planning_gap_unlock_recommendations_flow():
    coverage = _coverage_frame()
    facilities = _facilities_frame()

    gap_table = compute_gap_table(
        coverage,
        config=GapAnalysisConfig(top_n_missing=2, coverage_floor=1.0),
    )
    assert not gap_table.empty
    assert gap_table.iloc[0]["capability"] == "icu"

    unlock = find_unlock_candidates(
        facilities,
        gap_table,
        config=UnlockConfig(max_prerequisites_missing=2, min_confidence=0.2, rank_by="feasibility"),
    )
    assert not unlock.empty
    assert "recommended_action" in unlock.columns

    recommendations = generate_recommendations(
        gap_table,
        unlock,
        facilities,
        config=RecommendationConfig(min_alternatives=1),
    )
    assert not recommendations.empty
    assert {"recommendation_type", "action", "severity_score"}.issubset(recommendations.columns)
