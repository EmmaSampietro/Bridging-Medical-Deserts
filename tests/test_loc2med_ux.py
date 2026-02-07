import pathlib
import sys

import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.loc2med.map_data import Loc2MedDataset, build_dashboard_payload
from src.loc2med.tile_cache import TileCache
from src.loc2med.ui_state import state_from_config
from src.ux_agent.chat_agent import PlannerChatAgent
from src.ux_agent.intent_router import route_intent
from src.ux_agent.trace_bridge import TraceBridge


def _facilities():
    return pd.DataFrame(
        [
            {
                "facility_id": "f1",
                "facility_name": "Alpha",
                "capability": "icu",
                "status": "present",
                "confidence": 0.82,
                "region_id": "north",
                "region_name": "North",
                "latitude": 7.1,
                "longitude": -1.2,
                "flags": [],
                "missing_prerequisites": [],
                "evidence_ids": ["ev_1"],
            },
            {
                "facility_id": "f2",
                "facility_name": "Beta",
                "capability": "icu",
                "status": "uncertain",
                "confidence": 0.48,
                "region_id": "north",
                "region_name": "North",
                "latitude": 7.2,
                "longitude": -1.3,
                "flags": ["missing_prerequisite"],
                "missing_prerequisites": ["oxygen_supply"],
                "evidence_ids": ["ev_2"],
            },
        ]
    )


def _coverage():
    return pd.DataFrame(
        [
            {
                "region_id": "north",
                "region_name": "North",
                "capability": "icu",
                "coverage_score": 1.3,
                "desert_flag": "none",
                "facility_count": 2,
                "confirmed_count": 1,
                "probable_count": 1,
            }
        ]
    )


def test_loc2med_payload_and_cache(tmp_path):
    dataset = Loc2MedDataset(facilities=_facilities(), region_coverage=_coverage())
    state = state_from_config(
        {
            "map": {"default_center": [7.0, -1.0], "default_zoom": 6},
            "filters": {"default_capability": "icu", "default_confidence_min": 0.3},
        }
    )
    payload = build_dashboard_payload(dataset, state)
    assert payload["summary"]["markers_returned"] >= 1
    assert payload["summary"]["overlays_returned"] >= 1

    cache = TileCache(tmp_path / "tiles")
    cached = cache.get_or_build("payload_test", lambda: payload)
    assert cached["summary"]["markers_returned"] == payload["summary"]["markers_returned"]
    assert cache.get("payload_test") is not None


def test_ux_intent_and_chat_response(tmp_path):
    intent = route_intent("Which hospitals claim ICUs but lack oxygen in north?")
    assert intent.name in {"missing_prerequisite", "facility_search"}

    trace_bridge = TraceBridge(tmp_path / "traces")
    agent = PlannerChatAgent(_facilities(), trace_bridge=trace_bridge)
    response = agent.answer("Show icu facilities in north")
    assert isinstance(response.answer, str)
    assert response.trace_id is not None
    trace_path = tmp_path / "traces" / f"{response.trace_id}.json"
    assert trace_path.exists()
