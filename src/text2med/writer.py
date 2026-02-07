"""Persistence helpers for Text2Med outputs."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Dict

import pandas as pd

from src.common.storage import write_parquet


def write_text_chunks(text_chunks: pd.DataFrame, output_path: Path) -> Path:
    """Write normalized text chunks."""

    if text_chunks.empty:
        raise ValueError("No text chunks available to write.")
    return write_parquet(text_chunks, output_path, index=False)


def write_raw_claims(raw_claims: pd.DataFrame, output_path: Path) -> Path:
    """Write intermediate raw capability claims."""

    if raw_claims.empty:
        raise ValueError("No raw claims available to write.")
    return write_parquet(raw_claims, output_path, index=False)


def _final_columns() -> list[str]:
    return [
        "facility_id",
        "facility_name",
        "country",
        "capability",
        "category",
        "status",
        "confidence",
        "confidence_label",
        "evidence_count",
        "source_support_count",
        "evidence_ids",
        "evidence_chunk_ids",
        "evidence_doc_ids",
        "evidence_source_refs",
        "flags",
        "missing_prerequisites",
        "contradiction_count",
        "raw_explanation",
        "verification_notes",
        "confidence_explanation",
        "citations",
        "updated_at",
    ]


def write_final_capabilities(final_claims: pd.DataFrame, output_path: Path) -> Path:
    """Write final facility capabilities table."""

    if final_claims.empty:
        raise ValueError("No final claims available to write.")

    frame = final_claims.copy()
    if "updated_at" not in frame.columns:
        frame["updated_at"] = datetime.now(timezone.utc).isoformat()
    for column in _final_columns():
        if column not in frame.columns:
            frame[column] = None
    frame = frame[_final_columns()]
    return write_parquet(frame, output_path, index=False)


def write_pipeline_outputs(
    text_chunks: pd.DataFrame,
    raw_claims: pd.DataFrame,
    final_claims: pd.DataFrame,
    *,
    interim_dir: Path,
    processed_dir: Path,
) -> Dict[str, Path]:
    """Persist all primary Text2Med artifacts and return their paths."""

    outputs = {
        "text_chunks": write_text_chunks(text_chunks, interim_dir / "text_chunks.parquet"),
        "raw_claims": write_raw_claims(raw_claims, interim_dir / "facility_capabilities_raw.parquet"),
        "facility_capabilities": write_final_capabilities(
            final_claims, processed_dir / "facility_capabilities.parquet"
        ),
    }
    return outputs


__all__ = [
    "write_text_chunks",
    "write_raw_claims",
    "write_final_capabilities",
    "write_pipeline_outputs",
]
