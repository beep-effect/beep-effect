# Instance

- id: `tool-name-collision-row-truncated-digest`
- file:line: `packages/drivers/gov-legal-mcp/src/ToolNames.ts:144`
- symbol: `ToolNameCollisionRow`
- members: `truncated`, `digest`
- evidence classes:
  - E3 at `packages/drivers/gov-legal-mcp/src/ToolNames.ts:439-440` — the sole projection computes `digest` only when `truncated` is true.
  - E1 at `packages/drivers/gov-legal-mcp/src/ToolNames.ts:448-457` — production construction emits only full/null or truncated/digest rows.

# Current shape

The exported row schema stores `truncated: boolean` beside `digest: string | null`. `projectToolNameCandidate` derives both from the same normalized-length comparison, then derives `finalWireName` from that pair. `ToolNameCollisionReport` embeds the row in the versioned `gov-legal-mcp/tool-name-collision-report/v1` document; the generator commits that JSON under `src/_generated/`.

# Cardinality gap

The pair represents four combinations. Two are legal: a full name with a null digest and a truncated name with its eight-character digest. The other two let callers claim truncation without its suffix or attach a digest to an untruncated name.

# Target schema

Keep a legacy encoded `ToolNameCollisionRowEncoded` struct with the exact existing keys. Decode through a fallible compatibility transform to an honest nested tagged union, `nameForm: full | truncated({ digest })`, while retaining candidate, duplicate verdict, final wire name, normalized name, operation id, and source at the row level. Build the union from one named `LiteralKit` and `S.toTaggedUnion`; do not retain a decoded `truncated` projection.

Decode accepts the two coherent legacy shapes and rejects the two contradictory shapes with a typed schema issue. Encode maps the two decoded members back to the exact old `truncated` and `digest` values. The existing public `ToolNameCollisionRow` value remains the compatibility codec and reattaches the decoded union's `cases`, `guards`, and `match` statics.

# Migration inventory

- `packages/drivers/gov-legal-mcp/src/ToolNames.ts:144-158` — split encoded and decoded row schemas, add the compatibility transform, and preserve the public symbol.
- `packages/drivers/gov-legal-mcp/src/ToolNames.ts:295-321` — ordering/grouping continue to read row-level fields only.
- `packages/drivers/gov-legal-mcp/src/ToolNames.ts:433-459` — construct `full` or `truncated({ digest })` exactly once from the length branch; derive `finalWireName` from that member.
- `packages/drivers/gov-legal-mcp/src/ToolNames.ts:483-507` — duplicate-verdict rewriting must preserve `nameForm` while changing only `duplicateVerdict`.
- `packages/drivers/gov-legal-mcp/src/ToolNames.ts:554-596` — rendering and the production report continue through the compatibility codec.
- `packages/drivers/gov-legal-mcp/scripts/generate.ts:51-64` — retain the same generated report path and renderer.
- `packages/drivers/gov-legal-mcp/test/Server.test.ts:471-654` — migrate decoded assertions from `truncated`/`digest` to exhaustive `nameForm` matching while retaining exact JSON assertions.

# Guard-deletion accounting

Delete the `if (row.truncated)` test branch in `Server.test.ts` and the production ternaries that separately maintain `truncated`, `digest`, and `finalWireName`. One exhaustive match over `nameForm` owns digest access. The compatibility transform remains as the required Tier 2 boundary.

# Encoded-side impact

None. Encoding must preserve the version, every row key, null versus string digest, boolean `truncated`, ordering, and rendered JSON bytes of the checked-in production report. Both coherent legacy row shapes round-trip exactly; contradictory rows reject instead of entering decoded code.

# Test impact

Retain the existing normalization, collision, generated-file parity, schema round-trip, and deterministic-render tests. Add all four encoded boolean/null combinations: prove exact round trips for the two legal shapes and typed rejection for the two contradictory shapes. Compare `renderToolNameCollisionReport(ProductionToolNameCollisionReport)` byte-for-byte with `src/_generated/tool-name-collision-report.json`.

# Risk & sequencing

Tier 2 singleton. The public codec, generator, checked-in artifact, projection, duplicate rewrite, and tests land atomically. Run full `@beep/gov-legal-mcp` package verification; do not treat the generated report as disposable output.
