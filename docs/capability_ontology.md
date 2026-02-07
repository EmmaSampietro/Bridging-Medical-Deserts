# Capability ontology

Canonical capability labels, synonyms, and evidence-strength hints. See `config/ontology/capabilities.yaml` and `config/ontology/prerequisites.yaml` for the machine-readable definitions.

## Current implementation notes
- Capabilities are grouped by category from `config/ontology/capabilities.yaml`.
- `src/text2med/ontology.py` expands each capability with:
  - normalized synonyms
  - strong phrases
  - weak phrases
  - negative phrases
- Prerequisites are loaded from `config/ontology/prerequisites.yaml` (`rules.*.requires`) with fallback defaults for:
  - `icu`
  - `c_section`
  - `dialysis`
  - `x_ray`

## Extraction behavior (rule-first)
- Strong hits increase presence confidence.
- Weak hits produce uncertain claims unless supported by stronger evidence.
- Negative hits (`no <capability>`, `without <capability>`, etc.) push claims toward absent/inconsistent.

## Verification behavior
- Claims marked `present`/`uncertain` are checked against prerequisites.
- Missing prerequisites add `missing_prerequisite` flags.
- Strong + negative evidence combinations add `inconsistent_claim` flags.
