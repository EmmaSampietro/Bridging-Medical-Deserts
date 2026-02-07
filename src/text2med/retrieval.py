"""Keyword retrieval over chunked documents for capability evidence mining."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List

import pandas as pd

from .ontology import CapabilityDefinition, CapabilityOntology


@dataclass(frozen=True)
class ChunkMatch:
    """A matched chunk for a specific capability."""

    facility_id: str
    capability: str
    chunk_id: str
    doc_id: str
    source_type: str
    source_ref: str
    text: str
    match_type: str  # strong | weak | negative
    keyword: str
    score: float


def _count_hits(text: str, phrases: Iterable[str]) -> List[str]:
    matches: List[str] = []
    for phrase in phrases:
        phrase = phrase.strip().lower()
        if phrase and phrase in text:
            matches.append(phrase)
    return matches


class KeywordRetriever:
    """Rule-based retriever that scores chunks by lexical phrase matches."""

    def __init__(self, ontology: CapabilityOntology) -> None:
        self.ontology = ontology

    def retrieve_for_capability(
        self,
        chunks: pd.DataFrame,
        capability: CapabilityDefinition,
    ) -> List[ChunkMatch]:
        """Return chunk matches for a single capability."""

        matches: List[ChunkMatch] = []
        for row in chunks.itertuples(index=False):
            text = str(getattr(row, "chunk_text", "")).lower()
            if not text:
                continue

            strong_hits = _count_hits(text, capability.strong_phrases)
            weak_hits = _count_hits(text, capability.weak_phrases)
            negative_hits = _count_hits(text, capability.negative_phrases)

            events = [
                ("strong", strong_hits, 1.0),
                ("weak", weak_hits, 0.45),
                ("negative", negative_hits, 0.8),
            ]
            for match_type, keywords, weight in events:
                for keyword in keywords:
                    matches.append(
                        ChunkMatch(
                            facility_id=str(getattr(row, "facility_id")),
                            capability=capability.capability_id,
                            chunk_id=str(getattr(row, "chunk_id")),
                            doc_id=str(getattr(row, "doc_id")),
                            source_type=str(getattr(row, "source_type")),
                            source_ref=str(getattr(row, "source_ref")),
                            text=str(getattr(row, "chunk_text")),
                            match_type=match_type,
                            keyword=keyword,
                            score=weight,
                        )
                    )

        matches.sort(key=lambda item: item.score, reverse=True)
        return matches


def matches_to_frame(matches: Iterable[ChunkMatch]) -> pd.DataFrame:
    """Convert chunk matches to a DataFrame."""

    columns = [
        "facility_id",
        "capability",
        "chunk_id",
        "doc_id",
        "source_type",
        "source_ref",
        "chunk_text",
        "match_type",
        "keyword",
        "score",
    ]
    rows = [
        {
            "facility_id": match.facility_id,
            "capability": match.capability,
            "chunk_id": match.chunk_id,
            "doc_id": match.doc_id,
            "source_type": match.source_type,
            "source_ref": match.source_ref,
            "chunk_text": match.text,
            "match_type": match.match_type,
            "keyword": match.keyword,
            "score": match.score,
        }
        for match in matches
    ]
    return pd.DataFrame(rows, columns=columns)


__all__ = ["ChunkMatch", "KeywordRetriever", "matches_to_frame"]
