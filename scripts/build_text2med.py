#!/usr/bin/env python3
"""Run chunking → ontology → extraction pipeline.
Config: config/pipelines/text2med.yaml, config/ontology/*.yaml.
Outputs: data/interim/text_chunks.parquet, data/processed/facility_capabilities.parquet."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys
from typing import List, Sequence

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.common import load_config, setup_logging
from src.common.storage import StorageError, read_parquet, write_parquet
from src.text2med.confidence import score_claims
from src.text2med.extractor import extract_capability_claims, normalize_raw_documents
from src.text2med.ontology import load_capability_ontology
from src.text2med.verifier import apply_verification
from src.text2med.writer import write_pipeline_outputs


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build Text2Med capability artifacts")
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
        "--reload-config",
        action="store_true",
        help="Force reload of cached configuration.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run pipeline without writing outputs.",
    )
    return parser.parse_args()


def _merge_config_names(names: Sequence[str]) -> List[str]:
    merged = [name for name in names if name]
    if "pipelines/text2med" not in merged:
        merged.append("pipelines/text2med")
    return merged


def main() -> None:
    args = _parse_args()
    config_names = _merge_config_names(args.config_name)
    cfg = load_config(config_name=config_names, overrides=args.override, reload=args.reload_config)
    log_setup = setup_logging(cfg, run_name="build_text2med")
    logger = log_setup.logger

    input_path = Path(cfg.paths.data_interim) / "raw_documents.parquet"
    try:
        raw_documents = read_parquet(
            input_path,
            required_columns=["facility_id", "source_type", "source_ref", "text"],
        )
    except StorageError as exc:
        logger.error("Unable to read ingestion artifacts", extra={"error": str(exc)})
        raise

    chunking_cfg = getattr(cfg, "chunking", {}) or {}
    strategy = str(chunking_cfg.get("strategy", "sentence"))
    max_chunk_chars = int(chunking_cfg.get("max_chunk_chars", 512))

    text_chunks = normalize_raw_documents(
        raw_documents,
        strategy=strategy,
        max_chunk_chars=max_chunk_chars,
    )
    if text_chunks.empty:
        raise RuntimeError("No text chunks were generated from raw_documents input.")

    ontology = load_capability_ontology()
    raw_claims, match_rows = extract_capability_claims(text_chunks, ontology)
    if raw_claims.empty:
        raise RuntimeError("No capability claims were extracted.")

    verification_cfg = getattr(cfg, "verification", {}) or {}
    verified_claims = apply_verification(
        raw_claims,
        ontology,
        prerequisite_strict=bool(verification_cfg.get("prerequisite_strict", True)),
    )

    confidence_cfg = getattr(cfg, "confidence", {}) or {}
    weights = confidence_cfg.get("weights", {}) or {}
    final_claims = score_claims(verified_claims, weights)

    logger.info(
        "Text2Med pipeline complete",
        extra={
            "raw_documents": len(raw_documents),
            "text_chunks": len(text_chunks),
            "raw_claims": len(raw_claims),
            "final_claims": len(final_claims),
        },
    )

    if args.dry_run:
        logger.info("Dry-run mode; skipping writes.")
        return

    outputs = write_pipeline_outputs(
        text_chunks,
        raw_claims,
        final_claims,
        interim_dir=Path(cfg.paths.data_interim),
        processed_dir=Path(cfg.paths.data_processed),
    )
    logger.info(
        "Text2Med outputs written",
        extra={name: str(path) for name, path in outputs.items()},
    )

    tracing_cfg = getattr(cfg, "tracing", {}) or {}
    if bool(tracing_cfg.get("export_traces", False)) and not match_rows.empty:
        trace_path = Path(cfg.paths.outputs_traces) / "text2med_retrieval_matches.parquet"
        write_parquet(match_rows, trace_path, index=False)
        logger.info("Trace rows written", extra={"trace_path": str(trace_path), "rows": len(match_rows)})


if __name__ == "__main__":
    main()
