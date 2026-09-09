# R28 Docgen and Files source/design impact audit

This is a bounded native Codex P2 source/design audit. It is not the independent
R28 census or P3 review, does not reopen frozen R27 receipts, and does not change
canonical inventory, statuses, product source, tests, git state, or services.

- Current frozen HEAD: `93217d998f851e2e93d9864e2b5315552eaa58a7`.
- Current frozen origin/main: `d1b4d769fbaffddd55717f3b1ba461897dd545c5`.
- Previous HEAD: `8f266b878445ca8a7f751f9248da428a4dde39a1`.
- Previous origin/main: `663904610cce2a38c06b0619a8c414646b69361c`.
- Impact map: `data/main-d1b4d7-impact.json`.
- Binding scope/evidence: `SPEC.md` and `DECISIONS.md`, including one actual
  co-carried cluster, E1–E4 proof, payload fidelity, function-flag exclusion,
  and no duplicate record for the same cluster.
- Historical design archive: `history/designs/2026-09-09-pre-main-d1b4d7/`.

Short source paths in this audit are relative to
`packages/tooling/tool/cli/src/commands/` unless explicitly qualified.

## Conclusions for parent integration

| Case | Proposed canonical action | Current evidence |
| --- | --- | --- |
| `docgen-generation-outcome` | Retain 8/2; correct internal/Tier1 to wire/Tier2 and refresh design | Existing generate --json writer at `Docgen/Docgen.command.ts:413-418`; human and command readers at render:114 and command:415/:469 |
| `docgen-subject-collection-outcome` | Retain 12/2, stored/internal/Tier1; shift declaration/evidence citations | `Docgen/internal/quality/Quality.subjects.ts:903-915`, :966-971, :1004-1009 |
| `r27-cli-commands-d-k-normalize-manifest-dedupe-move` | Retain 4/3 stored/persisted/Tier2; shift source citations and update test inventory | `Files/Files.service.ts:2242`, :2254, :1362; `Files/internal/Apply.ts:409` |
| `r27-cli-commands-d-k-normalize-files-dedupe-move` | Retain D1 with corrected service citation | Public four requests still normalize at `Files/Files.service.ts:2242` |
| `r3-tooling-create-caption-overwrite-phase` | Archive/remove live row and current design together; no replacement row | Upstream removes local overwritesExisting; one existence probe now returns a Result Boolean which a separate owner copies into a one-bit entry |
| `r3-tooling-docgen-quality-jsdoc-tag-gates` | Archive/remove stale D seed; no replacement row | Two function declarations at `Quality.subjects.ts:262-264`, not Boolean-typed stored sibling state |
| `r3-tooling-files-normalize-image-gates` | Archive/remove stale D seed; no replacement row | Inline predicate calls at `Files/Files.service.ts:625`, not named Boolean members |

No new qualified owner is proposed. The two D withdrawals are scope repairs,
not a claim that every tuple is impossible or newly implemented. The caption
withdrawal is a removed owner, not an applied design. The parent's integration
owns row removal/status accounting. In response to parent steering, the current
caption design stays byte-identical pending removal; it is not rewritten into
a withdrawal stub. Its prior proposal remains available in the archive.

## Exact changed-source inspection

Read-only `git diff` compared the two HEADs above for all four changed source
files, followed by current source spans and graft symbol/consumer discovery.
The full relevant diffs were inspected. No source mutation or package command
was used.

| Changed source | Material diff and consequence |
| --- | --- |
| `Docgen/Docgen.render.ts` | Extracts analysisReportHeader, checklistPrioritySection, fixChecklistSections, analysisFindingSection, findingSections, analysisSummarySection at :228-315 and replaces append loops with composed sections at :355-365. Generation logging at :113-130 and generic JSON rendering at :45-51 are unchanged. No outcome count/array/string axes arise from required analysis payloads. |
| `Docgen/internal/Aggregate.ts` | Extracts assertUniqueDocsOutputPaths (:92-113) and cleanAggregateDestination (:115-125). Call order at :174-189 retains selected-package no-docs error, empty-list return, all-package duplicate-path error, then optional clean. Function parameters/optional anonymous argument bags are not newly admitted owners. |
| `Docgen/internal/quality/Quality.subjects.ts` | Extracts export-assignment, export-specifier/declaration, direct-statement, and overload helpers at :423-583, plus type-only ts-morph imports. Result declaration/returns shift +56 lines to :903/:966/:1004; result semantics are unchanged. Preserve helper collection order and exclusions. |
| `Files/Files.service.ts` | Extracts statSourceEntry (:529-532), caption source/target helpers (:675-866), and replaces the long caption loop body with Result handling (:881-905). statSourceEntry is called at :556/:736/:958/:1175. Normalize code below the last extraction shifts -2 lines. The old two-bit caption phase ceases to exist. |

A bounded read-only name diff confirmed no change between these HEADs in
Docgen.command.ts, Docgen.schemas.ts, internal/RunDocgen.ts,
quality/Quality.service.ts, Files/internal/Normalize.schemas.ts,
Files/internal/Apply.ts, Files.render.ts, Files.command.ts, or package.json.
The generation JSON miss therefore predates this upstream merge.

The two focused test files did change; their exact diff was inspected as
supporting compatibility evidence, not as corpus admissions:

- `test/docgen.test.ts:1739-1746` adds findings-mode assertions; :2683-2771 adds
  default-assignment JSDoc, a literal default export, export-equals exclusion,
  and expects four default subjects (:2748). Existing later references shift.
- `test/files-command.test.ts:4409` adds a broken symlink, :4418 adds its leading
  symlink skip, and :4431 now expects six skips. Later dry-run/overwrite/refusal
  fixtures move to :4437/:4457/:4485; stored-manifest assertions move to :4502-4503.

## Generation: missed outgoing compatibility boundary

`DocgenGenerationResult` really co-carries Boolean success and optional
error/moduleCount in `Docgen.schemas.ts:396-398`. Its three writers at
`internal/RunDocgen.ts:72/:95/:109` establish two supported states. The count is
an actual optional field, so its presence belongs in 8/2; its numeric value
does not create another axis. Output remains independent and fully preserved.

The old design's assertion that human logging is the only reader is false.
`Docgen.command.ts:413-418` emits raw result arrays through `renderDocgenJson`
and then checks failures; :469 gates aggregation after human logging. The
renderer calls the unknown-JSON encoder, so adding a schema codec alone would
not prevent new tags from leaking into stdout.

The refreshed design introduces one typed generation renderer with an exhaustive
outgoing flat projection before the existing JSON formatter. It retains exact
success/count and failure/error objects, item/field order, optional output,
current formatting and error messages. Nonzero/success writers omit empty
output; the outer catch explicitly retains present-empty output. No product
JSON decoder/persisted reader was found, so a new incoming codec or file
migration is unnecessary. The actual known schema/render public subpaths and
private Operations barrel are covered; blocked internal package exports are
not widened. Both existing Effect overload return/error types also migrate.

Proposed exposure is wire, Tier 2 singleton. The existing output is repo-owned,
so D2 external-wire-mirror exclusion does not apply. Old/new byte fixtures and
independent P3 review remain required before application. This source-only audit
does not claim that fixture execution has passed or unknown external TS callers
have been exhaustively inventoried.

## Collector: preserve the later timeout boundary

The collector at `Quality.subjects.ts:937-1013` has two synchronous successful
return objects within Effect.try; failed analysis takes the Effect error
channel. The three-value status domain, Boolean, and null/string payload form
12 representable and two legal states. Required candidates stay full payload.

Its only named-result consumer `Quality.service.ts:275-293` finalizes subjects,
deduplicates/sorts, and attaches snippets before rechecking budget. The new
union removes timedOut storage and nullable error, but must preserve this later
expiry. Partial forwards the original message and skips the later test just as
the current OR short-circuits; completed checks the later budget and may become
partial. Outer failure conversion at :295-309 remains failed/error/false even
if collection had been partial. The downstream package-report JSON stays
unchanged; that is a separate Tier-2 design, not another collector arm.

The refreshed design updates helper seams, both plain-object writers, the
constructor example, exact removal of :285-287 reconstructions, blocked internal
exports, and current timeout/default-export fixtures. It removes the old
sequencing dependency on generation landing as Tier 1.

## Caption: upstream removed the qualifying owner

Previously the caption loop declared captionExists and mutable overwritesExisting
in one local phase, initialized the latter false, and set it true only after
existing-target refusal paths returned. The old design targeted that 4/3 pair.
The exact Files.service.ts diff deletes the second local variable and assignment.

Current source separates the values:

1. `inspectExistingCaptionTarget` at :780-822 accepts a function overwrite
   parameter and declares just `captionExists` at :789. Missing target returns
   Result.succeed(false) at :792. Existing canonical regular-file targets either
   return a typed skipped entry or Result.succeed(true) at :821.
2. `planCaptionTarget` at :824-865 checks Result failure at :851 and writes the
   single `CreateCaptionFilesPlanEntry.overwritesExisting` from success at :859.
   It never stores captionExists beside that field.
3. The plan-entry schema at `internal/CreateCaptions.schemas.ts:97-111` has
   one Boolean plus required path/name/extension payloads. `Files.service.ts:1768`
   counts that Boolean; :1769 derives creates. Existing skipped-entry reasons
   already represent refusal and collision paths.

Do not assemble a new pair from values in different owners, count Result's
success/failure tag as an extra Boolean, admit excluded function parameters,
or invent presence axes for required strings. The surviving single bit has
both legal values and cannot support the old 4/3 gap. A create/overwrite rename
alone would delete no surviving coherence guard. Preserve actual target checks,
source/path safety, skips, counts, render signatures, and schema exports by
withdrawing this proposed implementation from the campaign.

Exact removal proposal: remove id `r3-tooling-create-caption-overwrite-phase`
from the live projection and remove its current design in the same parent
integration. Retain the existing immutable archive file and hash below; do not
mark the design applied, relabel it D1, or create a replacement singleton row.

## Impacted disqualified seeds: absent carriers

`r3-tooling-docgen-quality-jsdoc-tag-gates` claims kind sibling-state and names
`isFileoverviewJsDoc`/`isInternalJsDoc`. At `Quality.subjects.ts:262-264` these
are functions returning Boolean from raw JSDoc, not Boolean variables, class
fields, or a co-carried object. Their reader sites remain :748 and :800/:266.
A comment can contain both tags, but that semantic observation does not turn
function declarations into a net-qualified carrier. Remove this seed from the
live census and retain its D1 reasoning in historical inventory; no replacement
line-only D1 row or design is proposed.

`r3-tooling-files-normalize-image-gates` names the function symbols
`isImageFileExtension` and `isSupportedMetadataImageFile` as members of a
synthetic collectNormalizeFiles.imageGates scope. Current :625 directly invokes
both functions inside collectNormalizeFile (singular), after earlier media
admission. Neither result is bound into sibling Boolean state. The support
helper at `Files.media.ts:815-816` projects extension support, not a second
stored flag. An OR condition or one legal combined-true path is not proof of
D1's universal independence, and the two calls are not an E1–E4 state owner.
Remove the row with history retention, rather than repairing its old :622 line
or claiming all four detector tuples are reachable at that program point.

Neither withdrawal manufactures a new owner from required strings or arrays.
The separate real request/schema owners remain in the census.

## Normalize: unchanged request/operation split and full migration

The request declaration and docs are unchanged: all four dedupe/Option-presence
requests, including false/Some(path), are accepted. Destination alone enables
dedupe (`Files.command.ts:265`, README.md:416). The service folds the request at
:2242 before buildNormalizePlan at :2254. Profiling independently folds the same
value at :2340 before operation work, preserving its original timing.

The one manifest-options writer at :1362/:339 uses effective dedupe and the
validated resolved destination. The persisted operation therefore remains three
states out of four, with full string payload and omission preserved. The
refreshed design keeps the compatibility codec and its two directions, required
format/overwrite and optional maxLongEdge, public four-input acceptance,
profile folding, removal of duplicate plan destination/separate Apply Boolean,
full Apply consumers and staged manifest ordering, exports, filesystem checks,
and current tests. It does not simplify the design into a pair-only union.

`Apply.ts:409` still copies plan.options; :455 accepts separate dedupe; :479,
:529, :538 still consume duplicate destination and hashing/dedupe choices.
Those are real downstream migration obligations, not new parameter admissions.
The underlying Apply file is unchanged in this merge. The private encoded
compatibility decoder's treatment of false/present stored options remains an
explicit independent-review point; generic schema arbitraries do not prove
that tuple is a supported persisted operation.

The D1 raw-request row needs only its explanatory service cite changed from
2244 to 2242. Do not withdraw it or replace it with the three-state stored union.
The independent dedupe/overwrite D census clusters also remain separate and
unchanged; this audit adds no duplicate cluster.

## Proposed exact surviving canonical rows

These are proposed replacement rows for parent integration, not edits to the
canonical inventory. Their statuses are preserved; qualification, source notes,
and exposure corrections are backed above. Withdrawal ids receive no new row.

```jsonl
{"schemaVersion":"boolean-creep-inventory/v1","id":"docgen-generation-outcome","file":"packages/tooling/tool/cli/src/commands/Docgen/Docgen.schemas.ts","line":396,"symbol":"DocgenGenerationResult","kind":"schema-struct","members":["success","error","moduleCount"],"status":"designed","evidence":[{"class":"E3","cite":{"file":"packages/tooling/tool/cli/src/commands/Docgen/internal/RunDocgen.ts","line":72},"note":"Nonzero exit at 72 and outer failure at 109 write success false with error and omit moduleCount; success at 95 writes true with moduleCount and omits error. Output remains independent."},{"class":"E2","cite":{"file":"packages/tooling/tool/cli/src/commands/Docgen/Docgen.render.ts","line":114},"note":"Generation logging partitions by success, then reads required-on-success count and required-on-failure error with current optional fallbacks. Docgen.command.ts:415 and :469 also read success for JSON failure reporting and aggregation gating."}],"cardinality":{"representable":8,"legal":2},"storage":"stored","exposure":"wire","targetShape":"tagged-union","tier":2,"notes":"R28 source refresh: cardinality remains 8/2 from success plus actual optional error/moduleCount presence; count values and output are payloads, not extra axes. Correct previous internal/Tier1 classification: Docgen.command.ts:413-418 emits the array through renderDocgenJson for generate --json. This writer predated the latest merge. Wire/Tier2 singleton must preserve legacy flat JSON via explicit outgoing projection, including omission/present-empty output, all payloads, order, and formatting. No independent persisted decoder was found. Native P2 source audit: data/design-refresh-2026-09-09-r28-docgen-files-impact.md."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"docgen-subject-collection-outcome","file":"packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.subjects.ts","line":910,"symbol":"PackageSubjectCandidateResult","kind":"schema-struct","members":["timedOut","status","error"],"status":"designed","evidence":[{"class":"E1","cite":{"file":"packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.subjects.ts","line":966},"note":"Budget-exceeded return writes timedOut true, status partial, and string error; completed return at 1004 writes false/completed/null. The shared LiteralKit includes failed but this collector propagates failure through Effect, not a failed result."}],"cardinality":{"representable":12,"legal":2},"storage":"stored","exposure":"internal","targetShape":"tagged-union","tier":1,"notes":"R28 citation refresh after declaration-collector helper extraction: same 12/2 stored internal outcome from three status literals, Boolean timedOut, and null/string error. Candidates remain full required payload. Quality.service.ts:275-309 still finalizes candidates and can independently expire afterward; preserve its report legacy projection and failure conversion. Native P2 source audit: data/design-refresh-2026-09-09-r28-docgen-files-impact.md."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r27-cli-commands-d-k-normalize-manifest-dedupe-move","file":"packages/tooling/tool/cli/src/commands/Files/internal/Normalize.schemas.ts","line":165,"symbol":"NormalizeManifestOptions","kind":"schema-struct","members":["dedupe","moveDuplicatesTo"],"status":"designed","evidence":[{"class":"E4","cite":{"file":"packages/tooling/tool/cli/src/commands/Files/Files.service.ts","line":2242},"note":"The service normalizes every accepted request before the only buildNormalizePlan call at 2254; any present destination supplies effective dedupe true."},{"class":"E1","cite":{"file":"packages/tooling/tool/cli/src/commands/Files/Files.service.ts","line":1362},"note":"The sole manifest-options producer copies effective dedupe and presence-preserving resolved duplicate directory; makeNormalizeManifestOptions at 339 emits the path only for Some. Apply.ts:409 copies these options into the persisted manifest."}],"cardinality":{"representable":4,"legal":3},"storage":"stored","exposure":"persisted","targetShape":"tagged-union","tier":2,"notes":"R28 shifted-citation refresh only: recorded effective operation remains false/absent, true/absent, true/present full resolved path. Preserve optional-key omission, format/maxLongEdge/overwrite, profile folding at Files.service.ts:2340, Apply and all consumers, and exact beep.files.normalize.v1 encoding. Public NormalizeFilesOptions still accepts all four Boolean/Option-presence requests, including false/Some and true/Some; generic schema-derived round trips do not establish another supported stored operation. Retain the new broken-symlink skipped-source fixture. Native P2 audit: data/design-refresh-2026-09-09-r28-docgen-files-impact.md."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r27-cli-commands-d-k-normalize-files-dedupe-move","file":"packages/tooling/tool/cli/src/commands/Files/internal/Normalize.schemas.ts","line":131,"symbol":"NormalizeFilesOptions","kind":"schema-struct","members":["dedupe","moveDuplicatesTo"],"status":"disqualified","disqualifier":{"class":"D1","note":"Public request carrier accepts all four Boolean/Option-presence tuples. Destination-only input is documented by Files.command.ts:265 and README.md:416; the constructor independently defaults dedupe false, and the exported service deliberately normalizes false plus Some(path) at Files.service.ts:2242 instead of rejecting it. The 4/3 table applies only after request normalization, not to every supported NormalizeFilesOptions input. R28 source refresh moves the previous 2244 citation by two lines; request contract and D1 reasoning are unchanged."}}
```

## Archive and frozen-source verification

The following archived design SHA-256 values match the parent impact map.
The caption current file matches its archived bytes and is intentionally not
refreshed pending parent withdrawal integration.

| Archive basename | SHA-256 |
| --- | --- |
| docgen-generation-outcome.md | `9e67d5b0db8ddacbd9c8f800c11d09bd30315e67e0c4c8d110409677e9dbfbd6` |
| docgen-subject-collection-outcome.md | `7ff7c622b49db76a0ec60be22259a36b4524f40627592ce82aff4a05159f3507` |
| r3-tooling-create-caption-overwrite-phase.md | `6fba7e8fa5f6fe16591c750e6029fd65ac9166a58e4c54a19889c98466d5cb41` |
| r27-cli-commands-d-k-normalize-manifest-dedupe-move.md | `f8130c5d4b82bdf888ba49df9a78128c1d7ba2fbbcc54d1d4c25cdbe168aca60` |

| Current frozen source | SHA-256 |
| --- | --- |
| Docgen/Docgen.render.ts | `aff7dde28282058d4388dd0ff39cfdbcbc69046fc7f03c6eaa5b27762c07843d` |
| Docgen/internal/Aggregate.ts | `b79f4432b8fe51526654a27a4044ea6d0f03e506977e509081e7c74a659f1ca7` |
| Docgen/internal/quality/Quality.subjects.ts | `82ca325dc6881dfe72a4b736993ab417f81c1e21cccc967b8950e652d9cf56d3` |
| Files/Files.service.ts | `c3649fb3dfd079dc4e2b39ae01ce7716f738c93afef68b4abfd5fe06b817682b` |

Documentation validation passed: all eight mandated section headings exist
in each of the three refreshed designs and the unchanged caption design. The
four proposed rows parse, have distinct ids and valid basic inventory fields,
and their declaration/evidence citations are within the live source files.
All four archive hashes match the impact map; current caption bytes match the
archive. Each changed source file matches its git-show blob at frozen HEAD.
This is a bounded static audit, not execution of the full inventory validator.
Product tests, package commands, git/index/ref mutations, services,
frozen R27 receipts, and canonical inventory/status edits are outside this
handoff. New independent R28 census and exact-source P3 review remain pending
separate work; this P2 audit cannot replace them.
