"""Export utilities for planning recommendations."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from src.common.storage import ensure_parent_dir


def export_recommendations_csv(recommendations: pd.DataFrame, output_path: Path) -> Path:
    """Write planner recommendations to CSV."""

    ensure_parent_dir(output_path)
    recommendations.to_csv(output_path, index=False)
    return output_path


__all__ = ["export_recommendations_csv"]
