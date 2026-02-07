# Repository Code Structure Blueprint

Designing for the Virtue Foundation challenge means shipping fast **and** staying adaptable. This blueprint makes every component modular, scriptable, and configurable so we can add/remove files, swap data sources, or retune agent behavior without touching core logic.

---

## 1. Architecture goals (grounded in Project_Descr + MAIN_instructions)
- **Agentic IDP focus**: Prioritize the Text2Med pipeline that extracts, verifies, and cites facility capabilities from messy inputs.
- **Planning-first UX**: Keep desert detection, planning recommendations, and NL workflows isolated yet composable.
- **Config everywhere**: All parameters (paths, models, thresholds, ontology, map settings) live in `config/` YAML files, enabling per-run overrides.
- **Scriptable pipelines**: Provide runnable CLI scripts (Python entrypoints + Make targets) so hackathon teammates or VF engineers can execute stages end-to-end or piecemeal.
- **Inputs/outputs clarity**: Dedicated folders for raw inputs, intermediate bundles, processed “truth tables,” and exported planner assets.
- **Traceability hooks**: Built-in storage for evidence, citations, and agent-step traces as per stretch goals.

---

## 2. Top-level layout

```
.
├── config/
│   ├── base.yaml
│   ├── secrets.example.yaml
│   ├── environments/
│   │   ├── local.yaml
│   │   ├── databricks.yaml
│   │   └── demo.yaml
│   ├── pipelines/
│   │   ├── ingest.yaml
│   │   ├── text2med.yaml
│   │   ├── loc2hospital.yaml
│   │   ├── loc2med.yaml
│   │   └── planning.yaml
│   └── ontology/
│       ├── capabilities.yaml
│       └── prerequisites.yaml
├── scripts/
│   ├── ingest_data.py
│   ├── build_text2med.py
│   ├── verify_capabilities.py
│   ├── aggregate_regions.py
│   ├── run_planning.py
│   ├── launch_ui.py
│   └── eval_suite.py
├── src/
│   ├── __init__.py
│   ├── common/...
│   ├── data_ingest/...
│   ├── text2med/...
│   ├── loc2hospital/...
│   ├── loc2med/...
│   ├── planning/...
│   └── ux_agent/...
├── data/
│   ├── raw/            # untouched VF CSV + scraped HTML/text
│   ├── interim/        # normalized bundles & embeddings
│   ├── processed/      # facility_capabilities, region_coverage, planning tables
│   └── external/       # optional registries or auxiliary datasets
├── inputs/             # run-specific prompt sets, question payloads
├── outputs/
│   ├── reports/        # PDF/CSV exports for planners
│   ├── traces/         # LangGraph/CrewAI trace exports
│   └── tiles/          # cached map tiles or geojson
├── docs/
│   ├── MAIN_instructions.md
│   ├── Project_Descr.txt
│   ├── capability_ontology.md
│   ├── questions.md
│   └── ux_playbooks/
├── runbooks/
│   └── impact_playbook.md
├── Makefile
├── README.md
├── CODE_STRUCTURE.md   # (this file)
└── old_work/           # legacy prompts / datasets (kept read-only)
```

> **Modularity rule:** Each leaf directory contains focused files; swapping a capability rule or changing planner filters should be a one-file edit inside `config/` or the matching module.

---

## 3. Configuration system
- **Base config (`config/base.yaml`)**: references global defaults (paths, logging, experiment tracking, datastore URIs).
- **Environment overlays (`config/environments/*.yaml`)**: override credentials, cluster sizes, storage buckets (e.g., Databricks vs. local). Loaded via `--config-name`.
- **Pipeline configs (`config/pipelines/*.yaml`)**: stage-specific parameters—chunk sizes, LLM models, embedding types, verification thresholds, map filter defaults.
- **Ontology configs (`config/ontology/*.yaml`)**: curated lists of capabilities, synonyms, prerequisites, scoring weights. Adding a capability is editing YAML, not code.
- **Hydra or Pydantic**: Scripts use Hydra to compose configs; `python scripts/build_text2med.py --config-name pipelines/text2med --multirun pipeline.capability=icu,ultrasound`.
- **Secrets handling**: `secrets.example.yaml` documents required keys; real secrets injected via environment variables or `.env`, never committed.

---

## 4. Source modules (under `src/`)

### 4.1 `src/common/`
- `config.py`: Hydra/Pydantic loaders, environment detection.
- `logging.py`: structured logging + MLflow run hooks.
- `storage.py`: helpers for reading/writing parquet/Delta/JSON; aware of `data/` layout.
- `citations.py`: utilities to assign evidence IDs, build row-level + agent-step citations.
- `geo.py`: geocoding, region lookups, shapefile utilities.

### 4.2 `src/data_ingest/`
- `vf_loader.py`: parse VF facility CSV exports, enforce schema, handle nulls.
- `scraper.py`: HTTP fetchers with retries, robots compliance, caching.
- `document_store.py`: unify structured rows + scraped docs into `data/interim/raw_documents.parquet`.
- `chunker.py`: convert docs into “evidence units” per facility; supports sentence/bullet chunking.

### 4.3 `src/text2med/`
- `ontology.py`: loads YAML capability definitions.
- `retrieval.py`: hybrid semantic + keyword search over chunks (FAISS/LanceDB).
- `extractor.py`: orchestrates LLM prompts or rule-based parsers to create candidate claims.
- `verifier.py`: prerequisite + contradiction logic; attaches flags.
- `confidence.py`: scoring model (weights configurable).
- `writer.py`: persists `facility_capabilities.parquet` plus evidence metadata.

### 4.4 `src/loc2hospital/`
- `search.py`: location filtering (admin region, radius search, capability filter).
- `ranking.py`: confidence-based and completeness-based ranking.
- `api.py`: endpoints consumed by UI or CLI.

### 4.5 `src/loc2med/`
- `map_data.py`: generate GeoJSON layers, desert overlays, severity metrics.
- `ui_state.py`: default filters, persisted selections.
- `tile_cache.py`: caches map tiles/tilesets under `outputs/tiles/`.
- `server.py`: FastAPI/Streamlit entrypoint for the map UI.

### 4.6 `src/planning/`
- `gap_analysis.py`: aggregates region coverage + top missing capabilities.
- `unlock_engine.py`: identifies near-ready facilities and required interventions.
- `recommendations.py`: produces human-readable actions with citations.
- `exports.py`: CSV/PDF generator feeding `outputs/reports/`.

### 4.7 `src/ux_agent/`
- `intent_router.py`: maps NL questions to pipeline queries (Text2SQL, heuristics).
- `chat_agent.py`: LangGraph/CrewAI flow orchestrating retrieval + reasoning.
- `trace_bridge.py`: stores step-by-step traces in `outputs/traces/` for auditing.

---

## 5. Scripts & CLI entrypoints (`scripts/`)

| Script | Purpose | Key Configs | Outputs |
| --- | --- | --- | --- |
| `ingest_data.py` | Load VF CSV, optional scrape, write `data/raw` & `data/interim/raw_documents` | `pipelines/ingest.yaml` (source paths, scrape toggles) | `data/raw/*.csv`, `data/interim/raw_documents.parquet` |
| `build_text2med.py` | Run chunking → ontology → extraction pipeline | `pipelines/text2med.yaml`, `ontology/*.yaml` | `data/interim/text_chunks.parquet`, `data/processed/facility_capabilities.parquet` |
| `verify_capabilities.py` | Re-score claims, run prerequisite/contradiction checks | `pipelines/text2med.yaml` (verification section) | Updated `facility_capabilities`, anomaly logs |
| `aggregate_regions.py` | Produce region coverage + desert overlays | `pipelines/loc2hospital.yaml` (geo resolution) | `data/processed/region_coverage.parquet`, `outputs/tiles/*.geojson` |
| `run_planning.py` | Generate gap reports + unlock recommendations | `pipelines/planning.yaml` | `data/processed/planning_recommendations.parquet`, `outputs/reports/*.csv` |
| `launch_ui.py` | Start Loc2Med UI / planner dashboard | `pipelines/loc2med.yaml`, environment config | Web app powered by `src/loc2med/server.py` |
| `eval_suite.py` | Acceptance/regression tests vs. VF question backlog | `pipelines/text2med.yaml`, `inputs/questions/*.json` | `outputs/reports/eval_summary.json` |

Each script supports:
- `--config-path` / `--config-name` overrides (Hydra).
- `--run-id` to tag MLflow experiments.
- `--dry-run` to validate config without writing outputs.

`Makefile` aliases common workflows (e.g., `make text2med`, `make plan`, `make demo`), chaining scripts and ensuring required directories exist.

---

## 6. Data & artifact flow

1. **Inputs** land in `data/raw/` (CSV, scraped HTML) and `inputs/` (prompt sets, VF question payloads).
2. **Ingest** writes normalized bundles to `data/interim/` (chunked text, embeddings, retrieval indexes).
3. **Text2Med** consumes interim bundles, outputs `data/processed/facility_capabilities.parquet` plus `outputs/traces/` for extraction/verifier traces.
4. **Geo aggregation** reads processed capabilities + admin boundaries to produce `region_coverage.parquet` and map overlays in `outputs/tiles/`.
5. **Planning** consumes coverage + capability tables to craft `planning_recommendations.parquet` plus human-friendly exports in `outputs/reports/`.
6. **Loc2Med UI & UX agent** load processed tables + configs at runtime; no hidden state.

All steps log to MLflow (or lightweight JSON logs) with artifact URIs pointing back to specific config snapshots for reproducibility.

---

## 7. Testing & validation
- **Unit tests** under `tests/` mirror module names (`tests/text2med/test_extractor.py`, etc.) and can be run via `pytest`.
- **Evaluation harness (`scripts/eval_suite.py`)** replays real VF planner questions (from `docs/questions.md`) and checks acceptance criteria (citations, anomaly detection, UX readiness) tied to evaluation weights.
- **CI hooks** (optional) lint code (`ruff`), type-check (`pyright`), and validate configs (Hydra schema checks).

---

## 8. Extension & customization guide
- **Add capability**: edit `config/ontology/capabilities.yaml`, optionally update `prerequisites.yaml`, rerun `build_text2med.py`.
- **Swap LLM/model**: change `pipelines/text2med.yaml.llm.model_name` or `retrieval.embedding_model`; no source edits.
- **Introduce new dataset**: drop files under `data/raw/new_dataset/`, point `pipelines/ingest.yaml.sources` to it, rerun ingest.
- **New planner question**: append to `docs/questions.md` & `inputs/questions/*.json`; `eval_suite.py` will include it automatically.
- **Deploy on Databricks**: use `config/environments/databricks.yaml` plus `Makefile databricks-*` targets; scripts respect Spark/Hive paths.
- **Toggle stretch features** (agent-step citations, trace export): booleans in `pipelines/text2med.yaml.tracing` and `pipelines/planning.yaml.exports`.

With this structure, every behavior is discoverable, overrideable, and testable—exactly what we need to stay “100× faster” while remaining trustworthy for Virtue Foundation stakeholders.
