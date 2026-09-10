# Instance

- id: `ai-metrics-config-snapshot-bounds`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/library/ai-metrics/src/config-snapshot.ts:282`
- symbol: `AiMetricsConfigSnapshotBoundsReport`
- members: `truncated`, `truncationReason`
- evidence: E3/E1 at `config-snapshot.ts:990-998` — one Option is written as
  both the boolean and optional reason.

# Current shape

The exported bounds schema stores budget, exclusions, skipped oversize count,
total bytes, `truncated`, and an optional-key Option reason. It is nested at
`AiMetricsConfigSnapshotResult.bounds` (`config-snapshot.ts:497-526`), decoded
from previous manifests at 871-899, encoded at 1218-1224, and written to the
snapshot-id and `latest.json` artifacts at 1118-1160. Omitting the entire
`bounds` field decodes to the clean default for legacy manifests; omitting
`truncationReason` currently decodes to None.

# Cardinality gap

Four presence/boolean pairs are representable. Two are legitimate:
untruncated with no reason, and truncated with exactly one of `max-files`,
`max-total-bytes`, or `max-depth`. The enumeration/read writers at lines
604-754 produce those reasons, and the final writer derives the boolean from
Option presence. No producer or fixture gives true+missing or false+reason a
meaning.

# Target schema

Define `AiMetricsConfigSnapshotCompleteBounds` tagged `status: "complete"` and
`AiMetricsConfigSnapshotTruncatedBounds` tagged `status: "truncated"`; the
second requires `reason: AiMetricsConfigSnapshotTruncationReason`. Both retain
budget, exclusions, skipped count, and total bytes. Combine with
`S.toTaggedUnion("status")`.

Keep a private encoded schema with the exact current fields/order/defaults,
including optional-key `truncationReason` and `truncated`. A fallible
`S.decodeTo` transform maps false+None to complete and true+Some to truncated,
rejects mixed pairs, and encodes the exact inverse. Preserve the existing
whole-bounds decoding default by defaulting to the decoded complete value at
`AiMetricsConfigSnapshotResult.bounds`.

# Migration inventory

- `config-snapshot.ts:220-309` — retain the three-value reason LiteralKit,
  introduce the two annotated cases and compatibility transform, and rebuild
  `emptyConfigSnapshotBoundsReport` as the complete arm.
- `config-snapshot.ts:497-526` — preserve the nested `bounds` key/default and
  result JSON codec.
- `config-snapshot.ts:580-754` — keep internal enumeration/read Option results;
  these already carry the honest source state.
- `config-snapshot.ts:946-1010` — match the final Option once to construct the
  decoded bounds case; remove the redundant boolean.
- `config-snapshot.ts:871-905,1118-1160,1218-1224` — preserve previous-manifest
  failure behavior, artifact writes, atomic latest promotion, and JSON output.
- `test/config-snapshot-bounds.test.ts:220-329,378-430` — migrate assertions and
  extend encoded compatibility coverage.

# Guard-deletion accounting

Delete `truncated: O.isSome(truncationReason)` and all downstream consumers that
must re-correlate the flag and Option. Keep the Option in internal walk results
until the one final case construction. The compatibility decoder contains the
only legacy-pair check.

# Encoded-side impact

Tier 2 persisted snapshot compatibility. For complete and each of the three
truncation reasons, compare old/new canonical `encode(decode(payload))`,
preserving `truncated`, optional omission/presence of `truncationReason`, budget
default expansion, all neighboring fields, and property order. Preserve legacy
manifests that omit `bounds` entirely. Reject true+missing and false+reason as
incoherent inputs because no supported writer or fixture assigns them meaning.

# Test impact

Retain the file-count, total-byte, depth, oversize-file, nested-root, stable-hash,
legacy-manifest, and atomic artifact tests. Add the four legitimate codec rows,
two mixed-pair decode failures, bounds-omitted default, and exact complete
encoding currently asserted at lines 399-410.

# Risk and sequencing

The result reader consumes earlier on-disk manifests, so land as one Tier 2
codec change with exhaustive fixtures. Do not alter budget precedence: the
first enumeration reason survives, otherwise the read-phase total-byte reason
is selected at line 990.
