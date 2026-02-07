"""Convenience API for facility retrieval (used by CLI/UI)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import pandas as pd

from .ranking import apply_ranking
from .search import LocQueryEngine, LocationQuery


@dataclass
class SearchRequest:
    capability: Optional[str] = None
    region_id: Optional[str] = None
    min_confidence: float = 0.0
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: Optional[float] = None
    ranking_strategy: str = "confidence"


class Loc2HospitalService:
    """High-level service orchestrating search + ranking."""

    def __init__(self, facilities: pd.DataFrame, region_field: str = "region_id") -> None:
        self.engine = LocQueryEngine(facilities, region_field=region_field)

    def search(self, request: SearchRequest) -> pd.DataFrame:
        query = LocationQuery(
            capability=request.capability,
            min_confidence=request.min_confidence,
            region_id=request.region_id,
            latitude=request.latitude,
            longitude=request.longitude,
            radius_km=request.radius_km,
        )
        frame = self.engine.run(query)
        ranked = apply_ranking(frame, strategy=request.ranking_strategy)
        return ranked.reset_index(drop=True)

    def facility_detail(self, facility_id: str) -> pd.DataFrame:
        frame = self.engine.facilities
        return frame[frame["facility_id"] == facility_id]


__all__ = ["SearchRequest", "Loc2HospitalService"]
