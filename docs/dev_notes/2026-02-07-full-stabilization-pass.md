# Full Stabilization Pass (2026-02-07)

## Why
- Remaining stubs blocked Loc2Med and UX surfaces.
- Some scripts failed when run directly due missing repo-root import path setup.
- Config keys existed but were only partially wired into runtime behavior.
- Test coverage was too narrow for newly added verification/eval/planning logic.
- Repo hygiene and operator documentation needed completion.

## What was implemented
1. **Script/runtime consistency**
   - Added repo-root `sys.path` bootstrap to:
     - `scripts/ingest_data.py`
     - `scripts/aggregate_regions.py`
     - `scripts/run_planning.py`
   - Implemented `scripts/launch_ui.py` with modes:
     - `preview` (writes `outputs/reports/loc2med_preview.json`)
     - `api` (FastAPI + uvicorn)
     - `streamlit`

2. **Loc2Med implementation**
   - `src/loc2med/ui_state.py`: map/filter state models + config/override helpers.
   - `src/loc2med/tile_cache.py`: JSON cache helper for map payloads.
   - `src/loc2med/map_data.py`: dataset loader + marker/overlay/payload builders.
   - `src/loc2med/server.py`: backend wrapper + optional FastAPI/Streamlit runners.

3. **UX agent implementation**
   - `src/ux_agent/intent_router.py`: heuristic NL intent routing.
   - `src/ux_agent/chat_agent.py`: deterministic planner chat responses over project tables.
   - `src/ux_agent/trace_bridge.py`: trace model + JSON trace writer.
   - `src/ux_agent/__init__.py`: exports for UX modules.

4. **Config/code alignment**
   - `src/loc2hospital/ranking.py`: added strategy alias support (`capability_completeness`) and secondary ranking.
   - `src/loc2hospital/api.py`: supports default/secondary ranking strategy in service/search requests.
   - `scripts/aggregate_regions.py`: now applies `filter.min_confidence` from `loc2hospital` config.
   - `src/planning/unlock_engine.py`: now supports `rank_by` config.
   - `scripts/run_planning.py`: now consumes:
     - `unlock.rank_by`
     - `gap_analysis.min_facilities_for_referral` fallback for recommendation minimum alternatives.
   - `src/planning/recommendations.py`: now enforces minimum alternative facilities before referral recommendations.
   - Updated configs:
     - `config/pipelines/planning.yaml`
     - `config/pipelines/loc2med.yaml`

5. **Testing expansion**
   - Added:
     - `tests/test_text2med_pipeline.py`
     - `tests/test_planning_pipeline.py`
     - `tests/test_loc2med_ux.py`
     - `tests/test_verify_eval_logic.py`
   - Updated:
     - `tests/test_loc2hospital.py` (ranking alias coverage)

6. **Repo hygiene**
   - Expanded `.gitignore` for Python caches/env dirs.
   - Removed tracked `.pyc` artifacts from git index.

7. **Documentation**
   - Expanded `README.md` with setup, pipeline order, outputs.
   - Completed `runbooks/impact_playbook.md`.
   - Added ordered validation checklist:
     - `docs/test_execution_order.md`

## Dependency updates
- Added to `requirements.txt`:
  - `pyarrow`
  - `fastapi`
  - `uvicorn`
  - `streamlit`
  - `pytest`

## Notes
- API/Streamlit UI modes are optional and dependency-gated; preview mode works without web stack dependencies.
- The ordered test checklist in `docs/test_execution_order.md` should be used before release/demo runs.
