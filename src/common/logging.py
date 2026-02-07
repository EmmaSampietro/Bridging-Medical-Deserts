"""Structured logging setup + MLflow integration."""

from __future__ import annotations

import json
import logging
import logging.config
from dataclasses import dataclass
from datetime import datetime
from typing import Mapping, MutableMapping, Optional

from .config import AppConfig

_STANDARD_RECORD_KEYS = set(vars(logging.LogRecord("", 0, "", 0, "", (), None)))


class JsonFormatter(logging.Formatter):
    """Minimal JSON formatter for structured console output."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.utcfromtimestamp(record.created).isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            log_entry["exc_info"] = self.formatException(record.exc_info)
        if record.stack_info:
            log_entry["stack_info"] = self.formatStack(record.stack_info)
        if record.__dict__:
            extra = {
                key: value for key, value in record.__dict__.items() if key not in _STANDARD_RECORD_KEYS
            }
            if extra:
                log_entry["extra"] = extra
        return json.dumps(log_entry, default=str)


@dataclass
class LoggingSetupResult:
    logger: logging.Logger
    mlflow_run_id: Optional[str] = None


def _build_dict_config(cfg: AppConfig) -> MutableMapping[str, object]:
    formatter_name = "json" if cfg.logging.json_format else "standard"
    formatters = {
        "standard": {
            "format": cfg.logging.format,
            "datefmt": cfg.logging.datefmt,
        },
        "json": {
            "()": JsonFormatter,
        },
    }
    handlers = {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": formatter_name,
            "stream": "ext://sys.stdout",
        }
    }
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": formatters,
        "handlers": handlers,
        "root": {
            "handlers": ["console"],
            "level": cfg.logging.level,
        },
    }


def _init_mlflow(cfg: AppConfig, run_name: Optional[str], tags: Optional[Mapping[str, str]]) -> Optional[str]:
    tracking_uri = cfg.experiment.tracking_uri
    if not tracking_uri:
        return None
    try:
        import mlflow
    except ImportError:  # pragma: no cover - optional dependency
        logging.getLogger(cfg.logging.name).warning(
            "MLflow not installed; skipping tracking setup."
        )
        return None

    mlflow.set_tracking_uri(tracking_uri)
    active_run = mlflow.active_run()
    if active_run:
        run = active_run
    else:
        start_kwargs = {}
        if cfg.experiment.run_id:
            start_kwargs["run_id"] = cfg.experiment.run_id
        if run_name:
            start_kwargs["run_name"] = run_name
        run = mlflow.start_run(**start_kwargs)

    run_id = run.info.run_id
    if tags:
        mlflow.set_tags(dict(tags))
    if not cfg.experiment.run_id:
        cfg.experiment.run_id = run_id
    return run_id


def setup_logging(
    cfg: AppConfig,
    *,
    run_name: Optional[str] = None,
    mlflow_tags: Optional[Mapping[str, str]] = None,
) -> LoggingSetupResult:
    """
    Configure logging + optional MLflow and return the configured logger.

    Example:
        cfg = load_config()
        result = setup_logging(cfg, run_name=\"text2med\")
        logger = result.logger
    """

    dict_config = _build_dict_config(cfg)
    logging.config.dictConfig(dict_config)
    logger = logging.getLogger(cfg.logging.name)
    logger.debug("Logging configured", extra={"json": cfg.logging.json_format})

    run_id = _init_mlflow(cfg, run_name, mlflow_tags)
    if run_id:
        logger.info("MLflow run active", extra={"mlflow_run_id": run_id})

    return LoggingSetupResult(logger=logger, mlflow_run_id=run_id)


__all__ = ["setup_logging", "LoggingSetupResult"]
