"""Pinned CVLFace AdaFace ViT-Base KP-RPE inference.

The inference architecture in this module is adapted from CVLFace revision
308142aa50adf2e187711354f7524635d3414f1e. CVLFace is Copyright (c) 2022
Minchul Kim and is distributed under the MIT License. The complete upstream
license notice is included in ``UPSTREAM-CVLFACE-LICENSE.txt`` beside this
module.

Only the fixed inference graph needed by the two pinned safetensors files is
implemented. It intentionally does not import or execute Hugging Face remote
code, Transformers, timm, torchvision, OmegaConf, YAML, easydict, or compiled
RPE extensions.
"""

from __future__ import annotations

import importlib
import math
import sys
from dataclasses import dataclass, replace
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import cv2
import numpy as np

from ..model_store import (
    ArtifactDescriptor,
    component_payload,
    ensure_pinned_artifact,
    verify_pinned_file,
)
from .base import LoadedBackend, RuntimeSelection, WorkerArguments, WorkerError

BACKEND = "adaface-kprpe"
MODEL_NAME = "cvlface_adaface_vit_base_kprpe_webface12m"
CODE_REVISION = "308142aa50adf2e187711354f7524635d3414f1e"
DFA_CONFIDENCE_THRESHOLD = 0.2
FACE_CROP_MARGIN_RATIO = 0.25
RECOGNIZER_REVISION = "daefd5012d369588bd214fbaf4cc6b1d286e7066"
ALIGNER_REVISION = "8317e6dda53d91e7074979923144c2cc08906a33"
DETECTOR_REVISION = "v0.7"
RECOGNIZER_REPOSITORY = "minchul/cvlface_adaface_vit_base_kprpe_webface12m"
ALIGNER_REPOSITORY = "minchul/cvlface_DFA_mobilenet"
CVLFACE_LICENSE_NOTICE = (
    "CVLFace code is MIT-licensed; checkpoint use is also subject to the "
    "training-dataset and model-card terms at the pinned source."
)
INSIGHTFACE_LICENSE_NOTICE = (
    "InsightFace pretrained-model terms: "
    "https://github.com/deepinsight/insightface/blob/master/server/LICENSING.md"
)

DETECTOR = ArtifactDescriptor(
    role="detector",
    component_name="insightface-det_10g",
    repository="deepinsight/insightface",
    revision=DETECTOR_REVISION,
    source=(
        "https://github.com/deepinsight/insightface/releases/download/v0.7/"
        "buffalo_l.zip"
    ),
    license_notice=INSIGHTFACE_LICENSE_NOTICE,
    artifact_name="det_10g.onnx",
    size_bytes=16_923_827,
    sha256="5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91",
)
ALIGNER = ArtifactDescriptor(
    role="aligner",
    component_name="cvlface_DFA_mobilenet",
    repository=ALIGNER_REPOSITORY,
    revision=ALIGNER_REVISION,
    source=(
        f"https://huggingface.co/{ALIGNER_REPOSITORY}/resolve/"
        f"{ALIGNER_REVISION}/model.safetensors"
    ),
    license_notice=CVLFACE_LICENSE_NOTICE,
    artifact_name="model.safetensors",
    size_bytes=2_007_980,
    sha256="80b6e922e4c76c10d5e24061fe47cd96112d18689bf5ae7e34af52e641c18c4a",
)
RECOGNIZER = ArtifactDescriptor(
    role="recognizer",
    component_name=MODEL_NAME,
    repository=RECOGNIZER_REPOSITORY,
    revision=RECOGNIZER_REVISION,
    source=(
        f"https://huggingface.co/{RECOGNIZER_REPOSITORY}/resolve/"
        f"{RECOGNIZER_REVISION}/model.safetensors"
    ),
    license_notice=CVLFACE_LICENSE_NOTICE,
    artifact_name="model.safetensors",
    size_bytes=460_344_344,
    sha256="99d16ed4aac0fdf0fcc82526b9b70703f3ec8c3041bf1bf44bd22751536e65db",
)


def _import_adaface_dependencies() -> tuple[Any, Any]:
    try:
        torch = importlib.import_module("torch")
    except (ImportError, OSError) as error:
        raise WorkerError(
            "pytorch-runtime-load-failed",
            f"The pinned PyTorch runtime could not be loaded: {error}",
        ) from error
    try:
        safetensors_torch = importlib.import_module("safetensors.torch")
    except (ImportError, OSError) as error:
        raise WorkerError(
            "runtime-dependency-missing",
            (
                "AdaFace requires its pinned optional environment with "
                f"safetensors installed: {error}"
            ),
        ) from error
    return torch, safetensors_torch


def _parse_architecture(properties: Any) -> str:
    architecture = str(getattr(properties, "gcnArchName", ""))
    return architecture.split(":", maxsplit=1)[0]


def _probe_device(torch: Any, ordinal: int) -> dict[str, Any]:
    try:
        device_count = int(torch.cuda.device_count())
    except Exception as error:  # noqa: BLE001 - dependency boundary
        raise WorkerError(
            "rocm-unavailable", f"could not query ROCm device count: {error}"
        ) from error
    if ordinal < 0 or ordinal >= device_count:
        raise WorkerError(
            "rocm-unavailable",
            f"ROCm device ordinal {ordinal} is outside the available range 0..{device_count - 1}",
        )
    try:
        properties = torch.cuda.get_device_properties(ordinal)
        architecture = _parse_architecture(properties)
        if architecture != "gfx1201":
            raise WorkerError(
                "device-probe-failed",
                (
                    f"ROCm device {ordinal} reports architecture {architecture!r}; "
                    "the pinned runtime requires gfx1201"
                ),
            )
        device = torch.device(f"cuda:{ordinal}")
        left = torch.tensor(
            [[1.0, 2.0], [3.0, 4.0]], dtype=torch.float32, device=device
        )
        right = torch.tensor(
            [[5.0, 6.0], [7.0, 8.0]], dtype=torch.float32, device=device
        )
        result = (left @ right).to("cpu")
        torch.cuda.synchronize(ordinal)
        if float(result[0, 0]) != 19.0 or float(result[1, 1]) != 50.0:
            raise RuntimeError("ROCm matmul produced an unexpected result")
    except WorkerError:
        raise
    except Exception as error:  # noqa: BLE001 - device boundary
        raise WorkerError(
            "device-probe-failed",
            (
                f"ROCm device {ordinal} failed allocation, transfer, matmul, or "
                f"synchronization: {error}"
            ),
        ) from error
    return {
        "index": ordinal,
        "name": str(getattr(properties, "name", f"ROCm device {ordinal}")),
        "architecture": architecture,
    }


def resolve_compute(torch: Any, arguments: WorkerArguments) -> RuntimeSelection:
    if len(arguments.devices) > 1:
        raise WorkerError(
            "invalid-arguments",
            "AdaFace accepts at most one explicit ROCm device ordinal",
        )
    if arguments.compute == "cpu":
        if arguments.devices:
            raise WorkerError(
                "invalid-arguments", "--devices cannot be used with --compute cpu"
            )
        return RuntimeSelection("cpu", "cpu", (), ())

    hip_version = getattr(getattr(torch, "version", None), "hip", None)
    try:
        cuda_available = bool(torch.cuda.is_available())
    except Exception:  # noqa: BLE001 - dependency boundary
        cuda_available = False
    if not hip_version:
        if arguments.compute == "rocm":
            raise WorkerError(
                "rocm-unavailable",
                "the pinned PyTorch runtime does not report an available ROCm/HIP device",
            )
        return RuntimeSelection(
            "auto",
            "cpu",
            (),
            (),
            (
                {
                    "code": "rocm-fallback-to-cpu",
                    "message": (
                        "ROCm was unavailable, so AdaFace inference selected the "
                        "pinned CPU PyTorch distribution."
                    ),
                },
            ),
        )
    if not cuda_available:
        raise WorkerError(
            "rocm-unavailable",
            "the pinned ROCm PyTorch runtime does not report an available HIP device",
        )

    ordinal = arguments.devices[0] if arguments.devices else 0
    runtime_device = _probe_device(torch, ordinal)
    return RuntimeSelection(
        arguments.compute,
        "rocm",
        (ordinal,),
        (runtime_device,),
    )


def _piecewise_index(torch: Any, relative: Any) -> Any:
    alpha = 1.9
    beta = 3.8
    gamma = 15.2
    absolute = relative.abs()
    inside = absolute <= alpha
    safe_absolute = torch.clamp(absolute, min=alpha)
    magnitude = (
        (
            alpha
            + torch.log(safe_absolute / alpha)
            / math.log(gamma / alpha)
            * (beta - alpha)
        )
        .round()
        .clamp(max=beta)
    )
    outside = torch.sign(relative) * magnitude
    return torch.where(inside, torch.round(relative), outside).to(torch.long)


def _product_bucket_ids(torch: Any, device: Any) -> Any:
    coordinates = torch.arange(14, dtype=torch.float32, device=device)
    rows, columns = torch.meshgrid(coordinates, coordinates, indexing="ij")
    positions = torch.stack((rows, columns), dim=-1).reshape(196, 2)
    difference = positions[:, None, :] - positions[None, :, :]
    beta_int = 3
    row = _piecewise_index(torch, difference[:, :, 0]) + beta_int
    column = _piecewise_index(torch, difference[:, :, 1]) + beta_int
    return (row * 7 + column).to(torch.long)


def _build_recognizer(torch: Any) -> Any:
    nn = torch.nn

    class Mlp(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.fc1 = nn.Linear(512, 1536)
            self.act = nn.ReLU6()
            self.fc2 = nn.Linear(1536, 512)

        def forward(self, value: Any) -> Any:
            return self.fc2(self.act(self.fc1(value)))

    class RelativePositionEncoding(nn.Module):
        def forward(self, context: Any) -> Any:
            bucket_ids = _product_bucket_ids(torch, context.device)
            batch, heads, length, _ = context.shape
            offsets = torch.arange(
                0,
                length * 49,
                49,
                dtype=bucket_ids.dtype,
                device=bucket_ids.device,
            ).view(-1, 1)
            indices = (bucket_ids + offsets).flatten()
            return context.flatten(2)[:, :, indices].view(batch, heads, length, length)

    class Attention(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.num_heads = 16
            self.scale = 32**-0.5
            self.qkv = nn.Linear(512, 1536, bias=False)
            self.attn_drop = nn.Dropout(0.0)
            self.proj = nn.Linear(512, 512)
            self.proj_drop = nn.Dropout(0.0)
            self.rpe_k = RelativePositionEncoding()

        def forward(self, value: Any, relative_keypoints: Any) -> Any:
            batch, length, width = value.shape
            qkv = (
                self.qkv(value)
                .reshape(batch, length, 3, self.num_heads, width // self.num_heads)
                .permute(2, 0, 3, 1, 4)
            )
            query, key, payload = qkv[0], qkv[1], qkv[2]
            query = query * self.scale
            attention = query @ key.transpose(-2, -1)
            attention = attention + self.rpe_k(relative_keypoints)
            attention = self.attn_drop(attention.softmax(dim=-1))
            output = attention @ payload
            output = output.transpose(1, 2).reshape(batch, length, width)
            return self.proj_drop(self.proj(output))

    class Block(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.norm1 = nn.LayerNorm(512)
            self.attn = Attention()
            self.drop_path = nn.Identity()
            self.norm2 = nn.LayerNorm(512)
            self.mlp = Mlp()

        def forward(self, value: Any, relative_keypoints: Any) -> Any:
            value = value + self.attn(self.norm1(value), relative_keypoints)
            return value + self.mlp(self.norm2(value))

    class PatchEmbed(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.proj = nn.Conv2d(3, 512, kernel_size=8, stride=8)

        def forward(self, value: Any) -> Any:
            if tuple(value.shape[-2:]) != (112, 112):
                raise WorkerError(
                    "worker-failed",
                    f"AdaFace expected 112x112 crops, got {tuple(value.shape[-2:])}",
                )
            return self.proj(value).flatten(2).transpose(1, 2)

    class Recognizer(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.patch_embed = PatchEmbed()
            self.pos_embed = nn.Parameter(torch.zeros(1, 196, 512))
            self.pos_drop = nn.Dropout(0.0)
            self.blocks = nn.ModuleList(Block() for _ in range(24))
            self.norm = nn.LayerNorm(512)
            self.feature = nn.Sequential(
                nn.Linear(196 * 512, 512, bias=False),
                nn.BatchNorm1d(512, eps=2e-5),
                nn.Linear(512, 512, bias=False),
                nn.BatchNorm1d(512, eps=2e-5),
            )
            self.keypoint_linear = nn.Linear(10, 49 * 16 * 24)

        def forward(self, images: Any, keypoints: Any) -> Any:
            value = self.pos_drop(self.patch_embed(images) + self.pos_embed)
            batch = value.shape[0]
            coordinates = torch.linspace(
                0, 1, 15, device=value.device, dtype=value.dtype
            )
            centers = (coordinates[:-1] + coordinates[1:]) / 2
            rows, columns = torch.meshgrid(centers, centers, indexing="ij")
            grid = torch.stack((columns, rows), dim=-1).reshape(1, 196, 1, 2)
            relative = (grid - keypoints.unsqueeze(1)).flatten(2)
            contexts = self.keypoint_linear(relative)
            contexts = contexts.view(batch, 196, 16 * 24, 49).transpose(1, 2)
            for block_index, block in enumerate(self.blocks):
                start = block_index * 16
                value = block(value, contexts[:, start : start + 16])
            value = self.norm(value.float()).reshape(batch, 196 * 512)
            return self.feature(value)

    return Recognizer()


def _build_aligner(torch: Any) -> tuple[Any, Any]:
    nn = torch.nn
    functional = torch.nn.functional

    def conv_bn(
        input_channels: int,
        output_channels: int,
        stride: int = 1,
        leaky: float = 0.0,
    ) -> Any:
        return nn.Sequential(
            nn.Conv2d(
                input_channels,
                output_channels,
                3,
                stride,
                1,
                bias=False,
            ),
            nn.BatchNorm2d(output_channels),
            nn.LeakyReLU(negative_slope=leaky, inplace=True),
        )

    def conv_bn_no_relu(input_channels: int, output_channels: int) -> Any:
        return nn.Sequential(
            nn.Conv2d(input_channels, output_channels, 3, 1, 1, bias=False),
            nn.BatchNorm2d(output_channels),
        )

    def conv_bn_1x1(
        input_channels: int, output_channels: int, leaky: float = 0.0
    ) -> Any:
        return nn.Sequential(
            nn.Conv2d(input_channels, output_channels, 1, 1, 0, bias=False),
            nn.BatchNorm2d(output_channels),
            nn.LeakyReLU(negative_slope=leaky, inplace=True),
        )

    def conv_dw(
        input_channels: int,
        output_channels: int,
        stride: int,
        leaky: float = 0.1,
    ) -> Any:
        return nn.Sequential(
            nn.Conv2d(
                input_channels,
                input_channels,
                3,
                stride,
                1,
                groups=input_channels,
                bias=False,
            ),
            nn.BatchNorm2d(input_channels),
            nn.LeakyReLU(negative_slope=leaky, inplace=True),
            nn.Conv2d(input_channels, output_channels, 1, 1, 0, bias=False),
            nn.BatchNorm2d(output_channels),
            nn.LeakyReLU(negative_slope=leaky, inplace=True),
        )

    class Body(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.stage1 = nn.Sequential(
                conv_bn(3, 8, 2, 0.1),
                conv_dw(8, 16, 1),
                conv_dw(16, 32, 2),
                conv_dw(32, 32, 1),
                conv_dw(32, 64, 2),
                conv_dw(64, 64, 1),
            )
            self.stage2 = nn.Sequential(
                conv_dw(64, 128, 2),
                *(conv_dw(128, 128, 1) for _ in range(5)),
            )
            self.stage3 = nn.Sequential(
                conv_dw(128, 256, 2),
                conv_dw(256, 256, 1),
            )

        def forward(self, value: Any) -> dict[str, Any]:
            stage1 = self.stage1(value)
            stage2 = self.stage2(stage1)
            stage3 = self.stage3(stage2)
            return {"1": stage1, "2": stage2, "3": stage3}

    class Fpn(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.output1 = conv_bn_1x1(64, 64, 0.1)
            self.output2 = conv_bn_1x1(128, 64, 0.1)
            self.output3 = conv_bn_1x1(256, 64, 0.1)
            self.merge1 = conv_bn(64, 64, leaky=0.1)
            self.merge2 = conv_bn(64, 64, leaky=0.1)

        def forward(self, stages: dict[str, Any]) -> list[Any]:
            values = list(stages.values())
            output1 = self.output1(values[0])
            output2 = self.output2(values[1])
            output3 = self.output3(values[2])
            output2 = self.merge2(
                output2
                + functional.interpolate(
                    output3, size=output2.shape[-2:], mode="nearest"
                )
            )
            output1 = self.merge1(
                output1
                + functional.interpolate(
                    output2, size=output1.shape[-2:], mode="nearest"
                )
            )
            return [output1, output2, output3]

    class Ssh(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.conv3X3 = conv_bn_no_relu(64, 32)
            self.conv5X5_1 = conv_bn(64, 16, leaky=0.1)
            self.conv5X5_2 = conv_bn_no_relu(16, 16)
            self.conv7X7_2 = conv_bn(16, 16, leaky=0.1)
            self.conv7x7_3 = conv_bn_no_relu(16, 16)

        def forward(self, value: Any) -> Any:
            branch3 = self.conv3X3(value)
            branch5_input = self.conv5X5_1(value)
            branch5 = self.conv5X5_2(branch5_input)
            branch7 = self.conv7x7_3(self.conv7X7_2(branch5_input))
            return functional.relu(torch.cat((branch3, branch5, branch7), dim=1))

    class PredictionHead(nn.Module):
        def __init__(self, width: int) -> None:
            super().__init__()
            self.width = width
            self.conv1x1 = nn.Conv2d(64, 2 * width, kernel_size=1)

        def forward(self, value: Any) -> Any:
            output = self.conv1x1(value).permute(0, 2, 3, 1).contiguous()
            return output.view(output.shape[0], -1, self.width)

    class MixerMlp(nn.Module):
        def __init__(self, input_width: int, hidden_width: int) -> None:
            super().__init__()
            self.fc1 = nn.Linear(input_width, hidden_width)
            self.act = nn.GELU()
            self.drop1 = nn.Dropout(0.0)
            self.norm = nn.Identity()
            self.fc2 = nn.Linear(hidden_width, input_width)
            self.drop2 = nn.Dropout(0.0)

        def forward(self, value: Any) -> Any:
            value = self.drop1(self.act(self.fc1(value)))
            return self.drop2(self.fc2(self.norm(value)))

    class MixerBlock(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.norm1 = nn.LayerNorm(16)
            self.mlp_tokens = MixerMlp(1050, 8)
            self.norm2 = nn.LayerNorm(16)
            self.mlp_channels = MixerMlp(16, 64)

        def forward(self, value: Any) -> Any:
            value = value + self.mlp_tokens(
                self.norm1(value).transpose(1, 2)
            ).transpose(1, 2)
            return value + self.mlp_channels(self.norm2(value))

    class Aligner(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.body = Body()
            self.fpn = Fpn()
            self.ssh1 = Ssh()
            self.ssh2 = Ssh()
            self.ssh3 = Ssh()
            self.ClassHead = nn.ModuleList(PredictionHead(2) for _ in range(3))
            self.BboxHead = nn.ModuleList(PredictionHead(4) for _ in range(3))
            self.LandmarkHead = nn.ModuleList(PredictionHead(10) for _ in range(3))
            self.aggregator = nn.Sequential(
                MixerBlock(), MixerBlock(), MixerBlock(), nn.Linear(16, 1)
            )

        def forward(self, images: Any, priors: Any) -> tuple[Any, ...]:
            pyramid = self.fpn(self.body(images))
            features = [
                self.ssh1(pyramid[0]),
                self.ssh2(pyramid[1]),
                self.ssh3(pyramid[2]),
            ]
            boxes = torch.cat(
                [self.BboxHead[index](value) for index, value in enumerate(features)],
                dim=1,
            )
            classes = torch.cat(
                [self.ClassHead[index](value) for index, value in enumerate(features)],
                dim=1,
            )
            landmarks = torch.cat(
                [
                    self.LandmarkHead[index](value)
                    for index, value in enumerate(features)
                ],
                dim=1,
            )
            priors = (
                priors.to(images.device).unsqueeze(0).expand(images.shape[0], -1, -1)
            )
            decoded_boxes = torch.cat(
                (
                    priors[:, :, :2] + boxes[:, :, :2] * 0.1 * priors[:, :, 2:],
                    priors[:, :, 2:] * torch.exp(boxes[:, :, 2:] * 0.2),
                ),
                dim=-1,
            )
            decoded_boxes[:, :, :2] -= decoded_boxes[:, :, 2:] / 2
            decoded_boxes[:, :, 2:] += decoded_boxes[:, :, :2]
            decoded_landmarks = torch.cat(
                tuple(
                    priors[:, :, :2]
                    + landmarks[:, :, start : start + 2] * 0.1 * priors[:, :, 2:]
                    for start in range(0, 10, 2)
                ),
                dim=-1,
            )
            combined = torch.cat((decoded_boxes, classes, decoded_landmarks), dim=2)
            weights = functional.softmax(self.aggregator(combined), dim=1)
            merged = torch.sum(weights * combined, dim=1)
            return boxes, functional.softmax(classes, dim=-1), landmarks, merged, None

    anchors: list[float] = []
    for step, sizes in zip((8, 16, 32), ((64, 80), (96, 112), (128, 144))):
        feature_size = math.ceil(160 / step)
        for row in range(feature_size):
            for column in range(feature_size):
                for size in sizes:
                    anchors.extend(
                        (
                            (column + 0.5) * step / 160,
                            (row + 0.5) * step / 160,
                            size / 160,
                            size / 160,
                        )
                    )
    priors = torch.tensor(anchors, dtype=torch.float32).view(-1, 4)
    return Aligner(), priors


def _load_strict_safetensors(
    model: Any,
    path: Path,
    safetensors_torch: Any,
    component: str,
) -> None:
    try:
        state = safetensors_torch.load_file(str(path), device="cpu")
    except Exception as error:  # noqa: BLE001 - safetensors boundary
        raise WorkerError(
            "model-integrity-failed",
            f"could not decode pinned {component} safetensors: {error}",
        ) from error
    prefix = "model.net."
    invalid_names = sorted(name for name in state if not name.startswith(prefix))
    if invalid_names:
        raise WorkerError(
            "model-state-mismatch",
            f"{component} contained unexpected tensor names: {invalid_names[:5]!r}",
        )
    stripped = {name.removeprefix(prefix): tensor for name, tensor in state.items()}
    expected = model.state_dict()
    missing = sorted(set(expected) - set(stripped))
    unexpected = sorted(set(stripped) - set(expected))
    shape_mismatches = sorted(
        name
        for name in set(expected) & set(stripped)
        if tuple(expected[name].shape) != tuple(stripped[name].shape)
    )
    if missing or unexpected or shape_mismatches:
        raise WorkerError(
            "model-state-mismatch",
            (
                f"{component} strict state mismatch; missing={missing[:5]!r}, "
                f"unexpected={unexpected[:5]!r}, shape={shape_mismatches[:5]!r}"
            ),
        )
    try:
        model.load_state_dict(stripped, strict=True)
    except Exception as error:  # noqa: BLE001 - torch boundary
        raise WorkerError(
            "model-state-mismatch",
            f"{component} strict state load failed: {error}",
        ) from error


@dataclass
class AdaFaceAnalysis:
    detector: Any
    aligner: Any
    recognizer: Any
    priors: Any
    torch: Any
    device: Any
    batch_size: int

    @dataclass(frozen=True)
    class EmbeddingResult:
        embedding: np.ndarray | None
        aligner_confidence: float

    @staticmethod
    def _square_face_crop(image: np.ndarray, box: Any) -> np.ndarray:
        image_height, image_width = image.shape[:2]
        coordinates = np.asarray(box[:4], dtype=np.float64)
        if coordinates.shape != (4,) or not np.all(np.isfinite(coordinates)):
            raise WorkerError(
                "worker-failed", "det_10g returned non-finite face coordinates"
            )
        x1 = float(np.clip(coordinates[0], 0, image_width))
        y1 = float(np.clip(coordinates[1], 0, image_height))
        x2 = float(np.clip(coordinates[2], 0, image_width))
        y2 = float(np.clip(coordinates[3], 0, image_height))
        face_width = x2 - x1
        face_height = y2 - y1
        if face_width <= 0 or face_height <= 0:
            raise WorkerError(
                "worker-failed", "det_10g returned an empty face box after clipping"
            )
        side = max(face_width, face_height) * (1 + 2 * FACE_CROP_MARGIN_RATIO)
        center_x = (x1 + x2) / 2
        center_y = (y1 + y2) / 2
        left = center_x - side / 2
        top = center_y - side / 2
        scale = 112.0 / side
        transform = np.array(
            [[scale, 0.0, -left * scale], [0.0, scale, -top * scale]],
            dtype=np.float32,
        )
        return cv2.warpAffine(
            image,
            transform,
            (112, 112),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(0, 0, 0),
        )

    def _embed(self, crops: list[np.ndarray]) -> list[EmbeddingResult]:
        if not crops:
            return []
        results: list[AdaFaceAnalysis.EmbeddingResult] = []
        functional = self.torch.nn.functional
        for start in range(0, len(crops), self.batch_size):
            batch_crops = crops[start : start + self.batch_size]
            rgb = np.stack(
                [cv2.cvtColor(crop, cv2.COLOR_BGR2RGB) for crop in batch_crops]
            )
            images = (
                self.torch.from_numpy(rgb)
                .permute(0, 3, 1, 2)
                .to(device=self.device, dtype=self.torch.float32)
                / 127.5
                - 1.0
            )
            with self.torch.inference_mode():
                aligner_input = functional.interpolate(
                    images, size=(160, 160), mode="bilinear", align_corners=True
                ).flip(1)
                _, _, _, merged, _ = self.aligner(aligner_input, self.priors)
                confidence = functional.softmax(merged[:, 4:6], dim=-1)[:, 1]
                original_landmarks = merged[:, 6:16].view(-1, 5, 2)
                accepted_indices = (
                    (confidence >= DFA_CONFIDENCE_THRESHOLD)
                    .nonzero(as_tuple=False)
                    .flatten()
                )
                accepted_embeddings: dict[int, np.ndarray] = {}
                if int(accepted_indices.numel()) > 0:
                    embeddings = self.recognizer(
                        images.index_select(0, accepted_indices),
                        original_landmarks.index_select(0, accepted_indices),
                    )
                    embeddings = functional.normalize(embeddings.float(), p=2, dim=1)
                    indices = accepted_indices.to("cpu").tolist()
                    values = embeddings.to("cpu").numpy().astype(np.float32)
                    accepted_embeddings.update(zip(indices, values))
            for index, score in enumerate(confidence.to("cpu").tolist()):
                results.append(
                    self.EmbeddingResult(
                        embedding=accepted_embeddings.get(index),
                        aligner_confidence=float(score),
                    )
                )
        return results

    def get(self, image: np.ndarray) -> list[Any]:
        try:
            boxes, landmarks = self.detector.detect(image, max_num=32, metric="default")
        except Exception as error:  # noqa: BLE001 - model boundary
            raise WorkerError(
                "worker-failed", f"det_10g face detection failed: {error}"
            ) from error
        if boxes is None or len(boxes) == 0:
            return []
        if len(boxes) > 32:
            raise WorkerError(
                "input-limit-exceeded",
                "det_10g returned more than 32 faces for one image",
            )
        if landmarks is None or len(landmarks) != len(boxes):
            raise WorkerError(
                "missing-landmarks",
                "det_10g did not return one five-point set per face",
            )
        crops = [self._square_face_crop(image, box) for box in boxes]
        embedding_results = self._embed(crops)
        return [
            SimpleNamespace(
                bbox=np.asarray(box[:4], dtype=np.float32),
                det_score=float(box[4]),
                kps=np.asarray(points, dtype=np.float32),
                embedding=result.embedding,
                embedding_reason=(
                    "aligner-confidence-failed" if result.embedding is None else None
                ),
                aligner_confidence=result.aligner_confidence,
            )
            for box, points, result in zip(boxes, landmarks, embedding_results)
        ]


def _resolve_artifact_paths(
    arguments: WorkerArguments, detector_fallback: Any
) -> tuple[Path, Path, Path]:
    if (arguments.aligner_path is None) != (arguments.recognizer_path is None):
        raise WorkerError(
            "invalid-arguments",
            "--aligner-path and --recognizer-path must be supplied together",
        )
    if arguments.detector_path is None:
        detector_artifacts = detector_fallback(
            replace(arguments, backend="buffalo-l", compute="cpu", devices=())
        )
        detector_path = verify_pinned_file(Path(detector_artifacts[0]), DETECTOR)
    else:
        detector_path = verify_pinned_file(arguments.detector_path, DETECTOR)
    if arguments.aligner_path is None or arguments.recognizer_path is None:
        aligner_path = ensure_pinned_artifact(
            arguments.model_root, ALIGNER, arguments.accept_model_license
        )
        recognizer_path = ensure_pinned_artifact(
            arguments.model_root, RECOGNIZER, arguments.accept_model_license
        )
    else:
        aligner_path = verify_pinned_file(arguments.aligner_path, ALIGNER)
        recognizer_path = verify_pinned_file(arguments.recognizer_path, RECOGNIZER)
    return detector_path, aligner_path, recognizer_path


def load_backend(arguments: WorkerArguments, detector_fallback: Any) -> LoadedBackend:
    torch, safetensors_torch = _import_adaface_dependencies()
    selection = resolve_compute(torch, arguments)
    detector_path, aligner_path, recognizer_path = _resolve_artifact_paths(
        arguments, detector_fallback
    )
    try:
        model_zoo = importlib.import_module("insightface.model_zoo")
        face_align = importlib.import_module("insightface.utils.face_align")
    except ImportError as error:
        raise WorkerError(
            "runtime-dependency-missing",
            f"AdaFace detector dependencies are unavailable: {error}",
        ) from error

    print(
        f"[photo-face] loading AdaFace KP-RPE on {selection.actual_compute}",
        file=sys.stderr,
    )
    device = torch.device(
        f"cuda:{selection.device_ordinals[0]}"
        if selection.actual_compute == "rocm"
        else "cpu"
    )
    detector = model_zoo.get_model(
        str(detector_path), providers=["CPUExecutionProvider"]
    )
    detector.prepare(
        ctx_id=-1, input_size=(640, 640), det_thresh=arguments.detection_threshold
    )
    actual_providers = tuple(detector.session.get_providers())
    if actual_providers != ("CPUExecutionProvider",):
        raise WorkerError(
            "unexpected-execution-provider",
            (
                f"detector initialized with providers {actual_providers!r}, expected "
                "('CPUExecutionProvider',)"
            ),
        )

    aligner, priors = _build_aligner(torch)
    recognizer = _build_recognizer(torch)
    _load_strict_safetensors(aligner, aligner_path, safetensors_torch, "aligner")
    _load_strict_safetensors(
        recognizer, recognizer_path, safetensors_torch, "recognizer"
    )
    aligner = aligner.eval().to(device=device, dtype=torch.float32)
    recognizer = recognizer.eval().to(device=device, dtype=torch.float32)
    analysis = AdaFaceAnalysis(
        detector=detector,
        aligner=aligner,
        recognizer=recognizer,
        priors=priors,
        torch=torch,
        device=device,
        batch_size=arguments.batch_size,
    )
    hip_version = getattr(getattr(torch, "version", None), "hip", None)
    runtime: dict[str, Any] = {
        "framework": "pytorch",
        "distribution": "rocm72" if hip_version else "cpu",
        "packageVersion": str(torch.__version__),
        "actualCompute": selection.actual_compute,
        "precision": "fp32",
        "devices": list(selection.runtime_devices),
        "warnings": list(selection.warnings),
    }
    if selection.actual_compute == "rocm" and hip_version:
        runtime["hipVersion"] = str(hip_version)
    model = {
        "backend": BACKEND,
        "name": MODEL_NAME,
        "codeRevision": CODE_REVISION,
        "runtime": runtime,
        "root": str(arguments.model_root),
        "components": [
            component_payload(detector_path, DETECTOR),
            component_payload(aligner_path, ALIGNER),
            component_payload(recognizer_path, RECOGNIZER),
        ],
    }
    return LoadedBackend(
        analysis=analysis,
        align_face=face_align.norm_crop,
        model=model,
        selection=selection,
        artifacts=(detector_path, aligner_path, recognizer_path),
    )
