"""Storage helpers for parquet and JSON artifacts used across pipelines."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Sequence

import pandas as pd


class StorageError(RuntimeError):
    """Raised when reading or writing a storage artifact fails."""


def ensure_parent_dir(path: Path) -> None:
    """Ensure parent directory exists for the target path."""

    path.parent.mkdir(parents=True, exist_ok=True)


def read_parquet(path: Path, *, required_columns: Sequence[str] | None = None) -> pd.DataFrame:
    """Read parquet with optional required-column validation."""

    if not path.exists():
        raise StorageError(f"Parquet file not found: {path}")
    frame = pd.read_parquet(path)
    if required_columns:
        missing = [column for column in required_columns if column not in frame.columns]
        if missing:
            raise StorageError(
                f"Missing required columns in {path.name}: {', '.join(sorted(missing))}"
            )
    return frame


def write_parquet(frame: pd.DataFrame, path: Path, *, index: bool = False) -> Path:
    """Write DataFrame to parquet, creating parent directories if needed."""

    ensure_parent_dir(path)
    frame.to_parquet(path, index=index)
    return path


def read_json(path: Path) -> Any:
    """Read JSON payload from disk."""

    if not path.exists():
        raise StorageError(f"JSON file not found: {path}")
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(payload: Any, path: Path, *, indent: int = 2) -> Path:
    """Write JSON payload to disk."""

    ensure_parent_dir(path)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=indent, ensure_ascii=False)
    return path


__all__ = [
    "StorageError",
    "ensure_parent_dir",
    "read_parquet",
    "write_parquet",
    "read_json",
    "write_json",
]
