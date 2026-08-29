# Photo face worker

This pinned Python 3.12 worker runs InsightFace `buffalo_l` locally. It reads
reference and candidate images without modifying them and emits one JSON object
to standard output; model and scan progress goes to standard error.

The InsightFace source code and pretrained models have different licensing
terms. The worker will not acquire `buffalo_l` until the caller passes
`--accept-model-license`. That flag records the caller's confirmation; it does
not grant or alter any license.

```sh
uv run --project packages/tooling/tool/cli/python/photo-face \
  --frozen --python 3.12 -m beep_photo_face \
  --references /path/to/references \
  --candidates /path/to/candidates \
  --model-root /path/to/insightface-cache \
  --accept-model-license
```
