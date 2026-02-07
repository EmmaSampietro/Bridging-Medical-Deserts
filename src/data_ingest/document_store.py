"""Unify structured rows + scraped docs and persist chunked raw documents."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Sequence
from uuid import uuid4

import pandas as pd

from .chunker import TextChunk, TextChunker


@dataclass
class DocumentRecord:
    facility_id: str
    facility_name: str
    country: str
    source_type: str  # vf_row | scraped_web | other
    source_ref: str
    text: str
    metadata: Dict[str, object] = field(default_factory=dict)
    doc_id: str = field(default_factory=lambda: uuid4().hex)


def _metadata_to_json(metadata: Dict[str, object]) -> str:
    try:
        return json.dumps(metadata, ensure_ascii=False)
    except (TypeError, ValueError):
        safe_metadata = {k: str(v) for k, v in metadata.items()}
        return json.dumps(safe_metadata, ensure_ascii=False)


def _chunk_record(record: DocumentRecord, chunker: TextChunker) -> List[TextChunk]:
    chunks = chunker.chunk(record.text)
    if not chunks:
        fallback_text = record.text.strip()
        if not fallback_text:
            return []
        chunks = [
            TextChunk(
                chunk_id=uuid4().hex,
                index=0,
                text=fallback_text,
            )
        ]
    return chunks


def build_raw_document_rows(
    records: Sequence[DocumentRecord],
    chunker: TextChunker,
) -> List[Dict[str, object]]:
    """Transform DocumentRecord list into chunk rows ready for DataFrame creation."""

    rows: List[Dict[str, object]] = []
    ingested_at = datetime.now(timezone.utc).isoformat()

    for record in records:
        chunks = _chunk_record(record, chunker)
        if not chunks:
            continue
        metadata_json = _metadata_to_json(record.metadata)
        for chunk in chunks:
            rows.append(
                {
                    "doc_id": record.doc_id,
                    "chunk_id": chunk.chunk_id,
                    "chunk_index": chunk.index,
                    "facility_id": record.facility_id,
                    "facility_name": record.facility_name,
                    "country": record.country,
                    "source_type": record.source_type,
                    "source_ref": record.source_ref,
                    "text": chunk.text,
                    "metadata": metadata_json,
                    "ingested_at": ingested_at,
                }
            )
    return rows


def write_raw_documents(
    records: Sequence[DocumentRecord],
    chunker: TextChunker,
    output_path: Path,
) -> Path:
    """Write raw_documents.parquet containing chunked representations."""

    rows = build_raw_document_rows(records, chunker)
    if not rows:
        raise ValueError("No documents were generated; nothing to write.")

    df = pd.DataFrame(rows)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(output_path, index=False)
    return output_path


__all__ = ["DocumentRecord", "build_raw_document_rows", "write_raw_documents"]
