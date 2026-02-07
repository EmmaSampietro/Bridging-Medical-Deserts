"""Citation utilities for mapping chunk evidence to stable IDs."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, asdict
from typing import List, Sequence


def _sha1_short(value: str, length: int = 16) -> str:
    digest = hashlib.sha1(value.encode("utf-8")).hexdigest()
    return digest[:length]


def build_evidence_id(facility_id: str, capability: str, chunk_id: str) -> str:
    """Create a stable evidence ID from facility/capability/chunk linkage."""

    seed = f"{facility_id}|{capability}|{chunk_id}"
    return f"ev_{_sha1_short(seed)}"


@dataclass(frozen=True)
class EvidenceCitation:
    """Normalized citation payload attached to capability claims."""

    evidence_id: str
    chunk_id: str
    doc_id: str
    source_type: str
    source_ref: str
    snippet: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


def build_citation(
    *,
    facility_id: str,
    capability: str,
    chunk_id: str,
    doc_id: str,
    source_type: str,
    source_ref: str,
    text: str,
    max_snippet_chars: int = 220,
) -> EvidenceCitation:
    """Build a normalized citation record for a single chunk hit."""

    snippet = text.strip()
    if len(snippet) > max_snippet_chars:
        snippet = snippet[: max_snippet_chars - 3].rstrip() + "..."
    return EvidenceCitation(
        evidence_id=build_evidence_id(facility_id, capability, chunk_id),
        chunk_id=chunk_id,
        doc_id=doc_id,
        source_type=source_type,
        source_ref=source_ref,
        snippet=snippet,
    )


def citations_to_dicts(citations: Sequence[EvidenceCitation]) -> List[dict[str, str]]:
    """Convert citation dataclasses into JSON-serializable dict rows."""

    return [citation.to_dict() for citation in citations]


__all__ = [
    "EvidenceCitation",
    "build_evidence_id",
    "build_citation",
    "citations_to_dicts",
]
