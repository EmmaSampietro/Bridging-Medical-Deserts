# HackNation / Databricks Track — VF “Source of Truth” Pipeline (Cursor Master Plan)

> **Challenge context**: The Virtue Foundation brief tasks us with cutting the time-to-lifesaving treatment by **100×** by orchestrating scarce expertise where it is needed most. Our moonshot is an **agentic healthcare intelligence layer** that reads messy facility data, reasons about readiness, and routes action.
>
> **Purpose**: Build an **agentic + ML-based “source of truth” layer** for medical facility capabilities that (i) extracts + verifies capabilities from messy/unstructured data, (ii) produces **evidence-weighted confidence** and **anomaly flags**, (iii) visualizes **medical deserts** on a map, and (iv) supports **planning** via a simple NL interface that any NGO planner—regardless of age, technical skill, or bandwidth—can use.
>
> **Scope reality**: We will **not** estimate real “clinical quality” (outcomes, volumes, finances) unless explicitly available. We will estimate **capability existence + reliability** from evidence with citations + prerequisite checks (exactly aligned with the challenge). We stay laser-focused on a single VF dataset + light scraping to keep velocity high.

---

## Challenge alignment & success metrics
- **Moonshot metric**: Align every milestone to the VF brief’s mandate—**100× reduction** in time-to-lifesaving treatment by making coordination instant instead of manual bottlenecks.
- **IDP agent charter**: Build an intelligent document parsing agent that (a) extracts granular facility capabilities from chaotic text, (b) reasons over completeness/prerequisites, and (c) pinpoints facilities, gaps, and lives at risk in real time.
- **MVP promises (directly lifted from VF doc)**:
  - *Unstructured feature extraction*: prioritize free-form text fields first, then enrich with structured schema crosswalks.
  - *Intelligent synthesis*: fuse structured + unstructured evidence into a single capability view per facility + region.
  - *Planner-friendly system*: plan outputs must be legible and adoptable by NGO coordinators of any experience or age—plain language, low cognitive load, mobile-friendly.
- **Stretch ambition adoption**:
  - Row-level citations + optional agent-step traces so judges can follow every reasoning hop.
  - Map-based storytelling of deserts with intuitive overlays and drilldowns.
  - “Ship-to-impact” tack-on: structure repo so VF + Databricks teams can harden it by **June 7** for real-world deployment.
- **Evaluation weights (per brief)**:
  - Technical accuracy 35% → focus on reliable answers + anomaly detection.
  - IDP innovation 30% → novel extraction/verification heuristics > generic RAG.
  - Social impact 25% → desert signals + unlock recommendations must be clear enough to act on.
  - UX 10% → NL experience + accessibility can swing close judging calls.
- **Decision rule**: when in doubt, choose the workstream that maximizes coordination speed + transparency for Virtue Foundation field teams.

---

## 0) Executive summary (what we ship)

### The product in one sentence
We ingest facility information from one target country → produce a structured, auditable “capability graph” with confidence + citations → show it on a map with desert overlays → answer planner questions with grounded citations—squeezing today’s multi-week coordination loop into **hours**.

### Core modules (keep these names)
- **Text2Med**: IDP + verification + evidence-weighted “truth” tables
- **Loc2Hospital**: region/location → facility retrieval
- **Loc2Med**: map UI + filters + rankings + desert overlays
- **Planning**: actionable gap analysis + “unlock” recommendations + optional chat agent

### Demo country strategy
We will focus on **one country** chosen by **data availability** (scrape success + richness of text + number of facilities). The pipeline is generic; the demo is single-country for depth and polish, mirroring the VF challenge.

---

## 1) Main goals (explicit, judge-aligned)

### G1 — IDP: extract structured capabilities from messy text
- Parse free-text fields (`specialties`, `procedure`, `equipment`, `capability`, plus scraped site text if available)
- Normalize to a canonical capability schema
- Output: facility-level capability profile

### G2 — Verification: detect incomplete/suspicious claims
- Prerequisite logic (“ICU” implies oxygen/monitoring/ventilation evidence, etc.)
- Contradiction logic (“has ultrasound” vs “no imaging equipment”)
- Output: flags + explanations + cited evidence

### G3 — Confidence: evidence-weighted reliability scores
- Score each facility×capability on **how strongly the data supports it**
- Use transparent mechanics: evidence specificity, support count, contradiction penalties, prerequisite completeness
- Output: confidence ∈ [0,1], plus why

### G4 — Coverage & deserts: identify where care is missing
- Aggregate by region to compute capability coverage
- Desert overlays: “no confirmed providers” or “coverage below threshold”
- Compute severity hints (population proxy, facility density) to highlight where lives are most at risk
- Output: region×capability gap tables + map overlays + top “at risk” calls to action

### G5 — Planning: recommend actionable interventions
- “Unlock analysis”: identify facilities that could provide a capability if a small missing prerequisite is addressed
- Provide ranked recommendations for NGOs/policy-makers:
  - equipment donations
  - staffing rotations
  - targeted training
  - referral routing

### G6 — UX: simple interface for non-technical planners
- Map with toggles and filters
- Facility “explainability panel” showing:
  - capability list
  - confidence
  - evidence snippets (citations)
  - flags + reasons
- NL chat + guided workflows that translate questions into structured queries with safe defaults
- Accessibility commitments: readable on low-end laptops/tablets, clear copy (grade-8 reading level), explicit onboarding tips so planners across ages/experience can adopt it immediately

### G7 — Transparency & adoption accelerants
- Provide **row-level citations** everywhere (VF CSV row IDs, scraped doc IDs).
- Optional: expose **agent-step traces** (e.g., LangGraph trace pages) when reasoning spans multiple steps.
- Ship playbooks for VF/Databricks teams to extend/productionize by **June 7** (make repo legible, document data contracts, add runbooks).

---

## 2) Non-goals (avoid scope traps)
- No patient-level data, no diagnostic triage, no outcomes modeling
- No claims of “best hospital” quality without explicit evidence
- No training a bespoke medical model “on the largest data we can find” (not needed / too slow / not required)
- No global multi-country at hackathon time; one country polished beats many shallow

---

## 3) Data acquisition (we do NOT have VF scraping code)

### 3.1 Data sources (tiered)
**Tier A (must)**: VF dataset tables (CSV) — baseline structured + semi-structured fields  
**Tier B (should)**: Facility web pages from `source_url` / `websites` columns  
**Tier C (optional)**: A small set of public national registry pages for facility lists (only if easy)

### 3.2 Scraper goals
- Input: list of URLs (facility pages, org websites)
- Output: `raw_documents` table with:
  - `doc_id`
  - `facility_pk` (or best match)
  - `url`
  - `fetched_at`
  - `title`
  - `raw_text`
  - `html_snapshot_path` (optional)
  - `status_code`, `errors`
- Must handle:
  - timeouts / retries
  - robots and ethical limits
  - dedupe (same page repeated)
- Must preserve citations:
  - store exact text spans and source URL + timestamp

### 3.3 Country selection procedure (data-driven)
Run a quick “availability scan” over candidate countries:
- facilities with non-null `source_url`/`websites`
- scrape success rate (200 OK)
- average extracted text length
- diversity of medical terms discovered
Choose the country maximizing: coverage × richness × scrape feasibility.

### 3.4 Agentic + RAG tech stack (per VF hints)
- **Agentic orchestrator**: LangGraph or CrewAI with observable traces; must log intermediate tool calls for stretch-goal transparency.
- **RAG store**: FAISS or LanceDB (hosted on Databricks if possible) with embeddings tuned for clinical vocabulary.
- **Lifecycle management**: MLflow for experiment + agent run tracking; capture prompts + outputs for reproducibility.
- **Text2SQL helper**: genie (or equivalent) for structured dataset queries.
- **Execution environment**: keep workloads compatible with Databricks Free Edition and local dev; use lightweight data volumes.
- **Dataset focus**: Virtue Foundation facility CSVs + curated scraped documents; store schema docs + prompts in `/docs/`.
- **Traceability**: integrate evaluation/citation metadata into pipeline outputs so we can later expose agent-step-level citations.

---

## 4) Canonical schemas (data contracts)

### 4.1 Canonical capability object
A “capability” is not a single label. It’s structured:

- `capability`: canonical label (e.g., `ultrasound`, `icu`, `c_section`)
- `subtype`: optional (e.g., `echo`, `portable_ultrasound`, `adult_icu`)
- `level`: `basic | intermediate | advanced | unknown`
- `constraints`: list (e.g., `daytime_only`, `visiting_specialist`, `referral_required`)
- `confidence`: float [0,1]
- `evidence`: list of evidence items (see below)
- `flags`: list of anomalies
- `notes`: short explanation for humans

### 4.2 Evidence item
- `evidence_id`
- `doc_id` or `row_id`
- `source_type`: `vf_row | scraped_web | pdf | other`
- `snippet`: the exact text span (short)
- `field`: where it came from (`capability`, `procedure`, `equipment`, `web_text`, …)
- `offsets`: optional indices into raw text
- `strength`: `weak | medium | strong`

### 4.3 Output tables (minimum)
**facility_master**
- facility_id (internal)
- pk_unique_id (VF)
- name
- country
- region/admin fields (if available)
- lat/lon (if available, else geocode later)
- URLs/contact

**documents**
- doc_id
- facility_id
- url/source
- raw_text
- metadata

**facility_capabilities**
- facility_id
- capability
- subtype
- level
- constraints[]
- confidence
- evidence_ids[]
- flags[]
- updated_at

**region_coverage**
- region_id
- capability
- coverage_score
- desert_flag
- top_supporting_facilities[]

**planning_recommendations**
- region_id or facility_id
- recommended_action
- target_capability
- expected_unlock
- rationale + citations

---

## 5) Text2Med pipeline (deep reasoning, not code-level)

This pipeline **is** our VF-mandated Intelligent Document Parsing (IDP) agent: it reads noisy facility records, cross-checks claims, and emits auditable capability truths with row-level citations and anomaly flags.

### Stage A — Ingest & normalize (structured + scraped)
**Inputs**
- VF CSV rows (semi-structured lists + nulls)
- Scraped documents (raw text)

**Operations**
1. Normalize list-like fields:
   - `specialties`, `procedure`, `equipment`, `capability` (strings, JSON lists, null)
2. Build unified “text bundle” per facility:
   - include structured field text + scraped doc text
3. Chunk into “evidence units”:
   - sentences / bullet points / short paragraphs
4. Persist chunks with stable IDs (for citations later)

**Outputs**
- `facility_text_chunks(facility_id, chunk_id, chunk_text, source, origin_field, url/row_id)`

### Stage B — Capability ontology (small but powerful)
Create a limited set (~20–40) of high-impact capabilities grouped by category:

- **Emergency & maternal**: emergency obstetric care, C-section, blood transfusion, neonatal resuscitation
- **Surgery & anesthesia**: general surgery, anesthesia availability, operating theatre, sterilization
- **Critical care**: ICU, oxygen supply, ventilators, triage
- **Diagnostics**: ultrasound, x-ray, lab tests, blood bank
- **Infectious/chronic**: HIV care, TB diagnostics, dialysis

Each capability includes:
- synonyms / lexical patterns
- strong evidence phrases vs weak phrases (e.g., “performs” vs “offers”)
- prerequisites (next stage)
- optional “capability tier” expectations by facility type

### Stage C — Extraction (turn text into structured claims)
For each facility:
1. Retrieve relevant chunks by capability group (semantic + keyword)
2. Produce candidate claims:
   - capability present/absent/uncertain
   - subtype/level/constraints when possible
   - evidence chunk IDs
3. Emit **only what can be supported** by citations

**Output**
- `facility_capabilities_raw` with claims + evidence IDs

### Stage D — Verification (make it “truth”)
Verification produces:
- flags
- confidence adjustments
- human-readable explanation

#### D1 — Prerequisite checks (logical consistency)
Define prerequisites such as:
- `icu` ⇒ oxygen + monitoring + trained staff evidence
- `c_section` ⇒ anesthesia + sterile theatre + blood access evidence
- `dialysis` ⇒ dialysis machines + water treatment + technician evidence
- `x_ray` ⇒ imaging equipment + radiology tech evidence (or explicit x-ray service mention)

Rules are used to:
- downgrade confidence if prerequisites missing
- raise suspicion if strong claim but prerequisites absent

#### D2 — Contradiction checks
Detect contradictions such as:
- “24/7 emergency” vs “open Mon–Fri”
- “ICU available” vs “no ventilators/oxygen”
- “surgery” vs “no theatre / no anesthesia”

Contradictions produce:
- `flag: inconsistent_claim`
- reduced confidence
- explanation with cited snippets

#### D3 — Evidence grading
Evidence strength depends on:
- specificity of language
- multiple independent supporting chunks
- explicitness (e.g., “we perform C-sections” > “maternal care”)

### Stage E — Confidence scoring (transparent mechanics)
Confidence is computed from evidence, not hidden “quality”:

- **Base**: extracted claim certainty (or default)
- **+** specificity bonus
- **+** multiple evidence bonus (distinct sources/fields)
- **−** prerequisite missing penalty
- **−** contradiction penalty
- **−** vagueness penalty (e.g., “cardiology services” without subtype/equipment)

**Outputs**
- Final `facility_capabilities` table:
  - confidence
  - evidence IDs
  - flags
  - short explanation (“why we think this is true/uncertain”)
  - optional `trace_id` linking back to LangGraph/CrewAI run for agent-step-level citations

---

## 6) Loc2Hospital pipeline (geo retrieval)

### Inputs
- facility_master with lat/lon or region
- facility_capabilities with confidence

### Capabilities
- Region selection:
  - admin region lookup (if available)
  - fallback: radius search on lat/lon
- Filter:
  - by capability and min confidence threshold
- Rank:
  - by confidence
  - optionally by “capability completeness” (prerequisites satisfied)

### Outputs
- A ranked facility list for any location or region query

---

## 7) Loc2Med pipeline (map UI + desert overlays)

### 7.1 Map UI requirements
- Facility markers on map
- Filter panel:
  - capability selector
  - confidence threshold slider
  - subtype/constraint filters if available
- Facility detail panel (on click):
  - capability table: present/probable/uncertain
  - confidence values
  - evidence snippets (expandable) with citations (url/row_id)
  - anomaly flags + explanations

### 7.2 Desert overlays (regional synthesis)
Compute for each region:
- `coverage_score(capability) = Σ confidence of facilities with capability`
- `desert_flag`:
  - **hard desert**: no facilities above “confirmed” threshold
  - **soft desert**: below percentile threshold

Display:
- choropleth shading by `coverage_score`
- ability to overlay “top missing capabilities” per region

---

## 8) Planning system pipeline (NGO / policy recommender)

### 8.1 Planning outputs (what the system should produce)
For a selected region (or country-wide ranking):
- **Top capability gaps** (most socially critical missing services)
- **Nearest alternatives** (referral targets)
- **Unlock candidates** (facilities that could deliver capability with minimal intervention)
- **Recommended interventions** with rationales and citations

### 8.2 Unlock analysis (high-ROI logic)
For each missing capability in a region:
1. Identify facilities that:
   - have partial evidence
   - are missing few prerequisites
2. Propose targeted actions:
   - equipment donation (e.g., ultrasound machine)
   - staff rotation (e.g., anesthetist coverage)
   - training / certification
3. Rank by:
   - population/coverage proxy (if available) OR “facility centrality”
   - estimated unlock size (how many people served / region coverage improvement)
   - feasibility (number of missing prerequisites)

### 8.3 Optional agentic interface (small but impressive)
A NL agent for planners that:
- translates question → structured query over truth tables
- returns:
  - answer
  - recommended actions
  - citations (evidence items)
- supports “show on map” actions

### 8.4 Adoption + accessibility checklist
- Provide a **guided “task mode”** with canned prompts (“Identify maternal care gaps in Upper West”) for less-experienced planners.
- Include **sharing/export buttons** (CSV + PDF snapshot) so coordinators can brief field teams quickly.
- Optimize for **low-bandwidth contexts** (lazy-load maps, cache data, dark mode optional).
- Keep instructions at **grade-8 reading level** with iconography so coordinators across age groups understand next steps without training.

---

## 9) Evaluation checklist (acceptance criteria)

Tie each checklist to the VF scoring weights (35/30/25/10) so we invest in what moves the needle: accuracy + anomaly detection (G1-G3), IDP innovation (G1-G4), social impact (G4-G5 + planning), and UX (G6-G7 + adoption work).

### Text2Med acceptance tests
- ✅ For a facility, can we show a capability list with:
  - confidence
  - evidence snippets
  - at least one citation per claim
- ✅ Can we flag at least 2 classes of anomalies:
  - missing prerequisites
  - contradictions

### Deserts acceptance tests
- ✅ For a chosen capability, can we identify ≥1 region with low/zero coverage?
- ✅ Can we display that on map clearly?

### Planning acceptance tests
- ✅ For a chosen region, can we output:
  - top 3 missing capabilities
  - 2 recommended interventions with rationales + citations
  - nearest facility alternatives

### UX acceptance tests
- ✅ A non-technical user can:
  - select a region/capability
  - understand why a facility is “confirmed/probable/uncertain”
  - see the evidence for that conclusion

---

## 10) Demo script (what we show judges)

### Demo flow (5 minutes)
1. **Map**: “Here’s our chosen country. Let’s select ‘Emergency C-section’.”
2. **Desert overlay**: “These regions have no confirmed coverage — medical deserts.”
3. **Facility drilldown**: click a facility claiming maternal care:
   - show extracted claim, confidence, evidence snippet citations
   - show prerequisites missing (e.g., anesthesia evidence missing) → flagged
4. **Planning**: “What’s the best intervention for this region?”
   - show unlock candidates + recommended equipment/staff actions
5. **Trust**: “Every claim is cited back to a row or scraped doc.”

---

## 11) Risks & mitigations (pre-commit)

### R1 — Scraping fails / too sparse
**Mitigation**
- fall back to VF CSV-only pipeline
- choose country with best URL coverage
- cache + reuse scraping outputs

### R2 — Facility geolocation missing
**Mitigation**
- use region-level map if no lat/lon
- optional: geocode from address only if trivial and reliable

### R3 — Capability fields too generic (“Located in…”, “Open 24 hours”)
**Mitigation**
- treat generic text as constraints/metadata, not clinical capability evidence
- focus on a smaller set of capabilities where extraction is possible from text

### R4 — Hallucination risk in extraction
**Mitigation**
- enforce “citation required” rule: no capability claim without an evidence chunk ID
- store uncertainty explicitly

### R5 — Planner adoption gap (tool feels too technical)
**Mitigation**
- Co-design copy with field-style prompts; keep workflows wizard-like with prefilled templates.
- Provide lightweight onboarding doc + 2-minute loom-style walkthrough; ensure offline-friendly exports.
- Bake adoption feedback loops into `/docs/questions.md` to capture user pain quickly.

---

## 12) Workstreams (team split)

### Workstream A — Data & scraper
- choose country
- build scraper + caching
- store documents + text chunks with citations

### Workstream B — Text2Med truth layer
- capability ontology + prerequisite rules
- extraction to structured claims
- verification + confidence scoring
- output tables

### Workstream C — Loc2Med UI
- map + filters + facility panel
- desert overlays
- evidence/citation display

### Workstream D — Planning + optional agent
- gap ranking
- unlock analysis
- optional NL interface wired to tables

### Workstream E — Transparency + adoption (stretch, but high leverage)
- Build citation crosswalk service + UI surfaces (row-level + agent-step-level).
- Produce `/runbooks/impact_playbook.md` + `/docs/questions.md`.
- Instrument UX accessibility checklist (guided tasks, exports, low-bandwidth mode).

---

## 13) Final deliverables (repo artifacts)

- `/data/raw/` VF CSV + scraped caches
- `/data/processed/` truth tables (parquet/csv)
- `/docs/` capability ontology + rules + demo script
- `/docs/questions.md` VF planner question backlog + mapping to pipeline evaluations
- `/app/` map UI + planning UI
- `/pipelines/` ingest → extract → verify → aggregate
- `/runbooks/impact_playbook.md` how to deploy/extend the agent by the June 7 target (setup + maintenance + adoption tips)

---

## 14) Guiding principles (engineering + product)
- **Evidence-first**: no claim without a citation
- **Uncertainty is a feature**: show confidence + “why”
- **Small ontology, strong logic**: better than broad, shaky coverage
- **One country, one vertical**: depth over breadth for demo credibility
- **Planner orientation**: always translate “insight” → “action”

---

## 15) Real-impact handshake with Virtue Foundation
1. **Timeline sync**: Treat this repo as the upstream for the Databricks × VF agent targeted for **June 7**. Keep configs + docs production-grade so their team can fork + harden quickly.
2. **Question backlog**: Mirror the VF exploratory questions (e.g., “Where are C-sections unavailable?”, “Which hospitals claim ICUs but lack oxygen?”) inside `/docs/questions.md` so we continually test against real decision needs.
3. **Citations standard**: Every surfaced insight—map overlay, plan recommendation, NL answer—must carry row-level references (CSV row ID or scraped doc URL + timestamp) and optional agent-step traces for the stretch goal.
4. **Feedback hooks**: Capture planner feedback assumptions (copy tone, filter defaults, export needs) so NGO coordinators across ages/experience can plug in without training.
5. **Impact metric**: Track “time-to-action” from query → recommended intervention inside demos; aim to demonstrate a 100× improvement narrative backed by traceable numbers.
