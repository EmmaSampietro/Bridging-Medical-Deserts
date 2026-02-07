"""Ranking strategies for facility retrieval results."""

from __future__ import annotations

from typing import Optional

import pandas as pd


def _normalized_strategy(strategy: str) -> str:
    value = (strategy or "confidence").strip().lower()
    aliases = {
        "capability_completeness": "completeness",
        "completeness": "completeness",
        "confidence": "confidence",
    }
    return aliases.get(value, "confidence")


def rank_by_confidence(facilities: pd.DataFrame) -> pd.DataFrame:
    """Rank facilities by confidence (desc) and recency."""

    if facilities.empty:
        return facilities.copy()
    frame = facilities.copy()
    if "updated_at" not in frame:
        frame["updated_at"] = None
    frame = frame.sort_values(
        by=["confidence", "updated_at"],
        ascending=[False, False],
        na_position="last",
        kind="mergesort",
    )
    return frame


def rank_by_completeness(facilities: pd.DataFrame) -> pd.DataFrame:
    """Promote facilities with fewer missing prerequisites or flags."""

    if facilities.empty:
        return facilities.copy()

    frame = facilities.copy()
    if "missing_prerequisites" in frame.columns:
        frame["missing_prereq_count"] = frame["missing_prerequisites"].apply(
            lambda value: len(value) if isinstance(value, list) else 0
        )
    else:
        frame["missing_prereq_count"] = 0

    if "flags" in frame.columns:
        frame["flag_count"] = frame["flags"].apply(
            lambda value: len(value) if isinstance(value, list) else 0
        )
    else:
        frame["flag_count"] = 0
    frame = frame.sort_values(
        by=["missing_prereq_count", "flag_count", "confidence"],
        ascending=[True, True, False],
        kind="mergesort",
    )
    return frame


def _rank_once(facilities: pd.DataFrame, strategy: str) -> pd.DataFrame:
    normalized = _normalized_strategy(strategy)
    if normalized == "completeness":
        return rank_by_completeness(facilities)
    return rank_by_confidence(facilities)


def apply_ranking(
    facilities: pd.DataFrame,
    strategy: str = "confidence",
    secondary_strategy: Optional[str] = None,
) -> pd.DataFrame:
    """Dispatch ranking based on strategy."""

    if facilities.empty:
        return facilities.copy()

    frame = facilities.copy()
    if secondary_strategy:
        frame = _rank_once(frame, secondary_strategy)
    frame = _rank_once(frame, strategy)
    frame = frame.reset_index(drop=True)
    frame["rank"] = range(1, len(frame) + 1)
    return frame


__all__ = ["rank_by_confidence", "rank_by_completeness", "apply_ranking"]
