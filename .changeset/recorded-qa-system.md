---
{}
---

No release: land the UI Verification System — recorded browser QA with
correlated action events, precise artifact extraction, embedded provenance,
and a schema-validated vision-judge loop.

Two recording lanes share one artifact pipeline. Lane A drives the playwright
harness under `bun run beep qa record --lane playwright`: the browser context
records webm video while a dependency-free witness script (served by a local
collector and injected as one init script) logs pointer, hover, focus,
transition, animation, and marker events with `performance.timeOrigin`-based
epoch timestamps — non-printable key identities only, no keystroke logging by
construction. Lane B records the real Chrome window through `@beep/obs`, a
new effect-native obs-websocket v5 driver (SHA256 challenge auth, HashMap +
Deferred request correlation, sliding-PubSub event stream) whose
`RecordStateChanged` receipt anchors the video clock; scene provisioning is
idempotent and persists the Wayland PipeWire portal restore token.

Clock correlation is the load-bearing piece: Lane A renders an 8-flip corner
beacon whose paint-adjacent timestamps are least-squares fitted against
frames located via the new `@beep/ffmpeg` `probeRegionLuminance`
(signalstats) op — the live integration test recovers a synthetic offset at
8.33 ms RMS. Every failure degrades (beacon → obs-record-state →
assumed-start) rather than aborting, and low confidence pads extraction
windows instead of lying about precision.

`beep qa extract` turns event windows into evidence via new `@beep/ffmpeg`
ops — input-seek-accurate `extractFramesAt`, single-command palettegen GIFs,
JPEG contact sheets, `-c copy` container-metadata remux — under a
property-tested byte-budget ladder that records every degradation in the
plan's `dropped` list. Provenance is one `CaptureProvenance` schema encoded
into each artifact's native channel: the new `@beep/exiftool` driver writes
the custom `XMP-beepQA` namespace into PNG/JPEG/GIF (exiftool cannot write
Matroska, so webm/mkv/mp4 carry `BEEP_QA_*` container tags via ffmpeg).

The judge stops being a prose convention: `beep qa judge-pack` builds a
byte-budgeted evidence manifest plus an event timeline, the codex vision
judge emits `qa-inventory/v1` JSON, and `judge-ingest` — the only inventory
writer — cross-checks every evidence path and event reference before
rendering the human inventory. GIFs are for humans; the judge reads frame
strips and contact sheets.

browser-qa-loop v0.2.0 rewrites the loop around recording (and corrects the
portless guidance: registrations fail loudly, so worktree lanes use
lane-suffixed names, never raw ports). Three new skills — `qa-session-ops`,
`exif-provenance` (with a metadata-standards primer), and
`motion-evidence-review` — cover machinery, provenance, and evidence
literacy. The `goals/recorded-qa-acceptance` packet gates adoption on a
falsification round: revert one dock-react pointer fix, prove the judge
catches the reintroduced selection smear, restore, and close on two clean
rounds across both lanes.
