# Photo face worker

This pinned Python 3.12 worker runs either the portable InsightFace `buffalo_l`
backend or the high-quality CVLFace AdaFace ViT-Base KP-RPE backend locally. It
reads reference and candidate images without modifying them and emits one JSON
object to standard output; model and scan progress goes to standard error.

The worker scans JPG/JPEG, PNG, and WebP files. Other formats, including HEIC
and TIFF, are skipped and are not included in report totals.

The InsightFace and CVLFace source code is MIT-licensed, but the checkpoints
also carry model and training-dataset terms. Review the upstream
[`buffalo_l` licensing terms](https://github.com/deepinsight/insightface/blob/master/server/LICENSING.md)
and the pinned
[DFA MobileNet](https://huggingface.co/minchul/cvlface_DFA_mobilenet/tree/8317e6dda53d91e7074979923144c2cc08906a33)
and
[AdaFace KP-RPE](https://huggingface.co/minchul/cvlface_adaface_vit_base_kprpe_webface12m/tree/daefd5012d369588bd214fbaf4cc6b1d286e7066)
model cards before passing
`--accept-model-license`. The flag records the caller's confirmation; it does
not grant or alter any license.

```sh
uv run --project packages/tooling/tool/cli/python/photo-face \
  --frozen --python 3.12 -m beep_photo_face \
  --references /path/to/references \
  --candidates /path/to/candidates \
  --model-root /path/to/insightface-cache \
  --accept-model-license
```

AdaFace is isolated behind an optional Linux x64 environment so an ordinary
Buffalo run does not install the 1.6 GB ROCm PyTorch wheel. It uses only pinned
`safetensors` weights and the vendored fixed inference graph; remote Python code
is never loaded.

The pinned AMD wheel dynamically links ROCm's `libhipsparselt.so.0`. On
CachyOS, install the matching `hipsparselt` package. For
`bun run beep files match-person`, `BEEP_PHOTO_FACE_ROCM_LIBRARY_PATH` is the
preferred override: set it to one directory containing the compatible native
library, not a colon-separated list. The repo CLI prepends that directory to
the worker's library search path. When invoking this Python worker directly,
supply the library directory together with the matching system
`/opt/rocm/lib` through the parent process's `LD_LIBRARY_PATH`. A missing
library is returned as the typed `runtime-dependency-missing` failure.

The repo CLI defaults to AdaFace on Linux x64. Linux arm64, macOS x64/arm64,
and Windows x64 default to Buffalo CPU. Other host/architecture pairs fail
before cache or model acquisition because the frozen environment has no
complete wheel set for them. Explicit AdaFace selection outside Linux x64
fails at the same preflight boundary. This complete AdaFace example requires
ROCm device 0 and writes only the requested manifest; add `--out-dir` when
non-destructive accepted/review copies are also wanted:

```sh
BEEP_PHOTO_FACE_ROCM_LIBRARY_PATH=/path/to/compatible/rocm/lib \
  bun run beep files match-person \
  --dir /path/to/candidate-photos \
  --references /path/to/reference-photos \
  --manifest /path/to/person-match-report.json \
  --compute rocm \
  --devices 0 \
  --accept-model-license
```

`--devices` accepts zero or exactly one non-negative ROCm device ordinal. With
no explicit ordinal, AdaFace probes device 0. One worker uses one GPU and
reports at most that one selected `gfx1201` device in provenance; it never
shards an inference run across multiple GPUs.

For each `det_10g` box, the AdaFace path takes a deterministic square crop with
25% context on every side and resizes it to 112x112 without geometric
alignment. DFA predicts landmarks on that crop; the same unaligned crop and
DFA's original normalized landmarks feed KP-RPE. A detected crop with DFA
face-confidence below 0.20 is excluded from recognition. If every crop fails,
the image is `no-face`; if only some fail, valid faces remain scored but the
image is forced to `review`. Both cases carry the durable
`aligner-confidence-failed` reason, and references reject the complete image
after any alignment rejection. This avoids both discarding a valid group and
auto-accepting an ambiguously detected group.

```sh
LD_LIBRARY_PATH=/path/to/compatible/rocm/lib:/opt/rocm/lib \
  uv run --project packages/tooling/tool/cli/python/photo-face \
  --frozen --python 3.12 --extra adaface -m beep_photo_face \
  --backend adaface-kprpe \
  --compute auto \
  --references /path/to/references \
  --candidates /path/to/candidates \
  --model-root /path/to/model-cache \
  --accept-model-license
```
