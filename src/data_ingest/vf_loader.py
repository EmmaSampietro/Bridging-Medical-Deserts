"""Parse VF CSV exports, normalize rows, and build structured documents."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple
from uuid import uuid4

import pandas as pd

from .document_store import DocumentRecord
from .scraper import ScrapeRequest

TEXT_FIELDS_DEFAULT = [
    "capability",
    "capabilities",
    "procedures",
    "procedure",
    "equipment",
    "specialties",
    "services",
    "service",
    "notes",
    "comments",
    "description",
    "free_text",
]


@dataclass
class VFIngestResult:
    dataframe: pd.DataFrame
    documents: List[DocumentRecord]
    scrape_requests: List[ScrapeRequest]


def _snake_case(value: str) -> str:
    value = re.sub(r"[^\w\s]", "_", value)
    value = re.sub(r"(?<!^)(?=[A-Z])", "_", value)
    value = value.replace("__", "_")
    return value.strip("_").lower()


def _load_csv_files(csv_dir: Path) -> List[pd.DataFrame]:
    csv_files = sorted(csv_dir.glob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No CSV files found under {csv_dir}")
    dataframes = []
    for file in csv_files:
        df = pd.read_csv(file)
        df["__source_file__"] = file.name
        dataframes.append(df)
    return dataframes


def _normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    rename_map = {col: _snake_case(str(col)) for col in df.columns}
    normalized = df.rename(columns=rename_map)
    normalized.columns = normalized.columns.str.strip()
    return normalized


def _infer_facility_id_column(columns: Sequence[str]) -> str:
    preferred = [
        "facility_id",
        "pk_unique_id",
        "unique_id",
        "vf_id",
        "id",
    ]
    for candidate in preferred:
        if candidate in columns:
            return candidate
    return ""


def _coalesce_columns(df: pd.DataFrame, columns: Sequence[str]) -> Optional[str]:
    for column in columns:
        if column in df.columns:
            return column
    return None


def _clean_value(value: object) -> Optional[str]:
    if pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


def _build_text_bundle(row: pd.Series, text_fields: Sequence[str]) -> str:
    chunks: List[str] = []
    for field in text_fields:
        if field not in row:
            continue
        value = _clean_value(row[field])
        if not value:
            continue
        label = field.replace("_", " ").title()
        chunks.append(f"{label}: {value}")
    return "\n".join(chunks)


def _extract_urls(row: pd.Series) -> Set[str]:
    url_fields = [
        "source_url",
        "source_urls",
        "website",
        "websites",
        "link",
        "links",
    ]
    urls: Set[str] = set()
    for field in url_fields:
        if field not in row:
            continue
        value = _clean_value(row[field])
        if not value:
            continue
        for candidate in re.split(r"[;,\\s]+", value):
            candidate = candidate.strip()
            if candidate.lower().startswith("http://") or candidate.lower().startswith("https://"):
                urls.add(candidate)
    return urls


def _ensure_facility_id(df: pd.DataFrame) -> pd.DataFrame:
    column = _infer_facility_id_column(df.columns)
    if column:
        df["facility_id"] = df[column].fillna("").astype(str).replace("", pd.NA)
    if "facility_id" not in df.columns or df["facility_id"].isna().all():
        df["facility_id"] = [
            f"vf_{uuid4().hex[:10]}" for _ in range(len(df))
        ]
    df["facility_id"] = df["facility_id"].astype(str)
    return df


def _filter_country(df: pd.DataFrame, country: Optional[str]) -> pd.DataFrame:
    if not country:
        return df
    if "country" not in df.columns:
        return df
    mask = df["country"].fillna("").str.lower() == country.lower()
    filtered = df[mask].copy()
    if filtered.empty:
        raise ValueError(f"No rows found for country '{country}'.")
    return filtered


def load_vf_data(
    csv_root: Path,
    country: Optional[str],
    *,
    text_fields: Sequence[str] | None = None,
) -> VFIngestResult:
    """Load VF CSV files, normalize rows, and create DocumentRecords."""

    dataframes = [_normalize_dataframe(df) for df in _load_csv_files(csv_root)]
    df = pd.concat(dataframes, ignore_index=True)
    df = _ensure_facility_id(df)
    df = _filter_country(df, country)

    text_field_list = text_fields or TEXT_FIELDS_DEFAULT
    documents: List[DocumentRecord] = []
    scrape_requests: List[ScrapeRequest] = []

    for idx, row in df.iterrows():
        facility_id = row["facility_id"]
        facility_name = _clean_value(row.get("facility_name")) or _clean_value(row.get("name")) or "Unknown Facility"
        country_value = _clean_value(row.get("country")) or country or "Unknown"
        text_bundle = _build_text_bundle(row, text_field_list)
        if text_bundle:
            metadata = {
                "row_index": int(idx),
                "source_file": row.get("__source_file__", ""),
                "fields": [field for field in text_field_list if field in row and _clean_value(row[field])],
            }
            documents.append(
                DocumentRecord(
                    facility_id=facility_id,
                    facility_name=facility_name,
                    country=country_value,
                    source_type="vf_row",
                    source_ref=f"vf_row:{row.get('__source_file__','')}:{idx}",
                    text=text_bundle,
                    metadata=metadata,
                )
            )

        urls = _extract_urls(row)
        for url in urls:
            scrape_requests.append(
                ScrapeRequest(
                    facility_id=facility_id,
                    facility_name=facility_name,
                    country=country_value,
                    url=url,
                    source_field="vf_url",
                )
            )

    return VFIngestResult(dataframe=df, documents=documents, scrape_requests=scrape_requests)


__all__ = ["VFIngestResult", "load_vf_data"]
