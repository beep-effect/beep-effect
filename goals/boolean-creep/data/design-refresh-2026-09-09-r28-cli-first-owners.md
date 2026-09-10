# R28 CLI first-owner audit

Native P2 source adjudication only. No independent P3 verdict, implementation,
canonical update or round-completion claim. Owns this new audit and the three
provisional designs listed below. Frozen HEAD
`93217d998f851e2e93d9864e2b5315552eaa58a7`; origin/main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. R27, original reports, archives,
prior audits, product source/tests and refs remain untouched.

## Result and adjudication boundary

The three raw reports contain 13 records: 3 Q and 10 D. The actual Tmpfs
owner is qualified on native source proof, with corrected **26/6**, not4/3.
Both Docgen Q reports require an explicit owner correction: their anchors are
Flag descriptors, while their actual four-member argument objects are written
only after exact-one validation. Those post-validation objects support **8/3**.
The three provisional designs are complete, but parent admission and one
bounded independent owner/cardinality correction remain necessary.

Seven newly reported D bags remain D (four FileSystem SDK D2, three repo
StepExec D1). Three reported existing D records remain D after precise schema
or actual-object reanchoring. This audit also repairs seven footer D anchors,
completes the inherited StepExec request Boolean list, and proposes two
owner-specific Q-to-D1 raw-request replacements. They are proposals for parent
adjudication, not a statement that all CLI request objects are exempt.

The footers underreport callable/descriptor/parameter problems. The exact
withdrawal receipts below include the nine internal-root callable IDs, nine
still-live A-C callable IDs, the old cross-type Tmpfs Q, PersonMatchReport,
Knowledge runRefs, eighteen further D-K callable groups, seven Docgen
parameter/descriptor D rows, two Goals parameter D rows, and three command-only
Q rows. Existing current designs are preserved for parent archival/adjudication.
No stub or hold design replaces them.

## Immutable input provenance

The seed is read-only `~/.cache/beep/boolean-creep/refresh-2026-09-09-r28-main-d1b4d7.seed.jsonl`:
921 records,165 Q; SHA-256
`bf82e9656a66c738c413567734ae05bfad31e79c4cb7ab3c086307dd28185f24`.
Current-row hashes below are separate from seed hashes: earlier native R28
integrations have already changed the canonical projection. Row SHA-256 means
exact UTF-8 JSONL line bytes excluding LF. No whole seed is copied into a new
canonical input.

Current canonical read snapshot: 813 records; file SHA-256 `5374608f7a7b71412236a54780daac9aec2c6650c0649f7d8b8aa88c0675e450`. Proposed JSONL: 23 rows (3 Q, 20 D); 51 distinct current withdrawals. This arithmetic is scoped to the captured snapshot and does not override later parent writes.

| Immutable lane | Report SHA-256 | Execution SHA-256 | Completion proof |
| --- | --- | --- | --- |
| `r28-cli-internal-root` | `bb9d1551a55192a9b37b2450162f3ca2eee034fe699c4d0e14f8bdde39216d2d` | `be0656ae0c76c3ee5c8b997d8649dc3eb5bc5b307a99fa2f1122fcdebba2f2f7` | 5 rows; validation0; endTurnEvent true |
| `r28-cli-commands-a-c` | `1118219531731d81e1a9b80eba2ac6127f8533c7d408a65055bc677e709a9d29` | `973b8c3829ce195c887ab74077006aac031f7d821928b74cc0cce7f5950f4478` | 6 rows; validation0; endTurnEvent true |
| `r28-cli-commands-d-k` | `3e8edc87cef930f11c29785fe44200082a007e33345f5953ec018fc326a9f25b` | `d0550eae61100e590cf4eeedbeaedf10d0387d4b707156bf68c0dde9228bc58b` | 2 rows; validation0; endTurnEvent true |

<!-- r28-cli-internal-root: transcript 41522a8cc045517043c4fd9f389638a00403ad896e6ae17dda725d05e5bf8c1b; runner 0f3070ded9e9f0a1a905d7e6d43bf3d8631d85c657afa47d87312bc5349106bc; seed bf82e9656a66c738c413567734ae05bfad31e79c4cb7ab3c086307dd28185f24; basePrompt 6f54a113c39ea40a0254725aebf460ffcbb707792aa3e8b60aafb7f7a443dc5b; extraPrompt 5b92193de1ceb09051959239b35bee57d6b727f8dcba4e4d1c332ac2e5fcb19b -->
<!-- r28-cli-commands-a-c: transcript 957777bd479e5f9eb74f904e168e382a1a998282a5376fb37773c3cd08ec1d10; runner 0f3070ded9e9f0a1a905d7e6d43bf3d8631d85c657afa47d87312bc5349106bc; seed bf82e9656a66c738c413567734ae05bfad31e79c4cb7ab3c086307dd28185f24; basePrompt 6f54a113c39ea40a0254725aebf460ffcbb707792aa3e8b60aafb7f7a443dc5b; extraPrompt 5b92193de1ceb09051959239b35bee57d6b727f8dcba4e4d1c332ac2e5fcb19b -->
<!-- r28-cli-commands-d-k: transcript f5c132f781d4478a116ae157529fb247a8a1d21b4dc71e5312d4879e06df6393; runner 0f3070ded9e9f0a1a905d7e6d43bf3d8631d85c657afa47d87312bc5349106bc; seed bf82e9656a66c738c413567734ae05bfad31e79c4cb7ab3c086307dd28185f24; basePrompt 6f54a113c39ea40a0254725aebf460ffcbb707792aa3e8b60aafb7f7a443dc5b; extraPrompt 5b92193de1ceb09051959239b35bee57d6b727f8dcba4e4d1c332ac2e5fcb19b -->

The execution receipts' `completionSummary` fields are the matching completion
footers. Their zero structural-validation results do not validate ownership,
full payload cardinality or the assertion that every remaining seed is sound.

## Real carriers, complete payloads and consumers

### Tmpfs classification

`internal/repo-run/TmpfsReap.ts61-69` is a real named private type carrying
root,path,reapClass,idleSinceMillis,classified,shapeSkipReason,parentRepo.
The full declared Option reason domain is the twelve literals at
`TmpfsReap.schemas.ts97-109`. Thus26 representable states and six supported
states: true/None, false/None, and false/Some of gitdir-target-exists,
parent-repo-present,wrong-shape,contents-present. The exact producers and
migration map are in its provisional design. `DiscoveredCandidate / ApplyOutcome`
is a cross-type seed; output aggregation does not create its claimed pair.
Do not delete application reaped state under this candidate's implementation.

The private classification is projected into the unchanged candidate/report
schemas at147-203. Public reasons, schemaVersion tmpfs-reap/v1, optional root
fields, omitted skipReason/parentRepo/bytes, applied false, count/byte totals,
and warnings remain intact. Quality.command.ts129,3505-3523,3565-3567 encodes
and renders; Yeet/internal/Sweep.ts1141-1180 consumes the report; test kits
reexport run helpers and public schemas. Filesystem safety checks, repeated
rediscovery, nonrecursive .git deletion and guarded rmdir are retained.

### Docgen: descriptors, raw requests and successful operations

The raw reports anchor at Docgen.command.ts836/990, which are `allFlag`
values, not Booleans. The corrected operation objects at887/1035 carry
all,input,packageSelector,packetLimit after gates869/1029. Their eight
presence/Boolean projections reduce to input(path),package(selector),all.
The options at81-138 retain -p, optional input/package, default-false all and
all sibling flags; strings and packetLimit are payloads, not finite pseudoaxes.

Targets.resolveQualityWorkerEvalSource at271-316 is exported and documented
at253-264. It reads input first even when another selector is supplied. With
no input it calls resolveDocgenQualityTargets, whose orphan check precedes
conflict rejection; no selection takes affected discovery and preserves the
existing generated:affected source identity with the helper's package scope
mapping. That full public behavior is retained in the provisional designs.
No code path, error ordering or report JSON is narrowed to the CLI's three
successful selections. Exact local Effect TaggedUnion references are included.

The older docgen-quality object at792 is different: it is constructed before
orphan/conflict validation, to submit the actual raw request. PortfolioIndex.ts325
similarly builds write/check before runGoalsIndex's exact two-message conflict
handling at278-284. Their proposed D1 rows explain each request contract and
preserve it, following the owner-purpose method of the R27 Yeet request audit.
Do not transfer the new eval operation's E4 to these earlier request objects.
The historical command-scope-normalize audit's assertion that a named
Command.make automatically owns Boolean state is superseded by actual owner
inspection; current designs remain unchanged pending parent adjudication.

Fallow boundaries, Explore atlas and Ci lane timing render mode have only
Flag descriptor bags and anonymous callback flags for their claimed members.
Their later objects omit those pairs/triples. A branch over parameters does
not manufacture a source-declared Boolean data owner. The same applies to
seven Docgen D command seeds and the direct Goals adopt/bootstrap callback
forwarding. No permission is inferred to change their actual user behavior.

### Four removal bags: D2

The objects at TmpfsReap.ts855,910,917 and AdmissionJournal.ts936 have exactly
force and recursive. `.repos/effect/packages/effect/src/FileSystem.ts271-283`
defines both independently optional SDK controls. Preserve true/false on the
.git call and true/true on candidate/extras/sidecar calls, as well as omitted
SDK options elsewhere. Force handles nonexistent paths; recursion governs
nested directory removal. They do not express a repo lifecycle phase.
The locator strings identify actual enclosing calls, not fictitious `.removeOptions`
properties. No serialization or constructor alias is introduced. Distinct
candidate.path and extra call objects must remain separately identifiable.

### Three capture bags and their inherited contract: D1

EvalLawLanes.ts53-60 owns command,args,cwd,extendEnv,source,trim.
Preservation.ts1127-1133 owns args,command,cwd,extendEnv,trim.
CiLane.ts1964-1972 owns command,args,cwd,env,extendEnv,source,trim.
The first two write true/true; Ci derives environment inheritance from Turbo
while independently requesting trim. Their repo-owned StepExec contract
separates environment inheritance at436-443/705-712 from trim at1044 or
1131-1132. The raw description of trim as a ChildProcessSpawner SDK knob is
wrong. RunCapturedOptions also inherits extendEnv from SpawnFields, so its
canonical trim/tee row is expanded to all three members. Optional absence,
false and true remain distinct inputs; default tee is false, trim applies
only for ===true, and spawnFields preserves its current configured-env rule.
All command/args/env/cwd/stdin/forceKillAfter/source/bound/timeout payloads
remain intact. Captured stdout/stderr/exitCode consumers, including df parsing,
SubprocessResult and Turbo partition selection, receive unchanged results.
No request JSON or service protocol changes; the distinct named Streams
contract is supporting context, not an invented additional Q.

### Three retained report D rows and footer D drift

TemplateContext is an exported schema, not function parameters. isLab754
copies placement, while isEcosystem755 projects family1472. Both-true lab
plus ecosystem remains legal. Preserve the full schema at732-765: name,
scopedName,type,description,year,parentDir,packagePath,rootRelative, optional
family/kind/appKind, all existing type/app-kind Boolean clusters, isLab,
isEcosystem,portlessLabel,rootDirRelative,identityAccessor, and both plugin
strings. It flows through TemplateRenderRequest context spread at1507-1513
and generated templates. Existing qualified type/app-kind records remain
separate; this D1 does not bless or redesign them.

MakePhoenixSyncProgramOptions412 extends MakeDoctorProgramOptions320 with
confirmPhoenixWrite Option<string> and write. Inherited json/noPhoenix remain
independent of write; the base also carries dataRoot Option<string>,phoenixBaseUrl,
target and workerEvalReportPath. The exact consumer427-461 keeps dryRun=!write,
confirmation Option handling, doctor input, Phoenix layer choice, rendering
and failure status. D1 does not claim every request is authorized to perform
a remote write; the downstream approval/availability policy remains intact.

Corpus's old organizeCategoryFor anonymous parameter is OUT, but actual
planOrganizeRow's argument2298-2304 is eligible D1. Own fields are client,
extension,hasDocket,isEmailExport,isRecycleMetadata. Fact overlap is supported;
category precedence2268-2278 does not reject it. Preserve all record/restoration
and path/docket payloads and existing Organize report/JSON behavior. Reanchor
the existing ID to its real producer instead of creating a duplicate helper
parameter record.

DeletePackageHandlerOptions594-611 remains a named14-Boolean request type;
target/also strings and downstream DeletePackagePolicy facts remain distinct.
DocgenLocalOptions141-150 retains allowFull permission versus full request,
plus json/plan (separately qualified),base/head/packageSelector/parallel.
KnowledgeRefClassificationInput1830-1839 and RefCandidate2237-2251 retain
three independent classification facts, all literal kinds/surfaces/resolution
status and Option anchor/token/slug/normalized payloads. MatchPersonOptions'
four Booleans retain constructor false defaults837-844, all model/backend/
compute/device/threshold and path payloads. isWorkerDispositionCoherent1393-1394
really computes two local Booleans: quality flags and partial aligner rejection.
The actual locals remain D1 even though the enclosing symbol is a predicate;
the four score-threshold locals are a separate designed owner. ClassifiedJournalLines
at323-329 is a genuine interface carrying two independent text/parse facts,
lines and rows; constructor338-348 preserves unterminated text and torn-record
handling. These declarations support line corrections, not blanket callable
withdrawals based on naming.

## Exact proposed inventory JSONL

These full rows are review proposals. `confirmed` is the proposed union arm;
it does not record parent admission. No row has been applied to the canonical
inventory. The two historical Q-to-D1 request replacements need explicit
parent adjudication; preserve/retire their current designs only in that lane.

```jsonl
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-cli-internal-root-tmpfs-discovered-classified-skip","file":"packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts","line":66,"symbol":"DiscoveredCandidate","kind":"type-literal","members":["classified","shapeSkipReason"],"status":"confirmed","evidence":[{"class":"E4","cite":{"file":"packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts","line":239},"note":"Shape classification emits true/None or false/Some of three shape reasons; contents rejection at387-394 adds false/Some(contents-present). Every other classified producer writes None."},{"class":"E4","cite":{"file":"packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts","line":293},"note":"Git-worktree discovery admits false/None when parentRepo is None, so that sixth state cannot be erased. Declared Option reason payload has twelve values at TmpfsReap.schemas.ts97-109."}],"cardinality":{"representable":26,"legal":6},"storage":"stored","exposure":"internal","targetShape":"tagged-union","tier":1,"notes":"Actual named DiscoveredCandidate owner. shapeSkipReason is Option of twelve declared reasons (TmpfsReap.schemas.ts97-109), not a presence bit. Six supported states: true/None; false/None; false/Some(gitdir-target-exists,parent-repo-present,wrong-shape,contents-present). No true/Some producer. Preserve all other fields and later full reason family; separate from withdrawn cross-type classified/reaped seed and local dangling disposition. Native P2 proposal; provisional design under data/."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-cli-internal-root-tmpfs-gitfile-remove-options","file":"packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts","line":855,"symbol":"removeDanglingWorktreeStub: fs.remove(gitFile) options","kind":"object-literal","members":["force","recursive"],"status":"disqualified","disqualifier":{"class":"D2","note":"Inline Effect FileSystem.remove options for the dangling-stub .git file. force and recursive are independent platform-fs SDK knobs; this call sets recursive false while sibling directory removals set it true. Exact SDK contract: .repos/effect/packages/effect/src/FileSystem.ts271-283; these are the complete two own fields. Symbol is a human enclosing-call locator, not an invented object property. No encoded state migration."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-cli-internal-root-tmpfs-directory-remove-options","file":"packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts","line":910,"symbol":"removeDirectoryCandidate: fs.remove(candidate.path) options","kind":"object-literal","members":["force","recursive"],"status":"disqualified","disqualifier":{"class":"D2","note":"Inline Effect FileSystem.remove options for a classified directory candidate. force and recursive are independent platform-fs SDK knobs set together at this call. Exact SDK contract: .repos/effect/packages/effect/src/FileSystem.ts271-283; these are the complete two own fields. Symbol is a human enclosing-call locator, not an invented object property. No encoded state migration."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-cli-internal-root-tmpfs-fallow-extras-remove-options","file":"packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts","line":917,"symbol":"removeDirectoryCandidate: fs.remove(extra) options","kind":"object-literal","members":["force","recursive"],"status":"disqualified","disqualifier":{"class":"D2","note":"Inline Effect FileSystem.remove options for fallow sibling extras after the candidate directory is gone. Distinct owner from removeDirectoryCandidate.removeOptions; force and recursive are independent platform-fs SDK knobs. Exact SDK contract: .repos/effect/packages/effect/src/FileSystem.ts271-283; these are the complete two own fields. Symbol is a human enclosing-call locator, not an invented object property. No encoded state migration."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-cli-internal-root-admission-journal-sidecar-remove-options","file":"packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts","line":936,"symbol":"sweepOrphanJournalLockClaims: fs.remove(sidecar) options","kind":"object-literal","members":["force","recursive"],"status":"disqualified","disqualifier":{"class":"D2","note":"Inline Effect FileSystem.remove options for leftover journal-lock sidecars after the lock path is gone. force and recursive are independent platform-fs SDK knobs set together. Exact SDK contract: .repos/effect/packages/effect/src/FileSystem.ts271-283; these are the complete two own fields. Symbol is a human enclosing-call locator, not an invented object property. No encoded state migration."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"create-package-template-lab-ecosystem","file":"packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts","line":754,"symbol":"TemplateContext","kind":"schema-struct","members":["isLab","isEcosystem"],"status":"disqualified","disqualifier":{"class":"D1","note":"Independent axes unchanged: isLab copies the CLI lab placement flag at 1496; isEcosystem is the family projection at 1472. Both-true remains a legal lab-plus-ecosystem combination. Line corrected from 723 (JSDoc example) to the first boolean member."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r3-tooling-phoenix-sync-program-options","file":"packages/tooling/tool/cli/src/commands/AgentEffectiveness/AgentEffectiveness.command.ts","line":412,"symbol":"MakePhoenixSyncProgramOptions","kind":"schema-struct","members":["json","noPhoenix","write"],"status":"disqualified","disqualifier":{"class":"D1","note":"Independent CLI axes unchanged: json and noPhoenix are inherited from MakeDoctorProgramOptions at 323-324; write is the child's dry-run flip at 417. All 8 combinations still compose. Line corrected from 320 (parent class) to this class declaration."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"corpus-organize-category-flags","file":"packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts","line":2298,"symbol":"planOrganizeRow","kind":"object-literal","members":["hasDocket","isEmailExport","isRecycleMetadata"],"status":"disqualified","disqualifier":{"class":"D1","note":"Actual object supplied to organizeCategoryFor at2298-2304; anonymous helper parameter2261-2266 is OUT OF NET. Complete own fields are client, extension, hasDocket, isEmailExport, isRecycleMetadata. Independent file facts can overlap; reader2268-2278 uses recycle/pst/docket/email/client precedence without rejecting overlap. Preserve original record, restoration, path and docket payloads; stable census ID is reanchored to its concrete producer."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-cli-commands-a-c-eval-law-lanes-spawn-options","file":"packages/tooling/tool/cli/src/commands/AgentEffectiveness/internal/EvalLawLanes.ts","line":57,"symbol":"runSubprocess","kind":"object-literal","members":["extendEnv","trim"],"status":"disqualified","disqualifier":{"class":"D1","note":"Actual constructed repo StepExec request, not a ChildProcessSpawner-owned trim option. extendEnv controls spawn environment inheritance (StepExec.ts436-443,705-712); trim controls captured text normalization (1044 or1131-1132). Both-true is supported and the contract accepts either control independently. D1, not D2. Preserve all command/args/cwd/env/source payloads and omitted optional controls."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-cli-commands-a-c-preservation-capacity-spawn-options","file":"packages/tooling/tool/cli/src/commands/Corpus/internal/Preservation.ts","line":1131,"symbol":"destinationFreeBytes","kind":"object-literal","members":["extendEnv","trim"],"status":"disqualified","disqualifier":{"class":"D1","note":"Actual constructed repo StepExec request, not a ChildProcessSpawner-owned trim option. extendEnv controls spawn environment inheritance (StepExec.ts436-443,705-712); trim controls captured text normalization (1044 or1131-1132). Both-true is supported and the contract accepts either control independently. D1, not D2. Preserve all command/args/cwd/env/source payloads and omitted optional controls."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-cli-commands-a-c-ci-partition-dry-run-spawn-options","file":"packages/tooling/tool/cli/src/commands/Ci/CiLane.ts","line":1969,"symbol":"runCiPartition","kind":"object-literal","members":["extendEnv","trim"],"status":"disqualified","disqualifier":{"class":"D1","note":"Actual constructed repo StepExec request, not a ChildProcessSpawner-owned trim option. extendEnv controls spawn environment inheritance (StepExec.ts436-443,705-712); trim controls captured text normalization (1044 or1131-1132). Both-true is supported and the contract accepts either control independently. D1, not D2. Preserve all command/args/cwd/env/source payloads and omitted optional controls."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-cli-commands-d-k-docgen-quality-worker-eval-source","file":"packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts","line":887,"symbol":"docgenQualityWorkerEvalCommand","kind":"object-literal","members":["all","input","packageSelector"],"status":"confirmed","evidence":[{"class":"E4","cite":{"file":"packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts","line":887},"note":"Only after exact-one gate at869 does this object exist. It preserves all/input/packageSelector and packetLimit; none-selected or multiple-selected input cannot reach this writer."}],"cardinality":{"representable":8,"legal":3},"storage":"stored","exposure":"internal","targetShape":"tagged-union","tier":1,"notes":"Actual four-key argument object (plus packetLimit number) built after exact-one validation; Command.make descriptors and callback parameters are OUT OF NET. Three successful operation selections input(path), package(selector), all. Exported Targets.resolveQualityWorkerEvalSource retains its broader input-first and affected-fallback raw request behavior. Native reanchoring proposal pending independent owner correction; staged shared-schema design under data/."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-cli-commands-d-k-docgen-quality-worker-runpod-eval-source","file":"packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts","line":1035,"symbol":"docgenQualityWorkerRunpodEvalCommand","kind":"object-literal","members":["all","input","packageSelector"],"status":"confirmed","evidence":[{"class":"E4","cite":{"file":"packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts","line":1035},"note":"Only after exact-one gate at1029 does this object exist. It preserves all/input/packageSelector and packetLimit; none-selected or multiple-selected input cannot reach this writer."}],"cardinality":{"representable":8,"legal":3},"storage":"stored","exposure":"internal","targetShape":"tagged-union","tier":1,"notes":"Actual four-key argument object (plus packetLimit number) built after exact-one validation; Command.make descriptors and callback parameters are OUT OF NET. Three successful operation selections input(path), package(selector), all. Exported Targets.resolveQualityWorkerEvalSource retains its broader input-first and affected-fallback raw request behavior. Native reanchoring proposal pending independent owner correction; staged shared-schema design under data/."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"delete-package-handler-options","file":"packages/tooling/tool/cli/src/commands/DeletePackage/DeletePackage.command.ts","line":594,"symbol":"DeletePackageHandlerOptions","kind":"type-literal","members":["dryRun","check","skipLockfile","skipBaselines","retireChangesets","identityMajor","cascade","rewritePackets","allowStalePackets","allowPublished","pruneCatalog","force","dropData","allowNonLocalData"],"status":"disqualified","disqualifier":{"class":"D1","note":"Independent operator flags; dryRun/check print-prefix if-chain is precedence, not a rejected combined-true mode."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"docgen-local-allow-full","file":"packages/tooling/tool/cli/src/commands/Docgen/internal/Local.ts","line":142,"symbol":"DocgenLocalOptions","kind":"type-literal","members":["allowFull","full"],"status":"disqualified","disqualifier":{"class":"D1","note":"Independent: full requests full mode, allowFull is permission when the plan later requires it."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"knowledge-ref-classification-input","file":"packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts","line":1836,"symbol":"KnowledgeRefClassificationInput","kind":"type-literal","members":["patternContext","pairingAmbiguous","ungoverned"],"status":"disqualified","disqualifier":{"class":"D1","note":"Independently observed classification facts for different buses; writes set unused siblings false rather than encoding one exclusive state."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"knowledge-ref-candidate","file":"packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts","line":2244,"symbol":"RefCandidate","kind":"type-literal","members":["patternContext","pairingAmbiguous","ungoverned"],"status":"disqualified","disqualifier":{"class":"D1","note":"Same independently observed ref facts as KnowledgeRefClassificationInput; combinations like patternContext+ungoverned are written."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"files-match-person-options","file":"packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.schemas.ts","line":837,"symbol":"MatchPersonOptions","kind":"schema-struct","members":["recursive","acceptModelLicense","json","overwrite"],"status":"disqualified","disqualifier":{"class":"D1","note":"Independent CLI toggles for a local matching run."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r3-tooling-match-person-disposition-facts","file":"packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.ts","line":1393,"symbol":"isWorkerDispositionCoherent","kind":"sibling-state","members":["hasQualityFlags","hasPartialAlignerRejection"],"status":"disqualified","disqualifier":{"class":"D1","note":"Independent entry facts for face quality flags and aligner-confidence rejection; different disposition arms consume them and combined true is legal."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r3-tooling-attempt-journal-classified-lines","file":"packages/tooling/tool/cli/src/internal/repo-run/AttemptTerminationJournal.ts","line":325,"symbol":"ClassifiedJournalLines","kind":"interface","members":["needsTrailingNewline","torn"],"status":"disqualified","disqualifier":{"class":"D1","note":"Independent observations of one journal file: missing terminating newline versus an unterminated trailing JSON record. Combined-true is legal and both bits are copied independently into the rewrite."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"step-exec-run-captured-options","file":"packages/tooling/tool/cli/src/internal/process/StepExec.ts","line":884,"symbol":"RunCapturedOptions","kind":"type-literal","members":["extendEnv","trim","tee"],"status":"disqualified","disqualifier":{"class":"D1","note":"RunCapturedOptions intersects SpawnFields, inheriting optional extendEnv at439 alongside optional trim/tee at890-891. Three independent repo capture controls: environment inheritance, output whitespace normalization, live tee. Absence/false/true semantics remain intact; neither output formatting control is a ChildProcessSpawner SDK field. Keep full source/bound/timeout/stdin/env/cwd/command/args/forceKillAfter payloads."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r26-cli-commands-d-k-docgen-quality-command-scope","file":"packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts","line":792,"symbol":"docgenQualityCommand","kind":"object-literal","members":["all","changedFiles","packageSelector"],"status":"disqualified","disqualifier":{"class":"D1","note":"Actual raw object is constructed before resolveDocgenQualityTargets performs orphan checking and countSelectedScopes rejection. It intentionally carries conflicting selections into the resolver for the documented exact DomainError (Quality.scope.ts107-145), as well as default affected input; it is not a successful canonical scope. Command.make descriptors are OUT. Reanchor and retain D1 at this request boundary; preserve public resolver and error order. The later returned scope literal is already canonical."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r26-cli-commands-d-k-goals-index-command-mode","file":"packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts","line":325,"symbol":"goalsIndexCommand","kind":"object-literal","members":["write","check"],"status":"disqualified","disqualifier":{"class":"D1","note":"Actual raw object passed to runGoalsIndex before the explicit two-message conflict diagnostic at PortfolioIndex.ts278-284. Both flags independently record the request; success is later dispatched as write/check/print. Reanchor D1 to this request object, not the Flag descriptors at253/257 or anonymous handler parameters. Preserve both exact error strings, absence-tolerant check behavior and all output."}}
```

## Exact replacement provenance

| Proposed id already in current inventory | Seed row SHA-256 | Current row SHA-256 |
| --- | --- | --- |
| `create-package-template-lab-ecosystem` | `03475df2c3108dfad4bd119d888b6793e62d57129d914541e4493fcdacc1706c` | `03475df2c3108dfad4bd119d888b6793e62d57129d914541e4493fcdacc1706c` |
| `r3-tooling-phoenix-sync-program-options` | `9b8a6d19a276bbf21b1ae23b29539f4e2fabdcd74172759bad522d6eefd5cf93` | `9b8a6d19a276bbf21b1ae23b29539f4e2fabdcd74172759bad522d6eefd5cf93` |
| `corpus-organize-category-flags` | `c5b60d24567e62f0ca46e4f250891545e95debbe8e9254dc2283723ac98ad39b` | `c5b60d24567e62f0ca46e4f250891545e95debbe8e9254dc2283723ac98ad39b` |
| `delete-package-handler-options` | `bb3867e38f38da80d092b93656b9988609ffee3b3da99ceb7fa9ee488705b67b` | `bb3867e38f38da80d092b93656b9988609ffee3b3da99ceb7fa9ee488705b67b` |
| `docgen-local-allow-full` | `004244ccb867ff869097a93b7d2c56d4225ee85747c73352994649b37d810340` | `004244ccb867ff869097a93b7d2c56d4225ee85747c73352994649b37d810340` |
| `knowledge-ref-classification-input` | `5bf49cbb5a4d6159a0de2bd2efb2d69af0e062da8d912459949ddcc68927771a` | `5bf49cbb5a4d6159a0de2bd2efb2d69af0e062da8d912459949ddcc68927771a` |
| `knowledge-ref-candidate` | `32ee8a86929f8259dec185d8e45bc82204dcd56b812d73f6067415aa97cc2832` | `32ee8a86929f8259dec185d8e45bc82204dcd56b812d73f6067415aa97cc2832` |
| `files-match-person-options` | `afd95c8b3800b2b874b53b2e65847137d3c78498aa3ee0912e188893f698cf27` | `afd95c8b3800b2b874b53b2e65847137d3c78498aa3ee0912e188893f698cf27` |
| `r3-tooling-match-person-disposition-facts` | `90acc127ba5ede1683c3c9640644f688813a37a127d766e624aecffbf4fe7736` | `90acc127ba5ede1683c3c9640644f688813a37a127d766e624aecffbf4fe7736` |
| `r3-tooling-attempt-journal-classified-lines` | `ab3068fc901d7593e1ff1a53c7c004f0567237567f8b5a21b8d9bfb06d8b6925` | `ab3068fc901d7593e1ff1a53c7c004f0567237567f8b5a21b8d9bfb06d8b6925` |
| `step-exec-run-captured-options` | `f5591f4800dc48a8622685bd3642337132483881f9e687a1c4d8da1e09ff427e` | `f5591f4800dc48a8622685bd3642337132483881f9e687a1c4d8da1e09ff427e` |
| `r26-cli-commands-d-k-docgen-quality-command-scope` | `d6617a483dc89a5f35a15ce622855f18cae8173c4b70a9b2adacef3e9f2bf0ca` | `d6617a483dc89a5f35a15ce622855f18cae8173c4b70a9b2adacef3e9f2bf0ca` |
| `r26-cli-commands-d-k-goals-index-command-mode` | `73bc1ae0fb05232aca52e52d9719db8d99ac58db46bb62e2bbf4ad43054094bf` | `73bc1ae0fb05232aca52e52d9719db8d99ac58db46bb62e2bbf4ad43054094bf` |

## Exact withdrawal receipts

The following JSONL is an audit receipt format, not inventory/v1 and not a new
canonical input. Each evidence note names actual declarations in the row's
file (or explicitly names the companion file). OUT OF NET means omit the
record from the live census and retain historical evidence; do not invent a
new inventory status. Parent performs any archival or design retirement.

```jsonl
{"id":"r3-tooling-registration-authored-kind-probes","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/internal/cli/RegistrationGeometry/RegistrationGeometry.probes.ts","seedRowSha256":"01db7adb39d85ac81341018973b63e359d4fb3e2205ee43088fd09997afa934e","currentRowSha256":"01db7adb39d85ac81341018973b63e359d4fb3e2205ee43088fd09997afa934e","proof":"RegistrationGeometry.probes.ts393-420: two predicate functions form callable AUTHORED_KIND_RULES entries; authoredKindFor returns a kind literal."}
{"id":"r3-tooling-turbocache-value-probes","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/internal/cli/TurboCache.ts","seedRowSha256":"542fe5fd77d38b5d3e3d0262489475b83cd8663b1975b95b1ec16e8c1082e071","currentRowSha256":"542fe5fd77d38b5d3e3d0262489475b83cd8663b1975b95b1ec16e8c1082e071","proof":"TurboCache.ts528-534 declares three Boolean-returning functions. No valueProbes data object exists."}
{"id":"r3-tooling-tmpfs-name-brand-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts","seedRowSha256":"2cd58c3f8ee50b75acd83af36bec66fde36c5aa4a770eacf0bcf4d49ea9ef4b5","currentRowSha256":"2cd58c3f8ee50b75acd83af36bec66fde36c5aa4a770eacf0bcf4d49ea9ef4b5","proof":"TmpfsReap.ts51,59 binds S.is guard functions; uses at337,624,638 call/filter them."}
{"id":"r25-cli-internal-root-residue-reap-name-brands","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/internal/repo-run/ResidueReap.ts","seedRowSha256":"254b2a64ba37461abf7fa5bc6b1c844ea99059f6c7d7eeaf22241c18119ce2f0","currentRowSha256":"254b2a64ba37461abf7fa5bc6b1c844ea99059f6c7d7eeaf22241c18119ce2f0","proof":"ResidueReap.ts64,66 binds S.is guard functions; directory/PID filtering consumes callables at378,544."}
{"id":"r3-tooling-labs-workspace-path-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/internal/cli/Labs/LabsWorkspace.ts","seedRowSha256":"503c14d81244914da4c20d3258873bbe6468d8d2dd97937b4de6bcc27c109825","currentRowSha256":"503c14d81244914da4c20d3258873bbe6468d8d2dd97937b4de6bcc27c109825","proof":"LabsWorkspace.ts90 binds S.is;101-104 declares isLabsWorkspacePath. They are functions, not stored flags."}
{"id":"r3-tooling-github-job-shape-step-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/internal/github/JobShape.ts","seedRowSha256":"90f7a52e75809d68f0f07bf270b841044770c4050acbdfe890bcbe4c04c8c151","currentRowSha256":"90f7a52e75809d68f0f07bf270b841044770c4050acbdfe890bcbe4c04c8c151","proof":"JobShape.ts189-195 declares step predicate functions;270 applies A.some."}
{"id":"r25-cli-internal-root-job-shape-install-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/internal/github/JobShape.ts","seedRowSha256":"c5dbb6d365e2c7d6d97b7f34a41507766cdf2cb22884755960a2fc8a420134cc","currentRowSha256":"c5dbb6d365e2c7d6d97b7f34a41507766cdf2cb22884755960a2fc8a420134cc","proof":"JobShape.ts205-213 declares a step predicate and an array predicate;276 calls the latter."}
{"id":"r25-cli-internal-root-turbo-cache-control-arg","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/internal/cli/TurboCache.ts","seedRowSha256":"e8d8e85d0ea0cbfeec1fd6d43f609315728d225dd668acb274891e1166bfe91b","currentRowSha256":"e8d8e85d0ea0cbfeec1fd6d43f609315728d225dd668acb274891e1166bfe91b","proof":"TurboCache.ts518-529 declares two argument predicate functions;657/752 use them."}
{"id":"r25-cli-internal-root-bin-main-can-use-fast-paths","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/bin-main.ts","seedRowSha256":"fc38d33d9251533ef8d442fc90268e2c6ea778219d2f2b539a4bf36927e86d58","currentRowSha256":"fc38d33d9251533ef8d442fc90268e2c6ea778219d2f2b539a4bf36927e86d58","proof":"bin-main.ts87-90 declares argv predicates;199/220 calls them. Actual handledBy... latches are distinct and remain in scope."}
{"id":"r3-tooling-ai-metrics-retention-window-probes","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/AIMetrics/internal/Programs.ts","seedRowSha256":"5d4bfdf08c946955835aa914d74da7708d77ffbfad588c107ce0e5a4377ebe0e","currentRowSha256":"5d4bfdf08c946955835aa914d74da7708d77ffbfad588c107ce0e5a4377ebe0e","proof":"Programs.ts633-646 declares selector predicates;2901/2908/3077 invokes them. Window.ts reexports functions."}
{"id":"r3-tooling-architecture-package-level-file","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Architecture/internal/TemplateRetarget.ts","seedRowSha256":"75b6f4004811c2aa2f4189f56385ea7d4aa14b99c93d8942877c1d84846ae164","currentRowSha256":"75b6f4004811c2aa2f4189f56385ea7d4aa14b99c93d8942877c1d84846ae164","proof":"TemplateRetarget.ts34-64 declares path predicates;82-83 ORs their calls."}
{"id":"r3-tooling-create-package-relative-path-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/CreatePackage/FileGenerationPlanService.ts","seedRowSha256":"f040f5e9d6ce77ac52d4bcb010c5685f71572fdf5a7ed1ea8abcb0f8499aa91a","currentRowSha256":"f040f5e9d6ce77ac52d4bcb010c5685f71572fdf5a7ed1ea8abcb0f8499aa91a","proof":"FileGenerationPlanService.ts21-34 composes predicate functions;50 passes a function to S.makeFilter."}
{"id":"r3-tooling-codegen-walk-skip-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Codegen/Codegen.command.ts","seedRowSha256":"773318dc09086fc1c6c05b10fabc6ba0576bd67f58d72d32356523c858fd75f0","currentRowSha256":"773318dc09086fc1c6c05b10fabc6ba0576bd67f58d72d32356523c858fd75f0","proof":"Codegen.command.ts94-95 binds S.is guard functions, called at182/192."}
{"id":"r3-tooling-create-package-plugin-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts","seedRowSha256":"8d40cbc0921c9f7868f75c093aa02d2307a82a28b0e5c6266c8df4def18dba9b","currentRowSha256":"8d40cbc0921c9f7868f75c093aa02d2307a82a28b0e5c6266c8df4def18dba9b","proof":"CreatePackage.command.ts160-164 declares two predicates;178/207 applies plugin predicate."}
{"id":"r3-tooling-preservation-t7-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Corpus/internal/Preservation.ts","seedRowSha256":"b9a24e970a3b2504ee8924bbce96cf40132ca9230edcd59469dd6e3e113795c0","currentRowSha256":"b9a24e970a3b2504ee8924bbce96cf40132ca9230edcd59469dd6e3e113795c0","proof":"Preservation.ts79 is S.is;845-851 is a path predicate. Calls at872/1430 do not form a Boolean state owner."}
{"id":"r3-tooling-create-package-literal-guards","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts","seedRowSha256":"b8698036668ee63042785ffba88c853f9ad12f5b2755bf2e667a740da8f710b1","currentRowSha256":"b8698036668ee63042785ffba88c853f9ad12f5b2755bf2e667a740da8f710b1","proof":"CreatePackage.command.ts222,232,248 binds S.is functions, called at1188/1207/1226."}
{"id":"r3-tooling-lane-timings-window-row-guards","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts","seedRowSha256":"1d124f1b2d69cc56e84f40173404bbdf74b8445ae830e0b1114b66b6529782d8","currentRowSha256":"1d124f1b2d69cc56e84f40173404bbdf74b8445ae830e0b1114b66b6529782d8","proof":"LaneTimings.ts1768-1770 binds three S.is functions;1854-1856 filters rows with them."}
{"id":"r3-tooling-restoration-source-identity-predicates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Corpus/internal/Restoration.ts","seedRowSha256":"4646ab625d17d6109407d25e3272fad21632e9e6d0ff074dfd45f12f93610552","currentRowSha256":"4646ab625d17d6109407d25e3272fad21632e9e6d0ff074dfd45f12f93610552","proof":"Restoration.ts225-239 declares identity comparison functions;497-498/1091 and other reads call them over data."}
{"id":"r2-tooling-tmpfs-reap-classified-reaped","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts","seedRowSha256":"3568c93bc01f57d16cfa8b49dbb8d39103408d16fda93e0b29ec70e16818deec","currentRowSha256":"3568c93bc01f57d16cfa8b49dbb8d39103408d16fda93e0b29ec70e16818deec","proof":"TmpfsReap.ts61-69 owns classified;101-104 separately owns reaped. A.zip at1259 combines nested candidate/outcome values for aggregation without declaring the claimed same-owner Boolean pair."}
{"id":"person-match-report-success-flags","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.schemas.ts","seedRowSha256":"784ae8c7ee8ab61de457c525d6344d0d60feacdc1e6a2a36b38b65fcc7a14f50","currentRowSha256":"784ae8c7ee8ab61de457c525d6344d0d60feacdc1e6a2a36b38b65fcc7a14f50","proof":"MatchPerson.schemas.ts1772-1785 declares ok as S.Literal(true), with manifestWritten the only free Boolean. Preserve success literal and beep.files.match-person.v2 codec unchanged."}
{"id":"knowledge-refs-output-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.command.ts","seedRowSha256":"7221c6abd2f1f568f637b546e6bd81818127a654ae880b572a047c4b587da8d4","currentRowSha256":"7221c6abd2f1f568f637b546e6bd81818127a654ae880b572a047c4b587da8d4","proof":"Knowledge.command.ts413-418 is an anonymous function parameter;468 passes runRefs directly to the CLI descriptor. No source-declared same-pair object is instantiated in the handler."}
{"id":"r3-tooling-adaface-cpu-retry-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.worker-service.ts","seedRowSha256":"d2e5e5e5c3c6e8a34936ec7fa98c9e07d1f1fb82f8d10cdd83fc2eda9c52ef11","currentRowSha256":"d2e5e5e5c3c6e8a34936ec7fa98c9e07d1f1fb82f8d10cdd83fc2eda9c52ef11","proof":"MatchPerson.worker-service.ts911-926 declares retry functions;954/1004 invokes them. The test export at983-984 retains functions."}
{"id":"r3-tooling-knowledge-ungoverned-spelling-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts","seedRowSha256":"ac6ff9c3db1aeefa5ef8405c8e9c792d754cacc293ac93f75ea00858cad362a7","currentRowSha256":"ac6ff9c3db1aeefa5ef8405c8e9c792d754cacc293ac93f75ea00858cad362a7","proof":"Knowledge.refs.ts2196-2201 declares spelling predicates;2220 calls them."}
{"id":"r3-tooling-explore-atlas-literal-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Explore/Atlas.ts","seedRowSha256":"0e3d2dccc36df3ff34bf662f61f0ac0e876f26c54484b46ff1b655e329e4eac5","currentRowSha256":"0e3d2dccc36df3ff34bf662f61f0ac0e876f26c54484b46ff1b655e329e4eac5","proof":"Atlas.ts294-295 binds S.is functions;447-449 filters independent Option payloads with them."}
{"id":"r3-tooling-knowledge-blob-election-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts","seedRowSha256":"d6b08d7c9d9f01405c9b479e19cd6249e3d338647d30afd9c6d42961f9fd78db","currentRowSha256":"d6b08d7c9d9f01405c9b479e19cd6249e3d338647d30afd9c6d42961f9fd78db","proof":"Knowledge.refs.ts2127-2130 declares blob/path predicates;2658 calls both from a filter."}
{"id":"r3-tooling-knowledge-scanner-entry-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts","seedRowSha256":"023adf9ff14b09b05d3757a253a54050be9b9e79d373f06864a9f32250ed8439","currentRowSha256":"023adf9ff14b09b05d3757a253a54050be9b9e79d373f06864a9f32250ed8439","proof":"Knowledge.service.ts327-330 declares path/blob predicates;635 calls both from a filter."}
{"id":"r3-tooling-knowledge-governed-path-spelling-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts","seedRowSha256":"3852a33c18511da81ac184baa9385a16a1122c791e078cac093a13f7c173f7a1","currentRowSha256":"3852a33c18511da81ac184baa9385a16a1122c791e078cac093a13f7c173f7a1","proof":"Knowledge.refs.ts1295-1317 declares three spelling predicates;1307/1310 invokes siblings."}
{"id":"r3-tooling-delete-package-collision-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/DeletePackage/DeletePackage.command.ts","seedRowSha256":"b9b26ef9a480f735f63c276265262b49725281f4ec83a1a608742d1f7e5169fc","currentRowSha256":"b9b26ef9a480f735f63c276265262b49725281f4ec83a1a608742d1f7e5169fc","proof":"DeletePackage.command.ts568-592 declares Effect functions;623/625 yields their results into the separately recorded DeletePackagePolicy fields."}
{"id":"r3-tooling-doctest-option-literal-kind","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Docgen/internal/Doctest.ts","seedRowSha256":"af7f334f1c5aa837aec0f2f854cafd102e7a3aa1edf8b920c7b6a55d46351c18","currentRowSha256":"af7f334f1c5aa837aec0f2f854cafd102e7a3aa1edf8b920c7b6a55d46351c18","proof":"Doctest.ts291-309 declares Boolean predicate functions over AST inputs;307 calls none/some helpers."}
{"id":"r3-tooling-doctest-import-kind-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Docgen/internal/Doctest.ts","seedRowSha256":"0643273196598ed06ce698a8a04771a8a42b3716a4520100dbd4b57d753e8d4d","currentRowSha256":"0643273196598ed06ce698a8a04771a8a42b3716a4520100dbd4b57d753e8d4d","proof":"Doctest.ts81-92 declares import predicates;160 applies them to a specifier."}
{"id":"r3-tooling-knowledge-static-node-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.command-surface.ts","seedRowSha256":"e90dfea8f457cf1587724cf9d970081b0191eff7f221dfb24d1f200fe7635ae3","currentRowSha256":"e90dfea8f457cf1587724cf9d970081b0191eff7f221dfb24d1f200fe7635ae3","proof":"Knowledge.command-surface.ts216-221 declares expression predicates;291/522 calls them."}
{"id":"r3-tooling-files-media-rotation-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Files/Files.media.ts","seedRowSha256":"3f5f3637dc9f5a9e06eb0296b0545ae96856c9a5fe30789327aa6a1e7f90b0f7","currentRowSha256":"3f5f3637dc9f5a9e06eb0296b0545ae96856c9a5fe30789327aa6a1e7f90b0f7","proof":"Files.media.ts618,636-639 declares numeric predicates;MediaExec.ts116/187 applies them in separate probes, not one aggregate."}
{"id":"r3-tooling-doctest-declared-statement-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Docgen/internal/Doctest.ts","seedRowSha256":"bf549fe392e970505cac6b2df87435a15f0905edd0924a15c0adc26109fcec85","currentRowSha256":"bf549fe392e970505cac6b2df87435a15f0905edd0924a15c0adc26109fcec85","proof":"Doctest.ts183-190 declares AST predicates;194/206 invokes them."}
{"id":"r3-tooling-doctest-literal-like-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Docgen/internal/Doctest.ts","seedRowSha256":"9252cf705ee95258afd25d44b2abcdcc957f7ae25bf8a848ad2f82c8eeeac573","currentRowSha256":"9252cf705ee95258afd25d44b2abcdcc957f7ae25bf8a848ad2f82c8eeeac573","proof":"Doctest.ts252-309 declares six LiteralLikePredicate functions;312-317 stores callable predicates in a dispatch list, not Boolean values."}
{"id":"r3-tooling-knowledge-path-scope-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts","seedRowSha256":"af0f4662d21be2a8d25dc5738624b24d9c96e7c583886d7f4e1d618520ebb9c3","currentRowSha256":"af0f4662d21be2a8d25dc5738624b24d9c96e7c583886d7f4e1d618520ebb9c3","proof":"Knowledge.refs.ts1190-1193,1218-1226,1253-1258 declares path predicates;1256/2655/2676 invokes them."}
{"id":"r3-tooling-model-store-retry-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.model-store.ts","seedRowSha256":"aa312ca29d56952155d38004e079a21b39847c06b2f04b4382a089b5264c1cd1","currentRowSha256":"aa312ca29d56952155d38004e079a21b39847c06b2f04b4382a089b5264c1cd1","proof":"MatchPerson.model-store.ts162-167 declares error predicates;487 supplies a callable retry condition."}
{"id":"r3-tooling-unsafe-metadata-video-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Files/internal/MediaExec.ts","seedRowSha256":"82c31bd708e61fb0663e1a19f62c2f191bd861fe546d494e7f8702ad4f8e8b93","currentRowSha256":"82c31bd708e61fb0663e1a19f62c2f191bd861fe546d494e7f8702ad4f8e8b93","proof":"MediaExec.ts51-55 declares an extension predicate;Files.media.ts463 binds S.is(VideoFileExtension). Both remain callables."}
{"id":"r3-tooling-docgen-local-path-matchers","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Docgen/internal/Local.ts","seedRowSha256":"5920828bacda4505786c7ca71b5348bdfb2dc2e7a341d546fd50b6816aca7cd9","currentRowSha256":"5920828bacda4505786c7ca71b5348bdfb2dc2e7a341d546fd50b6816aca7cd9","proof":"Local.ts165-169 declares prefix/extension/exact-file functions. No pathMatchers Boolean object exists."}
{"id":"r3-tooling-goals-adopt-path-kinds","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Goals/Adopt.ts","seedRowSha256":"dc5b5c8787a05b26d9b7bd733a227ca20fc1c721a47b765638e9cea7fe46c837","currentRowSha256":"dc5b5c8787a05b26d9b7bd733a227ca20fc1c721a47b765638e9cea7fe46c837","proof":"Adopt.ts59,251-254 declares path predicates;331/402/466 invokes them."}
{"id":"docgen-init-force-dry-run","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts","seedRowSha256":"99ae36449c071e42ccbf52bd2830582e5ce867795e39d1aa2bec931991994034","currentRowSha256":"99ae36449c071e42ccbf52bd2830582e5ce867795e39d1aa2bec931991994034","proof":"Docgen.command.ts276-314 owns Flag descriptors and callback parameters. force and dryRun are read separately; no same-pair object is constructed."}
{"id":"docgen-status-verbose-json","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts","seedRowSha256":"76ce0f6ce03abd429841540af1f3f4713f20606d1729c65edceba19ac58be38a","currentRowSha256":"76ce0f6ce03abd429841540af1f3f4713f20606d1729c65edceba19ac58be38a","proof":"Docgen.command.ts335-377 owns descriptors/parameters; output objects carry package arrays/counts, not verbose/json."}
{"id":"docgen-quality-check-json","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts","seedRowSha256":"296172d1dac9e58cf5d29f974576cdb08f8ed480a5202dd1af72e2df5b322ceb","currentRowSha256":"296172d1dac9e58cf5d29f974576cdb08f8ed480a5202dd1af72e2df5b322ceb","proof":"Docgen.command.ts778-820 owns descriptors/parameters; actual target request792 excludes check/json, and analyzer request812 excludes both."}
{"id":"r2-tooling-docgen-generate-output-gates","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts","seedRowSha256":"b698532d07ec63a8b4e6eaae771feee6f127e5efc4d0d3213d33aed8343a5d9b","currentRowSha256":"b698532d07ec63a8b4e6eaae771feee6f127e5efc4d0d3213d33aed8343a5d9b","proof":"Docgen.command.ts383-421 uses descriptors/parameters; validateExamples is explicitly void at395. Actual generation options carry include, not this pair."}
{"id":"r2-tooling-docgen-run-clean-gate","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts","seedRowSha256":"e612c1837c1b16bb7590fa876091c3bb562d02f6c857e9baed8aed951aca3db9","currentRowSha256":"e612c1837c1b16bb7590fa876091c3bb562d02f6c857e9baed8aed951aca3db9","proof":"Docgen.command.ts437-481 uses descriptors/parameters; validateExamples is void at450. Aggregation options carry clean, not validateExamples."}
{"id":"r2-tooling-docgen-analyze-json-fix-mode","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts","seedRowSha256":"45a49ee73a94f03489dd244f5fdd65e49fa2c32851dc64bb93f017ae85d135f2","currentRowSha256":"45a49ee73a94f03489dd244f5fdd65e49fa2c32851dc64bb93f017ae85d135f2","proof":"Docgen.command.ts612-654 uses descriptors/parameters; json controls early rendering; fixMode passes as a scalar. No same-pair data object is instantiated."}
{"id":"r2-tooling-docgen-check-json-reuse-manifest","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts","seedRowSha256":"40daca7c1dc95f3b8149f18a725abea67ffbaf145016207ae72a34e1c92678f2","currentRowSha256":"40daca7c1dc95f3b8149f18a725abea67ffbaf145016207ae72a34e1c92678f2","proof":"Docgen.command.ts680-725 uses descriptors/parameters; proof gating is a scalar; output objects carry analyses/proof arrays/counts, not this pair."}
{"id":"goals-adopt-plan-json","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Goals/Adopt.ts","seedRowSha256":"b2bfe5e0bda67698be60197d9203cb9aad91697b0c740a3cdc599e77457c3691","currentRowSha256":"b2bfe5e0bda67698be60197d9203cb9aad91697b0c740a3cdc599e77457c3691","proof":"Adopt.ts504-509 is anonymous parameter syntax. CLI callback539-541 forwards its parameter without constructing a source-owned Boolean object."}
{"id":"goals-bootstrap-plan-json","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Goals/Bootstrap.ts","seedRowSha256":"cb13c4bfc3ff7d4da23bb8751257518f2d5add70bf1769eaca8880690675f926","currentRowSha256":"cb13c4bfc3ff7d4da23bb8751257518f2d5add70bf1769eaca8880690675f926","proof":"Bootstrap.ts877-888 is anonymous parameter syntax; CLI callback952-953 forwards it unchanged. No named root request owner is declared for the pair."}
{"id":"fallow-boundaries-mode","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Fallow/Fallow.command.ts","seedRowSha256":"ca00d238c03db0778a4fe6f1150c9a7f316ff3d367366c23dab69238b5c7f8ce","currentRowSha256":"ca00d238c03db0778a4fe6f1150c9a7f316ff3d367366c23dab69238b5c7f8ce","proof":"Fallow.command.ts460-499 owns write/check Flag descriptors and anonymous parameters. Conflict and output branches do not create a same-pair data object."}
{"id":"explore-atlas-mode","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Explore/Atlas.ts","seedRowSha256":"8c04ae7e932474984755cb6f74e4fb8b015e22c229046aa8fc48f51b9355c59e","currentRowSha256":"8c04ae7e932474984755cb6f74e4fb8b015e22c229046aa8fc48f51b9355c59e","proof":"Atlas.ts762-796 owns write/check descriptors and anonymous parameters; downstream projection has no such pair. Command naming does not create a Boolean owner."}
{"id":"ci-lane-timings-render-mode","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts","seedRowSha256":"f906b5a26f27873174cdec3ae5759c88ea669901f8c50c41a316e9c694477948","currentRowSha256":"f906b5a26f27873174cdec3ae5759c88ea669901f8c50c41a316e9c694477948","proof":"LaneTimings.ts2285-2335 owns markdown/tsv/window descriptors and callback parameters. Actual decodeCiLaneTimingWindowOptions object2310 omits all three."}
```

## Prior dispositions reused unchanged

The following six IDs are already absent from current canonical inventory; they are not counted among new withdrawals. Their immutable seed hashes establish the footer mapping.

| ID | Seed row SHA-256 | Existing source audit |
| --- | --- | --- |
| `r3-tooling-quality-scheduler-admission-probes` | `15fab231d0812cfba694acd04bbfac1a8f3976f12ca5014ef4cb88cecdcfe1d3` | `design-refresh-2026-09-09-r28-quality-scheduler-impact.md` |
| `r3-tooling-dead-lease-scope-plan-guards` | `27772206dd025ff6904f1524a246c1b25da9395d6e315a73ce5487b6bf2a09bb` | `design-refresh-2026-09-09-r28-quality-scheduler-impact.md` |
| `r3-tooling-ci-lane-docgen-input-kind` | `d9ae6c1f5d7e04a16e75b30863601e6b36a2c1200e7967d77b45e0a6e2db0151` | `design-refresh-2026-09-09-r28-tooling-callable-withdrawals.md` |
| `r3-tooling-create-caption-overwrite-phase` | `2d5ba1cfa333486c5fb31ba9900129473d1d43bacb3efa7b17739c270af7a0d2` | `design-refresh-2026-09-09-r28-docgen-files-impact.md` |
| `r3-tooling-docgen-quality-jsdoc-tag-gates` | `46df230345ccdb2a7afe13cd5ac907d5b1adfd2ba9d49d6f1286dc99582f06ec` | `design-refresh-2026-09-09-r28-docgen-files-impact.md` |
| `r3-tooling-files-normalize-image-gates` | `c5718bc1a8c6970ca8bd433ed6027839c66f990f0c8b0f84881e3236f7d6d753` | `design-refresh-2026-09-09-r28-docgen-files-impact.md` |

The prior docgen/files impact audit already resolves the removed caption
local, JSDoc functions and image predicates and refreshes affected output
models. The prior quality/scheduler audit resolves two internal callable seeds
and its own operation rows. This audit does not rerun those changes or claim
its findings as new. The finalized support/policy artifact remains exactly
`3a33a5bb246d68eacf893bf999ead41b0023853a87756df35aaa4f7e2898356e`.

## Provisional designs and staged review

- `data/provisional-r28-cli-internal-root-tmpfs-discovered-classified-skip.md` — SHA-256 `0903cb070e291370efc2f5533dc33fd60f3c4c439b79d670136782ce366c9071`.
- `data/provisional-r28-cli-commands-d-k-docgen-quality-worker-eval-source.md` — SHA-256 `3296388e84e95970e3c050ad62574eb6024210377aa67a7ae77d8eeac97d7864`.
- `data/provisional-r28-cli-commands-d-k-docgen-quality-worker-runpod-eval-source.md` — SHA-256 `9b39c4a592aca5827e61b0fbb11e60b551798d7fac315853f5505561aa7fb204`.

All three have the eight required sections, complete owned payload and
consumer/export/codec maps, concrete deletion accounting and implementation
verification plans. Tmpfs26/6 and the two actual post-validation Docgen owners
need the parent's bounded independent correction. The two Docgen migrations
share a schema/resolver and must stage one owner at a time; source helper
extraction must preserve the existing raw public API without aliases or copied
analysis implementations. No command-only withdrawn design is silently applied.

## Remaining limits and verification

This audit is not an exhaustive re-adjudication of every unchanged qualified
seed. It disproves the footers' blanket unchanged-seed assertion with exact
counterexamples; the independent correction must acknowledge that scope.
For example, `create-package-command-flags` still anchors a Command descriptor
owner. Its five-member potential request migration was not independently traced
here; parent should not count its old D note as proof of an actual five-member
runtime object. No proposed withdrawal or new Q is inferred for that untraced
whole-command owner. Other earlier reviewed/designed records retain their
existing packet evidence until separately adjudicated.

Scoped validation used JSON parsing, required inventory/v1 field checks,
positive legal<representable checks, exact line bounds, unique proposed IDs,
and a whole-current-canonical `(file,symbol,sorted members)` duplicate check
after simulated replacement/withdrawal in memory. No duplicates were found.
The raw reports' own validators returned0; no package/product command, test,
service, network provider or git mutation ran. Read-only git confirmed the
source pins. Required implementation tests are plans, not executed acceptance.

## Source and supporting artifact SHA-256

Hashes below identify the exact files supporting the audit. Canonical row
files, evidence dependencies, exported test kits and codec consumers are
included. Package tests were read as consumer/compatibility evidence, not
scanned as candidate owners. Effect reference source is an external SDK
contract, not a census root.

| Path | SHA-256 |
| --- | --- |
| `.repos/effect/packages/effect/src/FileSystem.ts` | `b9e289a8a0d18d04879d0fb507c2ad342aaaf8b9b01cff0cd0acae9cd23fba17` |
| `.repos/effect/packages/effect/src/Schema.ts` | `0f0daf6b6ec3b6c827083d8b76278a4f52fe48a636dfff031ddf18e6c93f82ad` |
| `goals/boolean-creep/data/design-refresh-2026-09-09-r27-yeet-request-boundary.md` | `d28504b5a5ac43175e3b1cd6ad687eed662334c13a32e78d39204bf36b4c6a47` |
| `goals/boolean-creep/data/design-refresh-2026-09-09-r28-docgen-files-impact.md` | `49d0d230d4124f87e09c4abe01ba2ab808e665dd8a41565241548bc2f1023d00` |
| `goals/boolean-creep/data/design-refresh-2026-09-09-r28-quality-scheduler-impact.md` | `5424d8dc0e0fe0f2e4f37f97cd71cf768f7c2bdb6e49e4c2d04c68bf6a2df9f9` |
| `goals/boolean-creep/data/design-refresh-2026-09-09-r28-tooling-callable-withdrawals.md` | `9fb8111f9739aee23d2d663607d6febb27ec188726c97824a9a3faf72c06b840` |
| `packages/tooling/tool/cli/package.json` | `afcc48072032175baf36b3a7ea79950d274f1bea5e14aba48c4ff60cba7c9d0c` |
| `packages/tooling/tool/cli/src/bin-main.ts` | `a8eba686bcfd61b0f2617152d8542f75f8a1de39fd9e3ce7c3d90524aa76180e` |
| `packages/tooling/tool/cli/src/commands/AIMetrics/internal/Programs.ts` | `5e41922eb1a4052fd130d94cac61ac37c0af6eb4ae7650c04ac56ca9fc480803` |
| `packages/tooling/tool/cli/src/commands/AgentEffectiveness/AgentEffectiveness.command.ts` | `eca53b5cb4bb822b55b812cb6e2aee95732929e6c0f2ee7bf77c297bbe654ad6` |
| `packages/tooling/tool/cli/src/commands/AgentEffectiveness/internal/EvalLawLanes.ts` | `dc79aeea1ef3e1fb7c7d43c540de96dc979017fc9265d14a4713f4cd8b9945e3` |
| `packages/tooling/tool/cli/src/commands/Architecture/internal/TemplateRetarget.ts` | `3058aaa79ff97029a95b54bc121741e980fa71ca067afde73f90ca0595d81a91` |
| `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` | `b05d95d1317b88a2ea485f7f98cc8a383c2485148bbe42607b96b4c8f574e976` |
| `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts` | `5c77ed0cb392f19102ae94403db84fa5590d4e399d178741588c5f6a7e3ed5c5` |
| `packages/tooling/tool/cli/src/commands/Codegen/Codegen.command.ts` | `d8cffab21c19e0cf5706937d24fa3017f7b5cc8e4a0768308cddec2cb649d7e9` |
| `packages/tooling/tool/cli/src/commands/Corpus/internal/Preservation.ts` | `8c78543665cd84df4e87fcb809a68766e19b020c40a48180541f042e2202c553` |
| `packages/tooling/tool/cli/src/commands/Corpus/internal/Restoration.ts` | `cf86f38338f03f83a68323c5817e9f5bbd916bf98179330ee6d5995648d990d7` |
| `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts` | `b85eae4f34058bf7c069027fa4dff435cabb7dbddd253b7b8643a06c63273ee4` |
| `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts` | `8b3108c7db97b1817f9f1504fc1e8d34ce3c72219b18c456e609920bb4203b75` |
| `packages/tooling/tool/cli/src/commands/CreatePackage/FileGenerationPlanService.ts` | `7ce3ce7ba6dc2dc699665cfeecb058ffa07da3cfc19552a1b97e39ebef36d6a7` |
| `packages/tooling/tool/cli/src/commands/DeletePackage/DeletePackage.command.ts` | `9532c4fac44c6a9330563a537d71e1b6753e9f2738ff1f80bb90275e62e18d54` |
| `packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts` | `47fd492d490230d0413af2c6e7be0a30641dafa973d0b8e2d3a93c42fd3e0753` |
| `packages/tooling/tool/cli/src/commands/Docgen/index.ts` | `8ba4aa861584832db1d2273d6f9c93f85ca2b02b8cbc28a0f2ea33a40d85a02f` |
| `packages/tooling/tool/cli/src/commands/Docgen/internal/Doctest.ts` | `1435210b5d57a6a2414369e36ed784bcb906e4a332a990bd5a2448f3de306911` |
| `packages/tooling/tool/cli/src/commands/Docgen/internal/Local.ts` | `e50cf7d481eb39fa48fa98d52e107e6d732602e66110ee5a54747d3969c9f5e2` |
| `packages/tooling/tool/cli/src/commands/Docgen/internal/QualityWorkerEval.ts` | `4614d9f3603d0e3e0575c63f33f9a2688525acbdaf74593e22b923c41f954b06` |
| `packages/tooling/tool/cli/src/commands/Docgen/internal/QualityWorkerRunpodEval.ts` | `febfc733b28082b43daef844c73d1ea2dac75627f7ce5b368c803573889b5d26` |
| `packages/tooling/tool/cli/src/commands/Docgen/internal/Targets.ts` | `865708cb04238a53da299299217a45baff39cc622ca72b21420c3c13b8f56eb1` |
| `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.scope.ts` | `d7eeed37b99368b54768247362602fc33107f97a296b44bf714e8076ee4bdd58` |
| `packages/tooling/tool/cli/src/commands/Explore/Atlas.ts` | `99a8d6804f94bfa864f8db6fa499892db6ae5d68866ae1e4e06bb191b9e03292` |
| `packages/tooling/tool/cli/src/commands/Fallow/Fallow.command.ts` | `ca50d625d9edb1ee468fafd990f3e92f46360dea170094fd33027118a543adb7` |
| `packages/tooling/tool/cli/src/commands/Files/Files.media.ts` | `5d972fb1609c98caae085c756a07a88dbdd21b081a7109ee695dd613b8c9f0f8` |
| `packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.model-store.ts` | `c34bed23f851cce7de32e7dfda16e203dd5d5c734a0590e9124955bafc4b20f9` |
| `packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.schemas.ts` | `2fd505c8179cbf84c77819d027290157e573d3e74ebaff069211799b11c02059` |
| `packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.ts` | `f75ed5f362a6049b7ba6cfc492d9b966dd00d4b6004419e611ae6d3781f28da7` |
| `packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.worker-service.ts` | `856690578d3906c5709c5447b83d1a7cc64d76aed6a903faa70742af6fa9e91d` |
| `packages/tooling/tool/cli/src/commands/Files/internal/MediaExec.ts` | `18afaeedf9d95b78b44a472183419fae8282bcc2643efdf2114aaebfa920830c` |
| `packages/tooling/tool/cli/src/commands/Goals/Adopt.ts` | `4d81c15d3b0370e86ebbe0bbab1431798a7e48b08bbaa094ce6b2d786bb1948c` |
| `packages/tooling/tool/cli/src/commands/Goals/Bootstrap.ts` | `5482fe1b9e48a8e63bca8d65cb8100687f754ebb935ead58ce7e0ed27b433991` |
| `packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts` | `12db9f67d2b2dc48860ef1ec1f85541b9315e935e768725ce20f0ac502a77548` |
| `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.command-surface.ts` | `dc01c701ab90a060feddd4585f6f09c65de698940df2d53a652fe4df1ac262a4` |
| `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.command.ts` | `fc3e53239fb6f856250f896d0ac6529a93f963c28c04c7a1165d31443e26e3e1` |
| `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts` | `01a35087a2ca1b09062096e5614c974f1f28b073c33912d98242619358ce929c` |
| `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts` | `f8ad808e75b04944f5192188642dfca5cdbe971e585742c7ebd85f3fa2138332` |
| `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts` | `16fe731bf9d23d882c229d2bd1004d3352fbee461513944d6b60effb7dddd081` |
| `packages/tooling/tool/cli/src/commands/Yeet/internal/Sweep.ts` | `6ca599a6b7334fb956e4b0b089e5364a062e4bb9281d6295a422e5257173488e` |
| `packages/tooling/tool/cli/src/internal/cli/Labs/LabsWorkspace.ts` | `17b92ba8b2db3b3da580a40eb24155d5fc357a5c731bf0a7f903a14a6b4b3003` |
| `packages/tooling/tool/cli/src/internal/cli/RegistrationGeometry/RegistrationGeometry.probes.ts` | `7d118605464a37620fe0fa59bc53f508b480a93566ce92720b17073845904ce5` |
| `packages/tooling/tool/cli/src/internal/cli/TurboCache.ts` | `860e455bcd130e8325f3499085313da11732500836cf2272cb129331bdcccacc` |
| `packages/tooling/tool/cli/src/internal/github/JobShape.ts` | `047736c71681b7b33b87c49b4223367d7592f30a39d21aab565dbe0ae6452e05` |
| `packages/tooling/tool/cli/src/internal/process/StepExec.ts` | `cd587a632e7e21fd1e913caaf78619ab8cca8be2ef9a86a514d252354dc1ffad` |
| `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts` | `7c3fd36bcf64ba5ea8f2ab472a8d137911333737326370a2345f55313ab8c429` |
| `packages/tooling/tool/cli/src/internal/repo-run/AttemptTerminationJournal.ts` | `95ab5de3fb233bcb338ec41aad512b5ba2fae3725e9b4720aba9b8680c82e28d` |
| `packages/tooling/tool/cli/src/internal/repo-run/ResidueReap.ts` | `693383ab275abc92beb8c676a6fbf674cf33b70c25c28715367628f45c0c8a7f` |
| `packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.schemas.ts` | `bad39e4279d1f1b9c0f6773a7645bd5b3fb31654209e312a4116066b7ea15b08` |
| `packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts` | `2a0253141d3ebdadfbe6b8d715012b83cb75c36876ec50969e330e2f03a5da01` |
| `packages/tooling/tool/cli/src/internal/repo-run/index.ts` | `8700650d67f60eeebdbc9830b1f47c415fcd80d26b2d51e0c6d0b4314079934a` |
| `packages/tooling/tool/cli/src/test/Docgen.test-kit.ts` | `8c50a91eaac0d201ea4f8220766c6c3ed7e52d07dfb7b63d04451394799217de` |
| `packages/tooling/tool/cli/src/test/RepoRun.test-kit.ts` | `88affd301f15a26a60bc1aa7d9fc6bb6a43dab0fcfb35a437ab6d28a6e5f5f8f` |
| `packages/tooling/tool/cli/test/docgen.test.ts` | `afd71f787eb90c06ff20d6dded18dd72bd11acde300474b2d9298ed4ec7f52a0` |
| `packages/tooling/tool/cli/test/quality-tmpfs-render.test.ts` | `670c08e3ea32a7b17651e72422a4bf6c8eed1b77dab64e3588e58a6a29b19219` |
| `packages/tooling/tool/cli/test/tmpfs-reap.test.ts` | `ab3db06585ab6baab7d17e42b3f5a705edb089d7a555111304eb17910ddbaece` |

Graft retrieval estimate: ~943,041 tokens saved across13 savings-bearing calls; one additional exact trace lookup lacked the helper node, so exhaustive source search supplied its consumers. This estimate describes retrieval size, not verification strength.
