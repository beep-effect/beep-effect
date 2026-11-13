# Local person matching

`bun run beep files match-person` scans JPG/JPEG, PNG, and WebP photos against
trusted single-face references. It runs entirely in the CLI process using
`onnxruntime-node` and `sharp`, with CPUExecutionProvider. It needs no Python,
uv, PyTorch, ROCm installation, or GPU. HEIC and TIFF are skipped.

```sh
bun run beep files match-person \
  --references /photos/references \
  --dir /photos/candidates \
  --manifest /reports/person-match.json \
  --accept-model-license
```

Add `--out-dir /photos/review` to copy accepted and review images without changing
sources. Add `--recursive` to include subdirectories. Accepted recursive reference
filenames must be unique. Raw face embeddings stay in memory and never enter the
manifest. Cosine scores are model-specific measurements, not probabilities.
Calibrate the match and review thresholds on a labeled sample of your library.

## Models and terms

Linux x64 defaults to AdaFace KP-RPE. Other supported hosts default to Buffalo.
Select either explicitly with `--backend adaface-kprpe` or `--backend buffalo-l`.
The first run downloads checksum-pinned models into
`${XDG_CACHE_HOME:-$HOME/.cache}/beep/photo-face`; `--cache-dir` overrides this.
The same artifact sizes, SHA-256 hashes, and upstream revisions used by the
former worker remain enforced. The manifest records original model provenance
and the ONNX Runtime version actually used.

The source projects use MIT licenses, but checkpoint and training-dataset terms
also apply. Review the [InsightFace terms](https://github.com/deepinsight/insightface/blob/master/server/LICENSING.md),
[DFA MobileNet model](https://huggingface.co/minchul/cvlface_DFA_mobilenet/tree/8317e6dda53d91e7074979923144c2cc08906a33),
and [AdaFace KP-RPE model](https://huggingface.co/minchul/cvlface_adaface_vit_base_kprpe_webface12m/tree/daefd5012d369588bd214fbaf4cc6b1d286e7066)
before passing `--accept-model-license`. This flag records acknowledgment; it
neither grants nor changes rights. The vendored graph's MIT notice is retained
in [UPSTREAM-CVLFACE-LICENSE.txt](UPSTREAM-CVLFACE-LICENSE.txt).

## Inference and rejection rules

Buffalo runs `det_10g.onnx` and `w600k_r50.onnx`. SCRFD detections pass through
non-maximum suppression. Five-point similarity alignment produces a 112x112
recognition crop. Embeddings are normalized before scoring.

AdaFace uses the same detector, then takes a square crop with 25% context on
each side and resamples it to 112x112 without geometric alignment. DFA predicts
landmarks on that crop. The unaligned crop and original normalized DFA landmarks
feed the fixed 24-block ViT KP-RPE recognizer. The CLI builds these two ONNX
graphs locally from the original pinned safetensors weights and caches them.
No separately hosted graph or executable model code is downloaded.

DFA confidence below 0.20 excludes a crop from recognition. References reject
the whole image if any detected crop fails. A candidate with only rejected
crops is `no-face`; a candidate with both accepted and rejected crops is forced
to `review`. Both carry `aligner-confidence-failed`. Quality checks still use
a geometrically aligned crop, including on the AdaFace path.

`--compute`, `--devices`, `BEEP_PHOTO_FACE_ROCM_LIBRARY_PATH`, and `BEEP_UV_PATH`
have been removed. There is no automatic environment fallback. CPU inference
uses bounded sessions and releases their native resources when the scan ends.

The fixed CPU graphs process one face at a time. `--batch-size` was removed;
reports record the actual batch size of one.
