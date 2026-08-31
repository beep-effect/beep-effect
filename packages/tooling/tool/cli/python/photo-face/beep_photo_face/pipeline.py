from __future__ import annotations

from typing import Any

from .backends.base import LoadedBackend, RuntimeSelection, WorkerArguments
from .backends.buffalo_l import model_payload as buffalo_model_payload


def load_selected_backend(
    arguments: WorkerArguments,
    buffalo_artifact_loader: Any,
    buffalo_analysis_loader: Any,
) -> LoadedBackend:
    if arguments.backend == "adaface-kprpe":
        from .backends.adaface_kprpe import load_backend

        return load_backend(arguments, buffalo_artifact_loader)

    artifacts = buffalo_artifact_loader(arguments)
    analysis, package_version, align_face = buffalo_analysis_loader(
        arguments, artifacts
    )
    return LoadedBackend(
        analysis=analysis,
        align_face=align_face,
        model=buffalo_model_payload(
            arguments.model_root,
            artifacts,
            package_version,
        ),
        selection=RuntimeSelection(arguments.compute, "cpu", (), ()),
        artifacts=tuple(artifacts),
    )


def parameters_payload(
    arguments: WorkerArguments, selection: RuntimeSelection
) -> dict[str, Any]:
    return {
        "backend": arguments.backend,
        "compute": arguments.compute,
        "actualCompute": selection.actual_compute,
        "devices": list(selection.device_ordinals),
        "batchSize": arguments.batch_size,
        "precision": "fp32",
        "thresholdSource": arguments.threshold_source,
        "detectionThreshold": arguments.detection_threshold,
        "matchThreshold": arguments.match_threshold,
        "reviewThreshold": arguments.review_threshold,
        "minFaceAreaPct": arguments.min_face_area_pct,
        "recursive": arguments.recursive,
    }
