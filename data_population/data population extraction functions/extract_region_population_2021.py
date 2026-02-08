#!/usr/bin/env python3
"""Extract Ghana 2021 region population figures from wiki-style text into CSV."""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path
from typing import List, Tuple


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract 2021 region population data from ghana_population_per_region.txt."
    )
    parser.add_argument(
        "--input-txt",
        type=Path,
        default=Path("data_population/ghana_population_per_region.txt"),
        help="Path to text file containing wiki-like population table.",
    )
    parser.add_argument(
        "--output-csv",
        type=Path,
        default=Path("data_population/ghana_population_per_region_2021.csv"),
        help="Path to output CSV.",
    )
    return parser.parse_args()


def _split_table_rows(raw_text: str) -> List[List[str]]:
    rows: List[List[str]] = []
    current: List[str] = []
    for raw_line in raw_text.splitlines():
        line = raw_line.rstrip("\n")
        stripped = line.strip()
        if stripped.startswith("|-"):
            if current:
                rows.append(current)
                current = []
            continue
        if stripped.startswith("|}") or stripped == "|":
            if current:
                rows.append(current)
            current = []
            continue
        if stripped.startswith("|"):
            current.append(stripped[1:].strip())
    if current:
        rows.append(current)
    return rows


def _clean_wiki_markup(value: str) -> str:
    text = value
    text = re.sub(r"<ref[^>/]*/>", "", text)
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text)
    text = re.sub(r"\[\[([^|\]]+)\|([^\]]+)\]\]", r"\2", text)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"\s*\(former[^)]*\)\s*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _is_numeric_population(value: str) -> bool:
    return bool(re.fullmatch(r"[\d,]+", value.strip()))


def _parse_region_rows(raw_text: str) -> List[Tuple[int, str, int, float]]:
    parsed: List[Tuple[int, str, int, float]] = []
    for row in _split_table_rows(raw_text):
        # Expected format:
        # [rank, region, pop2021, pop2010, ..., percent2021]
        if len(row) < 8:
            continue
        rank_raw = row[0].strip()
        pop_2021_raw = row[2].strip()
        percent_2021_raw = row[-1].strip()
        if not rank_raw.isdigit():
            continue
        if not _is_numeric_population(pop_2021_raw):
            continue
        if not percent_2021_raw.endswith("%"):
            continue

        rank = int(rank_raw)
        region_name = _clean_wiki_markup(row[1].strip())
        population_2021 = int(pop_2021_raw.replace(",", ""))
        population_percentage_2021 = float(percent_2021_raw.replace("%", ""))
        parsed.append((rank, region_name, population_2021, population_percentage_2021))
    return sorted(parsed, key=lambda x: x[0])


def _write_csv(rows: List[Tuple[int, str, int, float]], output_csv: Path) -> None:
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "rank_2021",
                "region_name",
                "population_2021",
                "population_percentage_2021",
            ],
        )
        writer.writeheader()
        for rank, region_name, population_2021, population_percentage_2021 in rows:
            writer.writerow(
                {
                    "rank_2021": rank,
                    "region_name": region_name,
                    "population_2021": population_2021,
                    "population_percentage_2021": population_percentage_2021,
                }
            )


def main() -> None:
    args = _parse_args()
    raw_text = args.input_txt.read_text(encoding="utf-8")
    rows = _parse_region_rows(raw_text)
    if not rows:
        raise ValueError("No 2021 region rows were parsed from input text file.")
    _write_csv(rows, args.output_csv)
    print(f"Parsed regions: {len(rows)}")
    print(f"Output CSV: {args.output_csv}")


if __name__ == "__main__":
    main()
