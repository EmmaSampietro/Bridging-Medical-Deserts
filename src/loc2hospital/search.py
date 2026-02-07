"""Location-aware filtering utilities for facility retrieval."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import pandas as pd

from src.common.geo import within_radius


@dataclass(frozen=True)
class LocationQuery:
    capability: Optional[str] = None
    min_confidence: float = 0.0
    region_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: Optional[float] = None


def _apply_capability_filter(
    facilities: pd.DataFrame,
    capability: Optional[str],
    min_confidence: float,
) -> pd.DataFrame:
    frame = facilities
    if capability:
        frame = frame[frame["capability"] == capability]
    if min_confidence > 0:
        frame = frame[frame["confidence"] >= min_confidence]
    return frame


def _apply_region_filter(
    facilities: pd.DataFrame,
    region_id: Optional[str],
    region_field: str,
) -> pd.DataFrame:
    if not region_id:
        return facilities
    if region_field not in facilities.columns:
        return facilities[facilities["region_id"] == region_id]
    return facilities[facilities[region_field] == region_id]


class LocQueryEngine:
    """Reusable wrapper for facility filtering operations."""

    def __init__(self, facilities: pd.DataFrame, region_field: str = "region_id") -> None:
        self.facilities = facilities
        self.region_field = region_field

    def run(self, query: LocationQuery) -> pd.DataFrame:
        frame = _apply_capability_filter(
            self.facilities, query.capability, query.min_confidence
        )
        frame = _apply_region_filter(frame, query.region_id, self.region_field)

        if query.latitude is not None and query.longitude is not None and query.radius_km:
            frame = within_radius(
                frame,
                latitude=float(query.latitude),
                longitude=float(query.longitude),
                radius_km=float(query.radius_km),
            )
        return frame.reset_index(drop=True)


__all__ = ["LocationQuery", "LocQueryEngine"]
