"""Load capability ontology and prerequisite rules from YAML."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Sequence

from omegaconf import OmegaConf

from src.common.config import PROJECT_ROOT


DEFAULT_CAPABILITIES_PATH = PROJECT_ROOT / "config" / "ontology" / "capabilities.yaml"
DEFAULT_PREREQUISITES_PATH = PROJECT_ROOT / "config" / "ontology" / "prerequisites.yaml"


@dataclass(frozen=True)
class CapabilityDefinition:
    """Canonical capability definition used across Text2Med stages."""

    capability_id: str
    category: str
    synonyms: tuple[str, ...]
    strong_phrases: tuple[str, ...]
    weak_phrases: tuple[str, ...]
    negative_phrases: tuple[str, ...]
    prerequisites: tuple[str, ...]


@dataclass(frozen=True)
class CapabilityOntology:
    """Container for loaded capability definitions and categories."""

    capabilities: Dict[str, CapabilityDefinition]
    categories: Dict[str, List[str]]

    def ordered_capabilities(self) -> List[CapabilityDefinition]:
        ordered: List[CapabilityDefinition] = []
        for category in self.categories:
            for capability_id in self.categories[category]:
                definition = self.capabilities.get(capability_id)
                if definition is not None:
                    ordered.append(definition)
        return ordered


DEFAULT_SYNONYMS: Dict[str, List[str]] = {
    "c_section": ["c section", "c-section", "cesarean", "caesarean"],
    "emergency_obstetric_care": ["emergency obstetric care", "emergency maternal care"],
    "blood_transfusion": ["blood transfusion", "transfusion"],
    "neonatal_resuscitation": ["neonatal resuscitation", "newborn resuscitation"],
    "general_surgery": ["general surgery", "surgical services"],
    "operating_theatre": ["operating theatre", "operating room", "surgical theatre"],
    "oxygen_supply": ["oxygen supply", "oxygen", "medical oxygen"],
    "ventilators": ["ventilator", "ventilators", "mechanical ventilation"],
    "x_ray": ["x ray", "x-ray", "radiography"],
    "lab_tests": ["lab tests", "laboratory", "laboratory testing"],
    "blood_bank": ["blood bank", "blood storage"],
    "tb_diagnostics": ["tb diagnostics", "tuberculosis diagnostics", "tb testing"],
    "hiv_care": ["hiv care", "hiv services", "antiretroviral therapy"],
}

DEFAULT_PREREQUISITE_RULES: Dict[str, List[str]] = {
    "icu": ["oxygen_supply", "ventilators"],
    "c_section": ["anesthesia", "operating_theatre", "blood_transfusion"],
    "dialysis": ["lab_tests"],
    "x_ray": ["lab_tests"],
}


def _dedupe(values: Iterable[str]) -> tuple[str, ...]:
    seen = set()
    out: List[str] = []
    for value in values:
        norm = value.strip().lower()
        if not norm or norm in seen:
            continue
        seen.add(norm)
        out.append(norm)
    return tuple(out)


def _capability_label(capability_id: str) -> str:
    return capability_id.replace("_", " ").strip().lower()


def _default_phrases(capability_id: str, synonyms: Sequence[str]) -> tuple[tuple[str, ...], tuple[str, ...], tuple[str, ...]]:
    base_terms = list(_dedupe([_capability_label(capability_id), *synonyms]))
    strong_templates = (
        "provides {term}",
        "offers {term}",
        "available {term}",
        "performs {term}",
        "{term} available",
    )
    weak_templates = (
        "{term}",
        "{term} service",
        "{term} care",
    )
    negative_templates = (
        "no {term}",
        "without {term}",
        "{term} unavailable",
        "lack {term}",
    )

    strong = [tpl.format(term=term) for term in base_terms for tpl in strong_templates]
    weak = [tpl.format(term=term) for term in base_terms for tpl in weak_templates]
    negative = [tpl.format(term=term) for term in base_terms for tpl in negative_templates]
    return _dedupe(strong), _dedupe(weak), _dedupe(negative)


def _load_yaml(path: Path) -> Mapping[str, object]:
    if not path.exists():
        return {}
    cfg = OmegaConf.load(path)
    payload = OmegaConf.to_container(cfg, resolve=True)
    if isinstance(payload, dict):
        return payload
    return {}


def load_capability_ontology(
    capabilities_path: Path | None = None,
    prerequisites_path: Path | None = None,
) -> CapabilityOntology:
    """Load ontology files and return normalized capability definitions."""

    capabilities_cfg = _load_yaml(capabilities_path or DEFAULT_CAPABILITIES_PATH)
    prerequisites_cfg = _load_yaml(prerequisites_path or DEFAULT_PREREQUISITES_PATH)

    categories_payload = capabilities_cfg.get("categories", {})
    categories: Dict[str, List[str]] = {}
    for category, capability_ids in (categories_payload or {}).items():
        if not isinstance(capability_ids, list):
            continue
        normalized = [_capability_label(str(capability_id)).replace(" ", "_") for capability_id in capability_ids]
        categories[str(category)] = normalized

    explicit: Dict[str, Mapping[str, object]] = {}
    for item in capabilities_cfg.get("capabilities", []) or []:
        if not isinstance(item, dict):
            continue
        capability_id = str(item.get("id", "")).strip().lower()
        if not capability_id:
            continue
        explicit[capability_id] = item

    rules_payload = prerequisites_cfg.get("rules", {}) or {}
    prerequisite_rules: Dict[str, List[str]] = {}
    for capability_id, rule in rules_payload.items():
        if not isinstance(rule, dict):
            continue
        requires = rule.get("requires", []) or []
        prerequisite_rules[str(capability_id).strip().lower()] = [
            str(req).strip().lower() for req in requires if str(req).strip()
        ]

    all_capability_ids: List[str] = []
    for ids in categories.values():
        all_capability_ids.extend(ids)
    for capability_id in explicit:
        if capability_id not in all_capability_ids:
            all_capability_ids.append(capability_id)

    capabilities: Dict[str, CapabilityDefinition] = {}
    for capability_id in all_capability_ids:
        item = explicit.get(capability_id, {})
        category = "uncategorized"
        for category_name, members in categories.items():
            if capability_id in members:
                category = category_name
                break

        synonyms = _dedupe(
            [
                capability_id.replace("_", " "),
                *DEFAULT_SYNONYMS.get(capability_id, []),
                *(item.get("synonyms", []) or []),
            ]
        )
        strong_default, weak_default, negative_default = _default_phrases(capability_id, synonyms)
        strong_phrases = _dedupe([*(item.get("strong_phrases", []) or []), *strong_default])
        weak_phrases = _dedupe([*(item.get("weak_phrases", []) or []), *weak_default])
        negative_phrases = _dedupe([*(item.get("negative_phrases", []) or []), *negative_default])

        prerequisites = _dedupe(
            [
                *(prerequisite_rules.get(capability_id, [])),
                *DEFAULT_PREREQUISITE_RULES.get(capability_id, []),
            ]
        )

        capabilities[capability_id] = CapabilityDefinition(
            capability_id=capability_id,
            category=category,
            synonyms=synonyms,
            strong_phrases=strong_phrases,
            weak_phrases=weak_phrases,
            negative_phrases=negative_phrases,
            prerequisites=prerequisites,
        )

    return CapabilityOntology(capabilities=capabilities, categories=categories)


__all__ = ["CapabilityDefinition", "CapabilityOntology", "load_capability_ontology"]
