# Photo-face port parity

Measured on Linux x64, CPUExecutionProvider, 2026-11-13. The reference is the
unchanged frozen Python worker copied to `~/.cache/beep/photo-face-parity/`.
Its pinned CPU environment loaded InsightFace 1.0.1, ONNX Runtime 1.23.2 and
PyTorch 2.13.0+cpu. The port uses onnxruntime-node 1.31.1 and sharp. All four
original model artifact SHA-256 pins were verified before inference.

## Fixtures and scope

The committed fixtures in `packages/tooling/tool/cli/test/fixtures/photo-face/`
use NASA's public-domain Eileen Collins photograph from scikit-image, plus a
384x384 resized version. The fixture README records the source and terms.
`python-reference.json` retains Python embeddings, detector boxes and scores,
landmarks, DFA confidence, brightness, Laplacian variance, area and flags for
both backends. No personal library photos were used. Two sizes of one identity
prove this conversion on these inputs; they do not measure recognition accuracy
across identities or demographic groups.

## End-to-end image parity

Detection threshold 0.5, minimum face area 0.5%. Each fixture has one face.

| Backend | Fixture | Embedding cosine | Box IoU | Detector score absolute delta | DFA confidence absolute delta |
| --- | --- | ---: | ---: | ---: | ---: |
| Buffalo | astronaut.png | 0.999909999 | 0.999164222 | 0.000028134 | 0 |
| Buffalo | astronaut-small.png | 0.999952318 | 0.999202002 | 0.000167251 | 0 |
| AdaFace KP-RPE | astronaut.png | 0.999825451 | 0.999164222 | 0.000028134 | 0.000001659 |
| AdaFace KP-RPE | astronaut-small.png | 0.999688746 | 0.999202002 | 0.000167251 | 0.000000214 |

Quality flags agree exactly. Maximum area delta is 0.001006 percentage points;
maximum mean brightness delta is 0.004545 on the 0–255 scale. Maximum relative
Laplacian-variance delta is 0.003850 (0.385%). Remaining differences come from
image interpolation/rounding and the CPU inference implementations.

The committed parity test requires cosine >= 0.999, box IoU >= 0.998, detector
score delta < 0.001, DFA confidence delta < 0.00001, area delta < 0.005 percentage
points, brightness delta < 0.05 and relative blur-variance delta < 0.005.
Quality flags and detected face counts must agree exactly.

## Fixed-graph check

A deterministic RGB tensor ramp from -1 to 1 isolates graph conversion from
image decoding. The recognizer additionally receives fixed five-point normalized
landmarks. Comparing TypeScript-generated ONNX with the vendored PyTorch graph:

| Component | Maximum absolute output delta | Cosine |
| --- | ---: | ---: |
| DFA MobileNet merged output | 0.000001073 | 0.9999999999999555 |
| ViT KP-RPE embedding before normalization | 0.000010729 | 0.9999999999967769 |

The source safetensors files are unchanged. The graph compiler implements the
fixed MobileNet/FPN/SSH/mixer aligner and 24-block ViT, including product bucket
indices, relative-keypoint contexts, attention, layer normalization and feature
batch normalization. It downloads no executable upstream code or replacement
ONNX artifact. Generated graph cache names include both source hashes and the
graph format version; cached bytes must match deterministic compilation.

## Reproduction

The normal suite never downloads models. To run parity, set
`BEEP_PHOTO_FACE_PARITY_MODELS` to a directory containing `det_10g.onnx`,
`w600k_r50.onnx`, `aligner.safetensors`, `recognizer.safetensors` and
`buffalo_l.zip`, then run from `packages/tooling/tool/cli`:

```sh
BEEP_PHOTO_FACE_PARITY_MODELS=/path/to/pinned-models \
  bunx vitest run test/photo-face-parity.test.ts
```

The test verifies each SHA-256 before loading and builds both AdaFace graphs
from safetensors in TypeScript. The JSON fixture remains usable when models are
unavailable; model-dependent assertions are explicitly skipped in that case.

Both `bun run beep files match-person` backends completed a real reference and
candidate scan using these fixtures, wrote a schema-valid manifest and reported
one solo match, with no Python executable or subprocess on the inference path.
The Buffalo run also exercised extraction of the verified pinned ZIP archive.
The focused run covering parity, Files commands, portability and dependency
review passed 126 tests. Publication and final quality receipts are recorded by
Yeet on the final head.

## Review wave 1 regressions

The focused suite now passes 152 tests across six files, including the original
embedding/box/quality tolerances, AdaFace followed by Buffalo in one cache,
interrupted ONNX artifact repair, truncated generated-graph repair and concurrent
graph publication. These integration checks reuse the pinned local models and
Buffalo ZIP without downloads; the parity environment also needs buffalo_l.zip.
A model-independent test rejects a zero-magnitude reference as invalid-embedding
while retaining a valid second reference. Intel macOS fails native preflight.
Buffalo reports the loaded onnxruntime-node package and runtime version, while
historical InsightFace provenance remains readable.

## Model-free hosted coverage (review wave 1)

The package coverage run with BEEP_PHOTO_FACE_PARITY_MODELS unset passed 140 tests
and skipped the three pinned-model cases. Native sessions are injected through
PersonMatchOnnxResources; canned SCRFD, DFA and recognizer tensors drive the
actual inference and worker pipeline over tiny PNGs generated by sharp. Tiny
authenticated ZIP entries and source digests exercise installation, interrupted
artifact repair, concurrent graph repair, unsafe paths and cache I/O failures.
No coverage floor changed. All four rows exceed their base floors:

| Source | Lines | Statements | Branches | Functions |
| --- | ---: | ---: | ---: | ---: |
| MatchPerson.worker-service.ts | 96.50 | 93.49 | 82.14 | 91.52 |
| MatchPerson.model-store.ts | 87.12 | 87.45 | 75.70 | 72.50 |
| MatchPerson.errors.ts | 100 | 100 | 100 | 100 |
| MatchPerson.schemas.ts | 100 | 100 | 100 | 100 |

The retired devices CLI decoder was removed after confirming it had no live
consumer; historical report device fields remain readable. Coverage was run
through the package coverage script on the six relevant test files, including
photo-face-worker, photo-face-parity, files-command, portability and both model
store suites, with the coverage include restricted to these four source rows.
