"""Centralized config loading with Hydra-style overrides + Pydantic validation."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable, List, Mapping, MutableMapping, Optional, Sequence, Union

from omegaconf import OmegaConf
from pydantic import BaseModel, ConfigDict, Field

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CONFIG_ROOT = PROJECT_ROOT / "config"
BASE_CONFIG_PATH = CONFIG_ROOT / "base.yaml"
ENV_VAR_CONFIG_NAME = "BMD_CONFIG_NAME"


class PathsConfig(BaseModel):
    """Filesystem layout for data + outputs."""

    model_config = ConfigDict(extra="allow")

    data_raw: Path
    data_interim: Path
    data_processed: Path
    data_external: Path
    outputs_reports: Path
    outputs_traces: Path
    outputs_tiles: Path

    def resolved(self, base_dir: Path) -> "PathsConfig":
        def _resolve(value: Path) -> Path:
            return value if value.is_absolute() else (base_dir / value).resolve()

        resolved_fields = {f: _resolve(getattr(self, f)) for f in self.model_fields}
        return type(self)(**resolved_fields)


class LoggingConfig(BaseModel):
    """Runtime logging preferences."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    level: str = "INFO"
    format: str = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    datefmt: Optional[str] = None
    json_format: bool = Field(False, alias="json")
    name: str = "bridging_medical_deserts"


class ExperimentConfig(BaseModel):
    model_config = ConfigDict(extra="allow")

    tracking_uri: Optional[str] = None
    run_id: Optional[str] = None


class DatastoreConfig(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: str = Field("local", pattern="^(local|databricks)$")
    base_uri: str = "."


class AppConfig(BaseModel):
    """Top-level validated configuration object."""

    model_config = ConfigDict(extra="allow")

    paths: PathsConfig
    logging: LoggingConfig
    experiment: ExperimentConfig
    datastore: DatastoreConfig


class ConfigLoaderError(RuntimeError):
    """Raised when config files are missing or malformed."""


def _ensure_exists(path: Path) -> None:
    if not path.exists():
        raise ConfigLoaderError(f"Config file not found: {path}")


def _as_tuple(overrides: Optional[Sequence[str]]) -> tuple[str, ...]:
    if not overrides:
        return tuple()
    return tuple(overrides)


def _load_omegaconf(path: Path) -> Any:
    _ensure_exists(path)
    return OmegaConf.load(path)


def _resolve_config_paths(names: Sequence[str]) -> List[Path]:
    if not names:
        return []
    resolved: List[Path] = []
    for name in names:
        rel = Path(name)
        rel = rel.with_suffix(".yaml") if rel.suffix == "" else rel
        candidate = CONFIG_ROOT / rel
        _ensure_exists(candidate)
        resolved.append(candidate)
    return resolved


def _merge_confs(base_conf: Any, overlays: Sequence[Any]) -> Any:
    cfg = base_conf
    for overlay in overlays:
        cfg = OmegaConf.merge(cfg, overlay)
    return cfg


def _resolve_paths(app_cfg: AppConfig) -> AppConfig:
    app_cfg.paths = app_cfg.paths.resolved(PROJECT_ROOT)
    return app_cfg


def _apply_overrides(cfg: Any, overrides: Sequence[str]) -> Any:
    if not overrides:
        return cfg
    override_conf = OmegaConf.from_dotlist(list(overrides))
    return OmegaConf.merge(cfg, override_conf)


def _default_config_names(config_name: Optional[Union[str, Sequence[str]]]) -> List[str]:
    env_value = os.getenv(ENV_VAR_CONFIG_NAME)
    target = config_name or env_value
    if target is None:
        return []
    if isinstance(target, str):
        return [target]
    return list(target)


@lru_cache(maxsize=16)
def _load_config_internal(
    config_name_key: str, overrides_key: tuple[str, ...]
) -> AppConfig:
    """Internal cached loader keyed by config target + overrides tuple."""

    base = _load_omegaconf(BASE_CONFIG_PATH)
    overlay_names = [name for name in config_name_key.split(",") if name]
    overlay_paths = _resolve_config_paths(overlay_names)
    overlays = [_load_omegaconf(path) for path in overlay_paths]
    merged = _merge_confs(base, overlays)
    merged = _apply_overrides(merged, list(overrides_key))

    cfg_dict = OmegaConf.to_container(merged, resolve=True)  # type: ignore[arg-type]
    app_cfg = AppConfig(**cfg_dict)
    return _resolve_paths(app_cfg)


def load_config(
    config_name: Optional[Union[str, Sequence[str]]] = None,
    overrides: Optional[Sequence[str]] = None,
    *,
    reload: bool = False,
) -> AppConfig:
    """Public helper resembling Hydra compose() but script-friendly."""

    names = _default_config_names(config_name)
    name_key = ",".join(names)
    overrides_key = _as_tuple(overrides)

    if reload:
        _load_config_internal.cache_clear()

    cfg = _load_config_internal(name_key, overrides_key)
    return cfg


__all__ = [
    "AppConfig",
    "PathsConfig",
    "LoggingConfig",
    "ExperimentConfig",
    "DatastoreConfig",
    "load_config",
    "PROJECT_ROOT",
    "CONFIG_ROOT",
]
