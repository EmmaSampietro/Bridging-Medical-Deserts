"""Common utilities exposed via lazy imports."""

from __future__ import annotations

import importlib
from typing import Any

__all__ = [
    "AppConfig",
    "PathsConfig",
    "LoggingConfig",
    "ExperimentConfig",
    "DatastoreConfig",
    "LoggingSetupResult",
    "load_config",
    "setup_logging",
]

_CONFIG_EXPORTS = {
    "AppConfig",
    "PathsConfig",
    "LoggingConfig",
    "ExperimentConfig",
    "DatastoreConfig",
    "load_config",
}
_LOGGING_EXPORTS = {"LoggingSetupResult", "setup_logging"}


def __getattr__(name: str) -> Any:
    if name in _CONFIG_EXPORTS:
        module = importlib.import_module(".config", __name__)
        return getattr(module, name)
    if name in _LOGGING_EXPORTS:
        module = importlib.import_module(".logging", __name__)
        return getattr(module, name)
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")


def __dir__() -> list[str]:
    return sorted(set(globals().keys()) | set(__all__))
