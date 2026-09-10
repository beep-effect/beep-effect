# R27 CLI normalize carrier adjudication

Read-only native source adjudication of the two records in
`data/sweeps/refresh-2026-09-09-r27-main-663904/r27-cli-commands-d-k.jsonl`.
This is a parent handoff, not an independent census, P3 review, inventory
admission, design approval, or lifecycle advance.

Frozen source HEAD: `8f266b878445ca8a7f751f9248da428a4dde39a1`.
Frozen corpus `origin/main`: `663904610cce2a38c06b0619a8c414646b69361c`.
Both refs were verified locally. No fetch, merge, or git mutation was performed.
Paths below are repository-relative and identify the current source lines.

The parent supplied the completed graft-first discovery: no indexed callers
for `NormalizeFilesOptions`, and twelve graft text hits in the command,
service, and schema. This audit continued with targeted source reads and
consumer searches rather than repeating those graft queries. AGENTS.md,
boolean-creep SPEC/DECISIONS, and the schema-first-development skill remain the
applicable rules. Generic schema permissiveness does not establish supported
domain states; actual documented normalization and explicit producers do.

## Dispositions

| Raw id | Actual carrier | Disposition | Parent action |
| --- | --- | --- | --- |
| `r27-cli-commands-d-k-normalize-files-dedupe-move` | Public request schema `NormalizeFilesOptions` | Eligible carrier, **D1**: all four request tuples are supported | Replace the proposed qualification with the D1 record below. Its 4/3 count describes the normalized subset, not every supported instance of this request type. |
| `r27-cli-commands-d-k-normalize-manifest-dedupe-move` | Recorded effective-operation schema `NormalizeManifestOptions` | Eligible carrier, **E1/E4, 4/3** | Retain qualified proposal with corrected producer evidence and the explicit input/output distinction below; persisted/Tier 2 compatibility required. |

Neither declaration is an anonymous function-parameter cluster or a callable
predicate. Both contain an actual Boolean and an actual optional string payload.
Neither is an external SDK/API/DB mirror, so neither should receive D2. There is
one qualified proposal after source adjudication, not the raw lane's two.

## Request inputs: false plus a destination is supported

`packages/tooling/tool/cli/src/commands/Files/internal/Normalize.schemas.ts:129`
declares `NormalizeFilesOptions` with:

- `dedupe: S.Boolean` and a **constructor** default of false at `:131`;
- `moveDuplicatesTo: S.Option(S.String)` and a constructor default of None at
  `:139`;
- independent `dryRun` at `:133`, `overwrite` at `:141`, three canonical format
  literals (`png`, `jpg`, `webp`) through `:134`, optional manifest path at
  `:135`, optional positive maximum long edge at `:136`, and required source
  and output paths at `:132` and `:140`.

The constructor defaults are independent. A caller can supply only a duplicate
destination while allowing dedupe to default false. This declaration does not
apply an implication filter or coerce that pair in `.make`. The source's
description of the options as “Validated” at `:144` is not a documented rejection
of that combination.

The supported behavior is explicit beyond schema acceptance:

1. `Files.command.ts:262`–`:266` documents `--dedupe` as default false and
   implied by `--move-duplicates-to`. The optional directory flag is at
   `:272`–`:275`. The package README repeats that supplying the destination
   enables dedupe at `packages/tooling/tool/cli/README.md:416`.
2. The CLI turns that supported request into effective options at
   `Files.command.ts:759`, then calls `NormalizeFilesOptions.make` at `:763`.
   The anonymous handler parameters are not separate census candidates; their
   documented behavior establishes the meaning of the named request carrier.
3. The service contract publicly accepts this exact type at
   `Files.service.ts:275`. The exported `normalizeFiles` wrapper at `:2778`
   forwards it unchanged at `:2782`, and the service implementation delegates
   unchanged at `:2511`–`:2512`.
4. The service itself deliberately calculates
   `options.dedupe || O.isSome(options.moveDuplicatesTo)` at
   `Files.service.ts:2244`, creates `validatedOptions` at `:2245`, and plans
   with it at `:2256`. It does not reject or drop the destination when the input
   Boolean is false. Profiling independently uses the same effective value at
   `:2342`.

Thus `false + Some(destination)` is a supported request meaning “move duplicates
there, thereby enabling dedupe,” including for a caller of the service that
bypasses the CLI. It is not a malformed internal tuple rescued incidentally by
a defensive guard. Narrowing the public input schema to three cases would
remove this supported API behavior. The fact that all current in-repo CLI
constructors pre-normalize the pair does not cancel the public service's own
normalization contract.

Complete request table, using a destination that passes directory validation:

| Input `(dedupe, moveDuplicatesTo)` | Effective operation | Supported evidence |
| --- | --- | --- |
| `(false, None)` | Normalize without dedupe | Defaults and the ordinary command fixture at `test/files-command.test.ts:4196`. |
| `(true, None)` | Skip duplicate normalized outputs; leave duplicate source files in place | Explicit `--dedupe` fixture at `test/files-command.test.ts:4305`. |
| `(false, Some(path))` | Dedupe and move duplicate sources | Documented implication, independent defaults, and service normalization at `Files.service.ts:2244`; the CLI fixture at `test/files-command.test.ts:4358` supplies only the destination, omitting `--dedupe`. |
| `(true, Some(path))` | Dedupe and move duplicate sources | Both flags are accepted and the same public service expression preserves the destination and true. No exclusivity check rejects redundant explicit `--dedupe`. |

This is four representable and four supported request tuples. The last two
share effective behavior without making either input illegal. D1 is the census
disposition for this input carrier; there is no qualified cardinality gap.

The Some payload is the whole string domain admitted by the source path
contract, not “one fixed destination.” Relative and absolute input paths remain
distinct payload values before resolution. Some("") remains a Some string at
the service input and is passed to `path.resolve` at
`internal/Validation.ts:327`; whether the resulting directory is allowed
depends on the filesystem and source/output paths. Do not silently turn an
empty string into None or add a new nonempty-string constraint in this audit.
No null/undefined/false destination alternative is declared by `S.Option(S.String)`.
The Option is not an optional-key wire codec, and the `dedupe` default is not a
decoding default.

The public type, schema, and service are exposed through
`Files.schemas.ts:77`, `commands/Files/index.ts:43`, and `:50`.
`packages/tooling/tool/cli/package.json:39` exports `./commands/Files`. This proves
public TypeScript use, not a JSON transport for the original input instance.
No direct encoder/persistence consumer of `NormalizeFilesOptions` was found.
Its values are normalized into a different manifest type before being recorded.

## Manifest: three effective-operation states

`internal/Normalize.schemas.ts:163` declares `NormalizeManifestOptions` with
`dedupe: S.Boolean` at `:165` and
`moveDuplicatesTo: S.optionalKey(S.String)` at `:168`. The destination is a real
optional property, not a Boolean invented by comparing a required string.

The complete emitted tuple table is:

| Manifest `(dedupe, moveDuplicatesTo)` | Meaning and producer |
| --- | --- |
| `(false, absent)` | No dedupe; request false/None remains false/None through `Files.service.ts:2244`. |
| `(true, absent)` | Dedupe without moving source files; request true/None remains true/None. |
| `(true, present resolved path)` | Move duplicates; either input Boolean with Some(path) becomes true before planning. |

The fourth flat structural state, `(false, present path)`, is not produced by a
supported normalizing run. The representation is 4/3 at the Boolean/payload
presence level; every valid path string stays in the present arm's payload.

Exhaustive producer chain for this declaration:

- `makeNormalizeManifestOptions` is private at `Files.service.ts:332`. It
  constructs the schema at `:339`, copies dedupe at `:340`, and emits an
  optional path via `O.getSomesStruct` at `:343`. Its only call is
  `buildNormalizePlan` at `:1364`.
- `buildNormalizePlan` is private at `:1351`; its only call is the service's
  `:2256`, after request normalization at `:2244`. It supplies effective dedupe
  and the validated `duplicateDirectory` to the manifest helper at
  `:1365`–`:1369`.
- Directory validation at `internal/Validation.ts:321` preserves None;
  `:327` resolves Some(path); `:349`–`:350` accepts a missing destination;
  `:361` rejects an existing non-directory; `:375` and `:381` reject canonical
  aliases of the source and output directories; `:387` returns Some(resolved
  path). It never silently converts a valid Some path to None.
- `NormalizePlan` receives `duplicateDirectory` and these same options at
  `Files.service.ts:1419`–`:1426`. Its actual schema nests
  `NormalizeManifestOptions` at `internal/Normalize.schemas.ts:266`.
- The only `NormalizeManifest.make` writer is `internal/Apply.ts:406`;
  `:409` copies `plan.options`. No second source writer or explicit alternate
  manifest fixture constructs false/present.

The annotation in raw evidence at `Apply.ts:406` is a persistence/copy receipt;
that call alone does not establish an implication. The E1/E4 evidence must cite
the complete normalization-to-plan path, as the corrected record does below.

Generic schema-derived manifest values are generated at
`test/files-command.test.ts:94` and used in the round-trip property at
`:834`–`:843`, with JSON equality asserted at `:891`–`:893`. Those tests exercise
the current broad codec domain; they are not explicit business constructors or
fixtures proving false/present is a supported recorded operation. Conversely,
their encoded compatibility coverage must be acknowledged when designing the
replacement. An encoder exported with `input: unknown` at
`internal/Normalize.schemas.ts:408`–`:410` is also not a second semantic producer.

`applyNormalizePlan` is exported from its internal module at
`internal/Apply.ts:452` and accepts a resolved plan plus separate dedupe and
overwrite arguments. Its only corpus call is `Files.service.ts:2301`, which
passes effective dedupe. Arbitrarily constructing an inconsistent plan and
passing a mismatching Boolean to this helper is not an observed/documented
alternative operation. Do not use its unconstrained signature alone to expand
the manifest table, and do not count its function flag parameters as another
carrier. It is nevertheless a migration dependency that a design must handle.

## Persistence, readers, and existing fixtures

`NormalizeManifest` embeds these options at
`internal/Normalize.schemas.ts:362` and keeps schema version
`beep.files.normalize.v1` at `:364`. The schema and encoder are re-exported
through `Files.schemas.ts:77` and the Files command barrel. The production
writer renders the schema's encoded object at `Files.render.ts:342`, then
formats it through `renderBiomeJson` at `:346`. `internal/Apply.ts:597`–`:601`
builds and stages the manifest; `:639` renames the staged file to the final
manifest path after output and duplicate moves. The default destination is
`<outDir>/normalize-manifest.json`, selected at `Files.service.ts:1361`.

The recorded options are a stored snapshot of the effective run configuration;
their assembly is derived from normalized request input. Retaining
`storage: stored`, `exposure: persisted`, Tier 2 describes that durable carrier
without authorizing new mutable state. It is an application-owned manifest,
not an external wire mirror.

No production decoder of an existing normalize manifest was found in the
scoped Files flow. The explicit test decoder is at
`test/files-command.test.ts:74` and the filesystem reader at `:265`–`:268`.
Public schema/encoder exports remain compatibility surface even without an
additional in-repo production reader. Exact source, test, and export searches
found no other constructors of the two options classes beyond the command and
service sites listed above.

Existing concrete behavior fixtures:

| Fixture | What it proves |
| --- | --- |
| `test/files-command.test.ts:4180`–`:4230` | Ordinary normalize run writes a versioned manifest, preserves the source, and records transformations without dedupe flags. |
| `:4278`–`:4325` | Dedupe-only request skips exact normalized duplicates and records their hashes/relationships; duplicate move count stays zero. |
| `:4330`–`:4387` | Destination-only request enables dedupe, moves the duplicate source, and explicitly asserts manifest dedupe true and the full destination path at `:4374`–`:4375`. |
| `:4435`–`:4450` | Dry run does not create output directories or write files. |
| `:4455` | Existing output refusal unless overwrite is enabled; preserve independent overwrite semantics. |

There is no dedicated direct-service regression fixture for constructing
`NormalizeFilesOptions` with explicit false/Some or with omitted dedupe/Some,
and no separate fixture for both true and Some. The documented service behavior
and implementation support those inputs; a future design should add direct
service fixtures so bypassing CLI normalization cannot regress. The three
manifest operation modes are already backed by concrete command fixtures.

## Inventory overlap and exact proposed actions

The current canonical records are:

- `files-normalize-options`: same `NormalizeFilesOptions` declaration at
  `internal/Normalize.schemas.ts:131`, members `[dedupe, dryRun, overwrite]`, D1.
- `files-normalize-manifest-options`: same `NormalizeManifestOptions`
  declaration at `:165`, members `[dedupe, overwrite]`, D1.

Both remain valid for those member sets. Dry-run and overwrite are independent
of the dedupe/destination operation; all three manifest modes permit either
overwrite setting, and the public request permits either dry-run setting.
Keep the existing ids/statuses/member sets. The proposed destination pair is a
different cluster and is not an exact duplicate of either record. A new D1 row
for the actual request pair can record this correction without changing the
existing narrower D1 receipt. The manifest pair adds one qualified cluster;
the narrower dedupe/overwrite D1 does not block it.

Existing inventory histories repeat those two narrower D1 records. No design
for either raw proposal or existing qualified dedupe/destination cluster was
found. Do not invent a qualification by renaming the local `validatedOptions`
instance: the raw inventory row names the public request class, whose full
supported domain includes false/Some. No source withdrawal is proposed here.

Ask the independent Grok correction to replace the request's 4/3/E4 claim with
D1 while verifying the manifest's source-supported 4/3 table. CLI-only write
sites cannot prove the domain of the exported service input. Native source
adjudication does not substitute for that correction or for later P3 review.

## Design requirements for the manifest qualification

Use a schema-owned effective operation with three variants: normalization
without dedupe; dedupe while leaving duplicate sources in place; dedupe while
moving duplicates to a destination payload. The third variant carries the
resolved full path. Keep the existing format literal kit, optional maxLongEdge,
and independent overwrite field. Encode the exact existing flat manifest
options (`dedupe`, optional `moveDuplicatesTo`, format, optional maxLongEdge,
overwrite); do not add a tag to `beep.files.normalize.v1` output.

Preserve all four public request tuples. The required behavior-changing boundary
is request-to-effective-operation normalization, not rejection of
false/Some at `.make`, service entry, or manifest construction. A shared
schema-owned normalization can remove duplicate implication reconstruction
while retaining the documented CLI and service semantics. Do not turn
dedupe-only into an absent operation or discard the destination because no
duplicates happened to occur in a run.

Concrete guard/branch accounting for the design:

| Existing obligation | Required treatment |
| --- | --- |
| CLI `dedupe || O.isSome(moveDuplicatesTo)` at `Files.command.ts:759` | Replace duplicated policy assembly through one authoritative normalization path; destination-only CLI input remains supported. |
| Service fold at `Files.service.ts:2244` | Preserve its four-input-to-three-operation behavior in the schema-owned boundary; do not delete the behavior by narrowing the public input. |
| Profile fold at `Files.service.ts:2342` | Derive the same effective dedupe display from the canonical operation instead of reconstructing it a third time. |
| Manifest field assembly at `Files.service.ts:339` and `:1364` | Build the appropriate operation variant, then preserve flat encoding, rather than copy a Boolean and optional path whose relationship every consumer must remember. |
| Separate dedupe argument to `applyNormalizePlan` at `Files.service.ts:2301`, `internal/Apply.ts:455` | Migrate the consumer so operation and destination cannot disagree. Preserve exact normalized-byte hashing/dedupe at `Apply.ts:529`–`:535` and destination mapping at `:538`. |
| Directory checks in `internal/Validation.ts:314`–`:387` | Keep filesystem/path validation and existing typed failures; a type union cannot establish these facts. |
| Duplicate detection and hash presence at `Apply.ts:537`, move-target collision handling at `:553`–`:556`, staging/move/manifest sequence at `:597`–`:639` | Preserve these operational checks and ordering; they are not all redundant Boolean-creep guards. |

There is no current manifest implication filter to claim as a deleted runtime
guard. Account for the actual repeated implication folds and consumer coupling,
not an invented `.check`. Keep profiling strings, dry-run planning/no-write
behavior, overwrite checks, exact-byte matching, source preservation in
dedupe-only mode, destination collision handling, failure messages, temporary
file cleanup, and final manifest ordering.

Test requirements after an accepted design: compare exact legacy/new encoded
options and rendered manifest bytes for all three operation modes, including
omitted optional keys; preserve positive maxLongEdge and all canonical format
alternatives. Exercise both accepted source input spellings of move mode
(false/Some and true/Some), constructor-default dedupe with Some, and direct
service calls as well as CLI calls. Test path resolution, valid existing and
missing destinations, invalid source/output aliases, overwrite behavior, and
dry-run non-mutation as appropriate to the changed seams. Preserve payload
strings and manifest version; do not replace arbitrary payloads with a fixed
fixture path in the model. Adjust generic schema-derived round trips to the
actual encoded compatibility contract; do not reinterpret their current
permissiveness as an alternate domain producer or silently rewrite incoherent
legacy JSON. Any proposed narrowing of a public legacy codec needs an explicit
compatibility decision in the design before application.

## Suggested schema-valid records

These are proposals for parent integration. The qualified `confirmed` value is
the required shape of a proposed admission, not a current status advance.

```jsonl
{"schemaVersion":"boolean-creep-inventory/v1","id":"r27-cli-commands-d-k-normalize-files-dedupe-move","file":"packages/tooling/tool/cli/src/commands/Files/internal/Normalize.schemas.ts","line":131,"symbol":"NormalizeFilesOptions","kind":"schema-struct","members":["dedupe","moveDuplicatesTo"],"status":"disqualified","disqualifier":{"class":"D1","note":"Public request carrier accepts all four Boolean/Option-presence tuples. Destination-only input is documented by Files.command.ts:265 and README.md:416; the constructor independently defaults dedupe false, and the exported service deliberately normalizes false plus Some(path) at Files.service.ts:2244 instead of rejecting it. The 4/3 table applies only after request normalization, not to every supported NormalizeFilesOptions input."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r27-cli-commands-d-k-normalize-manifest-dedupe-move","file":"packages/tooling/tool/cli/src/commands/Files/internal/Normalize.schemas.ts","line":165,"symbol":"NormalizeManifestOptions","kind":"schema-struct","members":["dedupe","moveDuplicatesTo"],"status":"confirmed","evidence":[{"class":"E4","cite":{"file":"packages/tooling/tool/cli/src/commands/Files/Files.service.ts","line":2244},"note":"The service normalizes every accepted request before the only buildNormalizePlan call at 2256, so any present duplicate destination supplies effective dedupe true."},{"class":"E1","cite":{"file":"packages/tooling/tool/cli/src/commands/Files/Files.service.ts","line":1364},"note":"The sole manifest-options producer copies effective dedupe and the presence-preserving resolved duplicate directory; makeNormalizeManifestOptions at 339 emits the path only for Some. Apply.ts:409 copies these options into the persisted manifest."}],"cardinality":{"representable":4,"legal":3},"storage":"stored","exposure":"persisted","targetShape":"tagged-union","tier":2,"notes":"Recorded effective operation: false/absent, true/absent, true/present resolved path. Preserve all path payloads, optional-key omission, format/maxLongEdge/overwrite, and exact beep.files.normalize.v1 encoding. Both false/Some and true/Some remain accepted public NormalizeFilesOptions requests; the input carrier is D1. Generic schema-derived round trips are compatibility coverage, not evidence for another supported manifest operation."}
```

Only this assigned handoff file was written. No source, test, inventory, design,
dependency, git, or status changes were made; no commands that normalize images
or mutate product files were run. Verification is source/consumer inspection,
frozen-ref checks, and schema validation of the two embedded proposed records.
Extracting the JSONL block into the existing validator through `/dev/stdin`
returned exit 0: `inventory OK: 2 records, 2 unique ids`. Final ref checks still
returned the frozen HEAD and `origin/main` recorded above.
