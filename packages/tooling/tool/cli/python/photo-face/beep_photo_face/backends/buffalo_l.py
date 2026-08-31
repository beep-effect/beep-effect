from __future__ import annotations

from pathlib import Path
from typing import Any

from ..model_store import sha256_file

BACKEND = "buffalo-l"
MODEL_NAME = "buffalo_l"
PACKAGE_NAME = "insightface"
PACKAGE_VERSION = "1.0.1"
ONNXRUNTIME_VERSION = "1.23.2"
MODEL_REVISION = "v0.7"
MODEL_SOURCE = (
    "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip"
)
MODEL_LICENSE_NOTICE = (
    "InsightFace pretrained-model terms: "
    "https://github.com/deepinsight/insightface/blob/master/server/LICENSING.md"
)
ARTIFACT_SIZES = {
    "det_10g.onnx": 16_923_827,
    "w600k_r50.onnx": 174_383_860,
}


def model_payload(
    model_root: Path,
    artifacts: tuple[Path, Path] | list[Path],
    package_version: str,
) -> dict[str, Any]:
    detector, recognizer = artifacts
    components = []
    for role, name, path in (
        ("detector", "insightface-det_10g", detector),
        ("recognizer", "insightface-w600k_r50", recognizer),
    ):
        components.append(
            {
                "role": role,
                "name": name,
                "revision": MODEL_REVISION,
                "source": MODEL_SOURCE,
                "licenseNotice": MODEL_LICENSE_NOTICE,
                "artifacts": [
                    {
                        "name": path.name,
                        "path": str(path),
                        "sizeBytes": path.stat().st_size,
                        "sha256": sha256_file(path),
                    }
                ],
            }
        )
    return {
        "backend": BACKEND,
        "name": MODEL_NAME,
        "packageName": PACKAGE_NAME,
        "packageVersion": package_version,
        "runtime": {
            "framework": "onnxruntime",
            "packageVersion": ONNXRUNTIME_VERSION,
            "actualCompute": "cpu",
            "precision": "fp32",
            "providers": ["CPUExecutionProvider"],
            "devices": [],
            "warnings": [],
        },
        "root": str(model_root),
        "allowedModules": ["detection", "recognition"],
        "components": components,
    }
