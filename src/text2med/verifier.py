"""Verification logic: prerequisites + contradiction checks for capability claims."""

from __future__ import annotations

from typing import List

import pandas as pd

from .ontology import CapabilityOntology


def _missing_required_status(frame: pd.DataFrame, facility_id: str, capability: str) -> bool:
    subset = frame[(frame["facility_id"] == facility_id) & (frame["capability"] == capability)]
    if subset.empty:
        return True
    status = str(subset.iloc[0].get("status", "absent"))
    return status == "absent"


def apply_verification(
    raw_claims: pd.DataFrame,
    ontology: CapabilityOntology,
    *,
    prerequisite_strict: bool = True,
) -> pd.DataFrame:
    """Attach flags and status adjustments based on consistency rules."""

    if raw_claims.empty:
        return raw_claims.copy()

    capability_map = ontology.capabilities
    verified = raw_claims.copy()
    verified["original_status"] = verified["status"]

    final_statuses: List[str] = []
    flags_list: List[List[str]] = []
    missing_prereqs_list: List[List[str]] = []
    contradiction_counts: List[int] = []
    verification_notes: List[str] = []

    for row in verified.itertuples(index=False):
        facility_id = str(getattr(row, "facility_id"))
        capability = str(getattr(row, "capability"))
        status = str(getattr(row, "status"))
        strong_count = int(getattr(row, "strong_match_count", 0))
        negative_count = int(getattr(row, "negative_match_count", 0))

        flags: List[str] = []
        missing_prereqs: List[str] = []
        contradictions = 0

        definition = capability_map.get(capability)
        prerequisites = list(definition.prerequisites) if definition else []
        if status in {"present", "uncertain"} and prerequisites:
            for prereq in prerequisites:
                if _missing_required_status(verified, facility_id, prereq):
                    missing_prereqs.append(prereq)
            if missing_prereqs:
                flags.append("missing_prerequisite")
                if prerequisite_strict and status == "present":
                    status = "uncertain"

        if status in {"present", "uncertain"} and strong_count > 0 and negative_count > 0:
            flags.append("inconsistent_claim")
            contradictions += 1
            if status == "present":
                status = "uncertain"

        if status == "absent" and int(getattr(row, "evidence_count", 0)) == 0:
            flags.append("low_evidence")

        if not flags:
            note = "Verification checks passed."
        else:
            note = "; ".join(flags)
            if missing_prereqs:
                note += f" ({', '.join(missing_prereqs)})"

        final_statuses.append(status)
        flags_list.append(flags)
        missing_prereqs_list.append(missing_prereqs)
        contradiction_counts.append(contradictions)
        verification_notes.append(note)

    verified["status"] = final_statuses
    verified["flags"] = flags_list
    verified["missing_prerequisites"] = missing_prereqs_list
    verified["contradiction_count"] = contradiction_counts
    verified["verification_notes"] = verification_notes
    return verified


__all__ = ["apply_verification"]
