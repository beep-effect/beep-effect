from __future__ import annotations

import hashlib
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
import time

import numpy as np
import pytest

import beep_photo_face.backends.adaface_kprpe as adaface
import beep_photo_face.worker as worker
from beep_photo_face.backends.base import LoadedBackend, RuntimeSelection, WorkerError
from beep_photo_face.model_store import ArtifactDescriptor, verify_pinned_file


def make_directories(tmp_path: Path) -> tuple[Path, Path, Path]:
    references = tmp_path / "references"
    candidates = tmp_path / "candidates"
    model_root = tmp_path / "models"
    references.mkdir()
    candidates.mkdir()
    return references, candidates, model_root


def test_parse_arguments_accepts_explicit_adaface_runtime_policy(
    tmp_path: Path,
) -> None:
    references, candidates, model_root = make_directories(tmp_path)
    detector = tmp_path / "detector.onnx"
    aligner = tmp_path / "aligner.safetensors"
    recognizer = tmp_path / "recognizer.safetensors"

    arguments = worker.parse_arguments(
        [
            "--references",
            str(references),
            "--candidates",
            str(candidates),
            "--model-root",
            str(model_root),
            "--backend",
            "adaface-kprpe",
            "--compute",
            "rocm",
            "--devices",
            "1",
            "--batch-size",
            "8",
            "--threshold-source",
            "explicit",
            "--detector-path",
            str(detector),
            "--aligner-path",
            str(aligner),
            "--recognizer-path",
            str(recognizer),
            "--accept-model-license",
        ]
    )

    assert arguments.backend == "adaface-kprpe"
    assert arguments.compute == "rocm"
    assert arguments.devices == (1,)
    assert arguments.batch_size == 8
    assert arguments.threshold_source == "explicit"
    assert arguments.detector_path == detector.resolve()
    assert arguments.aligner_path == aligner.resolve()
    assert arguments.recognizer_path == recognizer.resolve()


@pytest.mark.parametrize("devices", ["0,1", "0,0"])
def test_parse_arguments_rejects_multiple_device_ordinals(
    tmp_path: Path, devices: str
) -> None:
    references, candidates, model_root = make_directories(tmp_path)
    with pytest.raises(WorkerError) as raised:
        worker.parse_arguments(
            [
                "--references",
                str(references),
                "--candidates",
                str(candidates),
                "--model-root",
                str(model_root),
                "--backend",
                "adaface-kprpe",
                "--compute",
                "rocm",
                "--devices",
                devices,
            ]
        )
    assert raised.value.code == "invalid-arguments"
    assert "exactly one" in raised.value.message


def tiny_descriptor(content: bytes, role: str = "recognizer") -> ArtifactDescriptor:
    return ArtifactDescriptor(
        role=role,
        component_name=f"tiny-{role}",
        repository="example/tiny",
        revision="a" * 40,
        source="https://example.invalid/model.safetensors",
        license_notice="test-only model terms",
        artifact_name=f"{role}.safetensors",
        size_bytes=len(content),
        sha256=hashlib.sha256(content).hexdigest(),
    )


def test_verify_pinned_file_rejects_size_before_hash(tmp_path: Path) -> None:
    path = tmp_path / "model.safetensors"
    path.write_bytes(b"wrong")
    descriptor = tiny_descriptor(b"expected bytes")

    with pytest.raises(WorkerError) as raised:
        verify_pinned_file(path, descriptor)

    assert raised.value.code == "model-integrity-failed"
    assert "size mismatch" in raised.value.message


def test_verify_pinned_file_rejects_a_symlink_to_valid_bytes(tmp_path: Path) -> None:
    content = b"expected bytes"
    target = tmp_path / "target.safetensors"
    target.write_bytes(content)
    linked = tmp_path / "linked.safetensors"
    linked.symlink_to(target)

    with pytest.raises(WorkerError) as raised:
        verify_pinned_file(linked, tiny_descriptor(content))

    assert raised.value.code == "model-integrity-failed"
    assert "regular" in raised.value.message


def test_explicit_adaface_paths_are_all_verified_without_acquisition(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    arguments = worker.WorkerArguments(
        source_dir=tmp_path,
        reference_dir=tmp_path,
        model_root=tmp_path / "models",
        detection_threshold=0.6,
        match_threshold=0.5,
        review_threshold=0.35,
        min_face_area_pct=1.0,
        recursive=False,
        accept_model_license=True,
        backend="adaface-kprpe",
    )
    descriptors = []
    paths = []
    for role in ("detector", "aligner", "recognizer"):
        content = f"tiny {role}".encode()
        descriptor = tiny_descriptor(content, role)
        path = tmp_path / descriptor.artifact_name
        path.write_bytes(content)
        descriptors.append(descriptor)
        paths.append(path)
    monkeypatch.setattr(adaface, "DETECTOR", descriptors[0])
    monkeypatch.setattr(adaface, "ALIGNER", descriptors[1])
    monkeypatch.setattr(adaface, "RECOGNIZER", descriptors[2])

    def acquisition_must_not_run(_arguments: object) -> None:
        raise AssertionError("explicit paths must not trigger acquisition")

    result = adaface._resolve_artifact_paths(
        replace(
            arguments,
            detector_path=paths[0],
            aligner_path=paths[1],
            recognizer_path=paths[2],
        ),
        acquisition_must_not_run,
    )

    assert result == tuple(paths)


def test_explicit_adaface_pair_uses_verified_buffalo_detector_fallback(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    contents = {
        "detector": b"tiny detector",
        "aligner": b"tiny aligner",
        "recognizer": b"tiny recognizer",
    }
    descriptors = {
        role: tiny_descriptor(content, role) for role, content in contents.items()
    }
    paths = {}
    for role, descriptor in descriptors.items():
        path = tmp_path / descriptor.artifact_name
        path.write_bytes(contents[role])
        paths[role] = path
    monkeypatch.setattr(adaface, "DETECTOR", descriptors["detector"])
    monkeypatch.setattr(adaface, "ALIGNER", descriptors["aligner"])
    monkeypatch.setattr(adaface, "RECOGNIZER", descriptors["recognizer"])
    arguments = worker.WorkerArguments(
        source_dir=tmp_path,
        reference_dir=tmp_path,
        model_root=tmp_path / "models",
        detection_threshold=0.6,
        match_threshold=0.5,
        review_threshold=0.35,
        min_face_area_pct=1.0,
        recursive=False,
        accept_model_license=True,
        backend="adaface-kprpe",
        compute="rocm",
        devices=(0,),
        aligner_path=paths["aligner"],
        recognizer_path=paths["recognizer"],
    )
    fallback_arguments = []

    def detector_fallback(received: object) -> list[Path]:
        fallback_arguments.append(received)
        return [paths["detector"], tmp_path / "unused-recognizer.onnx"]

    result = adaface._resolve_artifact_paths(arguments, detector_fallback)

    assert result == (
        paths["detector"],
        paths["aligner"],
        paths["recognizer"],
    )
    assert len(fallback_arguments) == 1
    assert fallback_arguments[0].backend == "buffalo-l"
    assert fallback_arguments[0].compute == "cpu"
    assert fallback_arguments[0].devices == ()


def test_square_face_crop_is_unaligned_deterministic_and_padded() -> None:
    image = np.full((8, 12, 3), 200, dtype=np.uint8)

    crop = adaface.AdaFaceAnalysis._square_face_crop(
        image, np.array([-2.0, -2.0, 4.0, 4.0, 0.9], dtype=np.float32)
    )

    assert crop.shape == (112, 112, 3)
    assert crop.dtype == np.uint8
    assert np.all(crop[0, 0] == 0)
    assert np.all(crop[-1, -1] == 200)
    assert adaface.FACE_CROP_MARGIN_RATIO == 0.25
    assert adaface.DFA_CONFIDENCE_THRESHOLD == 0.2


@pytest.mark.parametrize(
    "box",
    [
        np.array([0.0, 0.0, np.inf, 4.0, 0.9]),
        np.array([4.0, 4.0, 2.0, 2.0, 0.9]),
    ],
)
def test_square_face_crop_rejects_invalid_detector_coordinates(box: np.ndarray) -> None:
    image = np.full((8, 12, 3), 200, dtype=np.uint8)

    with pytest.raises(WorkerError) as raised:
        adaface.AdaFaceAnalysis._square_face_crop(image, box)

    assert raised.value.code == "worker-failed"


def test_adaface_detection_requests_the_face_limit() -> None:
    calls: list[int] = []
    detector = SimpleNamespace(
        detect=lambda _image, max_num, metric: (calls.append(max_num) or (None, None))
    )
    analysis = adaface.AdaFaceAnalysis(
        detector=detector,
        aligner=object(),
        recognizer=object(),
        priors=object(),
        torch=object(),
        device=object(),
        batch_size=1,
    )

    assert analysis.get(np.zeros((1, 1, 3), dtype=np.uint8)) == []
    assert calls == [32]


def test_piecewise_index_matches_pinned_upstream_for_all_grid_offsets() -> None:
    torch = pytest.importorskip("torch", exc_type=ImportError)
    offsets = torch.arange(-13, 14, dtype=torch.float32)

    actual = adaface._piecewise_index(torch, offsets)

    assert actual.tolist() == [
        -3,
        -3,
        -3,
        -3,
        -3,
        -3,
        -3,
        -3,
        -3,
        -3,
        -2,
        -2,
        -1,
        0,
        1,
        2,
        2,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
    ]
    assert actual.tolist() == (-actual.flip(0)).tolist()
    assert int(actual.min()) == -3
    assert int(actual.max()) == 3


def test_product_bucket_ids_stay_within_the_upstream_49_bucket_table() -> None:
    torch = pytest.importorskip("torch", exc_type=ImportError)

    bucket_ids = adaface._product_bucket_ids(torch, torch.device("cpu"))

    assert tuple(bucket_ids.shape) == (196, 196)
    assert int(bucket_ids.min()) == 0
    assert int(bucket_ids.max()) == 48


def test_aligner_confidence_failure_closes_reference_without_aborting_collection(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    class Analysis:
        calls = 0

        @classmethod
        def get(cls, _image: np.ndarray) -> list[object]:
            cls.calls += 1
            if cls.calls == 1:
                return [
                    SimpleNamespace(
                        bbox=np.array([0.0, 0.0, 4.0, 8.0], dtype=np.float32),
                        det_score=0.99,
                        embedding=np.array([1.0, 0.0], dtype=np.float32),
                        embedding_reason=None,
                    ),
                    SimpleNamespace(
                        bbox=np.array([4.0, 0.0, 8.0, 8.0], dtype=np.float32),
                        det_score=0.80,
                        embedding=None,
                        embedding_reason="aligner-confidence-failed",
                        aligner_confidence=0.1,
                    ),
                ]
            return [
                SimpleNamespace(
                    bbox=np.array([0.0, 0.0, 8.0, 8.0], dtype=np.float32),
                    det_score=0.99,
                    embedding=np.array([1.0, 0.0], dtype=np.float32),
                )
            ]

    rejected = tmp_path / "rejected.jpg"
    accepted = tmp_path / "accepted.jpg"
    rejected.touch()
    accepted.touch()
    monkeypatch.setattr(
        worker, "read_image", lambda _path: np.zeros((8, 8, 3), dtype=np.uint8)
    )

    entries, embeddings, names = worker.collect_references(
        Analysis(), [rejected, accepted]
    )

    assert entries == [
        {
            "sourceName": "rejected.jpg",
            "sourcePath": str(rejected),
            "accepted": False,
            "faceCount": 0,
            "reason": "aligner-confidence-failed",
        },
        {
            "sourceName": "accepted.jpg",
            "sourcePath": str(accepted),
            "accepted": True,
            "faceCount": 1,
            "detectionScore": 0.99,
        },
    ]
    assert len(embeddings) == 1
    assert embeddings[0].tolist() == [1.0, 0.0]
    assert names == ["accepted.jpg"]
    assert "aligner-confidence-failed" in capsys.readouterr().err


def test_adaface_embedding_preserves_valid_crop_when_other_dfa_confidence_is_low() -> (
    None
):
    torch = pytest.importorskip("torch", exc_type=ImportError)

    class Aligner:
        @staticmethod
        def __call__(_images: object, _priors: object) -> tuple[object, ...]:
            merged = torch.zeros((2, 16), dtype=torch.float32)
            merged[0, 5] = 5.0
            merged[1, 4] = 5.0
            return None, None, None, merged, None

    class Recognizer:
        @staticmethod
        def __call__(images: object, _landmarks: object) -> object:
            return torch.ones((images.shape[0], 512), dtype=torch.float32)

    analysis = adaface.AdaFaceAnalysis(
        detector=None,
        aligner=Aligner(),
        recognizer=Recognizer(),
        priors=None,
        torch=torch,
        device=torch.device("cpu"),
        batch_size=2,
    )

    results = analysis._embed(
        [
            np.zeros((112, 112, 3), dtype=np.uint8),
            np.zeros((112, 112, 3), dtype=np.uint8),
        ]
    )

    assert len(results) == 2
    assert results[0].embedding is not None
    assert results[0].embedding.shape == (512,)
    assert results[0].aligner_confidence > adaface.DFA_CONFIDENCE_THRESHOLD
    assert results[1].embedding is None
    assert results[1].aligner_confidence < adaface.DFA_CONFIDENCE_THRESHOLD


def test_aligner_confidence_failure_closes_candidate_without_partial_faces(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    class Analysis:
        @staticmethod
        def get(_image: np.ndarray) -> list[object]:
            return [
                SimpleNamespace(
                    bbox=np.array([0.0, 0.0, 8.0, 8.0], dtype=np.float32),
                    det_score=0.8,
                    embedding=None,
                    embedding_reason="aligner-confidence-failed",
                    aligner_confidence=0.1,
                )
            ]

    candidate = tmp_path / "candidate.jpg"
    candidate.touch()
    monkeypatch.setattr(
        worker, "read_image", lambda _path: np.zeros((8, 8, 3), dtype=np.uint8)
    )
    arguments = SimpleNamespace(
        min_face_area_pct=1.0,
        match_threshold=0.5,
        review_threshold=0.35,
    )

    entry = worker.candidate_entry(
        Analysis(),
        candidate,
        tmp_path,
        np.ones((1, 2), dtype=np.float32),
        np.ones(2, dtype=np.float32),
        ["reference.jpg"],
        arguments,
        lambda *_args, **_kwargs: np.zeros((112, 112, 3), dtype=np.uint8),
    )

    assert entry == {
        "sourceName": "candidate.jpg",
        "sourcePath": str(candidate),
        "relativePath": "candidate.jpg",
        "disposition": "no-face",
        "faceCount": 0,
        "faces": [],
        "reason": "aligner-confidence-failed",
    }
    assert "aligner-confidence-failed" in capsys.readouterr().err


def test_partial_aligner_confidence_failure_preserves_faces_but_forces_review(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    landmarks = np.array(
        [[2.0, 2.0], [6.0, 2.0], [4.0, 4.0], [3.0, 6.0], [5.0, 6.0]],
        dtype=np.float32,
    )

    class Analysis:
        @staticmethod
        def get(_image: np.ndarray) -> list[object]:
            return [
                SimpleNamespace(
                    bbox=np.array([0.0, 0.0, 8.0, 8.0], dtype=np.float32),
                    det_score=0.99,
                    kps=landmarks,
                    embedding=np.array([1.0, 0.0], dtype=np.float32),
                    embedding_reason=None,
                ),
                SimpleNamespace(
                    bbox=np.array([4.0, 0.0, 8.0, 8.0], dtype=np.float32),
                    det_score=0.8,
                    kps=landmarks,
                    embedding=None,
                    embedding_reason="aligner-confidence-failed",
                    aligner_confidence=0.1,
                ),
            ]

    candidate = tmp_path / "candidate.jpg"
    candidate.touch()
    monkeypatch.setattr(
        worker, "read_image", lambda _path: np.zeros((8, 8, 3), dtype=np.uint8)
    )
    arguments = SimpleNamespace(
        min_face_area_pct=1.0,
        match_threshold=0.5,
        review_threshold=0.35,
    )

    entry = worker.candidate_entry(
        Analysis(),
        candidate,
        tmp_path,
        np.array([[1.0, 0.0]], dtype=np.float32),
        np.array([1.0, 0.0], dtype=np.float32),
        ["reference.jpg"],
        arguments,
        lambda *_args, **_kwargs: np.zeros((112, 112, 3), dtype=np.uint8),
    )

    assert entry["disposition"] == "review"
    assert entry["reason"] == "aligner-confidence-failed"
    assert entry["faceCount"] == 1
    assert entry["bestScore"] == 1.0
    assert len(entry["faces"]) == 1
    assert entry["faces"][0]["matchScore"] == 1.0
    assert "aligner-confidence-failed" in capsys.readouterr().err


def test_auto_compute_falls_back_to_cpu_with_structured_warning() -> None:
    fake_torch = SimpleNamespace(
        version=SimpleNamespace(hip=None),
        cuda=SimpleNamespace(is_available=lambda: False),
    )
    arguments = SimpleNamespace(compute="auto", devices=())

    selection = adaface.resolve_compute(fake_torch, arguments)

    assert selection.actual_compute == "cpu"
    assert selection.device_ordinals == ()
    assert selection.warnings == (
        {
            "code": "rocm-fallback-to-cpu",
            "message": (
                "ROCm was unavailable, so AdaFace inference selected the pinned "
                "CPU PyTorch distribution."
            ),
        },
    )


def test_auto_compute_requires_cpu_distribution_when_rocm_is_unavailable() -> None:
    fake_torch = SimpleNamespace(
        version=SimpleNamespace(hip="7.2"),
        cuda=SimpleNamespace(is_available=lambda: False),
    )
    arguments = SimpleNamespace(compute="auto", devices=())

    with pytest.raises(WorkerError) as raised:
        adaface.resolve_compute(fake_torch, arguments)

    assert raised.value.code == "rocm-unavailable"


@pytest.mark.parametrize(
    "load_error", [ImportError("missing"), OSError("native load failed")]
)
def test_pytorch_loader_failures_have_a_dedicated_code(
    monkeypatch: pytest.MonkeyPatch, load_error: Exception
) -> None:
    def import_module(name: str) -> object:
        if name == "torch":
            raise load_error
        return object()

    monkeypatch.setattr(adaface.importlib, "import_module", import_module)

    with pytest.raises(WorkerError) as raised:
        adaface._import_adaface_dependencies()

    assert raised.value.code == "pytorch-runtime-load-failed"


def test_safetensors_loader_failure_is_not_a_pytorch_bootstrap_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def import_module(name: str) -> object:
        if name == "torch":
            return object()
        raise ImportError("missing safetensors")

    monkeypatch.setattr(adaface.importlib, "import_module", import_module)

    with pytest.raises(WorkerError) as raised:
        adaface._import_adaface_dependencies()

    assert raised.value.code == "runtime-dependency-missing"


def test_explicit_rocm_unavailability_is_typed() -> None:
    fake_torch = SimpleNamespace(
        version=SimpleNamespace(hip=None),
        cuda=SimpleNamespace(is_available=lambda: False),
    )
    arguments = SimpleNamespace(compute="rocm", devices=())

    with pytest.raises(WorkerError) as raised:
        adaface.resolve_compute(fake_torch, arguments)

    assert raised.value.code == "rocm-unavailable"


def test_strict_safetensors_state_rejects_missing_and_unexpected_keys(
    tmp_path: Path,
) -> None:
    class Tensor:
        shape = (2, 2)

    class Model:
        def state_dict(self) -> dict[str, Tensor]:
            return {"expected.weight": Tensor()}

        def load_state_dict(self, *_args: object, **_kwargs: object) -> None:
            raise AssertionError("mismatched state must not be loaded")

    loader = SimpleNamespace(
        load_file=lambda *_args, **_kwargs: {"model.net.unexpected.weight": Tensor()}
    )

    with pytest.raises(WorkerError) as raised:
        adaface._load_strict_safetensors(
            Model(), tmp_path / "model.safetensors", loader, "recognizer"
        )

    assert raised.value.code == "model-state-mismatch"
    assert "missing" in raised.value.message
    assert "unexpected" in raised.value.message


def test_run_worker_selects_adaface_backend_and_emits_v2_protocol(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    references, candidates, model_root = make_directories(tmp_path)
    reference_path = references / "reference.jpg"
    candidate_path = candidates / "candidate.jpg"
    reference_path.touch()
    candidate_path.touch()
    arguments = worker.WorkerArguments(
        source_dir=candidates,
        reference_dir=references,
        model_root=model_root,
        detection_threshold=0.6,
        match_threshold=0.3,
        review_threshold=0.2,
        min_face_area_pct=1.0,
        recursive=False,
        accept_model_license=True,
        backend="adaface-kprpe",
        compute="auto",
        batch_size=4,
        threshold_source="calibrated-default",
    )
    fallback_warning = {
        "code": "rocm-fallback-to-cpu",
        "message": (
            "ROCm was unavailable, so AdaFace inference selected the pinned "
            "CPU PyTorch distribution."
        ),
    }
    model_payload = {
        "backend": "adaface-kprpe",
        "name": adaface.MODEL_NAME,
        "codeRevision": adaface.CODE_REVISION,
        "runtime": {
            "framework": "pytorch",
            "distribution": "cpu",
            "packageVersion": "2.9.1+cpu",
            "actualCompute": "cpu",
            "precision": "fp32",
            "devices": [],
            "warnings": [fallback_warning],
        },
        "root": str(model_root),
        "components": [],
    }
    monkeypatch.setattr(
        adaface,
        "load_backend",
        lambda _arguments, _fallback: LoadedBackend(
            analysis=object(),
            align_face=object(),
            model=model_payload,
            selection=RuntimeSelection("auto", "cpu", (), (), (fallback_warning,)),
        ),
    )
    monkeypatch.setattr(
        worker,
        "collect_references",
        lambda _analysis, _paths: (
            [
                {
                    "sourceName": reference_path.name,
                    "sourcePath": str(reference_path),
                    "accepted": True,
                    "faceCount": 1,
                    "detectionScore": 0.99,
                }
            ],
            [np.array([1.0, 0.0], dtype=np.float32)],
            [reference_path.name],
        ),
    )
    monkeypatch.setattr(
        worker,
        "candidate_entry",
        lambda *_args: {
            "sourceName": candidate_path.name,
            "sourcePath": str(candidate_path),
            "relativePath": candidate_path.name,
            "disposition": "no-match",
            "faceCount": 1,
            "faces": [],
            "bestScore": 0.1,
        },
    )

    report = worker.run_worker(arguments, time.perf_counter())

    assert report["schemaVersion"] == "beep.files.match-person.worker.v3"
    assert report["limits"] == worker.WORKER_LIMITS
    assert report["model"] is model_payload
    assert report["parameters"] == {
        "backend": "adaface-kprpe",
        "compute": "auto",
        "actualCompute": "cpu",
        "devices": [],
        "batchSize": 4,
        "precision": "fp32",
        "thresholdSource": "calibrated-default",
        "detectionThreshold": 0.6,
        "matchThreshold": 0.3,
        "reviewThreshold": 0.2,
        "minFaceAreaPct": 1.0,
        "recursive": False,
    }
