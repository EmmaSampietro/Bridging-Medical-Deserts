import pathlib
import sys

import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.text2med.confidence import score_claims
from src.text2med.extractor import extract_capability_claims, normalize_raw_documents
from src.text2med.ontology import load_capability_ontology
from src.text2med.verifier import apply_verification
from src.text2med.writer import write_pipeline_outputs


def test_text2med_rule_pipeline_end_to_end(tmp_path):
    raw_documents = pd.DataFrame(
        [
            {
                "doc_id": "doc_1",
                "chunk_id": "chunk_1",
                "facility_id": "f1",
                "facility_name": "Alpha Clinic",
                "country": "Ghana",
                "source_type": "vf_row",
                "source_ref": "vf_row:test:1",
                "text": (
                    "ICU available with oxygen supply and ventilators. "
                    "Performs c section with anesthesia and operating theatre."
                ),
                "metadata": '{"fields":["capability","procedure"]}',
            },
            {
                "doc_id": "doc_2",
                "chunk_id": "chunk_2",
                "facility_id": "f2",
                "facility_name": "Beta Center",
                "country": "Ghana",
                "source_type": "vf_row",
                "source_ref": "vf_row:test:2",
                "text": "No ICU and no ventilator support available.",
                "metadata": '{"fields":["capability"]}',
            },
        ]
    )

    text_chunks = normalize_raw_documents(raw_documents, strategy="sentence", max_chunk_chars=120)
    assert not text_chunks.empty
    assert {"facility_id", "chunk_id", "chunk_text"}.issubset(text_chunks.columns)

    ontology = load_capability_ontology()
    raw_claims, matches = extract_capability_claims(text_chunks, ontology)
    assert not raw_claims.empty
    assert "status" in raw_claims.columns
    assert "raw_explanation" in raw_claims.columns
    assert "icu" in set(raw_claims["capability"])
    assert not matches.empty

    verified = apply_verification(raw_claims, ontology, prerequisite_strict=True)
    scored = score_claims(
        verified,
        {
            "specificity": 0.3,
            "multi_evidence": 0.2,
            "prerequisite_penalty": -0.2,
            "contradiction_penalty": -0.3,
        },
    )

    assert "confidence" in scored.columns
    assert scored["confidence"].between(0.0, 1.0).all()
    assert set(scored["confidence_label"]).issubset({"confirmed", "probable", "uncertain"})

    outputs = write_pipeline_outputs(
        text_chunks,
        raw_claims,
        scored,
        interim_dir=tmp_path / "interim",
        processed_dir=tmp_path / "processed",
    )
    assert outputs["text_chunks"].exists()
    assert outputs["raw_claims"].exists()
    assert outputs["facility_capabilities"].exists()
