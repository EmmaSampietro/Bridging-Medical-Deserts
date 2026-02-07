import pathlib
import sys

import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.loc2hospital.api import Loc2HospitalService, SearchRequest
from src.loc2hospital.ranking import apply_ranking
from src.loc2hospital.search import LocQueryEngine, LocationQuery


def _sample_facilities():
    return pd.DataFrame(
        [
            {
                "facility_id": "f1",
                "facility_name": "Alpha",
                "region_id": "north",
                "capability": "icu",
                "confidence": 0.8,
                "status": "present",
                "latitude": 5.6,
                "longitude": -0.2,
                "missing_prerequisites": [],
                "flags": [],
            },
            {
                "facility_id": "f2",
                "facility_name": "Beta",
                "region_id": "south",
                "capability": "icu",
                "confidence": 0.4,
                "status": "uncertain",
                "latitude": 6.7,
                "longitude": -1.6,
                "missing_prerequisites": ["oxygen_supply"],
                "flags": ["missing_prerequisite"],
            },
        ]
    )


def test_loc_query_engine_filters():
    facilities = _sample_facilities()
    engine = LocQueryEngine(facilities)
    query = LocationQuery(capability="icu", region_id="north", min_confidence=0.5)
    result = engine.run(query)
    assert len(result) == 1
    assert result.iloc[0]["facility_id"] == "f1"


def test_apply_ranking_prioritizes_confidence():
    facilities = _sample_facilities()
    ranked = apply_ranking(facilities, strategy="confidence")
    assert ranked.iloc[0]["facility_id"] == "f1"


def test_apply_ranking_supports_capability_completeness_alias():
    facilities = _sample_facilities()
    ranked = apply_ranking(facilities, strategy="capability_completeness")
    assert ranked.iloc[0]["facility_id"] == "f1"


def test_loc2hospital_service_search():
    facilities = _sample_facilities()
    service = Loc2HospitalService(facilities)
    result = service.search(SearchRequest(capability="icu", min_confidence=0.3))
    assert list(result["facility_id"]) == ["f1", "f2"]
