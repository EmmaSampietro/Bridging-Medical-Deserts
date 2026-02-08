#!/usr/bin/env python3
"""Extract Ghana region area (km^2) from wiki-style text into CSV."""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path
from typing import List, Tuple


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract region area in km^2 from ghana_area_by_region.txt."
    )
    parser.add_argument(
        "--input-txt",
        type=Path,
        default=Path("data_population/ghana_area_by_region.txt"),
        help="Path to text file containing wiki-like area table.",
    )
    parser.add_argument(
        "--output-csv",
        type=Path,
        default=Path("data_population/ghana_area_by_region_km2.csv"),
        help="Path to output CSV.",
    )
    return parser.parse_args()


def _split_table_rows(raw_text: str) -> List[List[str]]:
    rows: List[List[str]] = []
    current: List[str] = []
    for raw_line in raw_text.splitlines():
        stripped = raw_line.strip()
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
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _parse_area_rows(raw_text: str) -> List[Tuple[int, str, int]]:
    parsed: List[Tuple[int, str, int]] = []
    for row in _split_table_rows(raw_text):
        # Expected format: [rank, region, area]
        if len(row) < 3:
            continue
        rank_raw = row[0].strip()
        area_raw = row[2].strip()
        if not rank_raw.isdigit():
            continue
        if not re.fullmatch(r"[\d,]+", area_raw):
            continue

        rank = int(rank_raw)
        region_name = _clean_wiki_markup(row[1].strip())
        area_km2 = int(area_raw.replace(",", ""))
        parsed.append((rank, region_name, area_km2))
    return sorted(parsed, key=lambda x: x[0])


def _write_csv(rows: List[Tuple[int, str, int]], output_csv: Path) -> None:
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["rank_area", "region_name", "area_km2"],
        )
        writer.writeheader()
        for rank, region_name, area_km2 in rows:
            writer.writerow(
                {
                    "rank_area": rank,
                    "region_name": region_name,
                    "area_km2": area_km2,
                }
            )


def main() -> None:
    args = _parse_args()
    raw_text = args.input_txt.read_text(encoding="utf-8")
    rows = _parse_area_rows(raw_text)
    if not rows:
        raise ValueError("No area rows were parsed from input text file.")
    _write_csv(rows, args.output_csv)
    print(f"Parsed regions: {len(rows)}")
    print(f"Output CSV: {args.output_csv}")


if __name__ == "__main__":
    main()
