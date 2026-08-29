from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from beep_photo_face.worker import (
    calculate_face_area_pct,
    classify_disposition,
    discover_images,
    is_side_face,
    main,
    normalize_embedding,
    normalized_centroid,
    score_embedding,
    verify_model_artifacts,
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
