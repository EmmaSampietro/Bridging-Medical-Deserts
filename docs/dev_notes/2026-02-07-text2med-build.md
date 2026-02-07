# Text2Med Build Pipeline (2026-02-07)

## Why
- `scripts/build_text2med.py` and all `src/text2med/*` modules were still stubs.
- Ingestion is now implemented and emits `data/interim/raw_documents.parquet`, so Text2Med needed a concrete pipeline that can run on those artifacts.
- The pipeline had to stay deterministic and auditable while teammate ingestion/LLM integration evolves.

## What changed
1. **Implemented common helpers**
   - `src/common/storage.py`: parquet/JSON read-write helpers with basic validation.
   - `src/common/citations.py`: stable `evidence_id` generation and normalized citation objects.

2. **Implemented Text2Med core modules**
   - `src/text2med/ontology.py`: loads ontology YAML, expands synonyms/phrases, loads prerequisite rules (with safe defaults).
   - `src/text2med/retrieval.py`: keyword-based chunk matching with strong/weak/negative match types.
   - `src/text2med/extractor.py`: normalizes raw ingestion rows into Text2Med chunks and emits `facility_capabilities_raw` claims with evidence/citations.
   - `src/text2med/verifier.py`: applies prerequisite and inconsistency checks, flags claims, adjusts status.
   - `src/text2med/confidence.py`: transparent weighted confidence scoring and confidence labels.
   - `src/text2med/writer.py`: writes `text_chunks`, `facility_capabilities_raw`, and final `facility_capabilities`.
   - `src/text2med/__init__.py`: exports the implemented pipeline functions.

3. **Implemented orchestration script**
   - `scripts/build_text2med.py` now supports:
     - config overlays (`--config-name`)
     - dotlist overrides (`--override`)
     - config cache reload (`--reload-config`)
     - dry run (`--dry-run`)
   - Script flow:
     - read `data/interim/raw_documents.parquet`
     - normalize chunks
     - load ontology
     - extract raw claims
     - verify claims
     - score confidence
     - write outputs to `data/interim/` and `data/processed/`
     - optional retrieval trace export to `outputs/traces/`

## Output artifacts
- `data/interim/text_chunks.parquet`
- `data/interim/facility_capabilities_raw.parquet`
- `data/processed/facility_capabilities.parquet`
- optional: `outputs/traces/text2med_retrieval_matches.parquet`

## Validation status
- Syntax compile check passed for edited modules (`python3 -m compileall ...`).
- Full end-to-end runtime test is blocked in current environment because required deps are missing:
  - `omegaconf`
  - parquet engine (`pyarrow` or `fastparquet`)

## Next steps
1. Install missing runtime deps in the active environment (`omegaconf`, `pyarrow`).
2. Run `scripts/ingest_data.py` to create `raw_documents.parquet`.
3. Run `scripts/build_text2med.py --config-name environments/local`.
4. Add focused tests under `tests/text2med/` for extraction, verification, and confidence scoring.
