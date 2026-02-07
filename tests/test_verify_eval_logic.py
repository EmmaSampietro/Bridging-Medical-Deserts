import importlib.util
import pathlib
import sys

import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _load_script_module(path: pathlib.Path, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_verify_preparation_and_counts():
    verify_mod = _load_script_module(ROOT / "scripts" / "verify_capabilities.py", "verify_mod")
    frame = pd.DataFrame(
        [
            {
                "facility_id": "f1",
                "capability": "icu",
                "status": "present",
                "raw_explanation": "icu: status=present; strong=2, weak=1, negative=0",
                "evidence_ids": "['ev_1']",
                "missing_prerequisites": "[]",
                "flags": "[]",
            }
        ]
    )
    prepared = verify_mod._prepare_input_for_verification(frame)
    assert prepared.iloc[0]["strong_match_count"] == 2
    assert prepared.iloc[0]["weak_match_count"] == 1
    assert prepared.iloc[0]["negative_match_count"] == 0
    assert prepared.iloc[0]["evidence_count"] == 1


def test_eval_regression_checks_and_question_eval():
    eval_mod = _load_script_module(ROOT / "scripts" / "eval_suite.py", "eval_mod")
    frame = pd.DataFrame(
        [
            {
                "facility_id": "f1",
                "capability": "icu",
                "status": "present",
                "confidence": 0.8,
                "confidence_label": "confirmed",
                "evidence_ids": ["ev_1"],
                "evidence_count": 1,
                "missing_prerequisites": [],
                "flags": [],
                "contradiction_count": 0,
            }
        ]
    )
    prepared = eval_mod._prepare_frame(frame)
    checks = eval_mod._run_regression_checks(prepared)
    assert checks
    assert any(check["id"] == "required_columns" and check["passed"] for check in checks)

    question_result = eval_mod._evaluate_question(
        prepared,
        {
            "id": "q1",
            "type": "capability_status_count",
            "capability": "icu",
            "statuses": ["present"],
            "expect_min": 1,
        },
    )
    assert question_result["passed"] is True
    assert question_result["match_count"] == 1
