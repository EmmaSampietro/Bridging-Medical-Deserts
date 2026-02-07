"""Lightweight geo helpers for region normalization + distance math."""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional

import pandas as pd


@dataclass(frozen=True)
class RegionLookupEntry:
    """Normalized region metadata row."""

    region_id: str
    region_name: str
    country: str | None = None
    latitude: float | None = None
    longitude: float | None = None


def normalize_region_name(value: str | None) -> str:
    """Normalize names for consistent region joins."""

    if not value:
        return ""
    clean = (
        str(value)
        .strip()
        .replace(".", "")
        .replace("-", " ")
        .replace("_", " ")
        .lower()
    )
    return " ".join(part for part in clean.split() if part)


def load_region_lookup(csv_path: Path) -> pd.DataFrame:
    """Load region lookup table with normalized name column."""

    if not csv_path.exists():
        raise FileNotFoundError(f"Region lookup file not found: {csv_path}")

    df = pd.read_csv(csv_path)
    required = {"region_id", "region_name"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(
            f"Region lookup missing required columns: {', '.join(sorted(missing))}"
        )
    df = df.copy()
    df["region_name_norm"] = df["region_name"].apply(normalize_region_name)
    return df


def assign_region(
    facility_row: pd.Series,
    lookup: pd.DataFrame,
    *,
    facility_region_field: str,
) -> tuple[str, str]:
    """Return (region_id, region_name) for a facility row."""

    region_value = facility_row.get(facility_region_field)
    norm = normalize_region_name(region_value)
    if not norm:
        return "", ""
    matches = lookup[lookup["region_name_norm"] == norm]
    if matches.empty:
        return "", str(region_value)
    row = matches.iloc[0]
    return str(row["region_id"]), str(row["region_name"])


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute Haversine distance between two coordinates in km."""

    radius = 6371.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = math.sin(d_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(
        d_lambda / 2.0
    ) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius * c


def within_radius(
    facilities: pd.DataFrame,
    *,
    latitude: float,
    longitude: float,
    radius_km: float,
) -> pd.DataFrame:
    """Filter facilities within radius_km of given coordinate."""

    required_cols = {"latitude", "longitude"}
    missing = [col for col in required_cols if col not in facilities.columns]
    if missing:
        raise ValueError(
            f"Facilities frame missing required geo columns: {', '.join(missing)}"
        )

    def _distance(row: pd.Series) -> float:
        lat = row.get("latitude")
        lon = row.get("longitude")
        if pd.isna(lat) or pd.isna(lon):
            return float("inf")
        return haversine_km(float(lat), float(lon), latitude, longitude)

    distances = facilities.apply(_distance, axis=1)
    facilities = facilities.copy()
    facilities["distance_km"] = distances
    return facilities[facilities["distance_km"] <= radius_km]


__all__ = [
    "RegionLookupEntry",
    "normalize_region_name",
    "load_region_lookup",
    "assign_region",
    "haversine_km",
    "within_radius",
]
