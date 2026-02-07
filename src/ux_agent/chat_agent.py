"""Deterministic UX chat agent wired to project data tables."""

from __future__ import annotations

import ast
import json
from dataclasses import dataclass
from typing import Dict, List, Optional

import pandas as pd

from src.loc2hospital.api import Loc2HospitalService, SearchRequest

from .intent_router import Intent, route_intent
from .trace_bridge import TraceBridge


def _normalize_list(value: object) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return []
        for parser in (json.loads, ast.literal_eval):
            try:
                parsed = parser(raw)
            except Exception:
                continue
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        return [raw]
    return [str(value)]


@dataclass
class ChatResponse:
    """Response payload for UX chat interactions."""

    answer: str
    rows: List[Dict[str, object]]
    trace_id: Optional[str] = None


class PlannerChatAgent:
    """Simple planner assistant over capability and recommendation tables."""

    def __init__(
        self,
        facility_capabilities: pd.DataFrame,
        planning_recommendations: Optional[pd.DataFrame] = None,
        trace_bridge: Optional[TraceBridge] = None,
    ) -> None:
        self.facilities = facility_capabilities.copy()
        if "missing_prerequisites" in self.facilities.columns:
            self.facilities["missing_prerequisites"] = self.facilities["missing_prerequisites"].apply(
                _normalize_list
            )
        self.recommendations = (
            planning_recommendations.copy()
            if planning_recommendations is not None
            else pd.DataFrame()
        )
        self.service = Loc2HospitalService(self.facilities)
        self.trace_bridge = trace_bridge

    def _run_facility_search(self, intent: Intent) -> ChatResponse:
        result = self.service.search(
            SearchRequest(
                capability=intent.capability,
                region_id=intent.region_id,
                min_confidence=float(intent.min_confidence),
            )
        )
        top = result.head(5)
        rows = top[
            [
                "facility_id",
                "facility_name",
                "capability",
                "confidence",
                "status",
                "region_id",
            ]
        ].to_dict("records")
        answer = (
            f"Found {len(result)} facilities for capability '{intent.capability}'. "
            f"Showing top {len(rows)} by ranking."
        )
        return ChatResponse(answer=answer, rows=rows)

    def _run_missing_prereq(self, intent: Intent) -> ChatResponse:
        frame = self.facilities.copy()
        if intent.capability:
            frame = frame[frame["capability"] == intent.capability]
        frame = frame[frame["status"].isin(["present", "uncertain"])]
        if intent.region_id:
            frame = frame[frame.get("region_id", "") == intent.region_id]

        if intent.prerequisite:
            frame = frame[
                frame["missing_prerequisites"].apply(lambda values: intent.prerequisite in values)
            ]
        else:
            frame = frame[frame["missing_prerequisites"].apply(bool)]

        rows = frame.head(8)[
            [
                "facility_id",
                "facility_name",
                "capability",
                "status",
                "confidence",
                "missing_prerequisites",
            ]
        ].to_dict("records")
        answer = f"Found {len(frame)} facilities with missing prerequisites for '{intent.capability}'."
        return ChatResponse(answer=answer, rows=rows)

    def _run_planning(self, intent: Intent) -> ChatResponse:
        if self.recommendations.empty:
            return ChatResponse(
                answer="No planning recommendations are loaded yet.",
                rows=[],
            )

        frame = self.recommendations.copy()
        if intent.capability:
            frame = frame[frame["capability"] == intent.capability]
        if intent.region_id:
            frame = frame[frame["region_id"] == intent.region_id]

        rows = frame.head(8).to_dict("records")
        answer = f"Found {len(frame)} planning recommendations."
        return ChatResponse(answer=answer, rows=rows)

    def _run_summary(self) -> ChatResponse:
        facilities = self.facilities
        answer = (
            f"Dataset includes {facilities['facility_id'].nunique()} facilities, "
            f"{facilities['capability'].nunique()} capabilities, "
            f"and {len(facilities)} facility-capability rows."
        )
        return ChatResponse(answer=answer, rows=[])

    def answer(self, question: str) -> ChatResponse:
        trace = self.trace_bridge.start_trace(question) if self.trace_bridge else None
        intent = route_intent(question)
        if trace:
            trace.add_step("intent_routed", {"intent": intent.name, "capability": intent.capability})

        if intent.name == "facility_search":
            response = self._run_facility_search(intent)
        elif intent.name == "missing_prerequisite":
            response = self._run_missing_prereq(intent)
        elif intent.name == "planning_recommendations":
            response = self._run_planning(intent)
        elif intent.name == "system_summary":
            response = self._run_summary()
        else:
            response = ChatResponse(
                answer=(
                    "I couldn't map that request yet. Try asking for facilities by capability, "
                    "missing prerequisites, or planning recommendations."
                ),
                rows=[],
            )

        if trace:
            trace.add_step(
                "response_generated",
                {"answer_preview": response.answer[:180], "rows": len(response.rows)},
            )
            path = self.trace_bridge.write(trace)
            response.trace_id = trace.trace_id
            response.rows = [{**row, "_trace_path": str(path)} for row in response.rows]
        return response


__all__ = ["ChatResponse", "PlannerChatAgent"]
