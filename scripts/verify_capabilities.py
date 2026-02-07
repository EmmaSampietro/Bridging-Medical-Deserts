#!/usr/bin/env python3
"""Re-score claims, run prerequisite/contradiction checks.
Config: config/pipelines/text2med.yaml (verification section).
Outputs: updated facility_capabilities, anomaly logs."""

from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Sequence

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.common import load_config, setup_logging
from src.common.storage import StorageError, read_parquet, write_json, write_parquet
from src.text2med.confidence import score_claims
from src.text2med.ontology import load_capability_ontology
from src.text2med.verifier import apply_verification
from src.text2med.writer import write_final_capabilities


_RAW_EXPLANATION_PATTERN = re.compile(
    r"strong=(?P<strong>\d+),\s*weak=(?P<weak>\d+),\s*negative=(?P<negative>\d+)"
)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Re-verify and re-score facility capabilities")
    parser.add_argument(
        "--config-name",
        action="append",
        default=[],
        help="Additional config overlays (e.g., environments/local).",
    )
    parser.add_argument(
        "--override",
        action="append",
        default=[],
        help="OmegaConf-style overrides (e.g., confidence.weights.specificity=0.35).",
    )
    parser.add_argument(
        "--input-path",
        default=None,
        help="Override input path for facility_capabilities.parquet.",
    )
    parser.add_argument(
        "--output-path",
        default=None,
        help="Override output path for updated facility_capabilities.parquet.",
    )
    parser.add_argument(
        "--reload-config",
        action="store_true",
        help="Force reload of cached configuration.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run verification logic without writing outputs.",
    )
    return parser.parse_args()


def _merge_config_names(names: Sequence[str]) -> List[str]:
    merged = [name for name in names if name]
    if "pipelines/text2med" not in merged:
        merged.append("pipelines/text2med")
    return merged


def _is_null(value: Any) -> bool:
    if value is None:
        return True
    try:
        return bool(pd.isna(value))
    except Exception:
        return False


def _normalize_list(value: Any) -> List[str]:
    if _is_null(value):
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, tuple) or isinstance(value, set):
        return [str(item).strip() for item in value if str(item).strip()]
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
                return [str(item).strip() for item in parsed if str(item).strip()]
            if isinstance(parsed, tuple) or isinstance(parsed, set):
                return [str(item).strip() for item in parsed if str(item).strip()]
        if "," in raw:
            return [part.strip() for part in raw.split(",") if part.strip()]
        return [raw]
    return [str(value).strip()]


def _extract_match_counts(frame: pd.DataFrame) -> pd.DataFrame:
    strong_counts: List[int] = []
    weak_counts: List[int] = []
    negative_counts: List[int] = []

    for row in frame.itertuples(index=False):
        raw_explanation = str(getattr(row, "raw_explanation", "") or "")
        match = _RAW_EXPLANATION_PATTERN.search(raw_explanation)
        if match:
            strong_counts.append(int(match.group("strong")))
            weak_counts.append(int(match.group("weak")))
            negative_counts.append(int(match.group("negative")))
            continue
        strong_counts.append(0)
        weak_counts.append(0)
        negative_counts.append(0)

    frame["strong_match_count"] = strong_counts
    frame["weak_match_count"] = weak_counts
    frame["negative_match_count"] = negative_counts
    return frame


def _to_int_or_default(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _prepare_input_for_verification(frame: pd.DataFrame) -> pd.DataFrame:
    prepared = frame.copy()

    required_defaults: Dict[str, Any] = {
        "facility_name": "Unknown Facility",
        "country": "Unknown",
        "category": "unknown",
        "status": "absent",
        "raw_explanation": "",
        "verification_notes": "",
        "evidence_count": None,  # None so it is computed from len(evidence_ids) below
        "source_support_count": None,  # None so it is computed from evidence_source_refs below
    }
    for column, default in required_defaults.items():
        if column not in prepared.columns:
            prepared[column] = default
        if default is not None:
            prepared[column] = prepared[column].fillna(default)

    for list_column in [
        "flags",
        "missing_prerequisites",
        "evidence_ids",
        "evidence_chunk_ids",
        "evidence_doc_ids",
        "evidence_source_refs",
        "citations",
    ]:
        if list_column not in prepared.columns:
            prepared[list_column] = [[] for _ in range(len(prepared))]
        else:
            prepared[list_column] = prepared[list_column].apply(_normalize_list)

    prepared["evidence_count"] = prepared.apply(
        lambda row: _to_int_or_default(row["evidence_count"], len(row["evidence_ids"])),
        axis=1,
    )
    prepared["source_support_count"] = prepared.apply(
        lambda row: _to_int_or_default(row["source_support_count"], len(set(row["evidence_source_refs"]))),
        axis=1,
    )

    prepared = _extract_match_counts(prepared)
    return prepared


def _build_anomaly_rows(frame: pd.DataFrame) -> pd.DataFrame:
    return frame[frame["flags"].apply(bool) | (frame["confidence_label"] == "uncertain")].copy()


def main() -> None:
    args = _parse_args()
    config_names = _merge_config_names(args.config_name)
    cfg = load_config(config_name=config_names, overrides=args.override, reload=args.reload_config)
    log_setup = setup_logging(cfg, run_name="verify_capabilities")
    logger = log_setup.logger

    default_input = Path(cfg.paths.data_processed) / "facility_capabilities.parquet"
    input_path = Path(args.input_path) if args.input_path else default_input
    output_path = Path(args.output_path) if args.output_path else default_input
    anomaly_path = Path(cfg.paths.data_processed) / "capability_anomalies.parquet"
    summary_path = Path(cfg.paths.outputs_reports) / "verify_summary.json"

    try:
        frame = read_parquet(input_path, required_columns=["facility_id", "capability", "status"])
    except StorageError as exc:
        logger.error("Unable to load capabilities for verification", extra={"error": str(exc)})
        raise

    prepared = _prepare_input_for_verification(frame)
    ontology = load_capability_ontology()

    verification_cfg = getattr(cfg, "verification", {}) or {}
    verified = apply_verification(
        prepared,
        ontology,
        prerequisite_strict=bool(verification_cfg.get("prerequisite_strict", True)),
    )
    confidence_cfg = getattr(cfg, "confidence", {}) or {}
    weights = confidence_cfg.get("weights", {}) or {}
    rescored = score_claims(verified, weights)

    anomalies = _build_anomaly_rows(rescored)
    summary = {
        "rows_evaluated": int(len(rescored)),
        "facilities_evaluated": int(rescored["facility_id"].nunique()),
        "anomaly_rows": int(len(anomalies)),
        "missing_prerequisite_rows": int(
            rescored["flags"].apply(lambda values: "missing_prerequisite" in values).sum()
        ),
        "inconsistent_claim_rows": int(
            rescored["flags"].apply(lambda values: "inconsistent_claim" in values).sum()
        ),
        "output_path": str(output_path),
        "anomaly_path": str(anomaly_path),
    }
    logger.info("Verification complete", extra=summary)

    if args.dry_run:
        logger.info("Dry-run enabled; outputs were not written.")
        return

    write_final_capabilities(rescored, output_path)
    if not anomalies.empty:
        write_parquet(anomalies, anomaly_path, index=False)
    write_json(summary, summary_path)
    logger.info(
        "Verification artifacts written",
        extra={"output_path": str(output_path), "summary_path": str(summary_path)},
    )


if __name__ == "__main__":
    main()
