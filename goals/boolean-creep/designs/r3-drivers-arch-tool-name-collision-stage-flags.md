# Design: aggregate MCP tool-name collision stage

Stable ID: `r3-drivers-arch-tool-name-collision-stage-flags`. P2 refresh against
`f97a89bdfdc5bc71b69aab09b8d425591698d42a`. E4, 4 representable / 3 legal;
derived/internal, Tier 1. Fresh independent P3 is required. No implementation,
review approval, census dry credit, or GATE 2 transition is claimed.

## Current shape

The actual owner is now private `collisionReportFromRows` at
`packages/drivers/gov-legal-mcp/src/ToolNames.ts:492-539`, not exported
`buildToolNameCollisionReport`. The helper derives two actual non-callable
Boolean locals at :497-498 from normalized and final duplicate-key sets over
one projected array. It labels individual rows at :503-509, builds aggregate
report verdict at :516, then chooses normalized error before final error at
:519/:529, otherwise Result success. The helper has exactly two callers:

- Exported Effect builder :561-566 first projects candidates with
  `Effect.forEach(candidates, projectToolNameCandidate)` and lifts the private
  helper's Result with Effect.fromResult at :565.
- Eager `ProductionToolNameCollisionReport` :628-634 uses Result.all of the
  private synchronous `projectUntruncatedToolNameCandidate`, then
  Result.flatMap(collisionReportFromRows) at :631 and getOrThrowWith(identity).

The whole context remains intact. Candidate :106 requires nonempty operationId
and source. Row :145 exposes eight fields: candidate, null-or-string digest,
row duplicateVerdict, finalWireName, normalized, originalOperationId, source,
and explicit Boolean truncated. Report :176 retains candidate array, clean or
duplicate verdict, and constructor-default S.tag version. Normalization error
:205, collision error :249 and registration error :287 remain public typed
schemas. Collision errors retain sorted keys, exact message/reason and full
report. No defaults exist on either selected Boolean local.

## Cardinality gap

| Normalized duplicate | Final duplicate | Stage | Outcome |
| --- | --- | --- | --- |
| false | false | unique | clean report / Result success |
| false | true | duplicate_final | final collision error and duplicate report |
| true | true | duplicate_normalized | normalized collision error and duplicate report |
| true | false | impossible on both admitted caller paths | no stage member |

**Both** paths establish the implication; it is not an invariant of arbitrary
exported ToolNameCollisionRow values. Effect projection :483-490 normalizes
candidate text, tests the64-character cap and obtains a SHA-256 prefix for long
names through Crypto.Crypto. Shared `toolNameRow` :322-338 chooses normalized
unchanged without a digest or the first55 characters plus underscore plus the
first8 digest hex characters. Equal normalized names produce equal final names
under the SHA-256 service contract, whether truncated or not.

The synchronous production projection :442-464 rejects normalized names longer
than64 with ToolNameNormalizationError (invalid_normalized and its exact
production cap message). Successful rows pass None digest to toolNameRow and
have finalWireName exactly equal to normalized. Thus normalized duplicate implies
final duplicate there too; this path cannot produce final-only. Its currently
fixed four candidates are clean. The two paths never pass a mixed arbitrary
exported row array to the private helper. A future new caller must establish
the same provenance or force re-audit; do not strengthen the public row schema.

All three legal states exist across the owner call closure. Empty/ordinary
inputs are clean. Normalization collision tests at Server.test.ts:512-528 and
:554-571 yield both true. The frozen final-only collision at :573-601 uses
`ecfr_` plus50 x characters and suffixes `_000000000g50` / `_0000000011bm`.
The distinct68-character normalized strings have equal first8 SHA-256 hex
characters `a06e92ed` and equal64-character final names. This fixture preserves
false/true without treating unlikely collisions as impossible. Repeated equal
candidates remain duplicates; no deduplication is introduced.

The qualification is E4 for these derived locals on the complete private call
closure. It does not claim a4/3 public ToolNameCollisionRow contract, reject
arbitrary report rows, or conflate row truncation/digest with this owner.

## Target schema

Reuse existing private `RowDuplicateVerdict` LiteralKit at ToolNames.ts:48
(unique, duplicate_normalized, duplicate_final). No new literal family, public
export, package, schema default, role file or decode boundary is needed. Keep
its identity and per-row annotations; derive local type from its Type. Existing
kit $match overloads in LiteralKit.schema.ts:583-605 provide exhaustive matching.

Inside collisionReportFromRows only, replace the two Boolean locals with one
`collisionStage`, classifying duplicate sets with normalized precedence, then
final, then unique. Use kit Enum/thunk and Effect Match helpers; do not first
store the pair or recreate it as getters. Keep both sets and existing per-row
membership verdicts. The aggregate stage must never overwrite individual row
verdicts in a mixed report.

Match stage exhaustively to report verdict (unique => clean, others => duplicate).
Match stage exhaustively to **Result**, preserving the private helper's
synchronous Result signature:

- unique => Result.succeed(report).
- duplicate_normalized => Result.fail(existing collision error), sorted
  normalized keys, reason duplicate_normalized and exact message
  `Duplicate normalized MCP tool names are forbidden.`
- duplicate_final => Result.fail(existing collision error), sorted final keys,
  reason duplicate_final and exact message
  `Duplicate final MCP wire names are forbidden.`

Do not return Effect from the helper, move crypto into it, call an Effect runner
at module load, defer production initialization, catch the eager thrown error,
or replace the synchronous production path with the general digesting projector.
Effect builder retains Effect.fromResult at :565 and its existing service/error
requirements. The production Result.all/flatMap/getOrThrowWith chain remains
unchanged, including early normalization/cap failure before collision grouping.

Local Effect source confirms Effect.fromResult :1827, Result.flatMap :1278 and
Result.getOrThrowWith :1162. No new advanced Schema transform API is involved.
The inspected contracts are API evidence, not a compiled implementation proof.

## Migration inventory

All package-relative paths below are under packages/drivers/gov-legal-mcp.

| Site | Required change / preservation |
| --- | --- |
| ToolNames.ts:48 | Reuse private row verdict kit; no new export or identity. |
| ToolNames.ts:492-539 | Sole edit locus: replace locals497-498, aggregate516 and Result branches519/529 with one stage and exhaustive matching. |
| ToolNames.ts:500-512 | Preserve row spread, row-specific verdicts, sorting by finalWireName/source/originalOperationId. |
| ToolNames.ts:322-357 | Preserve row construction, null digest, truncation, multiplicity grouping and duplicate sets. |
| ToolNames.ts:403-490 | Preserve normalization, synchronous cap failure and effectful digest projection separately. |
| ToolNames.ts:561-566 | Preserve projection before helper call, original Effect scheduling, trace and errors; only downstream helper implementation changes. |
| ToolNames.ts:606-634 | Preserve four production candidates, synchronous module initialization, Result chain and original thrown normalization/collision error. |
| ToolNames.ts:657-708; src/Tools.ts:32-40 | Preserve curried/data-first registration resolution and exact wire-name literal typing, missing/drift errors and fail-closed declarations. |
| ToolNames.ts:359-384,588-589 | Preserve recursive canonical JSON rendering; stage stays local and absent from reports. |
| src/index.ts and package.json | Preserve root and ToolNames exports; helper and stage stay private. |
| scripts/generate.ts:10,51-75 | Preserve imported eager report, report bytes/output path and independent generated version module. |
| src/_generated/tool-name-collision-report.json | Unchanged compatibility fixture; no generator churn. |
| test/Server.test.ts:512-601,637-719 | Preserve normalized/final collision cases, projected row laws, artifact bytes and registration tests; extend mixed/empty/permutation behavior only as needed. |
| test/GovLegalMcp.equivalence.test.ts | Preserve arbitrary public row/report/schema acceptance and equivalence; do not narrow these to producer provenance. |
| src/Tools.ts,Handlers.ts,Server.ts,bin.ts | Import closure consumes eager validated report; preserve import/startup behavior, no async crypto requirement introduced for toolkit initialization. |

Graft caller graph alone misses an edge: exhaustive symbol search confirms both
helper invocations at565 and631. Selected-source and package queries plus public
exports and generator reads establish the bounded closure. Refresh if source
changes before implementation.

## Guard-deletion accounting

- Delete exactly the two Boolean locals497-498. Duplicate set-size observations
  remain in one classifier, so detection itself earns no deletion credit.
- Delete aggregate Boolean OR/ternary516; replace with exhaustive stage mapping.
- Delete ordered Boolean error branches519 and529; replace with exhaustive
  stage-to-Result selection preserving normalized priority and exact payloads.
- Zero credit for per-row membership503-509, duplicateKeys, projection,
  normalization, crypto, synchronous cap guard, registration, or startup failure.
- Zero credit for row truncated/digest: the complete exported row class has only
  one Boolean field and is outside this campaign recall net. Preserve it unchanged.

No Boolean helper or aggregate tuple is introduced to reconstruct the old pair.

## Encoded-side impact

No public schema, report field, default, tag, version, codec, error channel, or
encoded representation changes. Preserve all eight row keys with explicit
false/null, all report fields and complete collision error payloads. The public
row schema remains broadly accepted exactly as before, even when callers
construct rows that the two private projection paths would never emit.

Canonical renderer processes report objects directly. This remains safe because
stage is a local value, never attached to report/row. Preserve sorted rows and
keys, escaping, indentation, no timestamp/CR and exactly one trailing newline.
Generated report SHA256 remains
`2a6d73fb1379a3321b890be6ff3a487395d5ece0ca2ede829758fcdb3cd4fe1e`.
No generator run, version bump or persisted rewrite is needed.

## Test impact

This P2 refresh runs no package tests or implementation. Required later proof:

- Existing normalized collision, frozen final-only SHA256, registration failures,
  projection determinism and exact artifact tests remain green.
- Exercise public Effect builder with empty, ordinary, repeated and mixed inputs.
  Mixed normalized-pair + final-only-pair + unique-row must select normalized
  error/keys while retaining all three row verdicts. Permutations preserve sorted
  keys and canonical bytes. Keep normalization failures before grouping.
- Verify source import and eager ProductionToolNameCollisionReport remain
  synchronous and clean without crypto service provisioning or launching stdio.
  Preserve exact four names and all registration behavior. Statically verify
  production projector still rejects over-cap names instead of hashing them;
  do not export private helpers solely for tests or mutate production candidates.
- Retain public row/report codecs and arbitrary equivalence tests, including
  valid exported rows outside producer provenance. No new schema restrictions.
- Compare report and collision-error encodings for all3 outcomes, unchanged
  generated artifact and newline. Require owning check/tests and
  `bun run beep quality package-verify @beep/gov-legal-mcp` at handoff, plus named
  campaign gates. Scoped static proof is not runtime/package proof.

## Risk

The prior design's Effect-owned body description is stale: converting this helper
to Effect would change eager initialization and service requirements. Preserve
Result and both caller boundaries. The4/3 invariant depends on private producer
provenance; applying it to arbitrary public rows would narrow an unrelated API.
Keep normalized priority, multiplicity and per-row detail despite aggregate stage.

The former Tier 2 row truncated/digest record is queued for withdrawal after
R32 as outside the recall net, not D1: complete ToolNameCollisionRow has only
one Boolean, truncated. This stage migration has no dependency on a row
migration, no serial row landing plan and no row codec change. Preserve the
existing exported row exactly. The stage helper independently remains two
Boolean locals with a 4/3 gap. All implementation remains gated on replacement
P3 and campaign GATE 2.
