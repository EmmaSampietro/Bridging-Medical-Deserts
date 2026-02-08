#!/usr/bin/env python3
"""Build a cleaner Ghana subnational population CSV grouped by region.

This script merges all `*_subnational_gha.csv` files under `data_population/`
into a simplified long-format CSV and writes a companion metadata dictionary.
It also appends derived region-profile indicators as extra rows:
`region_population_2021`, `region_population_percentage_2021`,
`region_area_km2`, and `population_density_2021_per_km2`.
"""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path
from typing import Dict, List, Set, Tuple
from urllib.parse import urlparse


COLUMN_SPECS: List[Dict[str, str]] = [
    {
        "column_name": "region_name",
        "clear_label": "Region Name",
        "data_type": "string",
        "source_column": "Location (normalized)",
        "description": "Clean region label used for grouping.",
    },
    {
        "column_name": "survey_year",
        "clear_label": "Survey Year",
        "data_type": "integer",
        "source_column": "SurveyYear",
        "description": "Survey year; derived region-profile indicators use 2021.",
    },
    {
        "column_name": "survey_type",
        "clear_label": "Survey Type",
        "data_type": "string",
        "source_column": "SurveyType or derived value",
        "description": "Survey family/type (DHS/MIS/etc). Derived rows use 'Derived'.",
    },
    {
        "column_name": "indicator_name",
        "clear_label": "Indicator Name",
        "data_type": "string",
        "source_column": "Indicator or derived name",
        "description": "Indicator label. Includes derived region-profile indicators.",
    },
    {
        "column_name": "indicator_value",
        "clear_label": "Indicator Value",
        "data_type": "number",
        "source_column": "Value or derived",
        "description": "Numeric value for each indicator row.",
    },
    {
        "column_name": "value_precision_digits",
        "clear_label": "Value Precision Digits",
        "data_type": "integer",
        "source_column": "Precision",
        "description": "Decimal precision reported in source for original DHS values.",
    },
    {
        "column_name": "denominator_weighted",
        "clear_label": "Denominator (Weighted)",
        "data_type": "number",
        "source_column": "DenominatorWeighted",
        "description": "Weighted denominator used for indicator estimate when available.",
    },
    {
        "column_name": "denominator_unweighted",
        "clear_label": "Denominator (Unweighted)",
        "data_type": "number",
        "source_column": "DenominatorUnweighted",
        "description": "Unweighted denominator used for indicator estimate when available.",
    },
    {
        "column_name": "ci_low",
        "clear_label": "Confidence Interval Low",
        "data_type": "number",
        "source_column": "CILow",
        "description": "Lower confidence interval bound when available.",
    },
    {
        "column_name": "ci_high",
        "clear_label": "Confidence Interval High",
        "data_type": "number",
        "source_column": "CIHigh",
        "description": "Upper confidence interval bound when available.",
    },
    {
        "column_name": "level_rank",
        "clear_label": "Level Rank",
        "data_type": "integer",
        "source_column": "LevelRank",
        "description": "Hierarchy rank value in source export when available.",
    },
    {
        "column_name": "source_file",
        "clear_label": "Source Data File",
        "data_type": "string",
        "source_column": "(derived)",
        "description": "Source file for the row.",
    },
    {
        "column_name": "source_theme",
        "clear_label": "Source Theme",
        "data_type": "string",
        "source_column": "(derived from filename)",
        "description": "Topic slug derived from source filename prefix.",
    },
    {
        "column_name": "source_metadata_file",
        "clear_label": "Source Metadata File",
        "data_type": "string",
        "source_column": "(derived)",
        "description": "Metadata CSV mapped to source data file when available.",
    },
    {
        "column_name": "source_download_url",
        "clear_label": "Source Download URL",
        "data_type": "string",
        "source_column": "download_url (metadata)",
        "description": "Original source URL recorded in metadata.",
    },
]

OUTPUT_COLUMNS: List[str] = [spec["column_name"] for spec in COLUMN_SPECS]


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Merge Ghana subnational population CSVs into one region-grouped CSV."
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("data_population"),
        help="Folder containing subnational data + metadata CSV files.",
    )
    parser.add_argument(
        "--output-csv",
        type=Path,
        default=Path("data_population/ghana_population_subnational_grouped_by_region.csv"),
        help="Path for merged output CSV.",
    )
    parser.add_argument(
        "--output-metadata-csv",
        type=Path,
        default=Path("data_population/metadata-ghana-population-subnational-grouped-by-region.csv"),
        help="Path for column dictionary metadata CSV.",
    )
    parser.add_argument(
        "--region-population-csv",
        type=Path,
        default=Path("data_population/ghana_population_per_region_2021.csv"),
        help="Optional CSV with columns region_name,population_2021,population_percentage_2021.",
    )
    parser.add_argument(
        "--region-area-csv",
        type=Path,
        default=Path("data_population/ghana_area_by_region_km2.csv"),
        help="Optional CSV with columns region_name,area_km2.",
    )
    return parser.parse_args()


def _normalize_region_name(region_name: str) -> str:
    region = (region_name or "").strip()
    region = re.sub(r"^[.\s]+", "", region)
    region = re.sub(r"\s+", " ", region)
    region = region.replace("Brong-Ahafo", "Brong Ahafo")
    region = re.sub(r"([A-Za-z])\(", r"\1 (", region)
    return region


def _theme_from_filename(data_filename: str) -> str:
    suffix = "_subnational_gha.csv"
    if data_filename.endswith(suffix):
        return data_filename[: -len(suffix)]
    return data_filename.replace(".csv", "")


def _region_lookup_key(region_name: str) -> str:
    value = _normalize_region_name(region_name)
    value = value.replace("Northeast", "North East")

    # Historical/combined labels do not map 1:1 to current 2021 region totals.
    if value.endswith("(pre 2022)") or value in {"Brong Ahafo", "Northern, Upper West, Upper East"}:
        return ""

    if value.endswith("(post 2022)"):
        value = value.replace("(post 2022)", "").strip()

    return value.lower()


def _discover_subnational_data_files(input_dir: Path) -> List[Path]:
    return sorted(path for path in input_dir.glob("*_subnational_gha.csv") if path.is_file())


def _read_simple_metadata_file(path: Path) -> Dict[str, str]:
    fields: Dict[str, str] = {}
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            field = (row.get("Field") or "").strip()
            value = (row.get("Value") or "").strip()
            if field:
                fields[field] = value
    return fields


def _index_metadata(input_dir: Path) -> Dict[str, List[Dict[str, str]]]:
    metadata_index: Dict[str, List[Dict[str, str]]] = {}
    for metadata_path in sorted(input_dir.glob("metadata-*.csv")):
        record = _read_simple_metadata_file(metadata_path)
        metadata_file_name = metadata_path.name

        download_url = record.get("download_url", "")
        if download_url:
            target = Path(urlparse(download_url).path).name
            metadata_index.setdefault(target, []).append(
                {
                    "metadata_file": metadata_file_name,
                    "download_url": download_url,
                }
            )

        resource_prefixes = sorted(
            {
                key.split("_download_url")[0]
                for key in record
                if key.endswith("_download_url")
            }
        )
        for prefix in resource_prefixes:
            resource_download = record.get(f"{prefix}_download_url", "")
            if not resource_download:
                continue
            target = Path(urlparse(resource_download).path).name
            metadata_index.setdefault(target, []).append(
                {
                    "metadata_file": metadata_file_name,
                    "download_url": resource_download,
                }
            )
    return metadata_index


def _load_region_population_lookup(population_csv: Path) -> Dict[str, Dict[str, str]]:
    lookup: Dict[str, Dict[str, str]] = {}
    if not population_csv.exists():
        return lookup

    with population_csv.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            key = _region_lookup_key(row.get("region_name", ""))
            if not key:
                continue
            lookup[key] = {
                "population_2021": (row.get("population_2021") or "").strip(),
                "population_percentage_2021": (row.get("population_percentage_2021") or "").strip(),
            }
    return lookup


def _load_region_area_lookup(area_csv: Path) -> Dict[str, str]:
    lookup: Dict[str, str] = {}
    if not area_csv.exists():
        return lookup

    with area_csv.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            key = _region_lookup_key(row.get("region_name", ""))
            if not key:
                continue
            lookup[key] = (row.get("area_km2") or "").strip()
    return lookup


def _safe_float(value: str) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _compute_density(population: str, area: str) -> str:
    pop_num = _safe_float(population)
    area_num = _safe_float(area)
    if pop_num is None or area_num is None or area_num <= 0:
        return ""
    return f"{(pop_num / area_num):.3f}"


def _select_metadata_for_data_file(
    data_filename: str,
    metadata_index: Dict[str, List[Dict[str, str]]],
) -> Dict[str, str]:
    candidates = metadata_index.get(data_filename, [])
    if not candidates:
        return {"metadata_file": "", "download_url": ""}

    theme = _theme_from_filename(data_filename)
    preferred_prefix = f"metadata-{theme}-data-for-ghana"

    def score(candidate: Dict[str, str]) -> Tuple[int, str]:
        name = candidate.get("metadata_file", "")
        if name.startswith(preferred_prefix) and " copy" not in name:
            return (0, name)
        if "dhs-subnational" not in name and " copy" not in name:
            return (1, name)
        if " copy" not in name:
            return (2, name)
        return (3, name)

    return sorted(candidates, key=score)[0]


def _build_base_output_row(
    source_row: Dict[str, str],
    *,
    source_file: str,
    source_theme: str,
    metadata: Dict[str, str],
) -> Dict[str, str]:
    return {
        "region_name": _normalize_region_name((source_row.get("Location") or "").strip()),
        "survey_year": (source_row.get("SurveyYear") or "").strip(),
        "survey_type": (source_row.get("SurveyType") or "").strip(),
        "indicator_name": (source_row.get("Indicator") or "").strip(),
        "indicator_value": (source_row.get("Value") or "").strip(),
        "value_precision_digits": (source_row.get("Precision") or "").strip(),
        "denominator_weighted": (source_row.get("DenominatorWeighted") or "").strip(),
        "denominator_unweighted": (source_row.get("DenominatorUnweighted") or "").strip(),
        "ci_low": (source_row.get("CILow") or "").strip(),
        "ci_high": (source_row.get("CIHigh") or "").strip(),
        "level_rank": (source_row.get("LevelRank") or "").strip(),
        "source_file": source_file,
        "source_theme": source_theme,
        "source_metadata_file": metadata.get("metadata_file", ""),
        "source_download_url": metadata.get("download_url", ""),
    }


def _build_derived_region_rows(
    *,
    regions_seen: Set[str],
    region_population_lookup: Dict[str, Dict[str, str]],
    region_area_lookup: Dict[str, str],
) -> List[Dict[str, str]]:
    derived_rows: List[Dict[str, str]] = []
    for region_name in sorted(regions_seen, key=lambda x: x.lower()):
        key = _region_lookup_key(region_name)
        if not key:
            continue

        population = region_population_lookup.get(key, {})
        area_km2 = region_area_lookup.get(key, "")
        density = _compute_density(population.get("population_2021", ""), area_km2)

        metrics = [
            ("region_population_2021", population.get("population_2021", ""), "ghana_population_per_region_2021.csv"),
            (
                "region_population_percentage_2021",
                population.get("population_percentage_2021", ""),
                "ghana_population_per_region_2021.csv",
            ),
            ("region_area_km2", area_km2, "ghana_area_by_region_km2.csv"),
            (
                "population_density_2021_per_km2",
                density,
                "ghana_population_per_region_2021.csv;ghana_area_by_region_km2.csv",
            ),
        ]

        for indicator_name, indicator_value, source_file in metrics:
            if indicator_value == "":
                continue
            derived_rows.append(
                {
                    "region_name": region_name,
                    "survey_year": "2021",
                    "survey_type": "Derived",
                    "indicator_name": indicator_name,
                    "indicator_value": indicator_value,
                    "value_precision_digits": "",
                    "denominator_weighted": "",
                    "denominator_unweighted": "",
                    "ci_low": "",
                    "ci_high": "",
                    "level_rank": "",
                    "source_file": source_file,
                    "source_theme": "derived-region-profile",
                    "source_metadata_file": "",
                    "source_download_url": "",
                }
            )
    return derived_rows


def _is_hxl_row(row: Dict[str, str]) -> bool:
    first_value = (row.get("ISO3") or "").strip()
    return first_value.startswith("#")


def _read_data_rows(path: Path) -> List[Dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        return [row for row in reader if not _is_hxl_row(row)]


def _write_output_csv(rows: List[Dict[str, str]], output_csv: Path) -> None:
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def _write_metadata_dictionary(output_metadata_csv: Path) -> None:
    output_metadata_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_metadata_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["column_name", "clear_label", "data_type", "source_column", "description"],
        )
        writer.writeheader()
        writer.writerows(COLUMN_SPECS)


def main() -> None:
    args = _parse_args()
    input_dir = args.input_dir
    output_csv = args.output_csv
    output_metadata_csv = args.output_metadata_csv
    region_population_csv = args.region_population_csv
    region_area_csv = args.region_area_csv

    if not input_dir.exists():
        raise FileNotFoundError(f"Input directory not found: {input_dir}")

    data_files = _discover_subnational_data_files(input_dir)
    if not data_files:
        raise FileNotFoundError(f"No *_subnational_gha.csv files found in: {input_dir}")

    metadata_index = _index_metadata(input_dir)
    region_population_lookup = _load_region_population_lookup(region_population_csv)
    region_area_lookup = _load_region_area_lookup(region_area_csv)

    merged_rows: List[Dict[str, str]] = []
    regions_seen: Set[str] = set()
    files_missing_metadata: List[str] = []

    for data_path in data_files:
        source_file = data_path.name
        source_theme = _theme_from_filename(source_file)
        metadata = _select_metadata_for_data_file(source_file, metadata_index)
        if not metadata.get("metadata_file"):
            files_missing_metadata.append(source_file)

        data_rows = _read_data_rows(data_path)
        for source_row in data_rows:
            row = _build_base_output_row(
                source_row,
                source_file=source_file,
                source_theme=source_theme,
                metadata=metadata,
            )
            merged_rows.append(row)
            if row["region_name"]:
                regions_seen.add(row["region_name"])

    derived_rows = _build_derived_region_rows(
        regions_seen=regions_seen,
        region_population_lookup=region_population_lookup,
        region_area_lookup=region_area_lookup,
    )
    merged_rows.extend(derived_rows)

    merged_rows.sort(
        key=lambda row: (
            row["region_name"].lower(),
            row["survey_year"],
            row["indicator_name"].lower(),
            row["source_theme"],
            row["source_file"],
        )
    )

    _write_output_csv(merged_rows, output_csv)
    _write_metadata_dictionary(output_metadata_csv)

    print(f"Base rows written: {len(merged_rows) - len(derived_rows)}")
    print(f"Derived rows written: {len(derived_rows)}")
    print(f"Total rows written: {len(merged_rows)}")
    print(f"Output CSV: {output_csv}")
    print(f"Metadata CSV: {output_metadata_csv}")
    print(f"Region population lookup loaded: {len(region_population_lookup)} ({region_population_csv})")
    print(f"Region area lookup loaded: {len(region_area_lookup)} ({region_area_csv})")
    if files_missing_metadata:
        missing = ", ".join(sorted(files_missing_metadata))
        print(f"Warning: metadata not found for {len(files_missing_metadata)} file(s): {missing}")


if __name__ == "__main__":
    main()
