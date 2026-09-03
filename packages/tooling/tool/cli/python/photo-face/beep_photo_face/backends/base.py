from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


class WorkerError(Exception):
    """A failure that is safe to expose through the worker protocol."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class WorkerArguments:
    source_dir: Path
    reference_dir: Path
    model_root: Path
    detection_threshold: float
    match_threshold: float
    review_threshold: float
    min_face_area_pct: float
    recursive: bool
    accept_model_license: bool
    backend: str = "buffalo-l"
    compute: str = "auto"
    devices: tuple[int, ...] = ()
    batch_size: int = 32
    threshold_source: str = "calibrated-default"
    detector_path: Path | None = None
    aligner_path: Path | None = None
    recognizer_path: Path | None = None


@dataclass(frozen=True)
class RuntimeSelection:
    requested_compute: str
    actual_compute: str
    device_ordinals: tuple[int, ...]
    runtime_devices: tuple[dict[str, Any], ...]
    warnings: tuple[dict[str, str], ...] = ()


@dataclass(frozen=True)
class LoadedBackend:
    analysis: Any
    align_face: Callable[..., Any]
    model: dict[str, Any]
    selection: RuntimeSelection
    artifacts: tuple[Path, ...] = field(default_factory=tuple)
