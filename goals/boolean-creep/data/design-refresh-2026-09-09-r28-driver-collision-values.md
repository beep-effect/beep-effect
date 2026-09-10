# R28 drivers G–M collision-value adjudication

P2 source/design audit only. Proposed integration consists of one D1 → qualified
correction, one provisional Tier 1 design, and three ineligible callable-seed
withdrawals. This file does not advance canonical inventory, design, phase, or
independent P3 status. The companion design is
`data/provisional-r3-drivers-arch-tool-name-collision-stage-flags.md`.

## Frozen provenance

- Checkout HEAD: `93217d998f851e2e93d9864e2b5315552eaa58a7`.
- Frozen `origin/main`: `d1b4d769fbaffddd55717f3b1ba461897dd545c5`.
- Independent source report:
  `data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/r28-drivers-g-m.jsonl`.
- Execution receipt: adjacent `r28-drivers-g-m.execution.json`.
- Receipt source SHA matches the checkout pin; start
  `2026-09-09T04:39:00.074158+00:00`, finish
  `2026-09-09T04:46:04.385146+00:00`, exit 0, end-turn event true, no
  errors, one valid report record and one qualified candidate. The receipt's
  scoped inventory validator returned `inventory OK: 1 records, 1 unique ids`.
- Independent report scope: gov-legal-mcp, authored govinfo, graph-3d, hubspot,
  libpff, m365, and m365-mcp. Generated sources were excluded from its census.
  This P2 audit reads the generated report as an encoded consumer fixture only.

| Evidence artifact | SHA-256 |
| --- | --- |
| Independent JSONL | `d77e246cf0ac0e9061476f9c3c7bfecdc75ece81abfcb80f127e65d91afd9dc8` |
| Independent execution JSON | `7c72f05fb20b2a517c614d496928fe7765f9b71198968f5c1365716139aa785b` |
| Receipt base prompt | `6f54a113c39ea40a0254725aebf460ffcbb707792aa3e8b60aafb7f7a443dc5b` |
| Receipt extra prompt | `5b92193de1ceb09051959239b35bee57d6b727f8dcba4e4d1c332ac2e5fcb19b` |
| Receipt transcript | `6c4f8a4e272bf968dafd2b763ce42dac8c762e939eb31bee1cbd563b589a7362` |
| Receipt runner | `0f3070ded9e9f0a1a905d7e6d43bf3d8631d85c657afa47d87312bc5349106bc` |
| Receipt seed | `bf82e9656a66c738c413567734ae05bfad31e79c4cb7ab3c086307dd28185f24` |

Prompt/transcript/runner/seed hashes above are provenance recorded by the
execution receipt; this lane independently hashed the JSONL, receipt, and source
files listed below. It did not rerun the independent scanner.

## Actual owner and corrected qualification

`packages/drivers/gov-legal-mcp/src/ToolNames.ts:483` declares
`buildToolNameCollisionReport`. Its generator has two actual Boolean locals at
490–491: `hasNormalizedDuplicates` and `hasFinalDuplicates`. Each is computed
from the size of a duplicate-key set over the same `projected` candidate rows.
They are non-callable values, retained together until aggregate report
construction and failure selection. This is an eligible sibling-state owner.

The scanner's `buildToolNameCollisionReport.stageFlags` symbol is a descriptive
suffix, not a declared source symbol or nested object. Keep the stable ID and
members, but correct the symbol to `buildToolNameCollisionReport`. Do not invent
a new `stageFlags` object to satisfy the scanner. The adjacent `projected` and
`rows` arrays, duplicate-key sets, report, candidates, names, digest payload,
and errors are data used by the owner; they do not add independent Boolean or
optional-presence axes to this two-local cluster.

The original D1 note says normalized and final grouping are independent. That
misses the complete producer relation. `projectToolNameCandidate` at 433–459
computes a normalized string once, then computes `finalWireName` solely from
that string. For length ≤64, the final name is the normalized string. For a
longer string, the final name is its first 55 characters, `_`, and the first
eight hexadecimal SHA-256 characters (`sha256Prefix8`, 309–310; projection,
439–446). Therefore equal normalized keys always have equal final keys.
`groupsBy` at 312–320 retains every row, and `duplicateKeys` at 322–329 marks
groups with more than one row. No candidate deduplication breaks the implication.

Thus normalized duplicates imply final duplicates, with four representable
Boolean pairs and exactly three supported states:

| Normalized duplicate | Final duplicate | Support and existing behavior |
| --- | --- | --- |
| false | false | Empty candidate array or distinct valid names. Report is `clean`; result succeeds. The four production candidates also use this state. |
| false | true | Distinct normalized strings can have one truncated/hash final name. Frozen fixture at `test/Server.test.ts:551` fails with `duplicate_final`. |
| true | true | Punctuation or source normalization produces the same normalized key. Fixtures at `test/Server.test.ts:499` and 537 fail with `duplicate_normalized`. Repeated identical candidates also belong here. |
| true | false | Impossible for this producer: each duplicate normalized group supplies at least one duplicate final group. |

All cited test paths in this section are under `packages/drivers/gov-legal-mcp/`.
Combined true is legal and essential. It does not make all four pairs legal.

### Concrete final-only witness

The frozen test uses source `ecfr` and two operation IDs consisting of 50 `x`
characters followed by `_000000000g50` and `_0000000011bm`. Their normalized
names are respectively:

```text
ecfr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_000000000g50
ecfr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_0000000011bm
```

Both are 68 characters long and already satisfy the normalization rules. Both
have SHA-256 prefix `a06e92ed`, producing the same 64-character final name:

```text
ecfr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_a06e92ed
```

A read-only Python `hashlib.sha256` calculation reproduced these lengths and
digest prefixes while inspecting this audit. This is arithmetic verification of
the frozen fixture, not a run of product code or the Vitest test. The distinct
normalized strings demonstrate a real final-only state; the argument does not
depend on an unobserved hypothetical hash collision.

## Exact proposed replacement row

Replace the stable-ID D1 record with the following confirmed row when the parent
integrates the independent correction. This is proposed data, not a second
canonical inventory or a claim that P3 reviewed the design.

```json
{"schemaVersion":"boolean-creep-inventory/v1","id":"r3-drivers-arch-tool-name-collision-stage-flags","file":"packages/drivers/gov-legal-mcp/src/ToolNames.ts","line":490,"symbol":"buildToolNameCollisionReport","kind":"sibling-state","members":["hasNormalizedDuplicates","hasFinalDuplicates"],"status":"confirmed","evidence":[{"class":"E4","cite":{"file":"packages/drivers/gov-legal-mcp/src/ToolNames.ts","line":441},"note":"finalWireName is a deterministic function of normalized: the full string or its prefix plus SHA-256 prefix. Every duplicate normalized group is therefore also a duplicate final-name group."},{"class":"E4","cite":{"file":"packages/drivers/gov-legal-mcp/src/ToolNames.ts","line":490},"note":"Actual generator locals hasNormalizedDuplicates and hasFinalDuplicates are computed from duplicate-key sets over the same projected rows. Their supported pairs are false/false, false/true, and true/true; true/false is impossible. The final-only pair is concretely witnessed by the frozen distinct-normalized-name truncation collision at test/Server.test.ts:551-576."}],"cardinality":{"representable":4,"legal":3},"storage":"derived","exposure":"internal","targetShape":"literalkit","tier":1,"notes":"Corrects prior D1 and the scanner's synthetic .stageFlags symbol suffix. The actual owner is buildToolNameCollisionReport's two local Boolean values. Preserve normalized-failure priority, per-row verdicts, both duplicate-key sets, all report/error payloads and exact v1 encoded report bytes. Reuse the existing RowDuplicateVerdict LiteralKit as the internal aggregate collision stage. Coordinate the separate Tier 2 tool-name-collision-row-truncated-digest migration without applying both records in that singleton PR."}
```

`storage: derived` and `exposure: internal` describe the two locals. Their
effects on a public function's result and persisted report require compatibility
proof, but neither local is a schema field, exported member, or serialized key.
The separate persisted row remains a different Tier 2 record.

## Consumer, writer, codec, and overlap map

| Surface | Exact frozen source and required preservation |
| --- | --- |
| Candidate writer and projection | `ToolNames.ts:105`, 307, 309, 375, 433. Keep required source/operation IDs, normalization, short-name behavior, 64-character limit, 55-character prefix, eight-character digest, and typed normalization failures. |
| Stage writer | `ToolNames.ts:487–491`. Keep early normalization failure, both duplicate sets, and row multiplicity. Replace only the two aggregate Booleans with one existing-domain literal stage. |
| Per-row reader/writer | `ToolNames.ts:492–504`. Preserve each row's normalized-before-final key-membership classification and final/source/operation-ID ordering. A global stage must not replace individual row verdicts. |
| Aggregate readers and errors | `ToolNames.ts:506–531`. Preserve report `clean`/`duplicate`, normalized-error priority, error reason, exact message, sorted collision keys from the selected set, and complete report payload. |
| Public schemas | `ToolNames.ts:144`, 175, 244. All eight row fields, report fields/default version, and error fields remain identical for this Tier 1 implementation. |
| Direct rendering and generator | `ToolNames.ts:331–358`, 554; `scripts/generate.ts:10`, 51–75. Renderer currently canonicalizes the report object directly; generator persists those bytes to `src/_generated/tool-name-collision-report.json`. Stage stays local, so no codec adapter or generated-file update is needed for this record. |
| Production initialization and declarations | `ToolNames.ts:572–597`, 620 onward; `src/Tools.ts:32–40` and four declarations. Keep report construction before registered-tool names are resolved, fail-closed initialization, exact names, and both dual resolver calling forms. |
| Export closure | `src/index.ts:46`, package root and wildcard source export in `package.json`. Public `ToolNames` APIs remain exposed; the existing `RowDuplicateVerdict` kit and new aggregate local remain private. Tools feed the package's handlers, server, and guarded bin. |
| Tests | `test/Server.test.ts:293`, 499–576, 610–689; `test/GovLegalMcp.equivalence.test.ts:1–108`. Existing collision fixtures and byte checks directly exercise the behavior; the equivalence test covers candidate/normalization/registration consumers rather than the two locals. |
| Other qualified owner | `designs/tool-name-collision-row-truncated-digest.md` owns `ToolNameCollisionRow.truncated`/`digest` at `ToolNames.ts:147`, 153, projection at 439–457, and row codec adaptation. Its 4/2 Tier 2 qualification is unchanged. |

Paths in this table without a package prefix are under
`packages/drivers/gov-legal-mcp/`, except the goal design path. Graft exhaustive
searches covered the owner, flags, exported helpers, test and script uses, and
all package references. An additional apps search returned no direct helper
uses. Graph edges alone were not used as a no-consumer claim: source reads
covered schema fields, module-level constants, generated artifacts, package
exports, generator code, and indirect declaration initialization.

Stage migration deletion credit is two Boolean local declarations, their OR
reader, and the two ordered Boolean-controlled error branches. Retain the
set-size observations at the producer boundary and replace downstream branch
selection with the existing three-literal domain's exhaustive match. Do not
claim deletion of duplicate grouping, row membership checks, normalization
guards, registration guards, or the separate row's truncated/digest logic.

Preferred serial order is this Tier 1 aggregate-stage change first, followed by
rebasing the existing Tier 2 row-codec design onto it. The Tier 2 PR then handles
only its row representation/codec and necessary consumers. If the row migration
lands first, adapt this later stage change to its row constructor and retain
its already-landed renderer boundary; do not revert it. No compatibility alias,
new public schema, duplicate literal family, or combination of both records in
the Tier 2 singleton PR is required.

## Exact proposed callable withdrawals

The independent receipt's footer identifies the following three stable IDs.
They should be removed from the active census as OUT OF NET after parent
integration, with their prior rows retained by the packet's existing history
mechanism. They are not D1 cases and do not receive replacement cardinalities,
designs, or implementation work. The following structured proposals identify
the precise current rows and reasons:

```json
[
  {"id":"graph-3d-projection-coherence-checks","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/drivers/graph-3d/src/Graph3D.projection.ts","line":97,"symbol":"Graph3DProjection.hasCoherentBuffers","members":["hasCoherentBufferLengths","hasCoherentLinkIndices"],"reason":"Members are callable functions, not co-carried Boolean values. Static hasCoherentBuffers at line 93 short-circuits calls to the functions at lines 97 and 115 over one projection. The projection's declared fields at lines 60-91 contain no such Boolean pair."},
  {"id":"r3-drivers-arch-graph3d-module-probes","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/drivers/graph-3d/src/Graph3D.renderer.ts","line":29,"symbol":"isThreeModule/isControlsModule","members":["isThreeModule","isControlsModule"],"reason":"Members are separate callable type guards over different dynamic-import module values, declared at lines 29 and 32 and passed directly to distinct Effect.filterOrFail calls at lines 38 and 44. No object or local Boolean pair stores their results."},
  {"id":"r3-drivers-arch-m365-path-extension-probes","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/drivers/m365/src/M365.service.ts","line":124,"symbol":"isGraphPathSegment/protectedByExtension","members":["isGraphPathSegment","protectedByExtension"],"reason":"Members are callable predicates over different payloads. isGraphPathSegment at line 124 is the GraphPathSegment schema filter at line 128; protectedByExtension at line 971 inspects a GraphDriveItem name and is invoked at line 1090 after request decoding and item retrieval. No eligible co-carried Boolean owner exists."}
]
```

For projection coherence, keep all length, link-index, and self-loop checks;
`Graph3D.renderer.ts:857` and 960 still validate projections for update and
mount. The logical conjunction does not materialize the proposed member pair,
and it skips link-index checking when buffer lengths fail.

For module probes, keep both import loaders at `Graph3D.renderer.ts:35–45` and
their distinct typed adapter-invariant errors. This withdrawal does not merge
the already separated `cancelled` latch in `Graph3D.react.ts` with `destroyed`
in the renderer.

For M365, keep `GraphPathSegment` validation at `M365.service.ts:127–138`, the
protected-extension predicate at 971–978, and the encrypted-item skip branch at
1090–1096. Request decoding at 1081 and item retrieval at 1085 precede the name
predicate. Combining unrelated validation and downloaded-item policy into a
state schema would invent a carrier and alter the service boundary.

The footer also explicitly leaves GraphMessage/GraphEvent D2,
ShaderMaterial/SpriteMaterial/WebGLRenderer D2, ToolNameCollisionRow E3, and
M365ToolError E4 unchanged. No additional row update is proposed for them.

## Source and preservation hashes

| File | SHA-256 |
| --- | --- |
| `packages/drivers/gov-legal-mcp/src/ToolNames.ts` | `365b788c48ce70b5d3b80b0dc09a27f9cc3db937a3d094a3d3df44315da01d02` |
| `packages/drivers/gov-legal-mcp/test/Server.test.ts` | `dae54579a97c10b6f550d12efcc678b72de59ceae57d13670316daff5bcde728` |
| `packages/drivers/gov-legal-mcp/src/_generated/tool-name-collision-report.json` | `2a6d73fb1379a3321b890be6ff3a487395d5ece0ca2ede829758fcdb3cd4fe1e` |
| `packages/drivers/graph-3d/src/Graph3D.projection.ts` | `fbcd533ddf6dc533c7e6f9644192b2dceb4a1c38ff8c288f324b9adea4bdafdf` |
| `packages/drivers/graph-3d/src/Graph3D.renderer.ts` | `ca4efa4c08bb3a9d8cc8b6401521fccfef8064383ea8c37edef79bb9a0f6743e` |
| `packages/drivers/m365/src/M365.service.ts` | `e2b4bb29a8c33b9a2b3e77287b4ba7853324f8991f4fd79bc6c3e095cbd5a6db` |
| Existing `designs/tool-name-collision-row-truncated-digest.md` | `a0debf9cc1118c628ef395b063706fa6d07a2b2de57f3c8baa78a5097439f1fd` |
| Prior `data/design-refresh-2026-09-09-r28-tier-gate-values.md` | `cc81f767e38b2947c6eb7c799760dd39bece572f25f27f35ee19d949dad8b7df` |
| Prior `data/provisional-r3-foundation-tier-gate-tool-hints.md` | `2bc56e926f8e10922511a54bdc23fdb7b38bb5e213caa15aea754db8bf067997` |

## Required verification and limits

P2 checks consist of exact-source inspection after graft discovery, fixture
digest/length arithmetic, input/protected-file hashes, source-pin verification,
the provisional design's eight exact required sections, and parse/shape checks
for the proposed row and withdrawal data. No product tests, package commands,
generator, services, source writes, git mutation, current-report edits, canonical
updates, or changes to the two completed TierGate documents occurred in this
lane. This audit is not independent P3 design acceptance.

The implementation must prove all three supported outcomes, normalization
failure before grouping, repeated candidates, mixed normalized/final-only/unique
row groups, normalized error priority and selected collision keys, deterministic
ordering, row/report/error codec preservation, and exact existing generated
bytes. Keep the existing fixed final-only fixture; do not replace it with a
probabilistic search. Run the focused package tests and the mandatory
`bun run beep quality package-verify @beep/gov-legal-mcp` in the future authorized
implementation lane. This P2 task does not run them.
