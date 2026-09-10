# Instance

- id: `r27-cli-commands-d-k-normalize-manifest-dedupe-move`
- exact source SHA: `93217d998f851e2e93d9864e2b5315552eaa58a7`
- corpus `origin/main`: `d1b4d769fbaffddd55717f3b1ba461897dd545c5`
- file:line: `packages/tooling/tool/cli/src/commands/Files/internal/Normalize.schemas.ts:165`
- symbol: `NormalizeManifestOptions`
- members: `dedupe`, `moveDuplicatesTo`
- evidence: E4 at `Files.service.ts:2242` and E1 at `Files.service.ts:1362`;
  the only supported plan writer records the normalized effective operation.
- cardinality: 4 representable / 3 legal Boolean–payload-presence states
- target: tagged union; stored manifest snapshot; persisted exposure; Tier 2
- source adjudication:
  `../data/design-refresh-2026-09-09-r27-cli-normalize-carriers.md`
- current impact audit: `../data/design-refresh-2026-09-09-r28-docgen-files-impact.md`
- prior design: `../history/designs/2026-09-09-pre-main-d1b4d7/r27-cli-commands-d-k-normalize-manifest-dedupe-move.md`

P2 design only. Inventory admission/status changes, independent P3 review, and
implementation are not performed by this document. Paths shortened below are
relative to `packages/tooling/tool/cli/src/commands/Files/` unless otherwise
specified. The current Astra/xhigh instruction supersedes historical model
wording in the packet.

# Current shape and legal states

The R28 refresh leaves this owner's 4/3 proof, public four-request boundary,
codec plan, profile folding, Apply consumers, and Tier-2 scope unchanged.
The source diff extracts `statSourceEntry` at `Files.service.ts:529-532` and
uses it for normalize at `:556`, detect-borders at `:958`, archive selection at
`:1175`, and caption inspection at `:736`. It preserves the same stat call and
typed failure mapping. Caption helper extraction shifts later source citations
by two lines without changing normalize's builders or execution semantics.
The current test adds a broken-image symlink to the existing skipped-source
fixture (`test/files-command.test.ts:4409`); retain its leading symlink skip and
six-entry skipped count at `:4417-4431`. These required counts and arrays are
payloads and test expectations, not new admitted state axes.

`NormalizeManifestOptions` is a recorded effective-operation model. It declares
`dedupe: S.Boolean` at `internal/Normalize.schemas.ts:165` and optional
`moveDuplicatesTo: S.String` at `:168`, beside independent format, maxLongEdge,
and overwrite fields. `NormalizePlan.options` embeds it at `:266`, and
`NormalizeManifest.options` embeds it at `:362`.

The service first computes effective dedupe at `Files.service.ts:2242`, then
calls the only plan builder at `:2254`. The private builder validates/resolves
the destination at `:1353` and calls the only options writer at `:1362` with
effective dedupe and the resolved destination. The private options writer at
`:339` copies dedupe and conditionally emits the path. The manifest writer at
`internal/Apply.ts:406` copies `plan.options` unchanged at `:409`.

# Cardinality gap

| Encoded dedupe | Encoded moveDuplicatesTo | Recorded operation |
| --- | --- | --- |
| false | absent | Normalize without dedupe |
| true | absent | Skip duplicate normalized outputs; leave duplicate source files in place |
| true | string payload | Skip duplicate normalized outputs and move duplicate source files |

False plus a present destination is not a supported **recorded effective
operation**. Counting path presence is legitimate because the declaration has
an actual optional property. Path values remain unrestricted payloads under
the existing string schema; this count does not replace them with an enum.

The public request model is different. `NormalizeFilesOptions` at
`internal/Normalize.schemas.ts:129` has constructor-default false dedupe and
constructor-default None destination. All four request tuples are supported:
false/None, true/None, false/Some(path), true/Some(path). Supplying a destination
enables dedupe, as documented at `Files.command.ts:265`, package `README.md:416`,
and implemented at `Files.service.ts:2242`. Preserve that D1 request carrier's
schema, defaults, accepted inputs, public service signature, and behavior.
This design does not make false/Some an invalid request.

# Target schema and ownership

Keep new models and the compatibility codec in the existing
`internal/Normalize.schemas.ts`; no new package, concept file, or service is
needed. Reuse `NormalizeImageFormat`, `PositiveMediaDimension`, the existing
identity composer, and existing field schemas.

Define `NormalizeDuplicateHandlingKind` with
`LiteralKit(["off", "dedupe", "move"])`. Define annotated `S.Class` members
with a `kind` discriminator from that kit:

| Member class | Decoded fields |
| --- | --- |
| `NormalizeWithoutDedupe` | `kind: "off"` |
| `NormalizeWithDedupe` | `kind: "dedupe"` |
| `NormalizeWithDuplicateMove` | `kind: "move"`, `directory: S.String` |

Assemble `NormalizeDuplicateHandling` with the kit's `mapMembers` and
`S.toTaggedUnion("kind")`. Follow the live LiteralKit/member-class construction
pattern in `packages/foundation/ui-system/dock/src/Dock.protocol.ts:137` and
`:179`; derive `.cases`, `.guards`, `.match`, and any `S.is` guard from the
schema. Do not add `as const`, hand-maintained literal unions, or parallel
predicate helpers. A tagged union is appropriate because only move owns a
destination payload; an Option of a payload-free literal would lose it.

Use one decoded options class, `NormalizeManifestOptionsData`, with:

- `duplicates: NormalizeDuplicateHandling`;
- `format: NormalizeImageFormat`;
- `maxLongEdge: S.optionalKey(PositiveMediaDimension)` exactly as today;
- `overwrite: S.Boolean` exactly as today.

`NormalizeManifestOptionsData` is a constructor for known in-repo producers,
not a second persisted schema or a shadow state cache. Its export has the
concrete `Files.service.ts` constructor consumer described below. Retain the
public name `NormalizeManifestOptions` for the annotated compatibility codec
whose decoded type is `NormalizeManifestOptionsData`; export its same-name
type alias from the codec. This intentionally migrates the old exported decoded
class shape atomically. Do not leave deprecated `dedupe`/`moveDuplicatesTo`
getters, extra constructor aliases, or a second flat domain model.

The private boundary schema `NormalizeManifestOptionsEncoded` retains the
current flat fields in their current order: dedupe, format, optional
maxLongEdge, optional moveDuplicatesTo, overwrite. A private `S.Struct` is
appropriate for this encoded-only shape. Compose it with
`S.decodeTo(NormalizeManifestOptionsData, SchemaTransformation.transformOrFail(...))`.
The transformation consumes the source schema's Type and produces the target
schema's Encoded form; class construction/validation is left to the target
schema. The inverse maps the target encoding to the legacy field set.
Use `NormalizeDuplicateHandling.match` for the three-case inverse projection.

The nontrivial API choices were checked against local Effect v4:
`.repos/effect/packages/effect/SCHEMA.md:3144` and `:3214`,
`Schema.ts:5366`, and `SchemaTransformation.ts:333`. Use Effectful schema
decoding/encoding and typed error mapping at the existing boundary. Do not
introduce native JSON parsing or synchronous throwing codecs.

# Encoded-side impact

Decode the three legitimate encoded states exactly:

1. False with absent moveDuplicatesTo becomes `duplicates=off`.
2. True with absent moveDuplicatesTo becomes `duplicates=dedupe`.
3. True with a present string becomes `duplicates=move(directory=that string)`.

Encode these cases to the table above. Emit no discriminator, `duplicates`
object, or renamed destination key into `beep.files.normalize.v1`. Preserve
format, overwrite, optional maxLongEdge, all full string payloads, field
omission, and schema field order. Do not add defaults to the recorded schema:
dedupe, format, and overwrite remain required; optional keys remain optional.
Keep the original primitive schemas and parse-option handling, including their
existing behavior for invalid/null/undefined values and unknown properties.

**Request normalization and persisted decoding are different boundaries.**
False/Some at service entry still means move mode. False/present in an encoded
manifest is an incoherent recorded operation and fails the new fallible
compatibility decode with a `SchemaIssue.InvalidValue` identifying the options
pair; it is never silently rewritten to true or stripped of its destination.
The current generic `S.toArbitrary(NormalizeManifest)` round-trip test is not a
supported producer for that contradictory tuple. No current explicit fixture,
documented persisted constructor, or production reader/rollback path establishes
it as a legitimate historical manifest. This boundary decision must be included
in independent review rather than hidden as an incidental union side effect.

Do not validate filesystem state or resolve paths while decoding a persisted
manifest. A legitimate encoded move path must round-trip byte-for-byte even if
the destination has moved, disappeared, is relative, or is the empty string.
The schema's `S.String` payload remains `S.String`. Operational directory
validation occurs only during a new request. `path.resolve` remains at
`internal/Validation.ts:327`; it returns the resolved lexical path, while
realPath is used only for collision/alias checks. Do not replace recorded paths
with realPath output or turn Some("") into None.

`NormalizeManifest` keeps its current class/public name, version literal,
entries, source/output paths, skipped records, and summary; only its nested
decoded options type changes through the codec. Its encoded shape remains
unchanged. `encodeNormalizeManifest` retains both overloads, ParseOptions
forwarding, dual dispatch, and typed error behavior at
`internal/Normalize.schemas.ts:407`. `Files.render.ts:342` and `:346` retain
the existing schema-encoding and Biome-rendering error messages.

# Construction and runtime migration

The operational owner is the decoded `plan.options.duplicates`. Build it once
after request normalization and destination validation. A Some validated
destination creates move; otherwise effective dedupe selects dedupe/off. This
mapping preserves all four public requests and the existing three operations.
It allocates no additional stored state beyond the current plan/manifest.

Remove the redundant `NormalizePlan.duplicateDirectory` field at
`internal/Normalize.schemas.ts:263`. It duplicates the move payload and would
allow the executed destination to disagree with the manifest. Use the move
case's directory in the plan's logging, apply logic, and manifest generation.
`NormalizePlan` is an exported decoded dependency, but no independent persisted
plan encoding or external supported constructor was found. Migrate its known
consumers atomically; do not add an alias field solely to preserve permissive
construction of mismatched plan/options values.

Remove the separate dedupe argument from the private-flow exported
`applyNormalizePlan` helper at `internal/Apply.ts:455` and its only call at
`Files.service.ts:2299`. Dispatch through the operation's schema-derived match
or guards. Off bypasses hashing/dedupe; dedupe and move retain exact normalized
byte comparison, with only move producing destination paths. Keep overwrite
independent. This is dependency migration for the qualified manifest owner, not
a new campaign qualification against function flag parameters.

The CLI fold at `Files.command.ts:759` and service normalization at
`Files.service.ts:2242` may remain as existing input-boundary behavior. This
design does not require rewriting the D1 request API just to remove those two
expressions. The profiling expression at `:2340` also preserves its current
effective value and timing; do not move profiling after filesystem work merely
to derive it from an already constructed plan. Guard-deletion claims below
exclude these retained boundary folds.

# Migration inventory

| Current source | Required change |
| --- | --- |
| `internal/Normalize.schemas.ts:163` | Replace the flat decoded options class with the member classes, LiteralKit-backed handling union, decoded data constructor, private flat encoded schema, and public codec/type. Keep JSDoc annotations and constructor examples accurate. |
| `internal/Normalize.schemas.ts:261` | Nest the new decoded options codec in NormalizePlan; remove its redundant duplicateDirectory storage. Preserve entries, skipped records, and all other fields. |
| `internal/Normalize.schemas.ts:358`, `:407` | Retain outer manifest/version and encoder APIs while the nested decoded options migrate. |
| `Files.service.ts:332`, `:1362` | Replace the old Boolean/Option copying helper with construction of NormalizeManifestOptionsData from one handling variant and the unchanged format/maxLongEdge/overwrite fields. Do not route trusted constructors through an unnecessary legacy JSON round trip. |
| `Files.service.ts:1353`, `:1417` | Preserve directory validation and plan ordering; place the resolved destination only in the move payload. No new check rejects false/Some request input. |
| `Files.service.ts:2271`, `:2299` | Derive the logged destination from the move case and migrate the apply call to the plan-owned handling. Keep strings, dry-run, maxLongEdge, and overwrite behavior. |
| `internal/Apply.ts:144` | Preflight accepts the migrated plan, but continues checking output/manifest path conflicts and overwrite policy unchanged; it never needed the duplicate handling pair. |
| `internal/Apply.ts:394`, `:406` | Copy honest decoded options into the manifest; preserve all entries/skipped/summary calculations. |
| `internal/Apply.ts:452`, `:479`, `:529`, `:538` | Consume plan-owned handling instead of an independent dedupe parameter and duplicateDirectory Option. Preserve directory creation, hashing, equality checks, candidate ordering, destination naming, and duplicate move records. |
| `Files.render.ts:334`, `:627` | Preserve manifest codec/formatting behavior and plan entry/skipped rendering. The changed NormalizePlan Type must compile through both exported readers. |
| `Files.schemas.ts:77`; `index.ts:43`, `:50`; package `package.json:39`, `:109` | Carry the changed decoded types and necessary new constructors/helpers through the existing Files exports. No compatibility aliases for zero-consumer decoded members; preserve the package subpath and actual encoder contract. |
| `test/files-command.test.ts:74`, `:86`, `:94`, `:265`, `:843`, `:891` | Migrate schema-derived decoding/encoding/arbitraries and manifest read helper to the new decoded options. Replace the legacy synchronous decode helper with an explicit Effect/Result boundary if touched. |
| `test/files-command.test.ts:4210`, `:4267`, `:4307`, `:4368`, `:4413` | Migrate decoded manifest consumers; the dedupe/path assertions at `:4374`–`:4375` become handling assertions plus separate exact encoded-key assertions. Keep all existing behavioral assertions. |

`NormalizeFilesOptions`, `FilesCommandServiceShape.normalizeFiles` at
`Files.service.ts:275`, and exported `normalizeFiles` at `:2776` retain their
existing request type and input semantics. The narrower D1 inventory records
`files-normalize-options` and `files-normalize-manifest-options` remain census
receipts for their independent member clusters; this design does not advance or
rewrite them.

# Persisted readers, staging, and recovery

The manifest is rendered at `Files.render.ts:342` and `:346`, written to the
temporary manifest at `internal/Apply.ts:601`, and renamed to its final path at
`:639`. Preserve the ordering: staged normalized output writes; selected output
renames at `:608`–`:620`; duplicate source moves at `:622`–`:634`; final manifest
commit at `:636`–`:639`. Preserve overwrite removals, exact names, path strings,
and typed platform-error mapping.

The rename error at `internal/Apply.ts:425`–`:436` includes the recovery
temporary-directory path. Preserve that error and the existing acquire/use/
release cleanup at `:491` and `:643`–`:649`. Do not opportunistically repair or
redesign transaction/recovery behavior. There is no automatic normalize-manifest
rollback reader in the searched `packages`, `apps`, or `scripts` source; do not
claim one exists. Recovery information includes manifest entries, hashes,
source/output paths, duplicate relationships, and moved-path fields, all of
which remain unchanged. The test filesystem reader at
`test/files-command.test.ts:265` is an actual persisted reader and must migrate.

The existing-manifest refusal fixture at `test/files-command.test.ts:4485`
preserves its previous file contents on failure (`:4502`) and asserts no image
was written (`:4503`). Keep it. A refactor of options must not reorder preflight
past output writes or overwrite an existing manifest unintentionally.

# Guard-deletion accounting

| Existing obligation | Result |
| --- | --- |
| Flat decoded `dedupe` plus optional `moveDuplicatesTo`, `Normalize.schemas.ts:165`–`:169` | Deleted from the decoded model; one handling case owns the state and move payload. Flat fields remain only in the private compatibility schema/projection. |
| Independent manifest field copying, `Files.service.ts:339`–`:344` | Replaced by one handling constructor and a schema-owned encoder. Callers no longer establish the implication by convention. |
| `NormalizePlan.duplicateDirectory`, schema `:263`, write `Files.service.ts:1418` | Deleted as redundant stored payload; plan, application, and manifest share the same move case. |
| Separate apply dedupe input, `Files.service.ts:2299`, `Apply.ts:455` | Deleted; the apply helper cannot be passed a Boolean disagreeing with its recorded options. |
| Destination presence tests/mapping against the separate plan Option, `Apply.ts:479` and `:538` | Replaced by handling-case dispatch; move carries a required destination. |
| Raw-request folds at `Files.command.ts:759`, `Files.service.ts:2242`, and profile `:2340` | Retained behavior, not counted as deleted. They serve the supported D1 request/telemetry boundary. |
| Directory/path/overwrite checks, duplicate byte comparison, collision guards, staged writes and cleanup | Retained operational validation; the union cannot establish filesystem facts or successful I/O. |

No current manifest implication `.check` exists, so this design claims no
deletion of such a guard. The concrete gains are elimination of the decoded
parallel pair, redundant destination storage, independent apply Boolean, and
the associated reader coordination. The compatibility decoder is the single
place that recognizes legacy field coherence; it is not replicated at every
reader.

# Test impact

1. Add exact legacy JSON fixtures for off, dedupe, and move. Decode each to its
   handling case; encode it back with the same keys, values, omissions, and
   field order. Compare the old and new `renderNormalizeManifest` output bytes,
   including formatting/newline behavior and schema version. Preserve arbitrary
   move string payloads on codec round trips, including empty/relative strings;
   no filesystem lookup is allowed in a persisted decode.
2. Cover all three canonical formats and independent overwrite values. Exercise
   absent/present maxLongEdge with its existing positive dimension schema. Keep
   required-field errors and invalid primitive/optional-value behavior supplied
   by the unchanged legacy field schemas. Assert false/present recorded options
   produce a typed decode failure rather than a silently altered manifest.
3. Derive new canonical arbitraries from the schema for the round-trip property
   at `test/files-command.test.ts:834`; keep non-smell entry, skipped, and
   summary payloads arbitrary. Add a separate explicit contradictory-legacy
   fixture so narrowed business coherence is reviewed and tested, not hidden by
   a smaller generator.
4. Preserve the ordinary normalize fixture at `:4180`, dedupe-only at `:4278`,
   move-without-explicit-dedupe at `:4330`, dry-run non-mutation at `:4437`,
   overwrite behavior at `:4457`, and existing-manifest refusal at `:4485`.
   Assert decoded handling and exact legacy encoded fields separately. Keep the
   updated skipped-source fixture at `:4392`, including the broken symlink
   at `:4409`, its skip ordering, and all six skipped records.
5. Add direct-service request fixtures for false/Some, omitted dedupe/Some, and
   true/Some, with valid synthetic directories. All produce the same move
   operation and expected manifest fields; false/None and true/None retain
   their distinct operations. Keep request constructor defaults and do not
   replace the public input schema with the three-case union.
6. Exercise valid existing/missing destinations and source/output aliases;
   preserve path-resolution behavior, typed messages, duplicate target naming,
   and preflight-before-mutation. Test a staged failure at the changed apply
   boundary to verify manifest commit ordering, rename error context, and
   existing cleanup behavior without asserting an unimplemented rollback.

Implementation validation: run the focused Files command/schema tests, then
`bun run beep quality package-verify @beep/repo-cli`. The full package check is
required for a package handoff; follow the canonical Yeet repair/verify flow
for the Tier 2 PR. Use synthetic media fixtures only. This design-only handoff
does not run product tests or claim those future checks passed.

# Risk and sequencing

Land this as one Tier 2 change spanning the schema/codec, producer, plan/apply
consumers, rendering types, exports, and tests. Source and main must be refreshed
again at implementation/review time; this document proves only the frozen
source above. Obtain independent review of every encoded rule, the four-input
request contract, and actual guard deletions before application.

The material risks are narrowing the public request accidentally, leaking the
new tag into manifest JSON, normalizing a stored path during read, retaining a
second destination that can diverge, and changing staged mutation ordering.
The tables and compatibility fixtures above are the acceptance conditions.
No persisted file migration, version bump, source-media operation, inventory
edit, status change, or implementation is authorized by writing this design.
