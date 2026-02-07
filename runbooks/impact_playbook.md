# Impact playbook

How to deploy, validate, and extend the pipeline for planner adoption.

## Deployment checklist
1. Install dependencies from `requirements.txt` in a clean virtual environment.
2. Confirm configuration overlays in `config/environments/` and pipeline YAMLs.
3. Run pipelines in this order:
   - ingest
   - text2med build
   - verify
   - aggregate regions
   - planning
   - evaluation
4. Verify expected outputs in `data/processed/` and `outputs/reports/`.

## Operational run cadence
1. Daily or per new data drop:
   - `scripts/ingest_data.py`
   - `scripts/build_text2med.py`
   - `scripts/verify_capabilities.py`
2. Weekly planning refresh:
   - `scripts/aggregate_regions.py`
   - `scripts/run_planning.py`
3. Before each release/demo:
   - `scripts/eval_suite.py --fail-on-check`
   - full ordered checks from `docs/test_execution_order.md`

## Quality guardrails
1. No non-absent capability row should have zero evidence IDs.
2. `confidence` must remain within `[0, 1]`.
3. Rows with missing prerequisites must carry `missing_prerequisite` flags.
4. Rows with contradictions must carry `inconsistent_claim` flags.
5. Regenerate planner exports after any ontology or scoring change.

## Extension points
1. Ontology updates:
   - `config/ontology/capabilities.yaml`
   - `config/ontology/prerequisites.yaml`
2. Planning rule updates:
   - `config/pipelines/planning.yaml`
3. UI behavior updates:
   - `config/pipelines/loc2med.yaml`
   - `src/loc2med/*`
4. UX assistant updates:
   - `src/ux_agent/*`

## Handoff notes
1. Keep all schema-impacting changes documented in `docs/dev_notes/`.
2. When adding new evaluation questions, commit JSON specs under `inputs/questions/`.
3. Prefer deterministic logic for critical scoring/verification steps and keep LLM use optional.
