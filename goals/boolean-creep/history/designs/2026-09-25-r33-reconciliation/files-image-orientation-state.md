# Instance

- id: `files-image-orientation-state`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Files/internal/ImageAudit.schemas.ts:52`
- symbol: `ImageAuditMetadataPresence`
- members: `orientationApplied`, `orientation`
- evidence: E4 at `ImageCuration.ts:438-455` writes absent/false, identity
  one/false, or nonidentity/present/true.

# Current shape

The persisted audit manifest stores an applied bit beside an optional integer
orientation. Other metadata-presence flags are independent.

# Cardinality gap

Four boolean/presence combinations are representable and three semantic states
are legal: absent, identity orientation 1, and applied nonidentity orientation.

# Target schema

Define `ImageOrientationState` as `none | identity | applied({ orientation })`,
with applied checked as integer other than 1. Replace the pair with one state
and preserve the old flat encoding through a compatibility codec.

# Migration inventory

- `ImageAudit.schemas.ts:45-57` — introduce the state, retain hasExif/hasIcc/
  hasIptc/hasXmp, and add flat compatibility.
- `ImageCuration.ts:436-455` — construct one state from Sharp metadata.
- `ImageAudit.schemas.ts:207-245` and `ImageCuration.ts:900-920` — preserve
  ImageAuditManifest JSON encode/decode and writing.
- Synthetic image-audit tests retain absent, identity, rotated, metadata
  presence, and manifest cases; no user media is needed.

# Guard-deletion accounting

Delete orientationApplied, optional orientation, their branch, and coherence
checks. Keep every independent embedded-metadata presence flag.

# Encoded-side impact

Tier 2. Preserve absent orientation omission, identity `orientation: 1` with
false, nonidentity integer with true, all metadata flags, and complete manifest
JSON. Reject only contradictory combinations.

# Test impact

Round-trip all three states and reject true/absent and false/nonidentity.
Retain synthetic Sharp metadata, audit limits, privacy, and manifest tests.

# Risk and sequencing

Land alone as Tier 2. Do not normalize EXIF values or change Sharp orientation
handling; the refactor models current reported state only.
