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
    secondary_ranking_strategy: Optional[str] = None


class Loc2HospitalService:
    """High-level service orchestrating search + ranking."""

    def __init__(
        self,
        facilities: pd.DataFrame,
        region_field: str = "region_id",
        *,
        default_ranking: str = "confidence",
        default_secondary_ranking: Optional[str] = None,
    ) -> None:
        self.engine = LocQueryEngine(facilities, region_field=region_field)
        self.default_ranking = default_ranking
        self.default_secondary_ranking = default_secondary_ranking

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
        ranked = apply_ranking(
            frame,
            strategy=request.ranking_strategy or self.default_ranking,
            secondary_strategy=(
                request.secondary_ranking_strategy
                if request.secondary_ranking_strategy is not None
                else self.default_secondary_ranking
            ),
        )
        return ranked.reset_index(drop=True)

    def facility_detail(self, facility_id: str) -> pd.DataFrame:
        frame = self.engine.facilities
        return frame[frame["facility_id"] == facility_id]


__all__ = ["SearchRequest", "Loc2HospitalService"]
