# Photo face worker

This pinned Python 3.12 worker runs InsightFace `buffalo_l` locally. It reads
reference and candidate images without modifying them and emits one JSON object
to standard output; model and scan progress goes to standard error.

The worker scans JPG/JPEG, PNG, and WebP files. Other formats, including HEIC
and TIFF, are skipped and are not included in report totals.

The InsightFace source code is MIT-licensed, but its published model packages
are limited to non-commercial academic research. Review the upstream
[`buffalo_l` licensing terms](https://github.com/deepinsight/insightface/blob/master/server/LICENSING.md)
before passing `--accept-model-license`. The flag records the caller's
confirmation; it does not grant or alter any license.

```sh
uv run --project packages/tooling/tool/cli/python/photo-face \
  --frozen --python 3.12 -m beep_photo_face \
  --references /path/to/references \
  --candidates /path/to/candidates \
  --model-root /path/to/insightface-cache \
  --accept-model-license
```
