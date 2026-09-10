# Instance

- id: `files-face-detection-presence`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Files/internal/DetectFaces.schemas.ts:175`
- symbol: `DetectFacesEntry`
- members: `hasFace`, `primaryFace`, `primaryFaceAreaPct`, `faceCount`, `faces`
- evidence: E3/E1 at `Analysis.ts:64-91,124-142` derives all three
  presence/zero fields and the leading `has-face`/sole `no-face` flag from the
  same ordered faces array.

# Current shape

The persisted face report independently encodes a boolean, two optional
primary-face fields, a count, and the ordered faces array. Its flags repeat the
same outcome: no faces emits `no-face`; a nonempty array emits `has-face`
followed by independent quality flags. Primary face is exactly the array head,
area is computed from that head, and count is exactly array length.

# Cardinality gap

The five named presence/zero bits represent 32 combinations and only two are
legal: empty faces/count zero/no primary, or nonempty faces/positive exact
count/primary head with area percentage. Flag arrays are a dependent encoded
projection, not another finite member axis.

# Target schema

Define a `PrimaryFaceOutcome` LiteralKit-backed tagged union: `none` or
`detected({ faces: NonEmptyReadonlyArray, primaryFace, areaPct })`, with the
primary constrained to the ordered array head and count derived from its exact
length. Store one outcome in the decoded entry. Use a compatibility codec to
retain `hasFace`, optional `primaryFace`, optional `primaryFaceAreaPct`, exact
`faceCount`, the unchanged ordered `faces` vector, and flags. Decode requires
`no-face` on none and `has-face` first on detected while preserving additional
flag order.

# Migration inventory

- `DetectFaces.schemas.ts:169-189` — introduce the outcome and flat report
  codec; keep the existing public entry/report names.
- `Analysis.ts:64-91,104-142` — construct one outcome and derive the exact
  existing flag array once.
- `DetectFaces.schemas.ts:265-317` and `Files.render.ts:509-550` — preserve
  report JSON encoding and manifest writes.
- `Files.service.ts:2104-2200` — retain ordering, move-no-face behavior,
  summary counts, and manifest materialization.
- `test/files-command.test.ts:3000-3160` and related synthetic face fixtures —
  preserve no-face moves, multiple/edge/small flags, primary fields, and JSON.
- Commands/Files barrels already expose these schemas; add the new owner there.

# Guard-deletion accounting

Delete decoded `hasFace`, both optional primary fields, redundant faceCount,
their construction spreads, and all five-way coherence guards. The outcome's
ordered array is the source; the boundary codec alone projects the exact count,
primary head, area, legacy fields, and required has/no flag. Keep face order
and quality-flag logic.

# Encoded-side impact

Tier 2. Preserve exact DetectFacesReport JSON keys, values, omitted optional
keys, face payloads, area values, flag text/order, manifest path, and summaries.
Reject only incoherent legacy combinations.

# Test impact

Round-trip both legal outcomes through the old flat encoding and reject partial
primary tuples, count/array mismatches, non-head primaries, and contradictory
flags. Retain all synthetic detector, report,
render, move, ordering, and failure tests. Run focused Files tests and package
verification when implemented.

# Risk and sequencing

Land alone as a wire change. The main risk is changing flag order or no-face
move selection; derive those projections from the union without changing their
encoded form.
