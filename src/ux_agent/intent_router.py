"""Map natural-language planner questions to structured intents."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, Optional


CAPABILITY_KEYWORDS = {
    "icu": ["icu", "intensive care"],
    "c_section": ["c section", "c-section", "cesarean", "caesarean"],
    "oxygen_supply": ["oxygen", "oxygen supply"],
    "dialysis": ["dialysis"],
    "x_ray": ["x ray", "x-ray", "radiography"],
    "ultrasound": ["ultrasound"],
    "lab_tests": ["lab test", "laboratory"],
}


@dataclass(frozen=True)
class Intent:
    """Structured representation of a planner query."""

    name: str
    capability: Optional[str] = None
    prerequisite: Optional[str] = None
    region_id: Optional[str] = None
    min_confidence: float = 0.0
    params: Dict[str, object] = field(default_factory=dict)


def _extract_capability(question: str) -> Optional[str]:
    text = question.lower()
    for capability, keywords in CAPABILITY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                return capability
    return None


def _extract_region(question: str) -> Optional[str]:
    match = re.search(r"\bin\s+([a-zA-Z][a-zA-Z\s\-]{1,50})", question)
    if not match:
        return None
    region = match.group(1).strip().lower()
    region = re.sub(r"[^a-z0-9\s\-]", "", region)
    return " ".join(region.split()) or None


def route_intent(question: str) -> Intent:
    """Return intent for a user question using lightweight heuristics."""

    text = question.strip()
    lower = text.lower()
    capability = _extract_capability(lower)
    region = _extract_region(lower)

    if any(token in lower for token in ["recommend", "plan", "unlock", "intervention"]):
        return Intent(name="planning_recommendations", capability=capability, region_id=region)

    if any(token in lower for token in ["lack", "missing", "without"]) and capability:
        prerequisite = "oxygen_supply" if "oxygen" in lower else None
        return Intent(
            name="missing_prerequisite",
            capability=capability,
            prerequisite=prerequisite,
            region_id=region,
        )

    if any(token in lower for token in ["where", "which", "find", "show"]) and capability:
        min_confidence = 0.45 if "confirmed" in lower else 0.0
        return Intent(
            name="facility_search",
            capability=capability,
            region_id=region,
            min_confidence=min_confidence,
        )

    if any(token in lower for token in ["summary", "overview", "status", "desert"]):
        return Intent(name="system_summary", capability=capability, region_id=region)

    return Intent(name="unknown", capability=capability, region_id=region)


__all__ = ["Intent", "route_intent"]
