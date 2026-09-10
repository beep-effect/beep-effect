# Provisional design: aggregate MCP tool-name collision stage

Stable ID: `r3-drivers-arch-tool-name-collision-stage-flags`. P2 draft on frozen
HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`, main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. Independent R28 drivers-g-m census
corrects D1 to E4, 4 representable / 3 legal. Derived/internal, Tier 1. Canonical
admission and independent P3 design review remain parent responsibilities.
Evidence, exact replacement row, callable withdrawals, and file hashes are in
`data/design-refresh-2026-09-09-r28-driver-collision-values.md`.

## Current shape

`packages/drivers/gov-legal-mcp/src/ToolNames.ts:483–532` exports
`buildToolNameCollisionReport`. After successful projection of all candidates,
the function groups the same rows by normalized and final wire name, retains
both duplicate-key sets, and derives two Boolean locals:

```ts
const hasNormalizedDuplicates = N.isGreaterThan(HashSet.size(normalizedDuplicates), 0);
const hasFinalDuplicates = N.isGreaterThan(HashSet.size(finalDuplicates), 0);
```

These are actual non-callable sibling values at 490–491. The scanner's
`.stageFlags` suffix does not name a source object or declaration; the corrected
owner symbol is `buildToolNameCollisionReport`. There is no Boolean default,
optional Boolean, constructor argument, or independently exposed field for
either local. Required arrays, sets, names, counts, and associated row payloads
are not extra axes in this owner.

The pair is read by the report's `duplicateVerdict` at 508 and the ordered error
branches at 511 and 521. Normalized collisions win over final collisions. Both
duplicate-key sets also label each report row independently at 497–501. A row
keeps normalized precedence when it belongs to both kinds of duplicate group.

Preserve the complete surrounding contract:

- Input `ToolNameCandidate` at 105 requires `operationId` and `source` as
  nonempty strings, with no added defaults or deduplication.
- `ToolNameCollisionRow` at 144 keeps `candidate`, `digest` (`null` or string),
  `duplicateVerdict`, `finalWireName`, `normalized`, `originalOperationId`,
  `source`, and `truncated` (explicit Boolean). Neither null digest nor false
  truncation may be omitted or rewritten by this record.
- `ToolNameCollisionReport` at 175 keeps its candidate array, aggregate
  `clean`/`duplicate` verdict, and constructor-default `S.tag` version
  `gov-legal-mcp/tool-name-collision-report/v1`.
- `ToolNameCollisionError` at 244 keeps its tag, sorted `collisionKeys`,
  nonempty `message`, existing `reason` literal, and complete report.
- Projection at 433–459 keeps normalization, the >64 truncation threshold,
  first-55-character prefix, underscore separator, first-eight-hex SHA-256
  digest, and existing normalization failures. The normalization error still
  returns before grouping when any candidate projection fails.

## Cardinality gap

The current pair represents four states. Exactly three are supported:

| Pair `(normalized, final)` | Aggregate stage | Existing externally observable outcome |
| --- | --- | --- |
| `(false, false)` | `unique` | Successful `clean` report. |
| `(false, true)` | `duplicate_final` | Failure with final collision keys and final-collision message/reason; report is `duplicate`. |
| `(true, true)` | `duplicate_normalized` | Failure with normalized collision keys and normalized-collision message/reason; report is `duplicate`. |
| `(true, false)` | No member | Impossible because final name is a deterministic function of normalized name. |

`groupsBy` at 312 and `duplicateKeys` at 322 preserve duplicate multiplicity.
For any two equal normalized strings, `projectToolNameCandidate` at 439–446
chooses the same truncation branch and produces the same final wire name. Thus
every normalized duplicate is a final duplicate. The stage preserves the
combined-true case; it does not impose mutual exclusion on the two events.

All legal states have source-supported witnesses. The empty input and the four
production candidates give clean reports. Cross-driver and punctuation cases at
`test/Server.test.ts:499–549` yield both true. The frozen collision at 551–576
uses distinct 68-character normalized strings ending `_000000000g50` and
`_0000000011bm`, each with the same `ecfr_` plus 50 `x` prefix. Both digest to
prefix `a06e92ed` and produce one 64-character final wire name, proving false/true
without assuming an unobserved hash collision.

This is a 4 → 3 reduction. The existing report verdict alone has two values and
would erase the failure-stage distinction; the error reason alone has two
values and lacks success. A schema for all four original pairs would retain
the invalid state instead of fixing the owner.

## Target schema

Reuse the existing private `RowDuplicateVerdict` LiteralKit at `ToolNames.ts:47`
as the finite domain of one aggregate `collisionStage` local. It already has
exactly `unique`, `duplicate_normalized`, and `duplicate_final`. The aggregate
stage is the highest-priority collision verdict present among the rows, or
`unique` when all rows are unique, including the empty report.

No new literal family, public schema, compatibility alias, field, role file,
or decoding boundary is needed. Keep the kit's existing identity and annotation
for its row schema use; reusing its values internally does not change the
schema field's per-candidate meaning. Do not rename the kit or public row field
as an incidental cleanup. Derive the local type from `typeof RowDuplicateVerdict.Type`.

At the one producer boundary, select the existing literal from duplicate sets
with normalized precedence: nonempty normalized set → `duplicate_normalized`;
otherwise nonempty final set → `duplicate_final`; otherwise → `unique`. Use
Effect matching helpers and the existing kit's `Enum`/`thunk` helpers where they
give the tersest equivalent expression. Do not first store the two old Boolean
results or add a tuple of them behind the new literal.

Use `RowDuplicateVerdict.$match(collisionStage, cases)` for the aggregate
consumers. The existing local implementation supports the data-first overload
and exhaustive cases at
`packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:582–605`
and exposes the helper on its schema type at 639–648. No advanced Effect Schema
v3/v4 transformation is introduced by this design.

The report-verdict match maps `unique` to `clean` and both duplicate members to
`duplicate`. The result match has the following complete branches:

- `unique`: succeed with the already-built report.
- `duplicate_normalized`: produce the existing `ToolNameCollisionError` using
  sorted normalized duplicate keys, reason `duplicate_normalized`, and exact
  message `Duplicate normalized MCP tool names are forbidden.`
- `duplicate_final`: produce the existing error using sorted final duplicate
  keys, reason `duplicate_final`, and exact message
  `Duplicate final MCP wire names are forbidden.`

Retain the report on both error branches. Avoid a default branch that could
silently turn an unhandled stage into a clean report. There is no new schema
default and no stage-bearing object whose fields could leak into rendering.

Keep both duplicate-key sets and each row's current membership-based verdict.
For example, a single report can contain a normalization-collision pair, a
different final-only pair, and one unique row. Its aggregate stage must be
`duplicate_normalized`, while its rows still expose all three row verdicts.

## Migration inventory

All paths here are under `packages/drivers/gov-legal-mcp/` unless specified.

| Writer or consumer | Planned migration or preservation |
| --- | --- |
| `src/ToolNames.ts:487–491` | Retain candidate projection, normalization failure, duplicate grouping, and both sets. Replace the two aggregate locals with one schema-derived stage. |
| `src/ToolNames.ts:492–504` | Preserve row payload spread, per-row normalized/final key-membership checks, and final/source/operation-ID sort. Stage never overwrites all rows with one verdict. |
| `src/ToolNames.ts:506–531` | Build the same report with an exhaustive stage-to-report-verdict mapping; replace the ordered Boolean error branches with an exhaustive stage-to-result match. |
| `src/ToolNames.ts:47`, 105, 144, 175, 204, 244, 282 | Reuse the existing private kit. Keep candidate, row, report, normalization-error, collision-error, and registration-error schemas and their annotations, fields, defaults, and public names. |
| `src/ToolNames.ts:297–310`, 375–459 | Keep sort order, candidate text, hashing, normalization, projection, truncation threshold, and digest payload unchanged. |
| `src/ToolNames.ts:331–358`, 554–555 | Keep the canonical renderer's recursive ordering, indentation, escaping, and exactly one trailing LF. New stage is local and absent from rendered data. |
| `src/ToolNames.ts:572–597` | Keep the four production candidates and eager report construction via `Result.getOrThrowWith`; duplicate production names still prevent initialization. |
| `src/ToolNames.ts:620` onward; `src/Tools.ts:32–40` and declarations | Preserve the curried and data-first registration resolver, exact wire-name literal return types, absent-candidate/drift errors, and all registered tool names. |
| `src/index.ts:46`; `package.json` exports | Keep root and `@beep/gov-legal-mcp/ToolNames` public access. The aggregate stage and kit remain private. |
| `scripts/generate.ts:10`, 51–75 | Writer continues receiving the same report and renderer; preserve output path, report bytes, independent version-module output, and offline behavior. No generator logic update belongs to this record. |
| `src/_generated/tool-name-collision-report.json` | Read-only encoded compatibility fixture; existing byte content should remain identical after implementation. |
| `test/Server.test.ts:293`, 499–576, 610–689 | Preserve failure assertions, frozen collision witnesses, registration proof, arbitrary row codec checks, and deterministic artifact checks; add only meaningful missing aggregate-stage behavior proof. |
| `test/GovLegalMcp.equivalence.test.ts` | Preserve source-alias imports and existing candidate/normalization/registration schema consumers; no new stage export is needed for testing. |

The tool declarations feed handlers, server, and guarded bin construction; their
public contracts require no shape change. Graft's exhaustive package searches,
the scoped apps no-hit result, package export inspection, and source-level
generator/schema reads supplement the call graph. The graph's absent edges
for module-level initialization or schema references are not treated as proof
those consumers do not exist.

The existing confirmed `tool-name-collision-row-truncated-digest` record is
4/2, Tier 2, with its separate design in
`designs/tool-name-collision-row-truncated-digest.md`. It owns the row's
truncation/digest representation and exact encoded compatibility. It overlaps
the same file and the row reconstruction in this function but does not own the
two aggregate flags.

Stage this Tier 1 record first, then rebase that Tier 2 singleton PR to preserve
the new aggregate match while adapting only row constructors and its renderer
codec boundary. If the Tier 2 change lands first, adapt the stage design to its
landed row type and leave that codec in place. Never apply both records in the
Tier 2 singleton PR, claim the same guard twice, or introduce a temporary public
alias merely to combine their staging. The current canonical row design remains
unchanged by this P2 draft.

## Guard-deletion accounting

| Frozen site | Concrete accounting |
| --- | --- |
| `ToolNames.ts:490–491` | Delete two named Boolean local declarations. The two set-size observations remain at the single producer classifier; no claim that the actual duplicate detection disappears. |
| `ToolNames.ts:508` | Delete the Boolean OR expression and ternary reader. Replace it with the existing-domain exhaustive mapping to the two encoded report verdicts. |
| `ToolNames.ts:511`, 521 | Delete both Boolean-controlled branches and their ordering dependency. One exhaustive literal-stage match retains the two typed failures and clean success. |
| `ToolNames.ts:497–501` | Zero deletion credit. Per-row membership checks represent which rows belong to which groups, not redundant copies of the aggregate pair. |
| Projection, `duplicateKeys`, normalization and registration checks | Zero deletion credit. Keep these real computations and boundary guards. |
| `ToolNameCollisionRow.truncated` / `digest` | Zero deletion credit in this record; these belong to the separate Tier 2 owner. |

Net structural change: two local Boolean axes become one existing three-member
literal; one aggregate Boolean combination and two downstream Boolean branches
disappear. No additional Boolean getter or helper is allowed to recreate the
old pair for the readers. Do not describe all branches as removed: domain
classification and legitimate result selection remain.

## Encoded-side impact

No encoded schema or public field changes in this Tier 1 implementation. The
row still encodes all eight existing keys; false `truncated` and null `digest`
remain explicit. The report still encodes `candidates`, `duplicateVerdict`, and
`schemaVersion: "gov-legal-mcp/tool-name-collision-report/v1"`. Error reason,
message, tag, collision-key array, and complete attached report remain identical.
Candidate and registration-error codecs and both resolver calling forms remain
unchanged. No aliases, deprecations, new defaults, version bump, or compatibility
codec are needed for a local aggregate-stage replacement.

`renderToolNameCollisionReport` currently canonicalizes the actual report object
directly rather than schema-encoding it first. That is safe for this stage-only
change because no report or row representation changes. Do not attach the
stage to the report or a spread source. The separate row-codec design must add
its own encoded projection before rendering when it changes the decoded row;
that requirement is not waived by this record's zero encoded delta.

Preserve sorted rows and collision keys, object key order, two-space indentation,
JSON escaping, no timestamps or CR characters, and exactly one final newline.
The frozen generated report SHA-256 is
`2a6d73fb1379a3321b890be6ff3a487395d5ece0ca2ede829758fcdb3cd4fe1e`.
The generator's unrelated `version.ts` output and all four production MCP wire
names remain unchanged. There is no SQL, JSONL, database, or telemetry schema
carrying these two local flags.

## Test impact

No tests were executed or edited for this P2 draft. Existing proof to preserve:

- `test/Server.test.ts:499–510` covers normalized-collision failure and selected
  normalized collision keys; 537–549 covers per-row normalized verdicts.
- Lines 551–576 cover the concrete final-only SHA-256/truncation fixture and
  per-row final verdicts. Keep its exact values and deterministic assertion.
- Lines 513–535 retain missing-candidate and wire-name-drift registration
  failures. Guarded-bin import behavior at 578 remains unchanged.
- Lines 610–635 retain arbitrary projection, candidate/row codec round trips,
  deterministic names, truncation limit, explicit false/null behavior.
- Lines 637–689 compare rendered bytes with the checked-in artifact and preserve
  exact production names, all row keys, ordering, and newline conventions.
- `test/GovLegalMcp.equivalence.test.ts` retains exported-schema equivalence and
  normalization/registration error contracts; the new local needs no test API.

Add focused behavior coverage at the exported report builder for empty and
ordinary clean inputs, repeated identical candidates, and a mixed report with
the existing normalized pair, the existing final-only pair, and a unique row.
The mixed report must fail with normalized reason/message and only normalized
collision keys while keeping normalized, final, and unique row verdicts. Check
input permutations preserve deterministic rendered report and sorted keys.
Preserve early normalization errors for invalid candidates before any collision
report is returned. Include row/report/collision-error encoding equivalence for
all three supported outcomes; do not expose the private stage solely to test
its implementation.

In the authorized implementation lane, run the focused gov-legal-mcp tests and
mandatory `bun run beep quality package-verify @beep/gov-legal-mcp`. Verify the
generated report stays byte-identical without accepting generator churn. Any
additional full-repo acceptance remains governed by the goal packet. Static
source proof and fixture arithmetic here are not substitutes for those checks.

## Risk

The main risk is losing normalized failure priority or flattening row-specific
verdicts into the aggregate stage. Retaining both sets and testing the mixed
case directly addresses both. Another risk is eliminating final-only as
theoretically unlikely; the fixed 68-character witness makes that unacceptable.
Repeated identical candidates must continue failing, so no deduplication can be
introduced while consolidating the classifier.

The private `RowDuplicateVerdict` domain is reused because the aggregate stage
is the highest-priority member of that same verdict domain. Its existing schema
identity and row annotation remain stable. A future reason to create a separate
domain would need an actual semantic difference; a new name alone is not a
reason to duplicate literals or add a compatibility alias.

Source locality makes this Tier 1, but public error payloads, fail-closed tool
registration, and the persisted report remain consequential consumers. Exact
bytes, required fields, explicit false/null, version defaults, and constructor
behavior are acceptance conditions. Coordinate serially with the separate
Tier 2 row migration to prevent accidental combined implementation or loss of
its renderer codec. No implementation or canonical admission is authorized by
this provisional file; independent P3 review remains outstanding.
