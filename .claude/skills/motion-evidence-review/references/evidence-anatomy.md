# Evidence anatomy

Session dir (`.beep/qa/round-N/`):

```
manifest.json          # legacy harness record (scenarios, assertions, screenshots)
session.json           # SessionManifest — session, clockSync, artifacts, extractionPlan
events.ndjson          # one ActionEvent per line, seq-ordered
video/                 # capture.webm|mkv (+ capture.norm.mp4 normalization, record-hint.json)
frames/                # timestamp-precise PNG frames and strips
clips/                 # GIFs + mp4 snippets — HUMANS ONLY, judges never open
sheets/                # JPEG contact sheets
judge/                 # timeline.md, manifest.json (incl. dropped), prompt.md, stdout.txt
inventory.json + .md   # the judgment (written by judge-ingest only)
report.md              # session summary: sync confidence, budgets, warnings
```

## Frames and strips

Extracted at explicit timestamps (input-seek accurate). Names carry the
window id and index; ORDER = temporal order = filename index order. Each
frame's `XMP-beepQA` provenance holds its exact `capturedAtEpochMs`. A
"3-frame hover strip" is enter−50 ms / enter+150 ms / leave+50 ms by default
rule — the middle frame is the one that must show the hover style.

## Contact sheets

`tile=CxR` grids read left→right, top→bottom, sampled EVENLY across the
window (`fps = cols·rows / duration`) — cell (row r, col c) ≈
`start + (r·cols + c + 0.5)/(cols·rows) · duration`. Sheets are JPEG q~80:
fine for layout/smear/ghost detection, unreliable for 1-px hairlines and
subtle contrast — pull the corresponding `frames/` PNG before claiming those.

## GIFs

Sampled (default 10–15 fps), width-capped (≤640), palette-quantized
(≤256 colors). Good for: showing a reviewer the smear happening. Bad for:
timing (sampling), color claims (quantization), fine detail (scaling).
`session.json` artifacts records each GIF's source window + `fileSizeBytes`.

## The extraction plan is evidence too

`session.json → extractionPlan`: `windows[]` (what was extracted and WHY —
trigger + seq range) and `dropped[]` (what was not, with reason:
over-budget, merged, degraded-to-strip, zero-length). An artifact that
doesn't exist for a gesture usually means a dropped/merged window, not a
capture failure — check here before re-recording.
