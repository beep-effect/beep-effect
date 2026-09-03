from __future__ import annotations

import argparse
import contextlib
import errno
import hashlib
import importlib
import json
import math
import os
import shutil
import sys
import tempfile
import time
import traceback
import urllib.error
import urllib.request
import zipfile
from collections import Counter
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import TYPE_CHECKING, Any, BinaryIO, Iterator

from .backends.base import WorkerArguments, WorkerError
from .pipeline import load_selected_backend, parameters_payload
from .quality import (
    calculate_face_area_pct,
    calculate_quality_flags,
    clip_box,
    is_side_face,
)
from .scoring import (
    MatchScores,
    classify_disposition,
    normalize_embedding,
    normalized_centroid,
    score_embedding,
)

__all__ = [
    "MatchScores",
    "WorkerArguments",
    "WorkerError",
    "calculate_face_area_pct",
    "calculate_quality_flags",
    "classify_disposition",
    "clip_box",
    "is_side_face",
    "normalize_embedding",
    "normalized_centroid",
    "score_embedding",
]

# OpenCV reads this limit during module initialization and rejects oversized
# image headers before allocating the full decoded pixel buffer.
MAX_DECODED_PIXELS = 100_000_000
os.environ["OPENCV_IO_MAX_IMAGE_PIXELS"] = str(MAX_DECODED_PIXELS)
import cv2  # noqa: E402 - pixel limit must be configured before OpenCV import
import numpy as np  # noqa: E402 - imported with OpenCV after its process configuration

if TYPE_CHECKING:
    from numpy.typing import NDArray


SCHEMA_VERSION = "beep.files.match-person.worker.v3"
MAX_REFERENCE_IMAGES = 256
MAX_CANDIDATE_IMAGES = 10_000
MAX_FACES_PER_IMAGE = 32
MAX_REPORTED_FACES = 65_536
MAX_REPORT_BYTES = 64 * 1024 * 1024
MAX_DIAGNOSTIC_BYTES = 1024 * 1024
WORKER_LIMITS = {
    "referenceImages": MAX_REFERENCE_IMAGES,
    "candidateImages": MAX_CANDIDATE_IMAGES,
    "facesPerImage": MAX_FACES_PER_IMAGE,
    "reportedFaces": MAX_REPORTED_FACES,
    "reportBytes": MAX_REPORT_BYTES,
    "diagnosticBytes": MAX_DIAGNOSTIC_BYTES,
}
MODEL_NAME = "buffalo_l"
MODEL_RUNTIME_NAME = "beep_buffalo_l_v1"
MODEL_ARTIFACT_NAMES = ("det_10g.onnx", "w600k_r50.onnx")
MODEL_ARCHIVE_URL = (
    "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip"
)
MODEL_ARCHIVE_SHA256 = (
    "80ffe37d8a5940d59a7384c201a2a38d4741f2f3c51eef46ebb28218a7b0ca2f"
)
MODEL_ARTIFACT_SHA256 = {
    "det_10g.onnx": "5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91",
    "w600k_r50.onnx": "4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43",
}
MODEL_MANIFEST_NAME = "beep-model-manifest.json"
MODEL_LICENSE_URL = (
    "https://github.com/deepinsight/insightface/blob/master/server/LICENSING.md"
)
MAX_MODEL_ARCHIVE_BYTES = 400 * 1024 * 1024
MODEL_LOCK_RETRY_SECONDS = 0.1
ALLOWED_MODULES = ("detection", "recognition")
PROVIDERS = ("CPUExecutionProvider",)
SUPPORTED_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp"})


class WorkerArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        raise WorkerError("invalid-arguments", message)


def discover_images(
    directory: Path,
    recursive: bool,
    limit: int = MAX_CANDIDATE_IMAGES,
    label: str = "candidate",
) -> list[Path]:
    candidates = directory.rglob("*") if recursive else directory.iterdir()
    images: list[Path] = []
    for path in candidates:
        if (
            path.is_file()
            and not path.is_symlink()
            and path.suffix.lower() in SUPPORTED_EXTENSIONS
        ):
            images.append(path)
            if len(images) > limit:
                raise WorkerError(
                    "input-limit-exceeded",
                    f"{label} image count exceeds {limit}; split the scan into smaller batches",
                )
    return sorted(
        images,
        key=lambda path: (
            path.relative_to(directory).as_posix().casefold(),
            path.relative_to(directory).as_posix(),
        ),
    )


def round_number(value: float, digits: int = 6) -> float:
    number = float(value)
    if not math.isfinite(number):
        raise WorkerError(
            "non-finite-result", "model produced a non-finite numeric result"
        )
    return round(number, digits)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_arguments(argv: Sequence[str] | None = None) -> WorkerArguments:
    parser = WorkerArgumentParser(
        prog="python -m beep_photo_face",
        description="Match one person against local photos with a pinned local backend.",
    )
    parser.add_argument(
        "--candidates", "--source-dir", dest="source_dir", required=True, type=Path
    )
    parser.add_argument(
        "--references",
        "--reference-dir",
        dest="reference_dir",
        required=True,
        type=Path,
    )
    parser.add_argument("--model-root", required=True, type=Path)
    parser.add_argument(
        "--backend",
        choices=("buffalo-l", "adaface-kprpe"),
        default="buffalo-l",
    )
    parser.add_argument("--compute", choices=("auto", "cpu", "rocm"), default="auto")
    parser.add_argument(
        "--devices",
        help="Optional single ROCm device ordinal; inference uses at most one GPU.",
    )
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument(
        "--threshold-source",
        choices=("calibrated-default", "explicit"),
        default="calibrated-default",
    )
    parser.add_argument("--detector-path", type=Path)
    parser.add_argument("--aligner-path", type=Path)
    parser.add_argument("--recognizer-path", type=Path)
    parser.add_argument(
        "--detection-threshold",
        "--det-threshold",
        dest="det_threshold",
        type=float,
        default=0.60,
    )
    parser.add_argument("--match-threshold", type=float, default=0.50)
    parser.add_argument("--review-threshold", type=float, default=0.35)
    parser.add_argument("--min-face-area-pct", type=float, default=1.0)
    parser.add_argument(
        "--recursive", action=argparse.BooleanOptionalAction, default=False
    )
    parser.add_argument(
        "--accept-model-license",
        action=argparse.BooleanOptionalAction,
        default=False,
        help=(
            "Acknowledge that the caller reviewed the selected checkpoints' model and "
            "training-dataset terms; the flag does not grant or alter any rights."
        ),
    )
    namespace = parser.parse_args(argv)

    for name, value in (
        ("detection-threshold", namespace.det_threshold),
        ("match-threshold", namespace.match_threshold),
        ("review-threshold", namespace.review_threshold),
    ):
        if not math.isfinite(value) or not 0.0 <= value <= 1.0:
            raise WorkerError("invalid-arguments", f"--{name} must be between 0 and 1")
    if namespace.review_threshold > namespace.match_threshold:
        raise WorkerError(
            "invalid-arguments", "--review-threshold must not exceed --match-threshold"
        )
    if (
        not math.isfinite(namespace.min_face_area_pct)
        or not 0.0 <= namespace.min_face_area_pct <= 100.0
    ):
        raise WorkerError(
            "invalid-arguments", "--min-face-area-pct must be between 0 and 100"
        )
    if namespace.batch_size <= 0:
        raise WorkerError("invalid-arguments", "--batch-size must be greater than zero")
    devices: tuple[int, ...] = ()
    if namespace.devices is not None:
        value = namespace.devices.strip()
        if not value or "," in value:
            raise WorkerError(
                "invalid-arguments",
                "--devices must contain exactly one non-negative integer ordinal",
            )
        try:
            ordinal = int(value)
        except ValueError as error:
            raise WorkerError(
                "invalid-arguments",
                "--devices must contain exactly one non-negative integer ordinal",
            ) from error
        if ordinal < 0:
            raise WorkerError(
                "invalid-arguments",
                "--devices must contain exactly one non-negative integer ordinal",
            )
        devices = (ordinal,)
    if namespace.compute == "cpu" and devices:
        raise WorkerError(
            "invalid-arguments", "--devices cannot be used with --compute cpu"
        )
    if namespace.backend == "buffalo-l" and namespace.compute == "rocm":
        raise WorkerError("invalid-arguments", "buffalo-l supports only CPU inference")
    if namespace.backend == "buffalo-l" and devices:
        raise WorkerError(
            "invalid-arguments", "--devices is supported only by adaface-kprpe"
        )
    supplied_paths = (
        namespace.detector_path,
        namespace.aligner_path,
        namespace.recognizer_path,
    )
    if (namespace.aligner_path is None) != (namespace.recognizer_path is None):
        raise WorkerError(
            "invalid-arguments",
            "--aligner-path and --recognizer-path must be supplied together",
        )
    if namespace.backend == "buffalo-l" and any(
        path is not None for path in supplied_paths
    ):
        raise WorkerError(
            "invalid-arguments",
            "explicit component paths are supported only by adaface-kprpe",
        )

    source_dir = namespace.source_dir.expanduser().resolve()
    reference_dir = namespace.reference_dir.expanduser().resolve()
    model_root = namespace.model_root.expanduser().resolve()
    for label, directory in (("source", source_dir), ("reference", reference_dir)):
        if not directory.is_dir():
            raise WorkerError(
                "invalid-directory", f"{label} directory does not exist: {directory}"
            )
    if model_root.exists() and not model_root.is_dir():
        raise WorkerError(
            "invalid-directory", f"model root is not a directory: {model_root}"
        )

    return WorkerArguments(
        source_dir=source_dir,
        reference_dir=reference_dir,
        model_root=model_root,
        detection_threshold=namespace.det_threshold,
        match_threshold=namespace.match_threshold,
        review_threshold=namespace.review_threshold,
        min_face_area_pct=namespace.min_face_area_pct,
        recursive=namespace.recursive,
        accept_model_license=namespace.accept_model_license,
        backend=namespace.backend,
        compute=namespace.compute,
        devices=devices,
        batch_size=namespace.batch_size,
        threshold_source=namespace.threshold_source,
        detector_path=(
            namespace.detector_path.expanduser().absolute()
            if namespace.detector_path is not None
            else None
        ),
        aligner_path=(
            namespace.aligner_path.expanduser().absolute()
            if namespace.aligner_path is not None
            else None
        ),
        recognizer_path=(
            namespace.recognizer_path.expanduser().absolute()
            if namespace.recognizer_path is not None
            else None
        ),
    )


def model_artifact_paths(model_root: Path) -> list[Path]:
    model_directory = model_root / "models" / MODEL_RUNTIME_NAME
    return [model_directory / name for name in MODEL_ARTIFACT_NAMES]


def verify_model_artifacts(artifacts: Sequence[Path]) -> None:
    for artifact in artifacts:
        if artifact.is_symlink() or not artifact.is_file():
            raise WorkerError(
                "model-integrity-failed",
                f"required regular model artifact is missing: {artifact.name}",
            )
        expected = MODEL_ARTIFACT_SHA256[artifact.name]
        actual = sha256_file(artifact)
        if actual != expected:
            raise WorkerError(
                "model-integrity-failed",
                (
                    f"{artifact.name} SHA-256 mismatch: expected {expected}, got {actual}; "
                    "the model will not be loaded"
                ),
            )


def model_manifest_text() -> str:
    return (
        json.dumps(
            {
                "schemaVersion": "beep.photo-face.model-manifest.v1",
                "package": MODEL_NAME,
                "source": MODEL_ARCHIVE_URL,
                "archiveSha256": MODEL_ARCHIVE_SHA256,
                "artifacts": MODEL_ARTIFACT_SHA256,
                "license": MODEL_LICENSE_URL,
            },
            indent=2,
            sort_keys=True,
        )
        + "\n"
    )


def verify_runtime_model_directory(model_directory: Path) -> list[Path]:
    if model_directory.is_symlink() or not model_directory.is_dir():
        raise WorkerError(
            "model-integrity-failed",
            f"trusted model directory is missing or is a symlink: {model_directory}",
        )

    expected_names = {*MODEL_ARTIFACT_NAMES, MODEL_MANIFEST_NAME}
    entries = list(model_directory.iterdir())
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

    manifest_path = model_directory / MODEL_MANIFEST_NAME
    if manifest_path.read_text(encoding="utf-8") != model_manifest_text():
        raise WorkerError(
            "model-integrity-failed",
            f"{MODEL_MANIFEST_NAME} does not match the pinned model manifest",
        )

    artifacts = [model_directory / name for name in MODEL_ARTIFACT_NAMES]
    verify_model_artifacts(artifacts)
    return artifacts


def verify_model_archive(archive_path: Path) -> None:
    if archive_path.is_symlink() or not archive_path.is_file():
        raise WorkerError(
            "model-integrity-failed",
            f"model archive is missing or is a symlink: {archive_path}",
        )
    archive_sha256 = sha256_file(archive_path)
    if archive_sha256 != MODEL_ARCHIVE_SHA256:
        raise WorkerError(
            "model-integrity-failed",
            (
                f"buffalo_l.zip SHA-256 mismatch: expected {MODEL_ARCHIVE_SHA256}, "
                f"got {archive_sha256}; the archive was not extracted"
            ),
        )


def extract_verified_model_archive(archive_path: Path, model_directory: Path) -> None:
    verify_model_archive(archive_path)
    try:
        with zipfile.ZipFile(archive_path) as archive:
            infos = archive.infolist()
            for artifact_name in MODEL_ARTIFACT_NAMES:
                matches = [info for info in infos if info.filename == artifact_name]
                if len(matches) != 1 or matches[0].is_dir():
                    raise WorkerError(
                        "model-acquisition-incomplete",
                        (
                            "verified buffalo_l archive did not contain exactly one regular "
                            f"{artifact_name} entry"
                        ),
                    )
                info = matches[0]
                if info.file_size > MAX_MODEL_ARCHIVE_BYTES:
                    raise WorkerError(
                        "model-acquisition-incomplete",
                        f"{artifact_name} exceeds the decoded model-artifact size limit",
                    )
                destination = model_directory / artifact_name
                with archive.open(info) as source, destination.open("xb") as target:
                    shutil.copyfileobj(source, target, length=1024 * 1024)
    except zipfile.BadZipFile as error:
        raise WorkerError(
            "model-integrity-failed",
            "pinned buffalo_l archive is not a readable ZIP file",
        ) from error

    (model_directory / MODEL_MANIFEST_NAME).write_text(
        model_manifest_text(), encoding="utf-8"
    )
    verify_runtime_model_directory(model_directory)


def install_verified_model_archive(archive_path: Path, models_directory: Path) -> None:
    runtime_directory = models_directory / MODEL_RUNTIME_NAME
    if runtime_directory.exists() or runtime_directory.is_symlink():
        verify_runtime_model_directory(runtime_directory)
        return

    staged_directory = Path(
        tempfile.mkdtemp(prefix=f".{MODEL_RUNTIME_NAME}.", dir=models_directory)
    )
    try:
        extract_verified_model_archive(archive_path, staged_directory)
        # The staging directory lives beside its destination, so this is a single,
        # same-filesystem publish. The model is never visible in a partial state.
        os.rename(staged_directory, runtime_directory)
    except OSError as error:
        if runtime_directory.exists() and not runtime_directory.is_symlink():
            verify_runtime_model_directory(runtime_directory)
            return
        raise WorkerError(
            "model-acquisition-incomplete",
            f"could not atomically install the verified model: {error}",
        ) from error
    finally:
        if staged_directory.exists():
            shutil.rmtree(staged_directory)


def download_model_archive(destination: Path) -> None:
    request = urllib.request.Request(
        MODEL_ARCHIVE_URL,
        headers={"User-Agent": "beep-photo-face/1"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310
            content_length = response.headers.get("Content-Length")
            if (
                content_length is not None
                and int(content_length) > MAX_MODEL_ARCHIVE_BYTES
            ):
                raise WorkerError(
                    "model-acquisition-failed",
                    "buffalo_l archive exceeds the download size limit",
                )
            total = 0
            with destination.open("xb") as output:
                while chunk := response.read(1024 * 1024):
                    total += len(chunk)
                    if total > MAX_MODEL_ARCHIVE_BYTES:
                        raise WorkerError(
                            "model-acquisition-failed",
                            "buffalo_l archive exceeds the download size limit",
                        )
                    output.write(chunk)
    except (OSError, ValueError, urllib.error.URLError) as error:
        raise WorkerError(
            "model-acquisition-failed",
            f"could not download buffalo_l from its pinned release URL: {error}",
        ) from error


def _model_lock_backend(platform_name: str) -> tuple[bool, Any]:
    is_windows = platform_name == "nt"
    module_name = "msvcrt" if is_windows else "fcntl"
    return is_windows, importlib.import_module(module_name)


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
            time.sleep(MODEL_LOCK_RETRY_SECONDS)


@contextlib.contextmanager
def _exclusive_model_lock(
    lock_file: BinaryIO, lock_path: Path, platform_name: str
) -> Iterator[None]:
    try:
        is_windows, backend = _model_lock_backend(platform_name)
        if is_windows:
            _acquire_windows_file_lock(lock_file, backend)
        else:
            backend.flock(lock_file.fileno(), backend.LOCK_EX)
    except (ImportError, OSError) as error:
        raise WorkerError(
            "model-acquisition-failed",
            f"could not acquire the model acquisition lock {lock_path}: {error}",
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
                f"could not release the model acquisition lock {lock_path}: {error}",
            ) from error


@contextlib.contextmanager
def model_acquisition_lock(lock_path: Path) -> Iterator[None]:
    try:
        lock_file = lock_path.open("a+b")
    except OSError as error:
        raise WorkerError(
            "model-acquisition-failed",
            f"could not open the model acquisition lock {lock_path}: {error}",
        ) from error

    with lock_file:
        with _exclusive_model_lock(lock_file, lock_path, os.name):
            yield


def ensure_model_available(arguments: WorkerArguments) -> list[Path]:
    runtime_directory = arguments.model_root / "models" / MODEL_RUNTIME_NAME
    if runtime_directory.exists() or runtime_directory.is_symlink():
        return verify_runtime_model_directory(runtime_directory)
    if not arguments.accept_model_license:
        raise WorkerError(
            "model-license-not-accepted",
            (
                "buffalo_l is not installed. Pass --accept-model-license only after reviewing "
                "the InsightFace pretrained-model terms. The flag records acknowledgment "
                "only and does not grant or alter rights; no model was downloaded."
            ),
        )

    print(
        f"[photo-face] acquiring InsightFace {MODEL_NAME} in {arguments.model_root}",
        file=sys.stderr,
    )
    models_directory = arguments.model_root / "models"
    models_directory.mkdir(parents=True, exist_ok=True)
    lock_path = models_directory / f".{MODEL_RUNTIME_NAME}.lock"
    with model_acquisition_lock(lock_path):
        if runtime_directory.exists() or runtime_directory.is_symlink():
            return verify_runtime_model_directory(runtime_directory)

        archive_path = models_directory / f"{MODEL_NAME}.zip"
        if archive_path.exists() or archive_path.is_symlink():
            verify_model_archive(archive_path)
        else:
            descriptor, temporary_name = tempfile.mkstemp(
                prefix=f".{MODEL_NAME}.", suffix=".zip", dir=models_directory
            )
            os.close(descriptor)
            temporary_archive = Path(temporary_name)
            temporary_archive.unlink()
            try:
                download_model_archive(temporary_archive)
                verify_model_archive(temporary_archive)
                os.rename(temporary_archive, archive_path)
            finally:
                temporary_archive.unlink(missing_ok=True)

        install_verified_model_archive(archive_path, models_directory)
        return verify_runtime_model_directory(runtime_directory)


def load_face_analysis(
    arguments: WorkerArguments, artifacts: Sequence[Path]
) -> tuple[Any, str, Callable[..., NDArray[np.uint8]]]:
    import insightface
    from insightface.app import FaceAnalysis
    from insightface.utils.face_align import norm_crop

    print("[photo-face] loading buffalo_l with CPUExecutionProvider", file=sys.stderr)
    analysis = FaceAnalysis(
        name=MODEL_RUNTIME_NAME,
        root=str(arguments.model_root),
        allowed_modules=list(ALLOWED_MODULES),
        providers=list(PROVIDERS),
    )
    analysis.prepare(ctx_id=-1, det_thresh=arguments.detection_threshold)
    missing_modules = [
        module for module in ALLOWED_MODULES if module not in analysis.models
    ]
    if missing_modules:
        raise WorkerError(
            "model-module-missing",
            f"buffalo_l did not provide required modules: {', '.join(missing_modules)}",
        )
    expected_model_files = {
        "detection": artifacts[0].resolve(),
        "recognition": artifacts[1].resolve(),
    }
    for module in ALLOWED_MODULES:
        model_file = getattr(analysis.models[module], "model_file", None)
        if (
            model_file is None
            or Path(model_file).resolve() != expected_model_files[module]
        ):
            raise WorkerError(
                "unexpected-model-artifact",
                (
                    f"{module} initialized from {model_file!r}, expected "
                    f"{str(expected_model_files[module])!r}"
                ),
            )
        actual_providers = tuple(analysis.models[module].session.get_providers())
        if actual_providers != PROVIDERS:
            raise WorkerError(
                "unexpected-execution-provider",
                f"{module} initialized with providers {actual_providers!r}, expected {PROVIDERS!r}",
            )
    return analysis, str(insightface.__version__), norm_crop


def read_image(path: Path) -> NDArray[np.uint8] | None:
    try:
        image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    except cv2.error as error:
        print(
            f"[photo-face] rejected unreadable or oversized image {path.name}: {error}",
            file=sys.stderr,
        )
        return None
    if image is None or image.size == 0:
        return None
    if int(image.shape[0]) * int(image.shape[1]) > MAX_DECODED_PIXELS:
        print(
            f"[photo-face] rejected image over decoded-pixel limit: {path.name}",
            file=sys.stderr,
        )
        return None
    return image


def sorted_faces(analysis: Any, image: NDArray[np.uint8]) -> list[Any]:
    faces = list(analysis.get(image))
    if len(faces) > MAX_FACES_PER_IMAGE:
        raise WorkerError(
            "input-limit-exceeded",
            (
                f"detected face count exceeds {MAX_FACES_PER_IMAGE} for one image; "
                "split the scan or use images with fewer faces"
            ),
        )
    return sorted(
        faces,
        key=lambda face: (
            float(face.bbox[1]),
            float(face.bbox[0]),
            float(face.bbox[3]),
            float(face.bbox[2]),
            -float(face.det_score),
        ),
    )


def collect_references(
    analysis: Any, paths: Sequence[Path]
) -> tuple[list[dict[str, Any]], list[NDArray[np.float32]], list[str]]:
    entries: list[dict[str, Any]] = []
    embeddings: list[NDArray[np.float32]] = []
    names: list[str] = []
    total = len(paths)
    for index, path in enumerate(paths, start=1):
        print(f"[photo-face] reference {index}/{total}: {path.name}", file=sys.stderr)
        entry: dict[str, Any] = {
            "sourceName": path.name,
            "sourcePath": str(path),
            "accepted": False,
            "faceCount": 0,
        }
        image = read_image(path)
        if image is None:
            entry["reason"] = "unreadable-image"
            entries.append(entry)
            continue

        try:
            faces = sorted_faces(analysis, image)
        except WorkerError as error:
            if error.code != "aligner-confidence-failed":
                raise
            print(
                f"[photo-face] {error.code}: {path.name}: {error.message}",
                file=sys.stderr,
            )
            entry["reason"] = "aligner-confidence-failed"
            entries.append(entry)
            continue
        aligner_rejections = [
            face
            for face in faces
            if getattr(face, "embedding_reason", None) == "aligner-confidence-failed"
        ]
        if aligner_rejections:
            minimum = min(
                float(getattr(face, "aligner_confidence", 0.0))
                for face in aligner_rejections
            )
            print(
                (
                    f"[photo-face] aligner-confidence-failed: {path.name}: "
                    f"rejected {len(aligner_rejections)}/{len(faces)} detected faces; "
                    f"minimum={minimum:.6f}"
                ),
                file=sys.stderr,
            )
            entry["reason"] = "aligner-confidence-failed"
            entries.append(entry)
            continue
        entry["faceCount"] = len(faces)
        if len(faces) == 1:
            entry["detectionScore"] = round_number(float(faces[0].det_score))
        if not faces:
            entry["reason"] = "no-face"
        elif len(faces) != 1:
            entry["reason"] = "multiple-faces"
        elif faces[0].embedding is None:
            entry["reason"] = "missing-embedding"
        else:
            try:
                embedding = normalize_embedding(faces[0].embedding)
            except ValueError:
                entry["reason"] = "invalid-embedding"
            else:
                entry["accepted"] = True
                embeddings.append(embedding)
                names.append(path.name)
        entries.append(entry)
    return entries, embeddings, names


def validate_unique_recursive_reference_names(
    reference_names: Sequence[str], recursive: bool
) -> None:
    if recursive and len(set(reference_names)) != len(reference_names):
        raise WorkerError(
            "invalid-arguments",
            (
                "Recursive person-match references contain duplicate accepted file names. "
                "Rename references so face evidence remains unambiguous."
            ),
        )


def candidate_entry(
    analysis: Any,
    path: Path,
    source_root: Path,
    reference_embeddings: NDArray[np.float32],
    reference_centroid: NDArray[np.float32],
    reference_names: Sequence[str],
    arguments: WorkerArguments,
    align_face: Callable[..., NDArray[np.uint8]],
) -> dict[str, Any]:
    base: dict[str, Any] = {
        "sourceName": path.name,
        "sourcePath": str(path),
        "relativePath": path.relative_to(source_root).as_posix(),
    }
    image = read_image(path)
    if image is None:
        return {
            **base,
            "disposition": "unreadable",
            "faceCount": 0,
            "faces": [],
            "reason": "image-decode-failed",
        }

    try:
        detected_faces = sorted_faces(analysis, image)
    except WorkerError as error:
        if error.code != "aligner-confidence-failed":
            raise
        print(
            f"[photo-face] {error.code}: {path.name}: {error.message}",
            file=sys.stderr,
        )
        return {
            **base,
            "disposition": "no-face",
            "faceCount": 0,
            "faces": [],
            "reason": "aligner-confidence-failed",
        }
    aligner_rejections = [
        face
        for face in detected_faces
        if getattr(face, "embedding_reason", None) == "aligner-confidence-failed"
    ]
    comparable_faces = [
        face
        for face in detected_faces
        if getattr(face, "embedding_reason", None) != "aligner-confidence-failed"
    ]
    if aligner_rejections:
        minimum = min(
            float(getattr(face, "aligner_confidence", 0.0))
            for face in aligner_rejections
        )
        print(
            (
                f"[photo-face] aligner-confidence-failed: {path.name}: rejected "
                f"{len(aligner_rejections)}/{len(detected_faces)} detected faces; "
                f"minimum={minimum:.6f}"
            ),
            file=sys.stderr,
        )
        if not comparable_faces:
            return {
                **base,
                "disposition": "no-face",
                "faceCount": 0,
                "faces": [],
                "reason": "aligner-confidence-failed",
            }
    image_height, image_width = image.shape[:2]
    face_entries: list[dict[str, Any]] = []
    scores: list[float] = []
    quality_flags_by_face: list[list[str]] = []
    for face in comparable_faces:
        if face.embedding is None:
            raise WorkerError(
                "missing-embedding", f"recognition produced no embedding for {path}"
            )
        landmarks = np.asarray(face.kps, dtype=np.float32)
        if landmarks.shape != (5, 2):
            raise WorkerError(
                "missing-landmarks",
                f"detection produced no five-point landmarks for {path}",
            )
        result = score_embedding(
            face.embedding,
            reference_embeddings,
            reference_centroid,
            reference_names,
        )
        flags, area_pct = calculate_quality_flags(
            image,
            face.bbox,
            landmarks,
            arguments.min_face_area_pct,
            align_face,
        )
        x1, y1, x2, y2 = clip_box(face.bbox, image_width, image_height)
        face_entry = {
            "box": {
                "x1": round_number(x1, 3),
                "y1": round_number(y1, 3),
                "x2": round_number(x2, 3),
                "y2": round_number(y2, 3),
            },
            "detectionScore": round_number(float(face.det_score)),
            "faceAreaPct": round_number(area_pct),
            "matchScore": round_number(result.match_score),
            "centroidScore": round_number(result.centroid_score),
            "top3MedianScore": round_number(result.top3_median_score),
            "bestReferenceScore": round_number(result.best_reference_score),
            "bestReferenceName": result.best_reference_name,
            "qualityFlags": flags,
        }
        face_entries.append(face_entry)
        scores.append(result.match_score)
        quality_flags_by_face.append(flags)

    disposition = (
        "review"
        if aligner_rejections
        else classify_disposition(
            scores,
            quality_flags_by_face,
            arguments.match_threshold,
            arguments.review_threshold,
        )
    )
    entry = {
        **base,
        "disposition": disposition,
        "faceCount": len(face_entries),
        "faces": face_entries,
    }
    if scores:
        entry["bestScore"] = round_number(max(scores))
    if aligner_rejections:
        entry["reason"] = "aligner-confidence-failed"
    return entry


def build_summary(
    references: Sequence[dict[str, Any]], entries: Sequence[dict[str, Any]]
) -> dict[str, int]:
    counts = Counter(entry["disposition"] for entry in entries)
    accepted_references = sum(1 for reference in references if reference["accepted"])
    return {
        "totalCount": len(entries),
        "soloMatchCount": counts["solo-match"],
        "groupMatchCount": counts["group-match"],
        "lowQualityMatchCount": counts["low-quality-match"],
        "reviewCount": counts["review"],
        "noMatchCount": counts["no-match"],
        "noFaceCount": counts["no-face"],
        "unreadableCount": counts["unreadable"],
        "acceptedReferenceCount": accepted_references,
        "rejectedReferenceCount": len(references) - accepted_references,
    }


def run_worker(arguments: WorkerArguments, started_at: float) -> dict[str, Any]:
    reference_paths = discover_images(
        arguments.reference_dir,
        arguments.recursive,
        MAX_REFERENCE_IMAGES,
        "reference",
    )
    source_paths = discover_images(
        arguments.source_dir,
        arguments.recursive,
        MAX_CANDIDATE_IMAGES,
        "candidate",
    )
    if not reference_paths:
        raise WorkerError(
            "no-reference-images",
            "reference directory contains no supported jpg, jpeg, png, or webp images",
        )

    if not arguments.accept_model_license:
        raise WorkerError(
            "model-license-not-accepted",
            (
                "Pass --accept-model-license only after reviewing the selected checkpoints' "
                "model and training-dataset terms. The flag records acknowledgment only and "
                "does not grant or alter rights; no model was loaded."
            ),
        )

    loaded = load_selected_backend(
        arguments,
        ensure_model_available,
        load_face_analysis,
    )
    analysis = loaded.analysis
    align_face = loaded.align_face
    references, reference_vectors, reference_names = collect_references(
        analysis, reference_paths
    )
    reported_face_count = sum(int(reference["faceCount"]) for reference in references)
    if reported_face_count > MAX_REPORTED_FACES:
        raise WorkerError(
            "input-limit-exceeded",
            (
                f"reported face count exceeds {MAX_REPORTED_FACES}; "
                "split the scan into smaller batches"
            ),
        )
    validate_unique_recursive_reference_names(reference_names, arguments.recursive)
    if not reference_vectors:
        raise WorkerError(
            "no-accepted-references",
            "no reference image contained exactly one detectable face with a valid embedding",
        )

    reference_embeddings = np.stack(reference_vectors).astype(np.float32, copy=False)
    centroid = normalized_centroid(reference_embeddings)
    entries: list[dict[str, Any]] = []
    total = len(source_paths)
    for index, path in enumerate(source_paths, start=1):
        print(f"[photo-face] candidate {index}/{total}: {path.name}", file=sys.stderr)
        entry = candidate_entry(
            analysis,
            path,
            arguments.source_dir,
            reference_embeddings,
            centroid,
            reference_names,
            arguments,
            align_face,
        )
        reported_face_count += int(entry["faceCount"])
        if reported_face_count > MAX_REPORTED_FACES:
            raise WorkerError(
                "input-limit-exceeded",
                (
                    f"reported face count exceeds {MAX_REPORTED_FACES}; "
                    "split the scan into smaller batches"
                ),
            )
        entries.append(entry)

    return {
        "schemaVersion": SCHEMA_VERSION,
        "ok": True,
        "limits": WORKER_LIMITS,
        "model": loaded.model,
        "parameters": parameters_payload(arguments, loaded.selection),
        "references": references,
        "entries": entries,
        "summary": build_summary(references, entries),
        "elapsedSeconds": round_number(time.perf_counter() - started_at, 3),
    }


def failure_payload(error: WorkerError, started_at: float) -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "ok": False,
        "limits": WORKER_LIMITS,
        "error": {"code": error.code, "message": error.message},
        "elapsedSeconds": round(time.perf_counter() - started_at, 3),
    }


class BoundedDiagnosticWriter:
    def __init__(self, target: Any, max_bytes: int) -> None:
        self.target = target
        self.remaining = max_bytes

    def write(self, text: str) -> int:
        encoded = text.encode("utf-8")
        if self.remaining <= 0:
            return len(text)
        retained = encoded[: self.remaining]
        self.remaining -= len(retained)
        self.target.write(retained.decode("utf-8", errors="ignore"))
        return len(text)

    def flush(self) -> None:
        self.target.flush()


def encode_payload(payload: dict[str, Any]) -> str:
    chunks: list[str] = []
    encoded_bytes = 0
    max_payload_bytes = MAX_REPORT_BYTES - len("\n".encode("utf-8"))
    encoder = json.JSONEncoder(
        ensure_ascii=False, separators=(",", ":"), allow_nan=False
    )
    for chunk in encoder.iterencode(payload):
        encoded_bytes += len(chunk.encode("utf-8"))
        if encoded_bytes > max_payload_bytes:
            raise WorkerError(
                "report-limit-exceeded",
                (
                    f"framed worker JSON exceeds {MAX_REPORT_BYTES} bytes; "
                    "split the scan into smaller batches"
                ),
            )
        chunks.append(chunk)
    return "".join(chunks)


def main(argv: Sequence[str] | None = None) -> int:
    started_at = time.perf_counter()
    exit_code = 0
    diagnostics = BoundedDiagnosticWriter(sys.stderr, MAX_DIAGNOSTIC_BYTES)
    with contextlib.redirect_stderr(diagnostics):
        try:
            arguments = parse_arguments(argv)
            with contextlib.redirect_stdout(diagnostics):
                payload = run_worker(arguments, started_at)
        except WorkerError as error:
            print(f"[photo-face] {error.code}: {error.message}", file=sys.stderr)
            payload = failure_payload(error, started_at)
            exit_code = 2
        except Exception as error:  # noqa: BLE001  # pragma: no cover - process boundary
            print("[photo-face] unexpected worker failure", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            payload = failure_payload(
                WorkerError("worker-failed", f"{type(error).__name__}: {error}"),
                started_at,
            )
            exit_code = 1

        try:
            encoded_payload = encode_payload(payload)
        except WorkerError as error:
            print(f"[photo-face] {error.code}: {error.message}", file=sys.stderr)
            encoded_payload = encode_payload(failure_payload(error, started_at))
            exit_code = 2

    sys.stdout.write(encoded_payload)
    sys.stdout.write("\n")
    sys.stdout.flush()
    return exit_code
