# Files outcome design handoff — 2026-09-08

## Source baseline

- Exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- Corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- Receipt: `goals/boolean-creep/data/sweeps/refresh-2026-09-08-r25-main-9b7553/r25-cli-d-k-contract-correction1.jsonl`

## Adjudicated records

| Canonical id | Primary | Members | Cardinality | Storage/exposure/tier |
| --- | --- | --- | --- | --- |
| `files-face-detection-presence` | `DetectFaces.schemas.ts:175` | `hasFace`, `primaryFace`, `primaryFaceAreaPct`, `faceCount`, `faces` | 32 / 2 | derived, persisted, Tier 2 |
| `files-border-classification` | `Borders.schemas.ts:400` | `hasBorder`, `classification` | 12 / 6 | derived, persisted, Tier 2 |
| `files-border-side-measurement` | `Borders.schemas.ts:369` | `matched`, `widthPx`, `score`, `widthPct` | 16 / 5 | derived, persisted, Tier 2 |
| `files-person-reference-disposition` | `MatchPerson.schemas.ts:1258` | `accepted`, `reason`, `detectionScore` | 8 / 3 | stored, persisted, Tier 2 |
| `files-worker-score-thresholds` | `MatchPerson.ts:1389` | all four match/review threshold locals | 16 / 6 | derived, internal, Tier 1 |
| `files-image-orientation-state` | `ImageAudit.schemas.ts:52` | `orientationApplied`, `orientation` | 4 / 3 | derived, persisted, Tier 2 |

The face cluster expands the receipt's three fields because primary face,
area, exact count, and empty/nonempty ordered faces vector all come from
`A.head(result.faces)` and `A.length(result.faces)` at `Analysis.ts:124-138`.
The legacy codec also preserves `no-face` versus leading `has-face`, additional
flag order, exact area/count values, and face array order.

Border-side cardinality is 16/5 rather than 16/2. `minSolidPct` is greater than
zero but may be arbitrarily small, dimensions have no upper schema bound, and
metrics round to four decimals at `BorderDetection.ts:63,182-193`. Matched
guarantees positive `widthPx`; rounded score and widthPct may independently be
zero. Existing such report rows remain legal.

The person-reference receipt's D2 withdrawal is reversed. D2 applies only to
external SDK/database/API mirrors. `python/photo-face/beep_photo_face/worker.py`
is a repo-owned application writer, while TypeScript owns decode-time security
validation and persists the same rows inside PersonMatchReport. The full
accepted/reason/score presence states are rejected-without-score,
rejected-with-score, and accepted-with-score.

The two raw score-threshold pairs form one four-local cluster. Strict
`reviewThreshold < matchThreshold` creates cross-relations, while explicit
thresholds may be within twice the 0.000001 rounding tolerance, so an overlap
state is supported. The six states are below-review, review-band,
between-bands, overlapping-bands, match-band, and above-match.

## Designs

- `goals/boolean-creep/designs/files-face-detection-presence.md`
- `goals/boolean-creep/designs/files-border-classification.md`
- `goals/boolean-creep/designs/files-border-side-measurement.md`
- `goals/boolean-creep/designs/files-person-reference-disposition.md`
- `goals/boolean-creep/designs/files-worker-score-thresholds.md`
- `goals/boolean-creep/designs/files-image-orientation-state.md`

Each Tier 2 design uses a schema-first tagged/literal decoded model with an
explicit old flat encoded projection. Report property names, defaults,
omissions, numeric values, flags/reasons/classifications, ordering, manifest
paths, CLI text, and errors remain unchanged. No user media was read and no
photo job was executed; evidence came from source and synthetic fixtures.

## Verification

- Whole-repository searches covered TypeScript and Python writers, validators,
  services, report codecs, render/write paths, barrels, and synthetic tests.
- Live Effect v4 `S.decodeTo` support was already confirmed in
  `.repos/effect/packages/effect/src/Schema.ts:5366-5374` for compatibility
  codec implementation.
- `mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` was
  run after writing the designs. It reached the global coverage check for 141
  qualified records and reported 25 separately owned missing designs, beginning
  with `scheduler-protocol-eviction-mode.md` and ending with
  `worktree-status-record-presence.md`; none is one of these six Files designs.
- Scoped `git diff --check` covers only these six designs and this handoff.
- No product source, tests, inventory, status, dependencies, generated files,
  or git references were changed.
