"""Loc2Med backend helpers for preview, FastAPI, and Streamlit modes."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Optional

from src.common.storage import ensure_parent_dir

from .map_data import Loc2MedDataset, build_dashboard_payload, load_loc2med_dataset
from .ui_state import UIState, apply_filter_overrides


class Loc2MedBackend:
    """Loads datasets and returns UI payloads for requested filters."""

    def __init__(
        self,
        *,
        facility_capabilities_path: Path,
        region_coverage_path: Path,
        default_state: UIState,
    ) -> None:
        self.facility_capabilities_path = facility_capabilities_path
        self.region_coverage_path = region_coverage_path
        self.default_state = default_state
        self._dataset: Optional[Loc2MedDataset] = None

    def refresh(self) -> Loc2MedDataset:
        self._dataset = load_loc2med_dataset(
            self.facility_capabilities_path,
            self.region_coverage_path,
        )
        return self._dataset

    @property
    def dataset(self) -> Loc2MedDataset:
        if self._dataset is None:
            return self.refresh()
        return self._dataset

    def payload(self, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, object]:
        state = apply_filter_overrides(self.default_state, overrides)
        return build_dashboard_payload(self.dataset, state)

    def write_preview(self, output_path: Path, overrides: Optional[Dict[str, Any]] = None) -> Path:
        payload = self.payload(overrides)
        ensure_parent_dir(output_path)
        output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        return output_path


def create_fastapi_app(backend: Loc2MedBackend):
    """Create FastAPI app if dependency is available."""

    try:
        from fastapi import FastAPI, Query
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise RuntimeError(
            "FastAPI is not installed. Install fastapi and uvicorn to run API mode."
        ) from exc

    app = FastAPI(title="Loc2Med API", version="0.1.0")

    @app.get("/health")
    def health() -> Dict[str, str]:
        return {"status": "ok"}

    @app.get("/payload")
    def payload(
        capability: Optional[str] = Query(default=None),
        min_confidence: Optional[float] = Query(default=None),
        region_id: Optional[str] = Query(default=None),
        ranking_strategy: Optional[str] = Query(default=None),
    ) -> Dict[str, object]:
        overrides: Dict[str, Any] = {}
        if capability is not None:
            overrides["capability"] = capability
        if min_confidence is not None:
            overrides["min_confidence"] = min_confidence
        if region_id is not None:
            overrides["region_id"] = region_id
        if ranking_strategy is not None:
            overrides["ranking_strategy"] = ranking_strategy
        return backend.payload(overrides)

    return app


def run_fastapi(backend: Loc2MedBackend, host: str = "127.0.0.1", port: int = 8000) -> None:
    """Run FastAPI application via uvicorn."""

    try:
        import uvicorn
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise RuntimeError(
            "uvicorn is not installed. Install uvicorn to run API mode."
        ) from exc

    app = create_fastapi_app(backend)
    uvicorn.run(app, host=host, port=port)


def run_streamlit(backend: Loc2MedBackend) -> None:
    """Render a simple Streamlit dashboard preview if dependency is available."""

    try:
        import streamlit as st
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise RuntimeError(
            "Streamlit is not installed. Install streamlit to run streamlit mode."
        ) from exc

    payload = backend.payload()
    st.set_page_config(page_title="Loc2Med", layout="wide")
    st.title("Loc2Med Dashboard Preview")
    st.caption("Facility capabilities and regional desert overlays.")
    st.json(payload["summary"])
    st.subheader("Markers")
    st.dataframe(payload["markers"])
    st.subheader("Overlays")
    st.dataframe(payload["overlays"])


__all__ = ["Loc2MedBackend", "create_fastapi_app", "run_fastapi", "run_streamlit"]
