# Bridging Medical Deserts — common workflows.
# See docs/PIPELINE_README.md for inputs/outputs and docs/README_RUN.md for setup.

.PHONY: dirs ingest text2med verify aggregate plan demo eval regenerate

dirs:
	mkdir -p data/raw data/interim data/processed data/external
	mkdir -p inputs/questions outputs/reports outputs/traces outputs/tiles

ingest: dirs
	python scripts/ingest_data.py

text2med: dirs
	python scripts/build_text2med.py

verify: dirs
	python scripts/verify_capabilities.py

aggregate: dirs
	python scripts/aggregate_regions.py

plan: dirs
	python scripts/run_planning.py

demo: dirs
	python scripts/launch_ui.py

eval: dirs
	python scripts/eval_suite.py

# Full pipeline: ingest → text2med → verify → aggregate (then plan/demo as needed).
regenerate: dirs
	python scripts/ingest_data.py && \
	python scripts/build_text2med.py && \
	python scripts/verify_capabilities.py && \
	python scripts/aggregate_regions.py
