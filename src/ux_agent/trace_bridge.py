"""Store UX agent traces under outputs/traces for auditing."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List
from uuid import uuid4

from src.common.storage import ensure_parent_dir


@dataclass
class TraceStep:
    """Single agent step entry."""

    step: str
    payload: Dict[str, Any]
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


@dataclass
class AgentTrace:
    """Collection of steps for one question/response cycle."""

    trace_id: str
    question: str
    steps: List[TraceStep] = field(default_factory=list)
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def add_step(self, step: str, payload: Dict[str, Any]) -> None:
        self.steps.append(TraceStep(step=step, payload=payload))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "trace_id": self.trace_id,
            "question": self.question,
            "created_at": self.created_at,
            "steps": [
                {
                    "step": step.step,
                    "payload": step.payload,
                    "created_at": step.created_at,
                }
                for step in self.steps
            ],
        }


class TraceBridge:
    """Trace persistence helper for UX flows."""

    def __init__(self, output_dir: Path) -> None:
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def start_trace(self, question: str) -> AgentTrace:
        return AgentTrace(trace_id=f"trace_{uuid4().hex[:12]}", question=question)

    def write(self, trace: AgentTrace) -> Path:
        path = self.output_dir / f"{trace.trace_id}.json"
        ensure_parent_dir(path)
        path.write_text(json.dumps(trace.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8")
        return path


__all__ = ["AgentTrace", "TraceStep", "TraceBridge"]
