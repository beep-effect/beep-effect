from __future__ import annotations

import contextlib
import errno
import hashlib
import importlib
import json
import os
import shutil
import sys
import tempfile
import time
import urllib.error
import urllib.request
from collections.abc import Iterator
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, BinaryIO

from .backends.base import WorkerError

LOCK_RETRY_SECONDS = 0.1
MANIFEST_NAME = "beep-artifact-manifest.json"


@dataclass(frozen=True)
class ArtifactDescriptor:
    role: str
    component_name: str
    repository: str
    revision: str
    source: str
    license_notice: str
    artifact_name: str
    size_bytes: int
    sha256: str

    @property
    def runtime_name(self) -> str:
        return f"{self.role}-{self.revision[:12]}"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_pinned_file(path: Path, descriptor: ArtifactDescriptor) -> Path:
    if path.is_symlink() or not path.is_file():
        raise WorkerError(
            "model-integrity-failed",
            f"required regular {descriptor.role} artifact is missing: {path}",
        )
    actual_size = path.stat().st_size
    if actual_size != descriptor.size_bytes:
        raise WorkerError(
            "model-integrity-failed",
            (
                f"{descriptor.role} size mismatch: expected {descriptor.size_bytes}, "
                f"got {actual_size}; the model will not be loaded"
            ),
        )
    actual_hash = sha256_file(path)
    if actual_hash != descriptor.sha256:
        raise WorkerError(
            "model-integrity-failed",
            (
                f"{descriptor.role} SHA-256 mismatch: expected {descriptor.sha256}, "
                f"got {actual_hash}; the model will not be loaded"
            ),
        )
    return path


def artifact_payload(path: Path, descriptor: ArtifactDescriptor) -> dict[str, Any]:
    verify_pinned_file(path, descriptor)
    return {
        "name": descriptor.artifact_name,
        "path": str(path),
        "sizeBytes": descriptor.size_bytes,
        "sha256": descriptor.sha256,
    }


def component_payload(path: Path, descriptor: ArtifactDescriptor) -> dict[str, Any]:
    return {
        "role": descriptor.role,
        "name": descriptor.component_name,
        "revision": descriptor.revision,
        "source": descriptor.source,
        "licenseNotice": descriptor.license_notice,
        "artifacts": [artifact_payload(path, descriptor)],
    }


def _manifest_text(descriptor: ArtifactDescriptor) -> str:
    return (
        json.dumps(
            {
                "schemaVersion": "beep.photo-face.artifact-manifest.v1",
                **asdict(descriptor),
            },
            indent=2,
            sort_keys=True,
        )
        + "\n"
    )


def _model_lock_backend(platform_name: str) -> tuple[bool, Any]:
    is_windows = platform_name == "nt"
    return is_windows, importlib.import_module("msvcrt" if is_windows else "fcntl")


def _windows_lock_is_contended(error: OSError) -> bool:
    return error.errno in {errno.EACCES, errno.EAGAIN, errno.EDEADLK} or getattr(
        error, "winerror", None
    ) in {33, 36}


def _acquire_windows_file_lock(lock_file: BinaryIO, backend: Any) -> None:
    lock_file.seek(0, os.SEEK_END)
    if lock_file.tell() == 0:
        lock_file.write(b"\0")
        lock_file.flush()
    while True:
        lock_file.seek(0)
        try:
            backend.locking(lock_file.fileno(), backend.LK_NBLCK, 1)
            return
        except OSError as error:
            if not _windows_lock_is_contended(error):
                raise
            time.sleep(LOCK_RETRY_SECONDS)


@contextlib.contextmanager
def artifact_lock(lock_path: Path) -> Iterator[None]:
    try:
        lock_file = lock_path.open("a+b")
    except OSError as error:
        raise WorkerError(
            "model-acquisition-failed",
            f"could not open model artifact lock {lock_path}: {error}",
        ) from error
    with lock_file:
        try:
            is_windows, backend = _model_lock_backend(os.name)
            if is_windows:
                _acquire_windows_file_lock(lock_file, backend)
            else:
                backend.flock(lock_file.fileno(), backend.LOCK_EX)
        except (ImportError, OSError) as error:
            raise WorkerError(
                "model-acquisition-failed",
                f"could not acquire model artifact lock {lock_path}: {error}",
            ) from error
        try:
            yield
        finally:
            try:
                if is_windows:
                    lock_file.seek(0)
                    backend.locking(lock_file.fileno(), backend.LK_UNLCK, 1)
                else:
                    backend.flock(lock_file.fileno(), backend.LOCK_UN)
            except OSError as error:
                raise WorkerError(
                    "model-acquisition-failed",
                    f"could not release model artifact lock {lock_path}: {error}",
                ) from error


def _verify_runtime_directory(directory: Path, descriptor: ArtifactDescriptor) -> Path:
    if directory.is_symlink() or not directory.is_dir():
        raise WorkerError(
            "model-integrity-failed",
            f"trusted model directory is missing or is a symlink: {directory}",
        )
    expected_names = {descriptor.artifact_name, MANIFEST_NAME}
    entries = list(directory.iterdir())
    actual_names = {entry.name for entry in entries}
    if actual_names != expected_names or any(
        entry.is_symlink() or not entry.is_file() for entry in entries
    ):
        raise WorkerError(
            "model-integrity-failed",
            (
                f"trusted model directory must contain exactly {sorted(expected_names)!r}; "
                f"found {sorted(actual_names)!r}"
            ),
        )
    if (directory / MANIFEST_NAME).read_text(encoding="utf-8") != _manifest_text(
        descriptor
    ):
        raise WorkerError(
            "model-integrity-failed", "artifact manifest does not match its pin"
        )
    return verify_pinned_file(directory / descriptor.artifact_name, descriptor)


def _download_pinned_artifact(
    destination: Path, descriptor: ArtifactDescriptor
) -> None:
    request = urllib.request.Request(
        descriptor.source, headers={"User-Agent": "beep-photo-face/2"}
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310
            content_length = response.headers.get("Content-Length")
            if (
                content_length is not None
                and int(content_length) != descriptor.size_bytes
            ):
                raise WorkerError(
                    "model-acquisition-failed",
                    (
                        f"{descriptor.role} content length did not match the pinned size: "
                        f"expected {descriptor.size_bytes}, got {content_length}"
                    ),
                )
            total = 0
            with destination.open("xb") as output:
                while chunk := response.read(1024 * 1024):
                    total += len(chunk)
                    if total > descriptor.size_bytes:
                        raise WorkerError(
                            "model-acquisition-failed",
                            f"{descriptor.role} download exceeded its pinned size",
                        )
                    output.write(chunk)
        verify_pinned_file(destination, descriptor)
    except WorkerError:
        raise
    except (OSError, ValueError, urllib.error.URLError) as error:
        raise WorkerError(
            "model-acquisition-failed",
            f"could not download pinned {descriptor.role} artifact: {error}",
        ) from error


def ensure_pinned_artifact(
    model_root: Path,
    descriptor: ArtifactDescriptor,
    accept_model_license: bool,
) -> Path:
    runtime_directory = (
        model_root / "models" / "adaface-kprpe" / descriptor.runtime_name
    )
    if runtime_directory.exists() or runtime_directory.is_symlink():
        return _verify_runtime_directory(runtime_directory, descriptor)
    if not accept_model_license:
        raise WorkerError(
            "model-license-not-accepted",
            (
                f"{descriptor.component_name} is not installed. Pass "
                "--accept-model-license only after reviewing the checkpoint's upstream "
                "dataset and model terms. The flag records acknowledgment only and does "
                "not grant or alter rights; no model was downloaded."
            ),
        )

    parent = runtime_directory.parent
    parent.mkdir(parents=True, exist_ok=True)
    lock_path = parent / f".{descriptor.runtime_name}.lock"
    with artifact_lock(lock_path):
        if runtime_directory.exists() or runtime_directory.is_symlink():
            return _verify_runtime_directory(runtime_directory, descriptor)
        print(
            f"[photo-face] acquiring pinned {descriptor.role} {descriptor.component_name}",
            file=sys.stderr,
        )
        staged = Path(
            tempfile.mkdtemp(prefix=f".{descriptor.runtime_name}.", dir=parent)
        )
        try:
            artifact = staged / descriptor.artifact_name
            _download_pinned_artifact(artifact, descriptor)
            (staged / MANIFEST_NAME).write_text(
                _manifest_text(descriptor), encoding="utf-8"
            )
            _verify_runtime_directory(staged, descriptor)
            os.rename(staged, runtime_directory)
        except OSError as error:
            if runtime_directory.exists() and not runtime_directory.is_symlink():
                return _verify_runtime_directory(runtime_directory, descriptor)
            raise WorkerError(
                "model-acquisition-failed",
                f"could not atomically publish pinned {descriptor.role}: {error}",
            ) from error
        finally:
            if staged.exists():
                shutil.rmtree(staged)
    return _verify_runtime_directory(runtime_directory, descriptor)
