# Instance

- id: `nlp-mcp-file-info-exists`
- file:line: `packages/drivers/nlp-mcp/src/StreamingTools.ts:132`
- symbol: `FileInfoOutput`
- members: `exists`, `lineCount`, `sizeBytes`
- evidence classes:
  - E3 at `packages/drivers/nlp-mcp/src/StreamingHandlers.ts:180` — missing write is `{exists:false}` with no stats; present write (line 189) is `{exists:true,lineCount,sizeBytes}`. `exists` restates payload presence.
  - E1 at `packages/drivers/nlp-mcp/src/StreamingHandlers.ts:180` — the two writes never construct `exists=false` with stats or `exists=true` without stats.

# Current shape

Live declaration at `packages/drivers/nlp-mcp/src/StreamingTools.ts:126`:

```ts
export const FileInfoOutput = S.Class<{
  readonly exists: boolean;
  readonly lineCount?: number | undefined;
  readonly sizeBytes?: number | undefined;
}>($I`FileInfoOutput`)(
  {
    exists: S.Boolean.annotateKey({
      description: "Whether the target file exists.",
    }),
    lineCount: S.optionalKey(NonNegativeInteger).annotateKey({
      description: "Total line count when the file exists.",
    }),
    sizeBytes: S.optionalKey(NonNegativeInteger).annotateKey({
      description: "File size in bytes when the file exists.",
    }),
  },
  $I.annote("FileInfoOutput", {
    description: "File existence with optional line count and byte size.",
  })
)
  .mapFields((fields) => fields)
  .pipe(
    $I.annoteSchema("FileInfoOutput", {
      description: "File existence with optional line count and byte size.",
    }),
    withOutputCodecStatics
  );
```

# Cardinality gap

The existence bit combined with optional stats admits at least four payload-presence categories (and independently optional stats admit still more partial combinations). Only two states are legal:

- `missing` — no statistics.
- `present({ lineCount, sizeBytes })` — both statistics exist.

The handler derives the result from one filesystem probe. The decoded type must be the honest union, while the MCP wire must continue encoding the existing `{ exists, lineCount?, sizeBytes? }` JSON.

# Target schema

Extend imports to `LiteralKit, SchemaUtils` and add `Effect`, `SchemaIssue`,
`SchemaTransformation`, and `Tuple` from the current Effect-v4 surface. Use a
tolerant legacy-shaped encoded bag and an honest decoded tagged union:

```ts
const FileInfoKind = LiteralKit(["missing", "present"]).pipe(
  $I.annoteSchema("FileInfoKind", {
    description: "Whether an MCP file-info probe found its target.",
  })
);
type FileInfoKind = typeof FileInfoKind.Type;

class FileInfoMissing extends S.Class<FileInfoMissing>($I`FileInfoMissing`)(
  { kind: S.tag("missing") },
  $I.annote("FileInfoMissing", { description: "A file-info probe whose target is absent." })
) {
  static readonly thunkThis = () => FileInfoMissing;
}

class FileInfoPresent extends S.Class<FileInfoPresent>($I`FileInfoPresent`)(
  {
    kind: S.tag("present"),
    lineCount: NonNegativeInteger,
    sizeBytes: NonNegativeInteger,
  },
  $I.annote("FileInfoPresent", { description: "Statistics for a file found by a file-info probe." })
) {
  static readonly thunkThis = () => FileInfoPresent;
}

const FileInfoOutputDecoded = FileInfoKind.mapMembers(
  Tuple.evolve([FileInfoMissing.thunkThis, FileInfoPresent.thunkThis])
).pipe(S.toTaggedUnion("kind"));

const FileInfoOutputEncoded = S.Struct({
  exists: S.Boolean,
  lineCount: S.optionalKey(NonNegativeInteger),
  sizeBytes: S.optionalKey(NonNegativeInteger),
});

export const FileInfoOutput = FileInfoOutputEncoded.pipe(
  S.decodeTo(
    FileInfoOutputDecoded,
    SchemaTransformation.transformOrFail({
      decode: (encoded, options) => {
        if (!encoded.exists) {
          return Effect.succeed(FileInfoOutputDecoded.cases.missing.make({}))
        }
        if (encoded.lineCount === undefined || encoded.sizeBytes === undefined) {
          return Effect.fail(
            new SchemaIssue.InvalidValue(
              { expected: "exists true with both lineCount and sizeBytes" },
              encoded,
              options
            )
          )
        }
        return Effect.succeed(
          FileInfoOutputDecoded.cases.present.make({
            lineCount: encoded.lineCount,
            sizeBytes: encoded.sizeBytes,
          })
        )
      },
      encode: (decoded) =>
        Effect.succeed(
          FileInfoOutputDecoded.match(decoded, {
            missing: () => ({ exists: false }),
            present: ({ lineCount, sizeBytes }) => ({ exists: true, lineCount, sizeBytes }),
          })
        ),
    })
  ),
  $I.annoteSchema("FileInfoOutput", {
    description: "Decoded file-info result with the legacy MCP JSON encoding preserved.",
  }),
  withOutputCodecStatics,
  SchemaUtils.withStatics(() => ({
    cases: FileInfoOutputDecoded.cases,
    guards: FileInfoOutputDecoded.guards,
    isAnyOf: FileInfoOutputDecoded.isAnyOf,
    match: FileInfoOutputDecoded.match,
  }))
);
export type FileInfoOutput = typeof FileInfoOutput.Type;
```

The actual transformation must be fallible on decode: `exists: false`
canonicalizes to the missing case even if stale statistics are present;
`exists: true` constructs the present case only when both statistics exist and
rejects missing or one-stat partial input with a typed schema issue. Encoding
still emits only the two canonical old JSON shapes. Validate the precise
Effect-v4 transform form against `.repos/effect`. The decoded discriminator is
`kind`; `exists` remains encoded-only.

# Migration inventory

- `packages/drivers/nlp-mcp/src/StreamingTools.ts:18-20` — import `LiteralKit`, `Effect`, `SchemaIssue`, `SchemaTransformation`, and `Tuple` in addition to existing schema helpers.
- `packages/drivers/nlp-mcp/src/StreamingTools.ts:110-169` — update examples/types and replace the loose class bag with the encoded schema, decoded tagged union, and transformation above.
- `packages/drivers/nlp-mcp/src/StreamingTools.ts:1537-1544` — keep `FileInfoOutput` as `Tool.make(...).success`; this is the wire encoder that must use the compatibility transformation.
- `packages/drivers/nlp-mcp/src/StreamingHandlers.ts:27` — import the transformed `FileInfoOutput` value with `StreamingToolkit`; its reattached tagged-union statics are the constructor surface.
- `packages/drivers/nlp-mcp/src/StreamingHandlers.ts:176-181` — missing writer becomes `FileInfoOutput.cases.missing.make({})`.
- `packages/drivers/nlp-mcp/src/StreamingHandlers.ts:183-189` — present writer uses `FileInfoOutput.cases.present.make({ lineCount, sizeBytes })`; no `exists` field is written in decoded code.
- `packages/drivers/nlp-mcp/test/Streaming.schema.test.ts:19,82` — imported schema and generic round-trip remain, now exercising decoded cases through the encoded compatibility codec.
- `packages/drivers/nlp-mcp/test/integration/Streaming.test.ts:195-206` — the MCP result remains read as encoded JSON with `exists` and `lineCount`; strengthen the cast to the exact legacy encoded union if useful.

Repository-wide search finds no other `FileInfoOutput` consumer or `stream_file_info` result reader.

# Guard-deletion accounting

- `packages/drivers/nlp-mcp/src/StreamingHandlers.ts:180-189` — delete the two hand-maintained object shapes whose `exists` bit must agree with the simultaneous absence/presence of both stats; tagged case constructors own coherence.
- `packages/drivers/nlp-mcp/src/StreamingTools.ts:126-145` — delete the comment-only invariant that both optional keys are absent exactly when `exists` is false. Case-specific required fields replace it.
- The encoded transformation is not a legacy normalizer to delete: it is the required Tier 2 compatibility boundary and must remain as long as the MCP JSON contract remains stable.

# Encoded-side impact

The encoded side is intentionally stable:

- decoded `missing` encodes exactly `{ "exists": false }`.
- decoded `present` encodes exactly `{ "exists": true, "lineCount": <n>, "sizeBytes": <n> }`.

Existing valid JSON decodes to the corresponding tagged member and re-encodes
shape-equivalently (property order is not contractual). For compatibility,
`{ exists: false }` with either or both stale statistic fields also decodes to
missing and re-encodes canonically as `{ exists: false }`. Reject
`{ exists: true }`, one-stat present inputs, and other incomplete present
payloads. Add explicit normalization and rejection proofs before landing.

# Test impact

- `packages/drivers/nlp-mcp/test/Streaming.schema.test.ts:46-60,74-83` — retain schema-derived round trips and add explicit decode/encode assertions for both tagged cases and both stable legacy JSON shapes.
- `packages/drivers/nlp-mcp/test/integration/Streaming.test.ts:195-206` — retain the live tool assertion that the encoded result has `exists: true` and `lineCount: 3`; add `sizeBytes` and a missing-file call asserting exactly `{ exists: false }`.
- Add false-with-one-stat and false-with-both-stats decode tests proving both normalize to missing and emit no stale statistics.
- Add true-with-no-stats and both true partial-stat cases proving decode rejection.
- No external repository test consumes a decoded `FileInfoOutput` member directly.

# Risk & sequencing

This is Tier 2 and must land alone. The transformation, handler constructors,
MCP success schema, and explicit encoded compatibility tests are one atomic
change. Keep the public `FileInfoOutput` symbol and tool name stable. Do not
expose decoded `kind` on the wire. Tolerant false-case canonicalization is the
ratified compatibility policy; incomplete true cases remain errors.
