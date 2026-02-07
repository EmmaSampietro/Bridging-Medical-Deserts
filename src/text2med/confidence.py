"""Confidence scoring for verified capability claims."""

from __future__ import annotations

from typing import Mapping

import pandas as pd


BASE_STATUS_SCORE = {
    "present": 0.55,
    "uncertain": 0.35,
    "absent": 0.05,
}


def _safe_weight(weights: Mapping[str, float], key: str, fallback: float) -> float:
    value = weights.get(key, fallback)
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _confidence_label(score: float) -> str:
    if score >= 0.7:
        return "confirmed"
    if score >= 0.45:
        return "probable"
    return "uncertain"


def score_claims(
    verified_claims: pd.DataFrame,
    weights: Mapping[str, float],
) -> pd.DataFrame:
    """Add confidence score and explanation to verified claims."""

    if verified_claims.empty:
        return verified_claims.copy()

    scored = verified_claims.copy()
    spec_weight = _safe_weight(weights, "specificity", 0.3)
    multi_weight = _safe_weight(weights, "multi_evidence", 0.2)
    prereq_weight = _safe_weight(weights, "prerequisite_penalty", -0.2)
    contradiction_weight = _safe_weight(weights, "contradiction_penalty", -0.3)

    confidence_scores = []
    confidence_labels = []
    explanations = []

    for row in scored.itertuples(index=False):
        status = str(getattr(row, "status", "absent"))
        base = BASE_STATUS_SCORE.get(status, 0.1)

        strong_matches = int(getattr(row, "strong_match_count", 0))
        evidence_count = int(getattr(row, "evidence_count", 0))
        source_support_count = int(getattr(row, "source_support_count", 0))
        missing_prereqs = list(getattr(row, "missing_prerequisites", []) or [])
        contradiction_count = int(getattr(row, "contradiction_count", 0))

        specificity_signal = min(1.0, strong_matches / 2.0)
        multi_evidence_signal = min(1.0, max(0.0, source_support_count - 1.0) / 2.0)
        prereq_signal = 1.0 if missing_prereqs else 0.0
        contradiction_signal = min(1.0, float(contradiction_count))

        score = (
            base
            + (spec_weight * specificity_signal)
            + (multi_weight * multi_evidence_signal)
            + (prereq_weight * prereq_signal)
            + (contradiction_weight * contradiction_signal)
        )
        score = max(0.0, min(1.0, float(score)))

        label = _confidence_label(score)
        explanation = (
            f"base={base:.2f}, strong={strong_matches}, evidence={evidence_count}, "
            f"sources={source_support_count}, missing_prereq={len(missing_prereqs)}, "
            f"contradictions={contradiction_count}"
        )

        confidence_scores.append(score)
        confidence_labels.append(label)
        explanations.append(explanation)

    scored["confidence"] = confidence_scores
    scored["confidence_label"] = confidence_labels
    scored["confidence_explanation"] = explanations
    return scored


__all__ = ["score_claims"]
