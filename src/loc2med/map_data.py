"""Build Loc2Med map payloads from processed artifacts."""

from __future__ import annotations

import ast
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional

import pandas as pd

from src.common.storage import read_parquet
from src.loc2hospital.api import Loc2HospitalService, SearchRequest

from .ui_state import UIState


@dataclass(frozen=True)
class Loc2MedDataset:
    """Data bundle required to render map and recommendation views."""

    facilities: pd.DataFrame
    region_coverage: pd.DataFrame


def _normalize_list_value(value: object) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return []
        for parser in (json.loads, ast.literal_eval):
            try:
                parsed = parser(raw)
            except Exception:
                continue
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        return [raw]
    return [str(value)]


def _ensure_facility_columns(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    defaults: Dict[str, object] = {
        "facility_name": "Unknown Facility",
        "confidence": 0.0,
        "status": "absent",
        "region_id": "unknown_region",
        "region_name": "Unknown Region",
    }
    for column, default in defaults.items():
        if column not in out.columns:
            out[column] = default
        out[column] = out[column].fillna(default)

    for list_column in ["flags", "missing_prerequisites", "evidence_ids"]:
        if list_column not in out.columns:
            out[list_column] = [[] for _ in range(len(out))]
        out[list_column] = out[list_column].apply(_normalize_list_value)

    if "latitude" not in out.columns:
        out["latitude"] = pd.NA
    if "longitude" not in out.columns:
        out["longitude"] = pd.NA
    return out


def load_loc2med_dataset(
    facility_capabilities_path: Path,
    region_coverage_path: Path,
) -> Loc2MedDataset:
    """Load processed data artifacts needed by Loc2Med."""

    facilities = read_parquet(
        facility_capabilities_path,
        required_columns=["facility_id", "capability", "status", "confidence"],
    )
    region_coverage = read_parquet(
        region_coverage_path,
        required_columns=["region_id", "region_name", "capability", "coverage_score", "desert_flag"],
    )
    facilities = _ensure_facility_columns(facilities)
    return Loc2MedDataset(facilities=facilities, region_coverage=region_coverage)


def build_facility_markers(facilities: pd.DataFrame, state: UIState, limit: int = 200) -> List[Dict[str, object]]:
    """Create lightweight marker payloads for map rendering."""

    service = Loc2HospitalService(facilities, region_field="region_id")
    result = service.search(
        SearchRequest(
            capability=state.filters.capability,
            region_id=state.filters.region_id,
            min_confidence=state.filters.min_confidence,
            ranking_strategy=state.filters.ranking_strategy,
        )
    )
    if result.empty:
        return []

    markers: List[Dict[str, object]] = []
    for row in result.head(limit).itertuples(index=False):
        markers.append(
            {
                "facility_id": row.facility_id,
                "facility_name": row.facility_name,
                "capability": row.capability,
                "status": row.status,
                "confidence": float(row.confidence),
                "region_id": getattr(row, "region_id", None),
                "region_name": getattr(row, "region_name", None),
                "latitude": getattr(row, "latitude", None),
                "longitude": getattr(row, "longitude", None),
                "rank": getattr(row, "rank", None),
                "flags": list(getattr(row, "flags", []) or []),
                "missing_prerequisites": list(getattr(row, "missing_prerequisites", []) or []),
                "evidence_ids": list(getattr(row, "evidence_ids", []) or []),
            }
        )
    return markers


def build_region_overlay(region_coverage: pd.DataFrame, state: UIState) -> List[Dict[str, object]]:
    """Build region-level overlay stats scoped by active capability."""

    frame = region_coverage.copy()
    capability = state.filters.capability
    if capability:
        frame = frame[frame["capability"] == capability]

    overlays: List[Dict[str, object]] = []
    for row in frame.itertuples(index=False):
        overlays.append(
            {
                "region_id": row.region_id,
                "region_name": row.region_name,
                "capability": row.capability,
                "coverage_score": float(row.coverage_score),
                "desert_flag": str(row.desert_flag),
                "facility_count": int(getattr(row, "facility_count", 0)),
                "confirmed_count": int(getattr(row, "confirmed_count", 0)),
                "probable_count": int(getattr(row, "probable_count", 0)),
            }
        )
    return overlays


def build_dashboard_payload(dataset: Loc2MedDataset, state: UIState) -> Dict[str, object]:
    """Compose map markers, overlays, and summary metrics into one payload."""

    markers = build_facility_markers(dataset.facilities, state=state)
    overlays = build_region_overlay(dataset.region_coverage, state=state)
    summary = {
        "facility_rows": int(len(dataset.facilities)),
        "facility_ids": int(dataset.facilities["facility_id"].nunique()),
        "capabilities": int(dataset.facilities["capability"].nunique()),
        "regions": int(dataset.region_coverage["region_id"].nunique()),
        "markers_returned": len(markers),
        "overlays_returned": len(overlays),
    }
    return {
        "ui_state": state.to_dict(),
        "summary": summary,
        "markers": markers,
        "overlays": overlays,
    }


__all__ = ["Loc2MedDataset", "load_loc2med_dataset", "build_facility_markers", "build_region_overlay", "build_dashboard_payload"]
