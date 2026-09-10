# NLP and SHACL Tier 2 design refresh — 2026-09-08

## Source and scope

- Reviewed corpus SHA: `be8995e66aeefedf0dabf131deaeaaf25c8e6fc8`
- Local checkout HEAD: `05405bf322da0ca7eb88b8bb402145081e8fded6`
- The reviewed `packages/**/src` and `apps/**/src` corpus is identical between those revisions.
- Canonical Tier 2 ids resolved before review: `nlp-mcp-file-info-exists` and `shacl-validation-result-flags`.
- No source, tests, inventory records, statuses, dependencies, generated files, or Git refs were changed.

## `nlp-mcp-file-info-exists`

The existing evidence and coarse cardinality remain supported:

- E3/E1 producer branches are `packages/drivers/nlp-mcp/src/StreamingHandlers.ts:176-190`: missing writes only `{ exists: false }`, while present writes `exists: true` with both statistics.
- The coarse presence projection remains 4 representable / 2 legal. The optional keys independently admit partial bags, but those are compatibility inputs rather than additional honest decoded states.

Design repairs:

- Export `FileInfoOutputEncoded` from the existing `@beep/nlp-mcp/StreamingTools` subpath as the exact pre-migration shape used for compatibility comparisons. The root package barrel remains unchanged.
- Update the `StreamingTools.ts:1-9` module contract, which currently says every output is a plain `S.Struct`; file-info will have a structural encoded side and a tagged decoded side.
- Preserve exact old canonical encoding for the two legitimate rows by comparing `encodeNew(decodeNew(input))` with `encodeOld(decodeOld(input))`: missing emits only `{ exists: false }`; present emits `exists`, `lineCount`, and `sizeBytes` unchanged.
- Keep the ratified exceptional behavior explicit. False with either or both stale statistics remains accepted but canonicalizes to missing and drops stale fields. True with missing or partial statistics is rejected. Those cases deliberately differ from the old permissive codec and are not described as byte-identical compatibility.
- Preserve the old rejection of null statistics; no null/default widening was introduced.
- The only runtime producer is the streaming handler, the only wire attachment is `Tool.make("stream_file_info").success`, and the integration consumer reads the encoded MCP result. No other repository source consumer was found.

Remaining implementation proof:

- Run the two legitimate rows through both codecs and compare canonical encoded output exactly.
- Cover both stale-false normalizations, all incomplete-true rejections, and null rejection separately.
- Retain the decoded tagged-union arbitrary round trip and exact encoded MCP integration assertions, including `sizeBytes` and a missing-file call.

## `shacl-validation-result-flags`

The earlier three-state design is withdrawn. The bounded validator produces
only three rows, but the shared result has another production implementation:

- `shacl-engine@1.1.2` `lib/Report.js:12-18` makes conformance false only
  for the exact `sh:Info`, `sh:Violation`, and `sh:Warning` severity terms.
- Its `lib/Shape.js:20,50-51` and `lib/Context.js:103-107` accept and copy an
  arbitrary shape severity into a result.
- The public request schema accepts an arbitrary `shapesDataset` and
  `maxResults: 0` at
  `packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:249-255`.
- The driver preserves the engine boolean in `reportFromUnknown` at
  `packages/drivers/shacl/src/Shacl.validation.ts:282-297`; lines 414-423 then
  retain zero custom-severity results and emit
  `{ conforms: true, violations: [], truncated: true }`.

The unknown-severity fallback to local `violation` at driver lines 260-271 is
applied only to retained findings and does not revise the engine's conformance
boolean. Info and warning findings themselves make this engine report
nonconforming. Debug and trace generation is disabled by the current validator
construction, so the supported custom-severity shapes-dataset route is the
decisive case.

After the frozen install at merged checkout
`7440cb8c4302ce64b87860069a464bafbf65f576`, a scratch `bun -e` reproduction
used `ShaclValidationRequest`, `ShaclValidationService`, and
`ShaclValidationServiceLive` rather than directly constructing results:

| request | `conforms` | `truncated` | retained |
| --- | --- | --- | --- |
| complete conforming | `true` | `false` | 0 |
| complete ordinary violation | `false` | `false` | 1 |
| ordinary violation, `maxResults: 0` | `false` | `true` | 0 |
| custom-severity violation, `maxResults: 0` | `true` | `true` | 0 |

All four boolean pairs are legal and meaningful; coarse cardinality is 4 / 4.
The existing `ShaclValidationResult` record, required wire keys, nested
violation codec, and constructor must remain unchanged. Combined true must
round-trip exactly across the ontology RPC and desktop-sidecar boundary.

The earlier transformation work is preserved here only as a withdrawn finding:
had the three-state premise been valid, the decoded violation array would have
needed `S.Array(S.toType(ShaclValidationViolation))`, and compatibility tests
would have needed an exported old-shape reference codec. Those changes are not
implementation requirements because the premise is false. No three-state
transformation, normalization, guard deletion, package migration, or browser QA
work remains for this instance.

## Inventory follow-up

The NLP `4 / 2` evidence remains supported. The parent reconciled SHACL to D1 after the four-row reproduction; the
qualified 4 / 3 claim is withdrawn because all 4 / 4 combinations are legal. Its E4 driver
citation cannot prove an implication and should be removed or rewritten as
evidence that the fields are independently derived.

## Validation

The pre-withdrawal design validator passed with 105 qualified ids. After the
public-service reproduction, the parent demoted SHACL, archived its former
design, and reran the aggregate against the merged source: inventory validation
passes for 784 records, design coverage passes for 104 qualified ids, and the
packet diff has no whitespace errors. The prior SHACL implementation test plan
is withdrawn; the NLP design remains subject to replacement independent P3
review.
