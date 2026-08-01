---
name: exif-provenance
description: >
  Read, write, and verify QA-artifact provenance metadata: the XMP-beepQA
  namespace, the @beep/exiftool driver, and exiftool/ffprobe inspection
  recipes for frames, GIFs, contact sheets, and videos. Use when checking
  where an artifact came from, stamping provenance, debugging missing or
  mangled tags — or learning how EXIF, IPTC, XMP, and C2PA actually relate.
version: 0.1.0
status: active
---

# EXIF / XMP Provenance

Every artifact `beep qa extract` writes is self-describing: one
`CaptureProvenance` schema, *encoded* into each artifact's native metadata
channel. The sidecar `session.json` stays canonical (schema is truth); the
embedded copy makes any frame answer "where did you come from?" on its own.

## The channels (who writes what)

| Artifact | Channel | Writer |
|---|---|---|
| PNG frames / strips | XMP packet (`iTXt`) | `@beep/exiftool` `writeXmpPacket` |
| JPEG contact sheets | XMP packet (APP1) | `@beep/exiftool` `writeXmpPacket` |
| GIF clips | XMP via GIF89a Application Extension | `@beep/exiftool` `writeXmpPacket` |
| webm / mkv / mp4 | Container tags (`BEEP_QA_*`) | `@beep/ffmpeg` `writeContainerMetadata` |

exiftool cannot write Matroska (read-only) — that is WHY video containers go
through ffmpeg remux. The driver enforces this split and errors with a
pointer if you aim `writeXmpPacket` at a video.

## The namespace

`XMP-beepQA`, URI `https://ns.beep.sh/qa/1.0/` — field-by-field spec in
`references/xmp-beepqa-namespace.md`. The driver materializes its own
exiftool `-config`; `resources/beepqa.ExifTool_config` is the same definition
for MANUAL inspection:

```sh
exiftool -config .claude/skills/exif-provenance/resources/beepqa.ExifTool_config \
  -G1 -a '-XMP-beepQA:*' frames/drag-sash_0004.png
```

(Without `-config`, exiftool still SHOWS unknown-namespace XMP tags — you
only need the config to write or to get canonical group names.)

## Common operations

- Verify a frame's provenance: `exiftool -G1 -a -XMP:all <file>` — expect
  sessionId, scenarioName, actionId, capturedAtEpochMs, sourceVideo,
  clockOffsetMs, commitSha.
- Verify a video: `ffprobe -v error -show_entries format_tags -of json <file>`
  — expect `BEEP_QA_SESSION_ID` etc.
- Round-trip check after any pipeline change: write → read back → decode with
  `BeepQaProvenance` from `@beep/exiftool`. The integration test
  `packages/drivers/exiftool/test/integration` is the executable version.
- Full inspection recipes: `references/inspection-recipes.md`.

## Learning track

`references/metadata-standards-primer.md` — EXIF vs IPTC vs XMP vs C2PA
through a schema lens (closed records vs extensible RDF vs signed manifests),
where each lives inside JPEG/PNG/GIF/MP4 containers, and what survives
re-encode. The `XMP-beepQA` namespace is the worked example throughout.

## Gotchas

- exiftool `-j -G1` output CAPITALIZES custom tag names (`SessionId`), and
  the driver's decode mapping accounts for it — when writing new fields,
  update the mapping AND keep the `raw` record so nothing is lost.
- ffmpeg re-encode DROPS XMP from images it processes; the pipeline stamps
  provenance as the LAST step after all encodes. If a tag is missing,
  suspect a step reordering first.
- Never put secrets or absolute home paths in provenance — artifacts get
  committed to goal packets and PR bodies. `sourceVideo` is session-relative.
