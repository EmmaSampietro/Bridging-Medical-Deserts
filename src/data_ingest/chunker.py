"""Convert textual documents into evidence chunks suitable for downstream models."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, List
from uuid import uuid4


_SENTENCE_SPLIT_REGEX = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")


@dataclass(frozen=True)
class ChunkerConfig:
    max_chars: int = 900
    min_chars: int = 120
    overlap_chars: int = 120


@dataclass(frozen=True)
class TextChunk:
    chunk_id: str
    index: int
    text: str


class TextChunker:
    """Sentence-aware chunker with optional overlap for retrieval robustness."""

    def __init__(self, config: ChunkerConfig | None = None) -> None:
        self.config = config or ChunkerConfig()

    def _normalize(self, text: str) -> str:
        return re.sub(r"\s+", " ", text.strip())

    def _split_paragraphs(self, text: str) -> List[str]:
        paragraphs = [p.strip() for p in re.split(r"\n{2,}", text)]
        return [p for p in paragraphs if p]

    def _split_sentences(self, paragraph: str) -> List[str]:
        sentences = _SENTENCE_SPLIT_REGEX.split(paragraph)
        if len(sentences) == 1:
            return [paragraph]
        return [s.strip() for s in sentences if s.strip()]

    def chunk(self, text: str) -> List[TextChunk]:
        normalized = self._normalize(text)
        if not normalized:
            return []

        max_chars = max(self.config.max_chars, self.config.min_chars)
        overlap = max(0, min(self.config.overlap_chars, max_chars // 2))

        paragraphs = self._split_paragraphs(normalized)
        sentences: List[str] = []
        for paragraph in paragraphs:
            sentences.extend(self._split_sentences(paragraph))

        chunks: List[TextChunk] = []
        buffer: List[str] = []
        buffer_len = 0
        chunk_index = 0

        for sentence in sentences:
            sentence_len = len(sentence) + 1
            if buffer and buffer_len + sentence_len > max_chars:
                chunk_text = " ".join(buffer).strip()
                if chunk_text:
                    chunks.append(
                        TextChunk(
                            chunk_id=uuid4().hex,
                            index=chunk_index,
                            text=chunk_text,
                        )
                    )
                    chunk_index += 1
                if overlap and chunk_text:
                    buffer = [chunk_text[-overlap:].strip()]
                    buffer_len = len(buffer[0])
                else:
                    buffer = []
                    buffer_len = 0
            buffer.append(sentence)
            buffer_len += sentence_len

        if buffer:
            chunk_text = " ".join(buffer).strip()
            if chunk_text:
                chunks.append(
                    TextChunk(chunk_id=uuid4().hex, index=chunk_index, text=chunk_text)
                )

        # Ensure minimum chunk length by merging small trailing chunks
        if len(chunks) >= 2 and len(chunks[-1].text) < self.config.min_chars:
            merged = chunks[-2].text + " " + chunks[-1].text
            chunks[-2] = TextChunk(
                chunk_id=chunks[-2].chunk_id,
                index=chunks[-2].index,
                text=self._normalize(merged),
            )
            chunks.pop()

        return chunks


__all__ = ["ChunkerConfig", "TextChunk", "TextChunker"]
