#!/usr/bin/env python3
"""Start Loc2Med map UI / planner dashboard.
Config: config/pipelines/loc2med.yaml, environment config. Uses src/loc2med/server.py."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys
from typing import List, Sequence

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.common import load_config, setup_logging
from src.loc2med.server import Loc2MedBackend, run_fastapi, run_streamlit
from src.loc2med.ui_state import state_from_config


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Launch Loc2Med UI or API preview")
    parser.add_argument("--config-name", action="append", default=[])
    parser.add_argument("--override", action="append", default=[])
    parser.add_argument("--reload-config", action="store_true")
    parser.add_argument(
        "--mode",
        choices=["preview", "api", "streamlit"],
        default="preview",
        help="preview writes JSON payload; api starts FastAPI; streamlit renders dashboard.",
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--capability", default=None)
    parser.add_argument("--min-confidence", type=float, default=None)
    parser.add_argument("--region-id", default=None)
    return parser.parse_args()


def _ensure_config(names: Sequence[str]) -> List[str]:
    merged = [name for name in names if name]
    if "pipelines/loc2med" not in merged:
        merged.append("pipelines/loc2med")
    return merged


def main() -> None:
    args = _parse_args()
    cfg = load_config(
        config_name=_ensure_config(args.config_name),
        overrides=args.override,
        reload=args.reload_config,
    )
    logger = setup_logging(cfg, run_name="launch_ui").logger

    facilities_path = Path(cfg.paths.data_processed) / "facility_capabilities.parquet"
    region_path = Path(cfg.paths.data_processed) / "region_coverage.parquet"
    ui_state = state_from_config({"map": getattr(cfg, "map", {}), "filters": getattr(cfg, "filters", {})})

    backend = Loc2MedBackend(
        facility_capabilities_path=facilities_path,
        region_coverage_path=region_path,
        default_state=ui_state,
    )

    overrides = {
        key: value
        for key, value in {
            "capability": args.capability,
            "min_confidence": args.min_confidence,
            "region_id": args.region_id,
        }.items()
        if value is not None
    }

    if args.mode == "preview":
        output = Path(cfg.paths.outputs_reports) / "loc2med_preview.json"
        backend.write_preview(output, overrides=overrides or None)
        logger.info("Loc2Med preview payload written", extra={"path": str(output)})
        return

    if args.mode == "api":
        logger.info("Starting Loc2Med FastAPI server", extra={"host": args.host, "port": args.port})
        run_fastapi(backend, host=args.host, port=args.port)
        return

    logger.info("Starting Loc2Med Streamlit view")
    run_streamlit(backend)


if __name__ == "__main__":
    main()
