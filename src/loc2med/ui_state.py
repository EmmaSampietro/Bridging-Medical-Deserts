"""UI state models and helpers for Loc2Med."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Mapping, Optional


@dataclass(frozen=True)
class MapViewState:
    """Map viewport preferences."""

    center_lat: float = 7.9465
    center_lon: float = -1.0232
    zoom: int = 6


@dataclass(frozen=True)
class FilterState:
    """Filter options applied to facilities and regional overlays."""

    capability: Optional[str] = None
    min_confidence: float = 0.5
    region_id: Optional[str] = None
    ranking_strategy: str = "confidence"


@dataclass(frozen=True)
class UIState:
    """Combined Loc2Med UI state snapshot."""

    map_view: MapViewState
    filters: FilterState

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def _safe_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def state_from_config(config: Mapping[str, Any] | None) -> UIState:
    """Build default UI state from pipeline configuration values."""

    config = config or {}
    map_cfg = config.get("map", {}) or {}
    filters_cfg = config.get("filters", {}) or {}

    center = map_cfg.get("default_center", [7.9465, -1.0232]) or [7.9465, -1.0232]
    if not isinstance(center, (list, tuple)) or len(center) != 2:
        center = [7.9465, -1.0232]

    map_view = MapViewState(
        center_lat=_safe_float(center[0], 7.9465),
        center_lon=_safe_float(center[1], -1.0232),
        zoom=_safe_int(map_cfg.get("default_zoom", 6), 6),
    )
    filters = FilterState(
        capability=filters_cfg.get("default_capability"),
        min_confidence=_safe_float(filters_cfg.get("default_confidence_min", 0.5), 0.5),
        ranking_strategy=str(filters_cfg.get("default_ranking_strategy", "confidence")),
    )
    return UIState(map_view=map_view, filters=filters)


def apply_filter_overrides(state: UIState, overrides: Mapping[str, Any] | None) -> UIState:
    """Return a new state with filter overrides applied."""

    overrides = overrides or {}
    filters = FilterState(
        capability=overrides.get("capability", state.filters.capability),
        min_confidence=_safe_float(
            overrides.get("min_confidence", state.filters.min_confidence),
            state.filters.min_confidence,
        ),
        region_id=overrides.get("region_id", state.filters.region_id),
        ranking_strategy=str(overrides.get("ranking_strategy", state.filters.ranking_strategy)),
    )
    return UIState(map_view=state.map_view, filters=filters)


__all__ = ["MapViewState", "FilterState", "UIState", "state_from_config", "apply_filter_overrides"]
