# Design: resolved Runpod template selection

Status: P2 draft; independent Fable review pending. Stable inventory id:
`docgen-runpod-template-search-scopes`. Native source: HEAD
`1c07c15495aaa42f521b887b01e943e68804606c`, main
`3657f8f97f7135c53c3c0b9fa99aa19093c3e5ee`. Rebind before review.
Tier 2, derived output with persisted report exposure.

## Current shape

`packages/tooling/tool/cli/src/commands/Docgen/internal/QualityWorkerRunpodEval.ts:121-135`
owns a sanitized completed template/image decision: required imageName, two
Boolean scope facts, the three-valued strategy LiteralKit and nullable id/name.
It is nested in the public report at231-254 and emitted as JSON at1297-1299;
`Docgen.command.ts:1079-1080` writes the result through the existing output path.

The E4 proof is the complete selection flow, not a statistical observation of
fixed settings. An explicit id terminates before search (534-549,570-571).
Search is skipped when either request gate says so (573-578). Otherwise the
request includes both external scopes (583-586), and the result is either an
existing template (551-559) or fallback after an empty selection (589-598).
Both recorded scope facts describe that one completed-or-skipped search phase.
The raw report's E1 labels and4/2 count do not describe the complete owner.

## Cardinality gap

The finite product is two Boolean values times two Boolean values times three
strategies times two id-presence states times two name-presence states:48.
Actual strings, including empty upstream strings, remain payload values and
are not turned into arbitrary nonempty/empty state bits.

| Output | Scope bits | id | name | Finite states |
| --- | --- | --- | --- | --- |
| explicit-template | false,false | present | absent | 1 |
| existing-template | true,true | independently absent/present | independently absent/present | 4 |
| fallback-image after skipped search | false,false | absent | absent | 1 |
| fallback-image after completed search | true,true | absent | absent | 1 |

There are7 legitimate completed-output states. `existingTemplate` deliberately
accepts missing id/name from the SDK at556-558; do not assume either is required.
Fallback preserves the configured image string. The required imageName is common
data, not another discriminator. The public request options at275-300 retain
all existing contradictory or redundant combinations and their current
precedence. The external `ListTemplatesRequest` remains a D2 wire mirror.

## Target schema

Retain the existing strategy LiteralKit and its exact values. Define annotated
class cases discriminated by `strategy`, combined through
`S.toTaggedUnion("strategy")`:

- Explicit case: required imageName and templateId. No search flags or name.
- Existing case: required imageName and independent `Option<string>` templateId
  and templateName. No scope flags; selection itself proves search completed.
- Fallback case: required imageName and a `LiteralKit(["skipped", "completed"])`
  search phase. No id or name fields.

Use `S.String` for values whose existing contract accepts every string. Keep
actual id/name payloads byte-for-byte; optional SDK properties become Options
at the SDK-to-decision boundary. Do not store a new Ref/atom or invent a second
source of truth. The result is derived from the same selection operation.

The private `fallbackTemplate` helper is a producer adapter of this included
output, not a separately qualified function-parameter record. Its calls select
one search literal instead of supplying duplicate facts. Preserve request
helper parameters/precedence except the incidental producer adaptation needed
to construct the reviewed result. No CLI flag, SDK shape or dependency changes.

## Migration inventory

- 121-135: replace the decoded bag with the three cases and retain a named
  compatibility schema with the exact legacy six-field encoded shape.
- 518-559: construct fallback, explicit and existing cases directly. Preserve
  explicit trim/nonempty normalization and existing SDK image fallback.
- 562-599: keep explicit-id precedence, skip/allow precedence, one ListTemplates
  call including both scopes, selection ordering and error propagation.
- 302-307,665-741: update the acquired-pod type and every template read. Match
  the case for optional template id; preserve the log text at685, the conditional
  SDK create input at702, the common image reads and the pod's nullable
  templateId at736. An existing template without an id must still create from
  its image, exactly as today.
- 231-254,1165-1184: migrate the public report's decoded template field and its
  only runtime producer. Every other report field remains the same.
- 1190-1299: update the exported example and generator for the new decoded
  case. Audit all live exports and tests by symbol before implementation;
  graph caller absence is insufficient (the graph misses several class edges).
- `Docgen.command.ts:1079-1080`: retain file/stdout behavior and schema version.
- `test/docgen.test.ts:3567-3758`: retain selection, create-input, confirmation,
  cleanup and readiness behavior; new tests use fakes and codec fixtures.

## Guard-deletion accounting

Delete the paired Boolean assignments in explicit/existing constructors and
both fallback calls (527-528,542-543,554-555,575-576,594-595). Delete the
implicit obligation that those two facts always agree. Delete explicit/fallback
nullable id/name assignments from decoded constructors: those variants encode
their presence directly. Case matching replaces the generic nullable-template
selection at702 with a typed id projection; existing-case id absence is real
and must stay handled. The formatted log and pod projection still need an
optional id formatter/encoder; do not claim those behavior-preserving branches
are redundant guards. Preserve all request validation, authorization, SDK
failure, resource cleanup, selection and network readiness checks.

This design removes duplicated output state and constructor obligations. There
is no existing dedicated runtime equal-bits guard to claim as deleted.

## Encoded-side impact

Keep encoded field order, names, values and nulls exactly as the current
six-field class: imageName, searchIncludedPublicTemplates,
searchIncludedRunpodTemplates, strategy, templateId, templateName. Encode the
explicit case with false/false and null name; existing with true/true and both
independent nullable values; fallback with the phase projected to both bits and
two null payloads. No new discriminator/search property may appear in JSON.

Build the pure transform with checked Effect v4 Schema APIs and typed errors.
Its supported domain is the seven legitimate output cells above; decoding must
retain all real payload values. The native history audit inspected all29 reachable versions of this source
file, including all six distinct producer blocks. Every constant scope pair is
false/false or true/true, and the explicit/existing/fallback payload-presence
cases remain the seven cells above. The original explicit-id producer retained
whitespace in its output; S.String must preserve that historical payload, even
though the current producer trims it. No matching test fixture adds another
scope combination. Recheck newly landed producer changes before implementing
rejection of the other41 cells. Permissive schema construction alone does not
establish a legitimate completed-output cell.

The current generator calls `renderJson(report)`, and `renderJson` uses generic
`encodeCommandJson` at311-316. It does NOT automatically invoke the nested
Schema encoder. Implementation must explicitly encode the report's template
through its compatibility schema before generic serialization, preserve the
remaining wrapper fields and order, then use the same pretty renderer. Coordinate
this path with `docgen-runpod-cleanup-outcome`: whichever singleton lands second
must preserve the first codec and project both reviewed fields through one
coherent wrapper encoding path. Do not serialize decoded tagged cases directly.

## Test impact

Enumerate all48 finite cells. For each of the7 supported cells, prove decode/
encode equality with absent/present id/name payloads, empty SDK strings,
non-ASCII strings and distinct images. Prove full wrapper JSON byte equality
against the prior generator, including ordering, nulls, schema version and
pretty output. Account for any additional historical legitimate cell before
introducing rejection tests; document that audit explicitly.

Exercise explicit-id selection without a list call; each skip/allow combination;
search-hit templates with all four id/name presence pairs; and search-miss
fallback. Verify unchanged pod input and log behavior, image fallback, request
error text, authorization, cleanup and timeout handling. Use fake services;
no paid pod or network call is needed for this migration.

## Risk

The main risk is changing report bytes or assuming a nested Schema encoder runs
inside generic JSON serialization. The historical explicit-id whitespace case
and independent existing-template id/name presence must stay supported.
Coordinate the wrapper encoder with the cleanup singleton before changing it.

Run full `bun run beep quality package-verify @beep/repo-cli` and canonical Yeet
repair/full verify before publication. Land as a Tier2 singleton after the
packet-only ratification PR. Reconcile the cleanup singleton's serializer and
all current source anchors before independent review and implementation.
