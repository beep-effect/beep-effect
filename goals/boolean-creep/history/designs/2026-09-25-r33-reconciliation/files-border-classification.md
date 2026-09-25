# Instance

- id: `files-border-classification`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Files/internal/Borders.schemas.ts:400`
- symbol: `DetectBordersEntry`
- members: `hasBorder`, `classification`
- evidence: E3/E2 at `Analysis.ts:33-46` and
  `BorderDetection.ts:231-266` proves `hasBorder` is exactly
  `classification !== "none"`.

# Current shape

The persisted border report pairs a boolean with the six-literal
`BorderDetectionKind`. `borderCount` is correlated supporting data: none is
zero, canvas-edge one, pillarbox/letterbox two, frame four, and mixed two or
three.

# Cardinality gap

Boolean times six classifications represents 12 combinations and six are
legal. `borderCount` is retained payload with additional exact refinements; it
is not reduced to a presence bit in the inventory cardinality.

# Target schema

Use `BorderDetectionKind` as the sole disposition and delete `hasBorder` from
the decoded entry. Refine its case-owned count: none(0), canvas-edge(1),
pillarbox/letterbox(2), frame(4), mixed(2|3). A compatibility codec encodes the
same flat classification, hasBorder, and borderCount values.

# Migration inventory

- `Borders.schemas.ts:62-74,395-410` — reuse the existing LiteralKit and model
  the count with its classification.
- `BorderDetection.ts:231-266` — preserve side-layout precedence and exact
  classification strings.
- `Analysis.ts:28-47` — construct classification/count once.
- `Files.plan.ts:340-365`, `Files.service.ts:2007-2065`, and
  `Files.render.ts:476-488` — match classification and retain crop planning,
  counts, and JSON.
- `test/files-command.test.ts:1600-1700,3150-3250` — preserve all layouts,
  counts, side order, and rendering.

# Guard-deletion accounting

Delete `hasBorder`, its `borderCount > 0` writer, and all hasBorder guards.
Keep matched-side counting and layout predicates because they produce the
classification and necessary numeric count.

# Encoded-side impact

Tier 2. The old report emits the same hasBorder boolean, classification literal,
borderCount, sides, dimensions, paths, and ordering via the codec. Crop/report
CLI behavior is unchanged.

# Test impact

Round-trip all six kinds and their legal counts, reject contradictory legacy
triples, and retain synthetic one-side, opposite-side, frame, mixed, and none
fixtures plus JSON snapshots.

# Risk and sequencing

Coordinate with side-measurement changes but keep entry classification separate
from per-side measurements. Do not change layout precedence or crop geometry.
