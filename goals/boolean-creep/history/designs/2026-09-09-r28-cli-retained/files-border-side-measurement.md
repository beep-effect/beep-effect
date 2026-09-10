# Instance

- id: `files-border-side-measurement`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Files/internal/Borders.schemas.ts:369`
- symbol: `DetectBorderSideMeasurement`
- members: `matched`, `widthPx`, `score`, `widthPct`
- evidence: E3 at `BorderDetection.ts:157-193` — unmatched zeros all three
  measurements; matched guarantees positive widthPx, while four-decimal
  rounding does not guarantee nonzero score or widthPct.

# Current shape

One wire row stores a matched bit and three numeric measurements. The raw
correction incorrectly assumed every matched metric is nonzero. Thresholds may
be any value greater than zero and media dimensions have no upper bound, so a
positive pre-rounded score or percentage can round to zero.

# Cardinality gap

Treating each numeric field by zero/nonzero presence gives 16 combinations and
five legal patterns: unmatched/all-zero, plus matched/positive-width with each
of score and widthPct independently zero or positive. The preliminary 16/2
count is not source-supported.

# Target schema

Define `BorderSideMeasurementOutcome` as `unmatched` with exact zero metrics or
`matched` with positive integer widthPx and nonnegative finite score/widthPct.
Do not refine rounded score or widthPct as strictly positive. Preserve color,
colorHex, and side beside the outcome. Encode through the old flat fields.

# Migration inventory

- `Borders.schemas.ts:365-378` — introduce the tagged outcome and legacy flat
  codec inside report rows.
- `BorderDetection.ts:63,157-193` — preserve 4-decimal rounding, scanning,
  thresholds, and exact zeroing; construct one case.
- `BorderDetection.ts:231-266` — match outcome when classifying sides without
  changing side precedence.
- Report encoding/rendering at `Borders.schemas.ts:483-645` and
  `Files.render.ts:476-488` remains stable.
- Synthetic border tests at `test/files-command.test.ts:1600-1700,3150-3250`
  retain widths/classifications; add tiny-threshold and large-axis unit inputs.

# Guard-deletion accounting

Delete decoded `matched` and the three correlated zeroing ternaries. Case
constructors own metric constraints. Keep threshold checks, line-break guards,
rounding, and side-layout readers.

# Encoded-side impact

Tier 2. Preserve exact matched, widthPx, score, widthPct, side, color, and
colorHex JSON values. Existing matched rows with rounded zero score or
percentage remain accepted and round-trip unchanged.

# Test impact

Cover unmatched and all four matched zero/nonzero metric patterns, with focused
rounding-boundary tests. Retain scan tolerance, minimum width, classification,
report JSON, and crop tests.

# Risk and sequencing

Do not strengthen rounded metrics beyond the actual protocol. Land with border
classification so side readers migrate once.
