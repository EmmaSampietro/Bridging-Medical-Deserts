# Bridging Medical Deserts — Philosophy & Delivery Blueprint

> _“A coordination engine for lifesaving expertise.”_  
This document captures the beliefs, mental models, and implementation outline that guided every commit in this repo. It is meant to help future contributors (or auditors at Virtue Foundation and Databricks) understand not just **what** we built, but **why we built it this way**.

---

## 1. North Star
1. **Mission pressure:** by 2030 the world will be short 10M+ healthcare workers. Our response is an **agentic “source of truth” layer** that cuts the time-to-treatment by ≥100× by connecting expertise to deserts faster than manual coordination ever could.
2. **Outcome definition:** our product is not a dashboard, it is an **evidence-backed capability graph** that planners trust because every recommendation carries citations, anomaly checks, and plain-language rationale.
3. **Deliverable promise:** one country, polished. The architecture is multi-country capable, but we optimize for depth (Ghana baseline) so VF can ship an agent by June 7.

---

## 2. Guiding Principles
| Principle | Description | Examples in repo |
| --- | --- | --- |
| **Evidence-first** | No claim without a citation + confidence score. | `src/text2med/citations.py`, `writer.py`, `planning/recommendations.py` all propagate evidence IDs. |
| **Uncertainty is a feature** | Show “why we believe/why we doubt” instead of hiding low signal. | Verification flags + `confidence_explanation` columns. |
| **Small ontology, strong logic** | ~30 high-impact capabilities with prerequisite rules beats a sprawling uncontrolled vocabulary. | `config/ontology/` + `text2med/ontology.py`. |
| **Planner empathy** | Non-technical users, inconsistent bandwidth, multi-age adoption. | `Planning` pipeline outputs include natural-language actions, CSV exports, “task mode” guidance. |
| **Search over scrape** | Facility CSVs are sparse; we bootstrap with keyword-based web search instead of brittle legacy URLs. | `src/data_ingest/search.py` feeds new URLs; scraper only hits those targets. |
| **Traceability over novelty** | We prefer simple heuristics whose behavior we can explain in 30 seconds to VF over fancy models we can’t defend. | Keyword retrieval + rule-based verification + transparent scoring. |

---

## 3. System Architecture
```
data/raw + search          -->  scripts/ingest_data.py
                               │   (loader + search expander + scraper + chunker)
                               ▼
data/interim/text_chunks.parquet ───► src/text2med/*
     │                                       │
     ├─► facility_capabilities_raw.parquet   │
     └─► processed/facility_capabilities.parquet (confidence, citations, flags)
                                             │
                    ┌─────────────Loc2Hospital────────────┐
                    │ geo/regional coverage + ranking     │
data/processed/region_coverage.parquet ◄──────────────────┘
      │
      ├─► outputs/tiles/desert_overlays.geojson (map layers)
      │
      └─► Planning pipeline → data/processed/planning_recommendations.parquet
                              outputs/reports/planning_summary.csv
```

### Core modules
1. **Data Ingestion (`scripts/ingest_data.py` + `src/data_ingest/`)**
   - Normalize VF CSV rows, build text bundles.
   - **Search-only discovery:** DuckDuckGo queries (facility name + city + “hospital” + country) produce new URLs even when the dataset has none. This avoids stale links and gives us fresh local news, Facebook posts, press releases, etc.
   - Scraper (httpx + optional Playwright fallback) enforces polite throttling, retries on 429/502/503, and caches HTML for reproducibility.
   - Output: `data/interim/raw_documents.parquet` (chunked evidence units with metadata ready for Text2Med).
2. **Text2Med (`src/text2med/` + `scripts/build_text2med.py`)**
   - **Ontology loader**: canonical capability defs, synonyms, prerequisites.
   - **Keyword retriever**: strong/weak/negative phrase detection across chunks.
   - **Claim extractor**: facility×capability status + evidence IDs.
   - **Verifier**: prerequisite and contradiction logic downgrade or flag dubious claims.
   - **Confidence scoring**: deterministic weighting (specificity, multi-source bonus, penalties).
   - **Writer**: persists text chunks, raw claims, final `facility_capabilities.parquet`.
3. **Loc2Hospital (`src/loc2hospital/` + `scripts/aggregate_regions.py`)**
   - Maps each facility to canonical regions, aggregates coverage metrics, and labels deserts (hard = zero coverage, soft = bottom percentile).
   - Provides queryable services (geo radius, capability filters, ranking by confidence/completeness) powering both CLI and future UI.
   - Emits GeoJSON overlays for Loc2Med.
4. **Planning (`src/planning/` + `scripts/run_planning.py`)**
   - Gap analysis ranks missing capabilities per region with severity logic (coverage deficit + desert status + facility scarcity).
   - Unlock engine finds facilities that need ≤N prerequisites to go live and suggests actions (“Provide oxygen concentrators”, “Add anesthesia coverage weekend shifts”).
   - Recommendation layer falls back to referral suggestions when unlock isn’t feasible.
   - Exports planner-friendly CSVs with rationale/citations.
5. **UX + Adoption**
   - Not fully coded yet, but wiring is ready: Loc2Med UI consumes GeoJSON + Loc2Hospital API; NL agent (future) will call planning + retrieval surfaces.
   - Documentation (`docs/dev_notes/*`, `docs/PROJECT_PHILOSOPHY.md`, `runbooks/impact_playbook.md`) ensures VF teams can extend quickly.

---

## 4. Detailed Pipeline Narrative
### 4.1 Ingestion Philosophy
- **Start messy, stay auditable:** We ingest raw VF rows without losing original context (field names recorded in metadata). Every scrape chunk remembers URL + fetch timestamp so auditors can reproduce.
- **Keyword-first web discovery:** Instead of trusting outdated `source_url` fields, we intentionally rebuild the link list via search. This lets us surface Facebook updates, district health posts, or NGOs describing facility upgrades—all high-signal for capability hints.
- **Ethical scraping:** Robots.txt checks, per-domain throttling, and user-agent rotation keep us polite. We skip any URL disallowed by robots rather than risk VF’s reputation.

### 4.2 Text2Med Philosophy
- **Ontology as product contract:** Capability definitions live in YAML so domain experts can edit without touching code. Each capability knows its synonyms, strong/weak phrases, and prerequisites.
- **Heuristics before hallucinations:** We avoided LLM-driven extraction until we have a watertight evaluation harness. Keyword retrieval + rule-based scoring gives deterministic, reviewable outputs with zero hallucination risk.
- **Explainable verification:** Missing prerequisite? We tell you exactly which ones. Contradiction? You see both evidence snippets. We’d rather show “ICU: uncertain (no oxygen evidence)” than mislead.

### 4.3 Geo & Coverage Philosophy
- **Region-first queries:** NGOs plan at district/regional levels, so `aggregate_regions.py` is the backbone. We compute coverage scores per capability + region and mark deserts so Loc2Med maps have authoritative shading.
- **Composability:** Loc2Hospital services are pure DataFrame transformations. Scripts, tests, and future APIs all call the same logic, eliminating divergence between CLI and UI.

### 4.4 Planning Philosophy
- **Action, not analytics:** Gap analysis surfaces top missing services; unlock analysis immediately translates them into actions or referrals. The CSV export is a ready-made briefing for field coordinators.
- **Severity ≠ raw counts:** A region with 0 facilities providing C-sections gets higher severity even if its population is small, because missing that service is catastrophic. We encode that domain intuition in scoring.
- **Citations carry through:** Recommendations reference facility IDs + evidence IDs so VF can trace back to the raw chunk, sustaining trust.

---

## 5. Dev Workflow & Quality
1. **Configuration-first:** Hydra-style loader ensures every script shares the same `config/base.yaml` + per-environment overlays. Changing a parameter (e.g., chunk size, search max results) never requires code edits.
2. **Logging + MLflow hooks:** `setup_logging` standardizes JSON/plain logs and automatically spins up MLflow runs when `experiment.tracking_uri` is set.
3. **Testing regimen:**
   - Unit tests cover geo helpers, Loc2Hospital ranking/search, and any future modules.
   - CLI scripts support `--dry-run` to validate config + log counts without writing data.
   - Manual verifications (Jupyter / pandas inspection) for early facility capability sanity checks.
4. **Documentation cadence:** Every major change ships with a `docs/dev_notes/YYYY-MM-DD-*.md` entry summarizing rationale + usage. This file itself is part of that habit.

---

## 6. Playbooks for Future Contributors
1. **Running end-to-end**
   ```bash
   # 1) Ingest VF CSV + search web
   python scripts/ingest_data.py --config-name environments/local

   # 2) Build Text2Med truth tables
   python scripts/build_text2med.py --config-name environments/local

   # 3) Aggregate regions + deserts
   python scripts/aggregate_regions.py --config-name environments/local

   # 4) Generate planning recommendations
   python scripts/run_planning.py --config-name environments/local
   ```
2. **Tuning search strategy**
   - `config/pipelines/ingest.yaml → search.max_core_terms` if you need longer/shorter queries.
   - `search.extra_terms` for domain-specific cues (e.g., “maternity”, “dialysis”).
3. **Adding a new capability**
   - Edit `config/ontology/capabilities.yaml`, add synonyms + phrases + prerequisites.
   - Re-run Text2Med + downstream scripts; citations+confidence will propagate automatically.
4. **Extending planning logic**
   - Add heuristics in `src/planning/unlock_engine.py` (e.g., staff availability data) and adjust severity scoring in `gap_analysis.py`.

---

## 7. What “Done” Looks Like
- **Facility card** shows: capability list (present/probable/uncertain), confidence scores, citations, prerequisite flags, and explanation.
- **Map view** paints deserts by capability and lets planners click through to details instantly.
- **Planning report** lists “Top missing capabilities per region”, “Unlock candidates + recommended interventions”, and “Referral alternatives” — all with citations.
- **Handoff readiness**: repo has structured configs, runbooks, and documentation so VF/Databricks teams can productionize without reverse-engineering hackathon code.

---

## 8. Closing Thoughts
We deliberately resisted “demo-only” shortcuts. Instead, the project is structured like a mini health-intelligence platform:
- Configurable ingest/search so VF can swap datasets or countries.
- Deterministic extraction logic with room for LLM augmentation later.
- Region + planning layers that answer **“So what?”** for field teams.
- Documentation + tests to keep technical debt low even as new volunteers join.

If you are inheriting this repository, start with the scripts listed above, read the `docs/dev_notes` timeline, and treat this philosophy file as the narrative backbone. The mission is too important for brittle hacks—ship auditable insights fast, and keep humans in the loop with the context they need to act.
