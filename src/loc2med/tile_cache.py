"""Simple filesystem cache for map overlays and derived payloads."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from src.common.storage import ensure_parent_dir


def _cache_name(key: str) -> str:
    digest = hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]
    return f"{digest}.json"


class TileCache:
    """Persist/retrieve JSON map artifacts under outputs/tiles."""

    def __init__(self, cache_dir: Path) -> None:
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def path_for_key(self, key: str) -> Path:
        return self.cache_dir / _cache_name(key)

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        path = self.path_for_key(key)
        if not path.exists():
            return None
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def set(self, key: str, payload: Dict[str, Any]) -> Path:
        path = self.path_for_key(key)
        ensure_parent_dir(path)
        with path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
        return path

    def get_or_build(self, key: str, builder: Callable[[], Dict[str, Any]]) -> Dict[str, Any]:
        cached = self.get(key)
        if cached is not None:
            return cached
        payload = builder()
        self.set(key, payload)
        return payload


__all__ = ["TileCache"]
