# How to run the pipeline

Quick setup and run reference. For full pipeline inputs/outputs and regeneration, see [PIPELINE_README.md](PIPELINE_README.md).

---

## Setup

1. Create and activate a virtual environment (from project root):

   ```bash
   python -m venv venv
   source venv/bin/activate   # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. Ensure inputs are in place:
   - VF facility CSV (e.g. `ghana.csv`) in `data/raw/`.
   - Optional: copy `config/secrets.example.yaml` to a secrets file and set any API keys or URIs (see `config/base.yaml` and pipeline configs).

3. Create required directories:

   ```bash
   make dirs
   ```

---

## Run

**Full pipeline (recommended):**

```bash
make regenerate
```

**Individual stages:**

| Target | Command | Outputs |
|--------|---------|---------|
| Ingest | `make ingest` | `data/interim/raw_documents.parquet` |
| Text2Med | `make text2med` | `data/processed/facility_capabilities.parquet` |
| Verify | `make verify` | Updated capabilities, anomalies, verify_summary.json |
| Aggregate | `make aggregate` | region_coverage.parquet, desert_overlays.geojson |
| Planning | `make plan` | planning_recommendations, reports |
| Demo UI | `make demo` | Launches Loc2Med UI |

**With config overrides:**

```bash
python scripts/ingest_data.py --config-name environments/local --override chunker.max_chars=600
python scripts/verify_capabilities.py --override verification.prerequisite_strict=false --dry-run
```

---

## Resuming and debugging

- **Dry-run**: Add `--dry-run` to any script to validate config and logic without writing outputs.
- **Config**: Pipeline configs live in `config/pipelines/`. Use `--config-name` and `--override` to tune without editing code.
- **Logs**: Scripts use structured logging; level and format are in `config/base.yaml` under `logging`.

If a stage fails, fix inputs or config and re-run from that stage; later stages read from the outputs of previous ones (see PIPELINE_README.md for the flow).
