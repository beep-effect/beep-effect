from __future__ import annotations

import contextlib
from dataclasses import replace
import errno
import hashlib
import io
import json
from pathlib import Path
import time
from types import SimpleNamespace
import zipfile

import numpy as np
import pytest

import beep_photo_face.worker as worker
from beep_photo_face.worker import (
    candidate_entry,
    calculate_face_area_pct,
    classify_disposition,
    discover_images,
    install_verified_model_archive,
    is_side_face,
    main,
    normalize_embedding,
    normalized_centroid,
    run_worker,
    score_embedding,
    verify_runtime_model_directory,
    verify_model_artifacts,
    WorkerArguments,
    WorkerError,
)


def test_normalize_embedding_returns_unit_vector() -> None:
    result = normalize_embedding([3.0, 4.0])

    np.testing.assert_allclose(result, np.array([0.6, 0.8], dtype=np.float32))
    assert float(np.linalg.norm(result)) == pytest.approx(1.0)


def test_normalize_embedding_rejects_zero_vector() -> None:
    with pytest.raises(ValueError, match="zero or non-finite"):
        normalize_embedding([0.0, 0.0])


def test_score_embedding_uses_centroid_or_top_three_median_whichever_is_higher() -> (
    None
):
    references = np.stack(
        [
            normalize_embedding([1.0, 0.0]),
            normalize_embedding([0.8, 0.6]),
            normalize_embedding([0.8, -0.6]),
        ]
    )
    centroid = normalized_centroid(references)

    result = score_embedding(
        [1.0, 0.0], references, centroid, ["front.jpg", "left.jpg", "right.jpg"]
    )

    assert result.centroid_score == pytest.approx(1.0)
    assert result.top3_median_score == pytest.approx(0.8)
    assert result.match_score == pytest.approx(1.0)
    assert result.best_reference_score == pytest.approx(1.0)
    assert result.best_reference_name == "front.jpg"


@pytest.mark.parametrize(
    ("scores", "flags", "expected"),
    [
        ([], [], "no-face"),
        ([0.8], [[]], "solo-match"),
        ([0.8], [["blurry"]], "low-quality-match"),
        ([0.8], [["face-too-small"]], "low-quality-match"),
        ([0.8], [["side-face"]], "low-quality-match"),
        ([0.8], [["too-dark"]], "low-quality-match"),
        ([0.8, 0.1], [[], []], "group-match"),
        ([0.4], [[]], "review"),
        ([0.2], [[]], "no-match"),
    ],
)
def test_classify_disposition(
    scores: list[float], flags: list[list[str]], expected: str
) -> None:
    assert classify_disposition(scores, flags, 0.5, 0.35) == expected


def test_calculate_face_area_pct_clips_box_to_image() -> None:
    assert calculate_face_area_pct((-10, -20, 60, 40), 100, 100) == pytest.approx(24.0)


def test_is_side_face_uses_five_point_landmark_asymmetry() -> None:
    frontal = np.array([[30, 40], [70, 40], [50, 60], [35, 80], [65, 80]])
    profile = np.array([[30, 40], [70, 40], [67, 60], [40, 80], [68, 80]])

    assert is_side_face(frontal) is False
    assert is_side_face(profile) is True


def test_discover_images_is_deterministic_and_respects_recursion(
    tmp_path: Path,
) -> None:
    (tmp_path / "b.JPG").touch()
    (tmp_path / "A.png").touch()
    (tmp_path / "ignored.gif").touch()
    (tmp_path / "linked.jpg").symlink_to(tmp_path / "A.png")
    nested = tmp_path / "nested"
    nested.mkdir()
    (nested / "c.webp").touch()

    assert [path.name for path in discover_images(tmp_path, False)] == [
        "A.png",
        "b.JPG",
    ]
    assert [
        path.relative_to(tmp_path).as_posix()
        for path in discover_images(tmp_path, True)
    ] == [
        "A.png",
        "b.JPG",
        "nested/c.webp",
    ]


def test_discover_images_stops_at_limit_plus_one(tmp_path: Path) -> None:
    for index in range(3):
        (tmp_path / f"{index}.jpg").touch()

    with pytest.raises(WorkerError) as raised:
        discover_images(tmp_path, False, limit=2, label="reference")

    assert raised.value.code == "input-limit-exceeded"
    assert "split the scan" in raised.value.message


def test_sorted_faces_rejects_more_than_the_per_image_limit() -> None:
    analysis = SimpleNamespace(
        get=lambda _image: [
            SimpleNamespace() for _ in range(worker.MAX_FACES_PER_IMAGE + 1)
        ]
    )

    with pytest.raises(WorkerError) as raised:
        worker.sorted_faces(analysis, np.zeros((1, 1, 3), dtype=np.uint8))

    assert raised.value.code == "input-limit-exceeded"


def test_encode_payload_and_diagnostics_are_bounded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(worker, "MAX_REPORT_BYTES", 8)
    with pytest.raises(WorkerError) as raised:
        worker.encode_payload({"value": "too large"})
    assert raised.value.code == "report-limit-exceeded"

    monkeypatch.setattr(worker, "MAX_REPORT_BYTES", 9)
    assert worker.encode_payload({"v": ""}) == '{"v":""}'
    monkeypatch.setattr(worker, "MAX_REPORT_BYTES", 8)
    with pytest.raises(WorkerError) as framed:
        worker.encode_payload({"v": ""})
    assert framed.value.code == "report-limit-exceeded"

    target = io.StringIO()
    diagnostics = worker.BoundedDiagnosticWriter(target, 4)
    assert diagnostics.write("abcdef") == 6
    diagnostics.write("ignored")
    assert target.getvalue() == "abcd"


def test_main_refuses_model_acquisition_without_license_and_emits_one_json_object(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    references = tmp_path / "references"
    candidates = tmp_path / "candidates"
    model_root = tmp_path / "models"
    references.mkdir()
    candidates.mkdir()
    (references / "person.jpg").touch()

    exit_code = main(
        [
            "--references",
            str(references),
            "--candidates",
            str(candidates),
            "--model-root",
            str(model_root),
        ]
    )

    captured = capsys.readouterr()
    stdout_lines = captured.out.splitlines()
    assert exit_code == 2
    assert len(stdout_lines) == 1
    assert json.loads(stdout_lines[0]) == {
        "schemaVersion": "beep.files.match-person.worker.v3",
        "ok": False,
        "limits": worker.WORKER_LIMITS,
        "error": {
            "code": "model-license-not-accepted",
            "message": (
                "Pass --accept-model-license only after reviewing the selected checkpoints' "
                "model and training-dataset terms. The flag records acknowledgment only and "
                "does not grant or alter rights; no model was loaded."
            ),
        },
        "elapsedSeconds": pytest.approx(0.0, abs=0.1),
    }
    assert "model-license-not-accepted" in captured.err
    assert not model_root.exists()


def test_verify_model_artifacts_rejects_unpinned_weights(tmp_path: Path) -> None:
    detector = tmp_path / "det_10g.onnx"
    recognizer = tmp_path / "w600k_r50.onnx"
    detector.write_bytes(b"not the pinned detector")
    recognizer.write_bytes(b"not the pinned recognizer")

    with pytest.raises(WorkerError) as raised:
        verify_model_artifacts([detector, recognizer])

    assert raised.value.code == "model-integrity-failed"
    assert "model will not be loaded" in raised.value.message


def patch_tiny_model_hashes(
    monkeypatch: pytest.MonkeyPatch, archive_path: Path
) -> None:
    monkeypatch.setattr(
        worker,
        "MODEL_ARCHIVE_SHA256",
        hashlib.sha256(archive_path.read_bytes()).hexdigest(),
    )
    monkeypatch.setattr(
        worker,
        "MODEL_ARTIFACT_SHA256",
        {
            "det_10g.onnx": hashlib.sha256(b"tiny detector").hexdigest(),
            "w600k_r50.onnx": hashlib.sha256(b"tiny recognizer").hexdigest(),
        },
    )


def write_tiny_model_archive(path: Path) -> None:
    with zipfile.ZipFile(path, mode="w") as archive:
        archive.writestr("det_10g.onnx", b"tiny detector")
        archive.writestr("w600k_r50.onnx", b"tiny recognizer")
        archive.writestr("genderage.onnx", b"unselected upstream module")


def test_model_archive_sha_is_verified_before_zip_is_opened(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    archive_path = tmp_path / "buffalo_l.zip"
    archive_path.write_bytes(b"not the pinned archive")
    staged_directory = tmp_path / "staged"
    staged_directory.mkdir()
    monkeypatch.setattr(worker, "MODEL_ARCHIVE_SHA256", "0" * 64)

    def fail_if_opened(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("an unverified archive must not be opened")

    monkeypatch.setattr(worker.zipfile, "ZipFile", fail_if_opened)

    with pytest.raises(WorkerError) as raised:
        worker.extract_verified_model_archive(archive_path, staged_directory)

    assert raised.value.code == "model-integrity-failed"
    assert "archive was not extracted" in raised.value.message
    assert list(staged_directory.iterdir()) == []


def test_verified_model_install_is_selective_and_atomically_published(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    archive_path = tmp_path / "buffalo_l.zip"
    write_tiny_model_archive(archive_path)
    patch_tiny_model_hashes(monkeypatch, archive_path)
    models_directory = tmp_path / "models"
    models_directory.mkdir()
    runtime_directory = models_directory / worker.MODEL_RUNTIME_NAME
    original_rename = worker.os.rename
    rename_calls: list[tuple[Path, Path]] = []

    def track_rename(source: str | Path, destination: str | Path) -> None:
        source_path = Path(source)
        destination_path = Path(destination)
        assert source_path.parent == destination_path.parent
        assert not destination_path.exists()
        rename_calls.append((source_path, destination_path))
        original_rename(source_path, destination_path)

    monkeypatch.setattr(worker.os, "rename", track_rename)

    install_verified_model_archive(archive_path, models_directory)

    assert rename_calls == [(rename_calls[0][0], runtime_directory)]
    assert rename_calls[0][0].name.startswith(f".{worker.MODEL_RUNTIME_NAME}.")
    assert not rename_calls[0][0].exists()
    assert {path.name for path in runtime_directory.iterdir()} == {
        *worker.MODEL_ARTIFACT_NAMES,
        worker.MODEL_MANIFEST_NAME,
    }
    assert not (runtime_directory / "genderage.onnx").exists()
    assert verify_runtime_model_directory(runtime_directory) == [
        runtime_directory / "det_10g.onnx",
        runtime_directory / "w600k_r50.onnx",
    ]


def test_runtime_model_directory_rejects_extra_onnx(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    archive_path = tmp_path / "buffalo_l.zip"
    write_tiny_model_archive(archive_path)
    patch_tiny_model_hashes(monkeypatch, archive_path)
    models_directory = tmp_path / "models"
    models_directory.mkdir()
    install_verified_model_archive(archive_path, models_directory)
    runtime_directory = models_directory / worker.MODEL_RUNTIME_NAME
    (runtime_directory / "untrusted.onnx").write_bytes(b"unexpected model")

    with pytest.raises(WorkerError) as raised:
        verify_runtime_model_directory(runtime_directory)

    assert raised.value.code == "model-integrity-failed"
    assert "untrusted.onnx" in raised.value.message


@pytest.mark.parametrize(
    ("platform_name", "module_name", "is_windows"),
    [("posix", "fcntl", False), ("nt", "msvcrt", True)],
)
def test_model_lock_selects_stdlib_backend_for_platform(
    platform_name: str,
    module_name: str,
    is_windows: bool,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    backend = object()
    imported_modules: list[str] = []

    def import_module(name: str) -> object:
        imported_modules.append(name)
        return backend

    monkeypatch.setattr(worker.importlib, "import_module", import_module)

    assert worker._model_lock_backend(platform_name) == (is_windows, backend)
    assert imported_modules == [module_name]


def test_windows_model_lock_retries_contention_and_releases(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    lock_path = tmp_path / "model.lock"
    sleep_calls: list[float] = []

    class WindowsLockBackend:
        LK_NBLCK = 1
        LK_UNLCK = 2

        def __init__(self) -> None:
            self.calls: list[tuple[int, int, int]] = []
            self.acquire_attempts = 0

        def locking(self, descriptor: int, operation: int, byte_count: int) -> None:
            self.calls.append((descriptor, operation, byte_count))
            if operation == self.LK_NBLCK:
                self.acquire_attempts += 1
                if self.acquire_attempts == 1:
                    raise OSError(errno.EACCES, "model lock is held")

    backend = WindowsLockBackend()
    monkeypatch.setattr(
        worker, "_model_lock_backend", lambda _platform_name: (True, backend)
    )
    monkeypatch.setattr(worker.time, "sleep", sleep_calls.append)

    with lock_path.open("a+b") as lock_file:
        descriptor = lock_file.fileno()
        with worker._exclusive_model_lock(lock_file, lock_path, "nt"):
            assert backend.calls == [
                (descriptor, backend.LK_NBLCK, 1),
                (descriptor, backend.LK_NBLCK, 1),
            ]
            assert lock_path.read_bytes() == b"\0"

    assert backend.calls == [
        (descriptor, backend.LK_NBLCK, 1),
        (descriptor, backend.LK_NBLCK, 1),
        (descriptor, backend.LK_UNLCK, 1),
    ]
    assert sleep_calls == [worker.MODEL_LOCK_RETRY_SECONDS]


def test_model_lock_backend_failure_is_typed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    lock_path = tmp_path / "model.lock"

    def unavailable_backend(_platform_name: str) -> tuple[bool, object]:
        raise ImportError("no platform lock backend")

    monkeypatch.setattr(worker, "_model_lock_backend", unavailable_backend)

    with pytest.raises(WorkerError) as raised:
        with worker.model_acquisition_lock(lock_path):
            raise AssertionError("the critical section must not run")

    assert raised.value.code == "model-acquisition-failed"
    assert "could not acquire the model acquisition lock" in raised.value.message


def make_worker_arguments(tmp_path: Path) -> WorkerArguments:
    reference_directory = tmp_path / "references"
    source_directory = tmp_path / "candidates"
    reference_directory.mkdir()
    source_directory.mkdir()
    return WorkerArguments(
        source_dir=source_directory,
        reference_dir=reference_directory,
        model_root=tmp_path / "model-root",
        detection_threshold=0.6,
        match_threshold=0.5,
        review_threshold=0.35,
        min_face_area_pct=1.0,
        recursive=False,
        accept_model_license=True,
    )


def test_model_acquisition_lock_spans_download_verify_and_install(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    arguments = make_worker_arguments(tmp_path)
    lock_held = False
    calls: list[str] = []

    @contextlib.contextmanager
    def tracked_lock(lock_path: Path):
        nonlocal lock_held
        assert lock_path == (
            arguments.model_root / "models" / f".{worker.MODEL_RUNTIME_NAME}.lock"
        )
        assert lock_held is False
        lock_held = True
        try:
            yield
        finally:
            lock_held = False

    def download(destination: Path) -> None:
        assert lock_held is True
        calls.append("download")
        destination.write_bytes(b"tiny archive")

    def verify_archive(_archive_path: Path) -> None:
        assert lock_held is True
        calls.append("verify-archive")

    def install(_archive_path: Path, models_directory: Path) -> None:
        assert lock_held is True
        calls.append("install")
        (models_directory / worker.MODEL_RUNTIME_NAME).mkdir()

    def verify_runtime(runtime_directory: Path) -> list[Path]:
        assert lock_held is True
        calls.append("verify-runtime")
        return [runtime_directory / name for name in worker.MODEL_ARTIFACT_NAMES]

    monkeypatch.setattr(worker, "model_acquisition_lock", tracked_lock)
    monkeypatch.setattr(worker, "download_model_archive", download)
    monkeypatch.setattr(worker, "verify_model_archive", verify_archive)
    monkeypatch.setattr(worker, "install_verified_model_archive", install)
    monkeypatch.setattr(worker, "verify_runtime_model_directory", verify_runtime)

    artifacts = worker.ensure_model_available(arguments)

    runtime_directory = arguments.model_root / "models" / worker.MODEL_RUNTIME_NAME
    assert artifacts == [
        runtime_directory / "det_10g.onnx",
        runtime_directory / "w600k_r50.onnx",
    ]
    assert calls == ["download", "verify-archive", "install", "verify-runtime"]
    assert lock_held is False


def test_unreadable_candidate_is_reported_without_running_inference(
    tmp_path: Path,
) -> None:
    arguments = make_worker_arguments(tmp_path)
    candidate_path = arguments.source_dir / "broken.jpg"
    candidate_path.write_bytes(b"not an image")

    class InferenceMustNotRun:
        def get(self, _image: object) -> None:
            raise AssertionError("inference must not run for an unreadable image")

    def alignment_must_not_run(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("alignment must not run for an unreadable image")

    entry = candidate_entry(
        InferenceMustNotRun(),
        candidate_path,
        arguments.source_dir,
        np.array([[1.0, 0.0]], dtype=np.float32),
        np.array([1.0, 0.0], dtype=np.float32),
        ["reference.jpg"],
        arguments,
        alignment_must_not_run,
    )

    assert entry == {
        "sourceName": "broken.jpg",
        "sourcePath": str(candidate_path),
        "relativePath": "broken.jpg",
        "disposition": "unreadable",
        "faceCount": 0,
        "faces": [],
        "reason": "image-decode-failed",
    }


def test_run_worker_emits_success_report_shape(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    arguments = make_worker_arguments(tmp_path)
    reference_path = arguments.reference_dir / "reference.jpg"
    candidate_path = arguments.source_dir / "candidate.jpg"
    reference_path.touch()
    candidate_path.touch()
    detector_path = tmp_path / "det_10g.onnx"
    recognizer_path = tmp_path / "w600k_r50.onnx"
    detector_path.write_bytes(b"detector")
    recognizer_path.write_bytes(b"recognizer")
    analysis = object()

    monkeypatch.setattr(
        worker,
        "ensure_model_available",
        lambda _arguments: [detector_path, recognizer_path],
    )
    monkeypatch.setattr(
        worker,
        "load_face_analysis",
        lambda _arguments, _artifacts: (analysis, "1.0.1", object()),
    )
    monkeypatch.setattr(
        worker,
        "collect_references",
        lambda _analysis, _paths: (
            [
                {
                    "sourceName": "reference.jpg",
                    "sourcePath": str(reference_path),
                    "accepted": True,
                    "faceCount": 1,
                    "detectionScore": 0.99,
                }
            ],
            [np.array([1.0, 0.0], dtype=np.float32)],
            ["reference.jpg"],
        ),
    )
    monkeypatch.setattr(
        worker,
        "candidate_entry",
        lambda *_args: {
            "sourceName": "candidate.jpg",
            "sourcePath": str(candidate_path),
            "relativePath": "candidate.jpg",
            "disposition": "solo-match",
            "faceCount": 1,
            "faces": [
                {
                    "box": {"x1": 10.0, "y1": 20.0, "x2": 110.0, "y2": 140.0},
                    "detectionScore": 0.99,
                    "faceAreaPct": 15.0,
                    "matchScore": 0.91,
                    "centroidScore": 0.91,
                    "top3MedianScore": 0.91,
                    "bestReferenceScore": 0.91,
                    "bestReferenceName": "reference.jpg",
                    "qualityFlags": [],
                }
            ],
            "bestScore": 0.91,
        },
    )

    report = run_worker(arguments, time.perf_counter())

    assert set(report) == {
        "schemaVersion",
        "ok",
        "limits",
        "model",
        "parameters",
        "references",
        "entries",
        "summary",
        "elapsedSeconds",
    }
    assert report["schemaVersion"] == worker.SCHEMA_VERSION
    assert report["limits"] == worker.WORKER_LIMITS
    assert report["ok"] is True
    assert report["model"] == {
        "backend": "buffalo-l",
        "name": worker.MODEL_NAME,
        "packageName": "insightface",
        "packageVersion": "1.0.1",
        "runtime": {
            "framework": "onnxruntime",
            "packageVersion": "1.23.2",
            "actualCompute": "cpu",
            "precision": "fp32",
            "providers": ["CPUExecutionProvider"],
            "devices": [],
            "warnings": [],
        },
        "root": str(arguments.model_root),
        "allowedModules": ["detection", "recognition"],
        "components": [
            {
                "role": "detector",
                "name": "insightface-det_10g",
                "revision": "v0.7",
                "source": worker.MODEL_ARCHIVE_URL,
                "licenseNotice": (
                    "InsightFace pretrained-model terms: "
                    "https://github.com/deepinsight/insightface/blob/master/server/LICENSING.md"
                ),
                "artifacts": [
                    {
                        "name": "det_10g.onnx",
                        "path": str(detector_path),
                        "sizeBytes": len(b"detector"),
                        "sha256": hashlib.sha256(b"detector").hexdigest(),
                    }
                ],
            },
            {
                "role": "recognizer",
                "name": "insightface-w600k_r50",
                "revision": "v0.7",
                "source": worker.MODEL_ARCHIVE_URL,
                "licenseNotice": (
                    "InsightFace pretrained-model terms: "
                    "https://github.com/deepinsight/insightface/blob/master/server/LICENSING.md"
                ),
                "artifacts": [
                    {
                        "name": "w600k_r50.onnx",
                        "path": str(recognizer_path),
                        "sizeBytes": len(b"recognizer"),
                        "sha256": hashlib.sha256(b"recognizer").hexdigest(),
                    }
                ],
            },
        ],
    }
    assert report["parameters"] == {
        "backend": "buffalo-l",
        "compute": "auto",
        "actualCompute": "cpu",
        "devices": [],
        "batchSize": 32,
        "precision": "fp32",
        "thresholdSource": "calibrated-default",
        "detectionThreshold": 0.6,
        "matchThreshold": 0.5,
        "reviewThreshold": 0.35,
        "minFaceAreaPct": 1.0,
        "recursive": False,
    }
    assert report["summary"] == {
        "totalCount": 1,
        "soloMatchCount": 1,
        "groupMatchCount": 0,
        "lowQualityMatchCount": 0,
        "reviewCount": 0,
        "noMatchCount": 0,
        "noFaceCount": 0,
        "unreadableCount": 0,
        "acceptedReferenceCount": 1,
        "rejectedReferenceCount": 0,
    }
    assert report["entries"][0]["relativePath"] == "candidate.jpg"
    assert report["elapsedSeconds"] >= 0.0
    assert "embedding" not in json.dumps(report).casefold()


def test_run_worker_rejects_duplicate_recursive_reference_names_before_candidates(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    arguments = replace(make_worker_arguments(tmp_path), recursive=True)
    first_reference = arguments.reference_dir / "first" / "reference.jpg"
    second_reference = arguments.reference_dir / "second" / "reference.jpg"
    candidate_path = arguments.source_dir / "candidate.jpg"
    first_reference.parent.mkdir()
    second_reference.parent.mkdir()
    first_reference.touch()
    second_reference.touch()
    candidate_path.touch()
    detector_path = tmp_path / "det_10g.onnx"
    recognizer_path = tmp_path / "w600k_r50.onnx"
    detector_path.write_bytes(b"detector")
    recognizer_path.write_bytes(b"recognizer")

    monkeypatch.setattr(
        worker,
        "ensure_model_available",
        lambda _arguments: [detector_path, recognizer_path],
    )
    monkeypatch.setattr(
        worker,
        "load_face_analysis",
        lambda _arguments, _artifacts: (object(), "1.0.1", object()),
    )
    monkeypatch.setattr(
        worker,
        "collect_references",
        lambda _analysis, _paths: (
            [
                {
                    "sourceName": path.name,
                    "sourcePath": str(path),
                    "accepted": True,
                    "faceCount": 1,
                }
                for path in (first_reference, second_reference)
            ],
            [
                np.array([1.0, 0.0], dtype=np.float32),
                np.array([1.0, 0.0], dtype=np.float32),
            ],
            [first_reference.name, second_reference.name],
        ),
    )

    def candidate_must_not_be_scanned(*_args: object) -> dict[str, object]:
        raise AssertionError("candidate scan must not start")

    monkeypatch.setattr(worker, "candidate_entry", candidate_must_not_be_scanned)

    with pytest.raises(WorkerError) as raised:
        run_worker(arguments, time.perf_counter())

    assert raised.value.code == "invalid-arguments"
    assert raised.value.message == (
        "Recursive person-match references contain duplicate accepted file names. "
        "Rename references so face evidence remains unambiguous."
    )
