# Bridging Medical Deserts — common workflows.
# Ensures required dirs exist and chains scripts. Extend with real commands.

.PHONY: dirs ingest text2med verify aggregate plan demo eval

dirs:
	mkdir -p data/raw data/interim data/processed data/external
	mkdir -p inputs/questions outputs/reports outputs/traces outputs/tiles

ingest: dirs
	# python scripts/ingest_data.py
	@echo "TODO: run scripts/ingest_data.py"

text2med: dirs
	# python scripts/build_text2med.py
	@echo "TODO: run scripts/build_text2med.py"

verify: dirs
	# python scripts/verify_capabilities.py
	@echo "TODO: run scripts/verify_capabilities.py"

aggregate: dirs
	# python scripts/aggregate_regions.py
	@echo "TODO: run scripts/aggregate_regions.py"

plan: dirs
	# python scripts/run_planning.py
	@echo "TODO: run scripts/run_planning.py"

demo: dirs
	# python scripts/launch_ui.py
	@echo "TODO: run scripts/launch_ui.py"

eval: dirs
	# python scripts/eval_suite.py
	@echo "TODO: run scripts/eval_suite.py"
