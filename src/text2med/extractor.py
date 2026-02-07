"""Rule-first extraction pipeline for capability claims from text chunks."""

from __future__ import annotations

import hashlib
import json
import re
from typing import Dict, List

import pandas as pd

from src.common.citations import build_citation, citations_to_dicts

from .ontology import CapabilityOntology
from .retrieval import KeywordRetriever, matches_to_frame

REQUIRED_RAW_DOCUMENT_COLUMNS = [
    "facility_id",
    "source_type",
    "source_ref",
    "text",
]


def _stable_id(seed: str) -> str:
    return hashlib.sha1(seed.encode("utf-8")).hexdigest()[:16]


def _split_text(text: str, *, strategy: str, max_chars: int) -> List[str]:
    content = re.sub(r"\s+", " ", str(text).strip())
    if not content:
        return []
    if len(content) <= max_chars:
        return [content]

    if strategy == "bullet":
        units = [unit.strip(" -\t") for unit in re.split(r"[\u2022\n\-]+", content) if unit.strip()]
    elif strategy == "paragraph":
        units = [unit.strip() for unit in re.split(r"\n{2,}", content) if unit.strip()]
    else:
        units = [unit.strip() for unit in re.split(r"(?<=[.!?])\s+", content) if unit.strip()]

    if not units:
        units = [content]

    chunks: List[str] = []
    buffer = ""
    for unit in units:
        candidate = f"{buffer} {unit}".strip() if buffer else unit
        if buffer and len(candidate) > max_chars:
            chunks.append(buffer)
            buffer = unit
            continue
        if len(candidate) <= max_chars:
            buffer = candidate
        else:
            if buffer:
                chunks.append(buffer)
            for i in range(0, len(unit), max_chars):
                chunks.append(unit[i : i + max_chars].strip())
            buffer = ""
    if buffer:
        chunks.append(buffer)
    return [chunk for chunk in chunks if chunk]


def _derive_origin_field(metadata_value: object) -> str:
    if metadata_value is None:
        return ""
    payload = metadata_value
    if isinstance(metadata_value, str):
        try:
            payload = json.loads(metadata_value)
        except json.JSONDecodeError:
            return ""
    if not isinstance(payload, dict):
        return ""
    if payload.get("source_field"):
        return str(payload["source_field"])
    fields = payload.get("fields")
    if isinstance(fields, list):
        return ",".join(str(field) for field in fields if str(field).strip())
    return ""


def normalize_raw_documents(
    raw_documents: pd.DataFrame,
    *,
    strategy: str = "sentence",
    max_chunk_chars: int = 512,
) -> pd.DataFrame:
    """Normalize ingestion output into Text2Med chunk schema."""

    missing = [column for column in REQUIRED_RAW_DOCUMENT_COLUMNS if column not in raw_documents.columns]
    if missing:
        raise ValueError(f"raw_documents is missing required columns: {', '.join(sorted(missing))}")

    normalized = raw_documents.copy()
    if "doc_id" not in normalized.columns:
        normalized["doc_id"] = [
            f"doc_{_stable_id(f'{facility}_{idx}')}"
            for idx, facility in enumerate(normalized["facility_id"].astype(str))
        ]
    if "chunk_id" not in normalized.columns:
        normalized["chunk_id"] = [
            f"chunk_{_stable_id(f'{doc}_{idx}')}"
            for idx, doc in enumerate(normalized["doc_id"].astype(str))
        ]
    if "chunk_index" not in normalized.columns:
        normalized["chunk_index"] = 0
    if "facility_name" not in normalized.columns:
        normalized["facility_name"] = "Unknown Facility"
    if "country" not in normalized.columns:
        normalized["country"] = "Unknown"
    if "metadata" not in normalized.columns:
        normalized["metadata"] = "{}"

    rows: List[Dict[str, object]] = []
    for row in normalized.itertuples(index=False):
        base_chunk_id = str(getattr(row, "chunk_id"))
        doc_id = str(getattr(row, "doc_id"))
        text = str(getattr(row, "text", ""))
        split_chunks = _split_text(text, strategy=strategy, max_chars=max_chunk_chars)
        if not split_chunks:
            continue
        origin_field = _derive_origin_field(getattr(row, "metadata", None))
        for split_idx, chunk_text in enumerate(split_chunks):
            chunk_id = base_chunk_id
            if split_idx > 0:
                chunk_id = f"{base_chunk_id}_{split_idx}_{_stable_id(f'{doc_id}:{split_idx}:{chunk_text}')[:8]}"
            rows.append(
                {
                    "doc_id": doc_id,
                    "chunk_id": chunk_id,
                    "chunk_index": split_idx,
                    "facility_id": str(getattr(row, "facility_id")),
                    "facility_name": str(getattr(row, "facility_name")),
                    "country": str(getattr(row, "country")),
                    "source_type": str(getattr(row, "source_type")),
                    "source_ref": str(getattr(row, "source_ref")),
                    "origin_field": origin_field,
                    "chunk_text": chunk_text,
                    "metadata": getattr(row, "metadata", "{}"),
                }
            )

    return pd.DataFrame(rows)


def _decide_claim_status(strong_matches: int, weak_matches: int, negative_matches: int) -> str:
    if strong_matches > 0 and negative_matches == 0:
        return "present"
    if strong_matches > 0 and negative_matches > 0:
        return "uncertain"
    if weak_matches > 0 and negative_matches == 0:
        return "uncertain"
    if negative_matches > 0:
        return "absent"
    return "absent"


def _build_raw_explanation(
    capability: str,
    status: str,
    strong_matches: int,
    weak_matches: int,
    negative_matches: int,
) -> str:
    return (
        f"{capability}: status={status}; "
        f"strong={strong_matches}, weak={weak_matches}, negative={negative_matches}"
    )


def extract_capability_claims(
    text_chunks: pd.DataFrame,
    ontology: CapabilityOntology,
    *,
    max_evidence_per_claim: int = 5,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Generate raw facility-capability claims and retrieval matches."""

    if text_chunks.empty:
        return pd.DataFrame(), pd.DataFrame()

    retriever = KeywordRetriever(ontology)
    claims: List[Dict[str, object]] = []
    all_match_rows: List[pd.DataFrame] = []

    for facility_id, facility_chunks in text_chunks.groupby("facility_id", sort=False):
        facility_name = str(facility_chunks.iloc[0].get("facility_name", "Unknown Facility"))
        country = str(facility_chunks.iloc[0].get("country", "Unknown"))

        for capability in ontology.ordered_capabilities():
            matches = retriever.retrieve_for_capability(facility_chunks, capability)
            match_frame = matches_to_frame(matches)
            if not match_frame.empty:
                all_match_rows.append(match_frame)

            strong_count = int((match_frame["match_type"] == "strong").sum()) if not match_frame.empty else 0
            weak_count = int((match_frame["match_type"] == "weak").sum()) if not match_frame.empty else 0
            negative_count = int((match_frame["match_type"] == "negative").sum()) if not match_frame.empty else 0
            status = _decide_claim_status(strong_count, weak_count, negative_count)

            if status == "absent":
                evidence_candidates = match_frame[match_frame["match_type"] == "negative"]
            else:
                evidence_candidates = match_frame[match_frame["match_type"].isin(["strong", "weak"])]
            evidence_candidates = evidence_candidates.drop_duplicates(subset=["chunk_id"]).head(
                max_evidence_per_claim
            )

            citations = [
                build_citation(
                    facility_id=str(facility_id),
                    capability=capability.capability_id,
                    chunk_id=str(row.chunk_id),
                    doc_id=str(row.doc_id),
                    source_type=str(row.source_type),
                    source_ref=str(row.source_ref),
                    text=str(row.chunk_text),
                )
                for row in evidence_candidates.itertuples(index=False)
            ]
            citation_dicts = citations_to_dicts(citations)

            evidence_ids = [item["evidence_id"] for item in citation_dicts]
            evidence_chunk_ids = [item["chunk_id"] for item in citation_dicts]
            evidence_doc_ids = [item["doc_id"] for item in citation_dicts]
            evidence_source_refs = [item["source_ref"] for item in citation_dicts]

            claims.append(
                {
                    "facility_id": str(facility_id),
                    "facility_name": facility_name,
                    "country": country,
                    "capability": capability.capability_id,
                    "category": capability.category,
                    "status": status,
                    "strong_match_count": strong_count,
                    "weak_match_count": weak_count,
                    "negative_match_count": negative_count,
                    "retrieval_score": float(match_frame["score"].sum()) if not match_frame.empty else 0.0,
                    "evidence_count": len(evidence_ids),
                    "source_support_count": len(set(evidence_source_refs)),
                    "evidence_ids": evidence_ids,
                    "evidence_chunk_ids": evidence_chunk_ids,
                    "evidence_doc_ids": evidence_doc_ids,
                    "evidence_source_refs": evidence_source_refs,
                    "citations": citation_dicts,
                    "raw_explanation": _build_raw_explanation(
                        capability.capability_id,
                        status,
                        strong_count,
                        weak_count,
                        negative_count,
                    ),
                }
            )

    claim_frame = pd.DataFrame(claims)
    matches_frame = pd.concat(all_match_rows, ignore_index=True) if all_match_rows else pd.DataFrame()
    return claim_frame, matches_frame


__all__ = ["normalize_raw_documents", "extract_capability_claims"]
