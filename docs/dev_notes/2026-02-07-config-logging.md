# Config & Logging Infrastructure (2026-02-07)

## Why
- Needed a reusable loader so every script can hydrate `config/base.yaml` plus `config/environments/*.yaml` overrides without duplicating glue code.
- Logging/MLflow setup had to be one-liner (`setup_logging(cfg)`) to keep downstream pipelines lean and consistent.
- Requirement: document changes in Markdown for future contributors.

## What was built
1. **Hydra-style config loader (`src/common/config.py`):**
   - Uses OmegaConf to merge `base.yaml` with any number of overlay files (e.g., `environments/databricks.yaml`) plus optional dotlist overrides.
   - Validates the merged config via Pydantic models (`AppConfig`, `PathsConfig`, etc.), resolving all repository-relative paths to absolutes.
   - Supports env var `BMD_CONFIG_NAME` for default overlays and caches resolved configs for repeated use.

2. **Structured logging helper (`src/common/logging.py`):**
   - Provides `setup_logging(cfg, run_name=..., mlflow_tags=...)` returning both a configured logger and optional MLflow run id.
   - JSON formatter option (toggle via `logging.json` in YAML) for structured console output; default remains human-readable format.
   - Automatically wires MLflow when `experiment.tracking_uri` is set, starting/resuming runs and storing the resulting run id back on the config.

3. **Base config enhancements (`config/base.yaml`):**
   - Added logging metadata (datefmt, JSON toggle, logger name) so formatting is fully adjustable without code edits.

4. **Surface exports (`src/common/__init__.py`):**
   - Simplified imports so scripts can `from src.common import load_config, setup_logging`.

## How to use
```python
from src.common import load_config, setup_logging

cfg = load_config(config_name="environments/local", overrides=["paths.data_raw=data/new_raw"])
logging_result = setup_logging(cfg, run_name="text2med_v1")
logger = logging_result.logger
run_id = logging_result.mlflow_run_id
```

The loader ensures every downstream module sees the same resolved paths + experiment settings, and logging now standardizes console output + MLflow hooks.
