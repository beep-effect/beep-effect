from __future__ import annotations

import hashlib
import json
from pathlib import Path
import time
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
        "schemaVersion": "beep.files.match-person.worker.v1",
        "ok": False,
        "error": {
            "code": "model-license-not-accepted",
            "message": (
                "buffalo_l is not installed. Pass --accept-model-license only after accepting "
                "the InsightFace pretrained-model licensing terms; no model was downloaded."
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
        "model",
        "parameters",
        "references",
        "entries",
        "summary",
        "elapsedSeconds",
    }
    assert report["schemaVersion"] == worker.SCHEMA_VERSION
    assert report["ok"] is True
    assert report["model"] == {
        "name": worker.MODEL_NAME,
        "packageVersion": "1.0.1",
        "providers": ["CPUExecutionProvider"],
        "allowedModules": ["detection", "recognition"],
        "root": str(arguments.model_root),
        "artifacts": [
            {
                "name": "det_10g.onnx",
                "path": str(detector_path),
                "sha256": hashlib.sha256(b"detector").hexdigest(),
            },
            {
                "name": "w600k_r50.onnx",
                "path": str(recognizer_path),
                "sha256": hashlib.sha256(b"recognizer").hexdigest(),
            },
        ],
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
