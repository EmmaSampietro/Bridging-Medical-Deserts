#!/usr/bin/env python3
"""Acceptance/regression tests vs. VF question backlog.
Config: config/pipelines/text2med.yaml, inputs/questions/*.json.
Outputs: outputs/reports/eval_summary.json."""

from __future__ import annotations

import argparse
import ast
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Sequence

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.common import load_config, setup_logging
from src.common.storage import StorageError, read_json, read_parquet, write_json


DEFAULT_QUESTIONS = [
    {
        "id": "q_c_section_absent",
        "prompt": "Where are C-sections unavailable?",
        "type": "capability_status_count",
        "capability": "c_section",
        "statuses": ["absent"],
        "required": False,
    },
    {
        "id": "q_icu_without_oxygen",
        "prompt": "Which hospitals claim ICUs but lack oxygen?",
        "type": "missing_prerequisite",
        "capability": "icu",
        "prerequisite": "oxygen_supply",
        "required": False,
    },
]


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Text2Med regression and acceptance checks")
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
        help="OmegaConf-style overrides.",
    )
    parser.add_argument(
        "--input-path",
        default=None,
        help="Override input path for facility_capabilities.parquet.",
    )
    parser.add_argument(
        "--questions-glob",
        default="inputs/questions/*.json",
        help="Glob pattern for optional acceptance question specs.",
    )
    parser.add_argument(
        "--summary-path",
        default=None,
        help="Override output summary path (default outputs/reports/eval_summary.json).",
    )
    parser.add_argument(
        "--reload-config",
        action="store_true",
        help="Force reload of cached configuration.",
    )
    parser.add_argument(
        "--fail-on-check",
        action="store_true",
        help="Exit non-zero if critical checks fail or required question checks fail.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run checks without writing output files.",
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


def _to_int_or_default(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _prepare_frame(frame: pd.DataFrame) -> pd.DataFrame:
    prepared = frame.copy()
    if "status" not in prepared.columns:
        prepared["status"] = "absent"
    prepared["status"] = prepared["status"].fillna("absent").astype(str)

    for list_column in ["flags", "missing_prerequisites", "evidence_ids"]:
        if list_column not in prepared.columns:
            prepared[list_column] = [[] for _ in range(len(prepared))]
        else:
            prepared[list_column] = prepared[list_column].apply(_normalize_list)

    if "evidence_count" not in prepared.columns:
        prepared["evidence_count"] = prepared["evidence_ids"].apply(len)
    else:
        prepared["evidence_count"] = prepared.apply(
            lambda row: _to_int_or_default(row["evidence_count"], len(row["evidence_ids"])),
            axis=1,
        )

    if "contradiction_count" not in prepared.columns:
        prepared["contradiction_count"] = 0
    prepared["contradiction_count"] = prepared["contradiction_count"].apply(
        lambda value: _to_int_or_default(value, 0)
    )
    return prepared


def _build_check(
    *,
    check_id: str,
    description: str,
    passed: bool,
    severity: str,
    details: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "id": check_id,
        "description": description,
        "passed": bool(passed),
        "severity": severity,
        "details": details,
    }


def _run_regression_checks(frame: pd.DataFrame) -> List[Dict[str, Any]]:
    checks: List[Dict[str, Any]] = []
    required_columns = ["facility_id", "capability", "status"]
    missing = [column for column in required_columns if column not in frame.columns]
    checks.append(
        _build_check(
            check_id="required_columns",
            description="Processed table contains mandatory columns.",
            passed=not missing,
            severity="critical",
            details={"missing_columns": missing},
        )
    )
    checks.append(
        _build_check(
            check_id="non_empty_dataset",
            description="Processed table has at least one row.",
            passed=len(frame) > 0,
            severity="critical",
            details={"row_count": int(len(frame))},
        )
    )

    duplicate_count = int(frame.duplicated(subset=["facility_id", "capability"]).sum())
    checks.append(
        _build_check(
            check_id="duplicate_facility_capability",
            description="No duplicate facility/capability rows.",
            passed=duplicate_count == 0,
            severity="warning",
            details={"duplicate_rows": duplicate_count},
        )
    )

    if "confidence" in frame.columns:
        confidence_series = pd.to_numeric(frame["confidence"], errors="coerce")
        invalid_confidence = int((confidence_series.isna() | ~confidence_series.between(0.0, 1.0)).sum())
        checks.append(
            _build_check(
                check_id="confidence_range",
                description="Confidence values are between 0 and 1.",
                passed=invalid_confidence == 0,
                severity="critical",
                details={"invalid_rows": invalid_confidence},
            )
        )

    if "confidence" in frame.columns and "confidence_label" in frame.columns:
        confidence_series = pd.to_numeric(frame["confidence"], errors="coerce").fillna(-1.0)

        def expected_label(value: float) -> str:
            if value >= 0.7:
                return "confirmed"
            if value >= 0.45:
                return "probable"
            return "uncertain"

        expected = confidence_series.apply(expected_label)
        mismatches = int((frame["confidence_label"].astype(str) != expected).sum())
        checks.append(
            _build_check(
                check_id="confidence_label_consistency",
                description="confidence_label aligns with confidence thresholds.",
                passed=mismatches == 0,
                severity="warning",
                details={"mismatched_rows": mismatches},
            )
        )

    non_absent = frame[frame["status"].isin(["present", "uncertain"])]
    citation_missing = int(
        non_absent.apply(
            lambda row: row["evidence_count"] <= 0 and len(row["evidence_ids"]) == 0, axis=1
        ).sum()
    )
    checks.append(
        _build_check(
            check_id="citation_required_non_absent",
            description="Non-absent claims include evidence support.",
            passed=citation_missing == 0,
            severity="critical",
            details={"rows_missing_evidence": citation_missing},
        )
    )

    missing_prereq_flag_mismatch = int(
        frame.apply(
            lambda row: bool(row["missing_prerequisites"]) and "missing_prerequisite" not in row["flags"],
            axis=1,
        ).sum()
    )
    checks.append(
        _build_check(
            check_id="missing_prerequisite_flag_consistency",
            description="Rows with missing prerequisites carry missing_prerequisite flag.",
            passed=missing_prereq_flag_mismatch == 0,
            severity="warning",
            details={"mismatched_rows": missing_prereq_flag_mismatch},
        )
    )

    contradiction_flag_mismatch = int(
        frame.apply(
            lambda row: row["contradiction_count"] > 0 and "inconsistent_claim" not in row["flags"],
            axis=1,
        ).sum()
    )
    checks.append(
        _build_check(
            check_id="contradiction_flag_consistency",
            description="Rows with contradictions carry inconsistent_claim flag.",
            passed=contradiction_flag_mismatch == 0,
            severity="warning",
            details={"mismatched_rows": contradiction_flag_mismatch},
        )
    )
    return checks


def _coerce_question_specs(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        if isinstance(payload.get("questions"), list):
            return [item for item in payload["questions"] if isinstance(item, dict)]
        return [payload]
    return []


def _load_question_specs(glob_pattern: str) -> List[Dict[str, Any]]:
    paths = sorted(PROJECT_ROOT.glob(glob_pattern))
    if not paths:
        return list(DEFAULT_QUESTIONS)

    specs: List[Dict[str, Any]] = []
    for path in paths:
        payload = read_json(path)
        entries = _coerce_question_specs(payload)
        for entry in entries:
            item = dict(entry)
            item.setdefault("source_file", str(path.relative_to(PROJECT_ROOT)))
            specs.append(item)
    return specs


def _evaluate_capability_status_count(frame: pd.DataFrame, question: Dict[str, Any]) -> Dict[str, Any]:
    capability = str(question.get("capability", "")).strip()
    statuses = question.get("statuses") or question.get("status_in") or ["present"]
    statuses = [str(status).strip() for status in statuses]
    if not capability:
        return {"passed": False, "error": "Missing required field: capability", "match_count": 0}

    subset = frame[(frame["capability"] == capability) & (frame["status"].isin(statuses))]
    sample_facilities = subset["facility_id"].drop_duplicates().head(5).tolist()
    count = int(len(subset))

    expected_min = question.get("expect_min")
    expected_max = question.get("expect_max")
    passed = True
    if expected_min is not None and count < int(expected_min):
        passed = False
    if expected_max is not None and count > int(expected_max):
        passed = False

    return {
        "passed": passed,
        "match_count": count,
        "sample_facilities": sample_facilities,
        "filters": {"capability": capability, "statuses": statuses},
    }


def _evaluate_missing_prerequisite(frame: pd.DataFrame, question: Dict[str, Any]) -> Dict[str, Any]:
    capability = str(question.get("capability", "")).strip()
    prerequisite = str(
        question.get("prerequisite", question.get("required_capability", ""))
    ).strip()
    cap_statuses = question.get("capability_statuses") or ["present", "uncertain"]
    lacking_statuses = question.get("lacking_statuses") or ["absent", "missing"]
    if not capability or not prerequisite:
        return {
            "passed": False,
            "error": "Missing required field(s): capability and prerequisite.",
            "match_count": 0,
        }

    cap_rows = frame[frame["capability"] == capability][["facility_id", "status"]].drop_duplicates(
        subset=["facility_id"], keep="first"
    )
    prereq_rows = frame[frame["capability"] == prerequisite][["facility_id", "status"]].drop_duplicates(
        subset=["facility_id"], keep="first"
    )
    prereq_status_map = prereq_rows.set_index("facility_id")["status"].astype(str).to_dict()

    matches: List[str] = []
    for row in cap_rows.itertuples(index=False):
        if str(row.status) not in cap_statuses:
            continue
        prereq_status = prereq_status_map.get(str(row.facility_id), "missing")
        if prereq_status in lacking_statuses:
            matches.append(str(row.facility_id))

    expected_min = question.get("expect_min")
    expected_max = question.get("expect_max")
    count = len(matches)
    passed = True
    if expected_min is not None and count < int(expected_min):
        passed = False
    if expected_max is not None and count > int(expected_max):
        passed = False

    return {
        "passed": passed,
        "match_count": int(count),
        "sample_facilities": matches[:5],
        "filters": {
            "capability": capability,
            "prerequisite": prerequisite,
            "capability_statuses": cap_statuses,
            "lacking_statuses": lacking_statuses,
        },
    }


def _evaluate_question(frame: pd.DataFrame, question: Dict[str, Any]) -> Dict[str, Any]:
    question_id = str(question.get("id", "unnamed_question"))
    q_type = str(question.get("type", "")).strip()
    prompt = str(question.get("prompt", question.get("question", question_id)))
    required = bool(question.get("required", False))

    if q_type == "capability_status_count":
        result = _evaluate_capability_status_count(frame, question)
    elif q_type == "missing_prerequisite":
        result = _evaluate_missing_prerequisite(frame, question)
    else:
        result = {"passed": False, "error": f"Unsupported question type: {q_type}", "match_count": 0}

    return {
        "id": question_id,
        "prompt": prompt,
        "type": q_type,
        "required": required,
        **result,
    }


def _summarize_report(
    frame: pd.DataFrame,
    checks: List[Dict[str, Any]],
    question_results: List[Dict[str, Any]],
) -> Dict[str, Any]:
    critical_failures = [check for check in checks if check["severity"] == "critical" and not check["passed"]]
    required_question_failures = [
        result for result in question_results if result.get("required", False) and not result.get("passed", False)
    ]
    overall_passed = not critical_failures and not required_question_failures
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "row_count": int(len(frame)),
        "facility_count": int(frame["facility_id"].nunique()) if "facility_id" in frame.columns else 0,
        "capability_count": int(frame["capability"].nunique()) if "capability" in frame.columns else 0,
        "checks": checks,
        "questions": question_results,
        "critical_failures": len(critical_failures),
        "required_question_failures": len(required_question_failures),
        "overall_passed": overall_passed,
    }


def main() -> None:
    args = _parse_args()
    config_names = _merge_config_names(args.config_name)
    cfg = load_config(config_name=config_names, overrides=args.override, reload=args.reload_config)
    log_setup = setup_logging(cfg, run_name="eval_suite")
    logger = log_setup.logger

    default_input = Path(cfg.paths.data_processed) / "facility_capabilities.parquet"
    input_path = Path(args.input_path) if args.input_path else default_input
    summary_path = (
        Path(args.summary_path)
        if args.summary_path
        else Path(cfg.paths.outputs_reports) / "eval_summary.json"
    )

    try:
        frame = read_parquet(input_path, required_columns=["facility_id", "capability", "status"])
    except StorageError as exc:
        logger.error("Unable to run eval suite", extra={"error": str(exc)})
        raise

    prepared = _prepare_frame(frame)
    checks = _run_regression_checks(prepared)
    questions = _load_question_specs(args.questions_glob)
    question_results = [_evaluate_question(prepared, question) for question in questions]
    summary = _summarize_report(prepared, checks, question_results)
    summary["input_path"] = str(input_path)
    summary["summary_path"] = str(summary_path)
    summary["questions_loaded"] = len(questions)

    logger.info(
        "Eval suite complete",
        extra={
            "overall_passed": summary["overall_passed"],
            "critical_failures": summary["critical_failures"],
            "required_question_failures": summary["required_question_failures"],
        },
    )

    if not args.dry_run:
        write_json(summary, summary_path)
        logger.info("Eval summary written", extra={"summary_path": str(summary_path)})
    else:
        logger.info("Dry-run enabled; eval summary not written.")

    if args.fail_on_check and not summary["overall_passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
