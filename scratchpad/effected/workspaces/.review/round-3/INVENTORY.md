# Workspaces — round-3 merged inventory

Read **12 seat reports**: `part-1`–`part-4`, each with `grok.md`, `sol.md` and `fable.md`, plus all four adjacent `BRIEF.md` files and all four `BRIEF.grok3.md` fallback briefs. Fable filenames retain the independent Grok medium fallback provenance. Seat ids below include the part because numbering restarts.

**Required: 11 · Backlog: 1 · Codemod: 0 · Rejected: 1 · Groups: 7.** All 24 submitted finding records are accounted for once after deduplication. The Unicode member/exemption cases share one raw-identifier boundary defect (r04); all omitted generated codec floors share one S3 backlog item (b01). Each contributing seat finding remains named.

Binding basis: the complete operator revision block (including the later grilling), D1–D20, sections 12.4/12.5 and 14, and the current merge instructions. Reports reviewed `c3fc60bdbfd5574dc69623d132dced0a552a586a` against pinned oracle `af7566a9da2eff169cb74955efcc5ede1e5de9f8`. This checkout is `@lab/effected-2`, HEAD `308cf4850d315a047e096708b8ed3644cb73eb6c`; workspaces source/tests have no tracked differences from the reviewed commit. The request's S2/S3 deferral overrides the briefs' claim that those gates have run. No compiler, audit, vitest, coverage, session, Yeet or closeout command was run in this merge.

Live `standards/effect-laws.allowlist.jsonc` contains **zero** entries for `scratchpad/effected/workspaces/**`, so there are no `allow-<n>` findings to synthesize. History confirms the removal in `a955556fb3` (effected-port laws). The removed historical allowances are not live entries and are not reopened. File history includes `fef6838fd8` / `2ac543dbcf` / `03bf79d41b` (step 2), `e9cdd3ec83` (laws) and `1baf00a8fd` (S1); the inspected laws diff explicitly forces tagged sync errors and Effect collections. No submitted finding establishes an unforced divergence, and no restore is assigned for a law/diagnostic-forced transformation.

`required.json` assigns every required finding exactly once. Every source and regression-test file has one owner; the largest group has three source files. Only the module source/test surfaces are assigned. Ledger, README Port notes, added-export bookkeeping and any eventual repo-level configuration remain centrally owned. New bug/law evidence requested below is a handoff to central bookkeeping, not another file assignment.

## Required

### r01 — Use collision-free keys for duplicate-instance provenance.

- file: scratchpad/effected/workspaces/DuplicateCheck.ts:404
- class: bug   severity: required
- standard: D9/D11; section 14, verified upstream-bug; DuplicateInstance.dependents completeness.
- evidence: part-1/sol-3-1 reports a decoded Lockfile and a pinned-oracle/lab probe: holders {name: "x\u0000y", version: "z"} and {name: "x", version: "y\u0000z"} both render as "package\u0000x\u0000y\u0000z". Expected two dependents, observed one; a non-colliding control yields two. Current record() concatenates targetId and renderKey with another NUL, leaving a second collision boundary. Green execution gates missed this schema-valid case.
- failure: Distinct package relationships collapse into one dependent, losing duplicate-instance provenance.
- fix: Encode the entire [targetId, dependent] pair unambiguously with a schema-backed JSON tuple codec instead of delimiter concatenation. Preserve first-occurrence order and identical-relationship deduplication. Add embedded-NUL collision and non-collision controls in DuplicateCheck.test.ts. Supply verified upstream-bug evidence to central bookkeeping; do not edit ledger or Port notes.
- seats: part-1/sol-3-1
- group: g1

### r02 — Annotate the reusable required-edge check.

- file: scratchpad/effected/workspaces/LayerPolicy.ts:136
- class: schema   severity: required
- standard: D5/D11; standards/effect-laws-v1.md law 18; standards/effect-first-development.md EF-12c.
- evidence: S.isPattern(REQUIRED_EDGE) has no check metadata. The seat inspected LayerPolicy.fields.requiredEdges.ast.rest[0].checks[0].annotations and found only expected, representation and arbitraryConstraint, with no identifier/title/description. The enclosing annotateKey does not annotate the check. The neighboring glob constraint is already annotated; prior review did not cover this check. This is explicit evidence of a gate miss.
- failure: The reusable exported policy constraint lacks canonical check identity and descriptive metadata.
- fix: Pass a distinct $I-derived identifier, title and description directly to S.isPattern. Preserve REQUIRED_EDGE and validation behavior. Add a targeted metadata assertion in LayerPolicy.test.ts. No hand-written deviation entry.
- seats: part-1/sol-3-2
- group: g2

### r03 — Give the graph index payload a schema owner.

- file: scratchpad/effected/workspaces/DependencyGraph.ts:72
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-12b/EF-33; standards/ARCHITECTURE.md Core Principle 5.
- evidence: Edges is still an erased interface with order, forward and reverse. It is constructed by #index()/sortSubset() and shared by materialize(), cycleMembers() and kahn(), so it is named reusable data, not an operation contract. The seat derived S.Struct({order: S.Array(S.String), forward: S.HashMap(S.String, S.HashSet(S.String)), reverse: S.HashMap(S.String, S.HashSet(S.String))}) over its current representation. Prior native-collection repair did not supply a schema owner; the green gates do not enforce this internal model.
- failure: The shared graph data definition cannot supply derived guards, codecs, equivalence or canonical annotations.
- fix: Define a module-local identity-annotated Edges structural schema and derive the existing type from .Type. Retain plain objects, immutable Effect collections, explicit vertex order and construction timing; do not introduce runtime rejection or an unnecessary export. Retain graph behavior tests and add a representation/ordering control in DependencyGraph.test.ts.
- seats: part-1/sol-3-3
- group: g3

### r04 — Recognize complete Unicode identifiers in boundary rules and exemptions.

- file: scratchpad/effected/workspaces/SourceBoundary.ts:346; scratchpad/effected/workspaces/SourceBoundary.ts:362; scratchpad/effected/workspaces/SourceBoundary.ts:387; scratchpad/effected/workspaces/SourceBoundary.ts:400
- class: bug   severity: required
- standard: D9/D11; section 14, verified upstream-bug; console-stdout/stdout-write contracts; ReferenceOptions.ignoreTokens exact-token contract.
- evidence: The shared defect is using raw identifier characters/literal regex text at boundaries where Unicode escapes belong to the same cooked identifier. Pinned-oracle/lab probes show console.error\u0058(x) is wrongly spared while console.\u0065rror(x) is wrongly flagged; stdout.wr\u0069te(x) is missed while stdout.write\u0058(x) is wrongly flagged; process.env.__PACKAGE_VERSION__\u0058 is wrongly exempted, whereas the equivalent unescaped suffix is flagged. Fable corroborates escaped console members and escaped stdout receivers/members, including end with a chunk. JavaScript probes confirm the actual cooked property names. Round-2 r23 repaired receiver matching, not these member and exemption boundaries. Custom ignore tokens have the same suffix defect. Existing green gates did not exercise these forms.
- failure: Valid escaped identifiers bypass forbidden stdout/process checks or trigger false console/stdout offences; exact exemptions admit longer runtime property names.
- fix: Read complete raw identifier tokens and reuse Unicode cooking for console members and stdout receiver/write/end members. Make processReads and tokenOccurrences exemption end guards recognize escaped identifier continuations. Preserve raw UTF-16 offsets, optional/member access, receiver/private-name/comment controls and exact ignore-token semantics; retain the existing final-chunk rule. Add escaped permitted console methods, escaped longer names, escaped stdout receivers/members and default/custom exemption suffix regressions in SourceBoundary.test.ts, with identifier helper controls in sourceText.test.ts if needed. Any shared lexer helper/export belongs to the same owning group. Supply upstream-bug evidence centrally.
- seats: part-2/sol-3-1, part-2/fable-3-1, part-2/sol-3-2, part-2/fable-3-2, part-2/sol-3-3
- group: g4

### r05 — Detect optional stdout.end calls that pass a chunk.

- file: scratchpad/effected/workspaces/SourceBoundary.ts:349
- class: bug   severity: required
- standard: D9/D11; section 14, verified upstream-bug; stdout-write final-chunk contract.
- evidence: part-2/sol-3-4 probes both lab and oracle: stdout.end?.(x) returns no offence although stdout.end(x) is flagged; stdout.end?.() remains correctly clean. Injected JavaScript execution confirms the optional call receives the chunk. END_WITH_CHUNK requires a parenthesis immediately after whitespace, excluding valid optional-call punctuation. This defect is independent of Unicode token cooking in r04.
- failure: A valid optional final-chunk write bypasses the stdout boundary rule.
- fix: Accept optional-call ?. before the argument parenthesis in the final-chunk check. Add chunk-bearing and empty optional-call controls in SourceBoundary.test.ts; preserve existing write/end distinctions and locations. Supply verified upstream-bug evidence centrally.
- seats: part-2/sol-3-4
- group: g4

### r06 — Require a file for the pnpm workspace marker.

- file: scratchpad/effected/workspaces/WorkspaceRoot.ts:202
- class: bug   severity: required
- standard: D9/D11; section 14, verified upstream-bug; WorkspaceRoot marker-file and ancestor-ascent contract.
- evidence: The lab and pinned oracle both select /repo/packages/a when pnpm-workspace.yaml is a directory made by /repo/packages/a/pnpm-workspace.yaml/child, hiding a valid /repo/package.json workspace. An ordinary-directory control ascends to /repo; a genuine marker file selects /repo/packages/a. Current fs.exists treats both directories and files as markers. Green tests omitted the directory-marker case.
- failure: A directory with the marker filename terminates ascent at the wrong workspace root.
- fix: Use fs.stat for the pnpm marker and require type === "File". Absorb per-probe errors as before and continue to the package.json check when the marker is a directory. Add directory-marker, real-file and ancestor controls in WorkspaceRoot.test.ts. Supply verified upstream-bug evidence centrally.
- seats: part-3/sol-3-1
- group: g5

### r07 — Reject traversal segments in config-dependency versions before resolving paths.

- file: scratchpad/effected/workspaces/internal/configDependencyResolution.ts:150; scratchpad/effected/workspaces/internal/configDependencyResolution.ts:324
- class: bug   severity: required
- standard: D9/D11; section 14, upstream-bug with path-normalization evidence; ConfigDependencyHooks traversal refusal contract.
- evidence: declaredEntries checks hasTraversalSegment(entry.name) only. findInStores joins store/links/name/declared with unchecked version text; a version ../../../../../../outside normalizes outside the store and entriesOf reads that directory. A matching package manifest can then be replayed. The pinned oracle has the same name-only check and join. Existing integration coverage at ConfigDependencyHooks.int.test.ts:241 pins refusal of .. segments before path construction, but not version segments; a single segment such as 1.0.0-beta..1 is unaffected.
- failure: A config-dependency version containing a parent-traversal segment can resolve and import code outside the pnpm store.
- fix: Validate hasTraversalSegment(entry.version) in declaredEntries before either resolver constructs paths, failing through the existing typed CatalogAssemblyError path. Add resolvePnpmfiles({pkg: "../../outside"}) refusal with no directory read or fetch and a valid single-segment version control; keep name validation. Tests belong to internal/configDependencyResolution.coverage.test.ts and integration/ConfigDependencyHooks.int.test.ts. Supply verified upstream-bug evidence centrally.
- seats: part-4/grok-3-1
- group: g6

### r08 — Preserve own __proto__ registry scopes.

- file: scratchpad/effected/workspaces/internal/configDependencyFetch.ts:331
- class: bug   severity: required
- standard: D9/D11; section 14, verified upstream-bug; Effect Record.assignProperty own-key semantics.
- evidence: Yaml.parse preserves own __proto__ keys via R.assignProperty, and R.toEntries lists them. registrySettingsOf assigns registries[scope] = url into {}, invoking the inherited __proto__ setter and dropping a string URL. Both seats identify the same assignment; Fable also identifies the self-comparison property that misses it. The pinned oracle repeats the assignment. Round-2 r15 repaired environment scrubbing, not registrySettingsOf. The native-runtime gate does not detect ordinary assignment.
- failure: A declared registry scope disappears, and scratchWorkspaceYaml installs that scope from the default registry.
- fix: Use R.assignProperty(registries, scope, url). Add an own __proto__ scope plus a normal-scope control through registrySettingsOf and scratchWorkspaceYaml in internal/configDependencyFetch.coverage.test.ts. Preserve tolerant input handling and scope order. This file shares ownership with r11. Supply verified upstream-bug evidence centrally.
- seats: part-4/grok-3-2, part-4/fable-3-4
- group: g7

### r09 — Classify division after spaced or repeated non-null assertions.

- file: scratchpad/effected/workspaces/internal/sourceText.ts:290
- class: bug   severity: required
- standard: D9/D11; section 14, verified upstream-bug; lexer non-null-assertion division rule.
- evidence: A pinned-oracle/lab probe finds process in const y = x! / 2; process.cwd(); const z = 1 / 4;, but misses it with x ! / 2 or a comment before !. TypeScript transpilation confirms equivalent division semantics. regexAllowed calls endsOperand(j - 1), which sees whitespace/comment padding rather than the operand; a second postfix ! has the same problem. Existing sourceText.test.ts only pins an adjacent assertion.
- failure: Whitespace, comments or repeated postfix assertions make division look like a regex, blanking executable forbidden references.
- fix: Walk backward over postfix ! tokens using lastCode to inspect the preceding significant operand. Preserve prefix logical negation and genuine-regex handling. Add spaced, commented and repeated assertion regressions plus division/regex controls in sourceText.test.ts and a public SourceBoundary.check regression in SourceBoundary.test.ts. Retain raw offsets and the adjacent-assertion pin; supply upstream-bug evidence centrally.
- seats: part-4/sol-3-1, part-4/fable-3-1
- group: g4

### r10 — Exclude global-object spellings nested under local receivers.

- file: scratchpad/effected/workspaces/internal/sourceText.ts:539
- class: bug   severity: required
- standard: D9/D11; section 14, verified upstream-bug; references excludes unrelated object members and includes global-object members.
- evidence: The lab public SourceBoundary.check and oracle reference functions flag child.globalThis.process and child.window.process even for an explicitly constructed local child object. references() cooks the immediately preceding receiver and tests GLOBAL_OBJECTS without determining whether that receiver itself belongs to another object. A free globalThis.process is the existing positive pin. Both seats identify this distinct missing receiver-origin check.
- failure: Ordinary local properties named globalThis/window/global/self produce false forbidden-global offences.
- fix: Require the recognized receiver to be a free global-object reference or a verified global-object chain; reject unrelated member and optional-member receivers, retaining the spread exception. Preserve cooked identifiers, optional chaining and original offsets. Add local nested-object controls and genuine globalThis.process/global-object-chain controls in sourceText.test.ts and SourceBoundary.test.ts. Supply verified upstream-bug evidence centrally.
- seats: part-4/sol-3-2, part-4/fable-3-2
- group: g4

### r11 — Use Schema JSON codecs in the remaining synchronous boundaries.

- file: scratchpad/effected/workspaces/WorkspacesSync.ts:392,420; scratchpad/effected/workspaces/internal/packedInstallPlan.ts:215,281,380,429; scratchpad/effected/workspaces/internal/configDependencyFetch.ts:364–399
- class: effect-idiom   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-3/EF-19 and checklist item 16; schema-first boundary-codec rule.
- evidence: Both seats identify direct JSON.parse/JSON.stringify calls in the same three synchronous source files. EF-19 explicitly requires Schema JSON codecs and allows non-throwing Result/Option forms for deliberate synchronous helpers. The prefer_schema_over_json checker only examines Effect contexts (reference rule lines 14–17,50–64); the schema-first detector is advisory, explaining the green-gate miss. Round-1 r40 repaired WorkspaceSnapshots.parseJsonObject, not these sites. These calls are actual remaining law violations, not a request merely to record a forced change.
- failure: Manifest parsing and generated consumer/configuration documents still bypass Schema JSON boundaries and maintain hand-written native parse/serialize exception paths.
- fix: Use S.fromJsonString with Result/Option decode/encode codecs for these deliberate synchronous helpers, including a string JSON codec for YAML quoting and an appropriate document codec for consumer package.json. Preserve skip behavior, read/invalidJson/invalidShape classification, tolerant shape handling, formatting and trailing newlines (including packedInstallPlan.ts:281). Add/adjust assertions in WorkspacesSync.test.ts, WorkspacesSync.coverage.test.ts, PackedInstallPlan.test.ts, internal/packedInstallPlan.coverage.test.ts and internal/configDependencyFetch.coverage.test.ts. Supply law-forced SyntaxError-to-SchemaError cause changes and adjusted oracle assertions to central per-class bookkeeping; do not edit ledger/Port notes.
- seats: part-4/sol-3-3, part-4/fable-3-5
- group: g7

## Backlog

### b01 — Complete the generated codec floor for the omitted exported schemas during S3.

- file: scratchpad/effected/workspaces/WorkspaceDiscovery.ts:259; scratchpad/effected/workspaces/WorkspacePackage.ts:108; scratchpad/effected/workspaces/Workspaces.ts:62,124; scratchpad/effected/workspaces/WorkspacesSync.ts:174; scratchpad/test/workspaces/WorkspacesSync.property.test.ts:31
- class: test   severity: backlog
- standard: D10; section 11.4; current merge instruction postpones coverage and vitest-canon work because S2/S3 have not run.
- evidence: The seats identify one systemic missing generated encode/decode floor. Owning property suites omit WorkspaceDiscoveryOptions and DependencyDiff, plus SyncDirectoryEntry, WorkspaceDiscoverySkipKind, WorkspaceDiscoverySkip, WorkspacesOptions, WorkspacesGitOptions, CatalogMisconfiguration, FetchFailureReason, FetchFailure, RegistrySettings, ConfigDependencySpecParts, EnumeratedDirectory, EnumerationFailure, EnumerateOptions, LayerRootOptions, ConsumerInput, PackedManifest, PatternReadFailure, ImporterRoots, TraversalFrame and TraversalStop. Sol reports unsupported Declaration errors at WorkspaceDiscoveryOptions/EnumerateOptions.maxDepth and TraversalFrame.depth; example fixtures and a stand-in struct do not prove the owning codecs. The broader Fable list includes the two composite Workspaces options omitted by Sol. This merges all four floor records while preserving their distinct schema sites.
- failure: These 22 exported schemas lack their prescribed generated round-trip properties; three owning codecs need depth-generation metadata before Arbitrary.schema can derive. Reclassified to backlog: S3 coverage/property/vitest-canon work has not run under the binding task instruction.
- fix: During S3, register every listed owning schema with the existing roundTrips/it.effect.prop helpers, Arbitrary.schema(schema), fcRuns, equivalence, successful decoding and stable re-encoding. Supply generator-only toCodecArbitrary metadata for declaration depths without changing numeric acceptance or lazy defaults. Keep omitted-key, present-undefined stopAt and non-finite-depth controls; retain all behavioral properties and example regressions. Do not assign these source/test edits to the required fix wave.
- seats: part-3/sol-3-2, part-3/sol-3-3, part-4/sol-3-4, part-4/fable-3-6

## Handled by the deviation codemod

None. No seat submitted a bookkeeping-only request to record an identity-key, S.Finite, tagged-error, added-export or native-runtime change. References to central recording in actual fixes do not create separate findings or write surfaces.

## Rejected

### x01 — Reject the escaped-return keyword premise.

- file: scratchpad/effected/workspaces/internal/sourceText.ts:247
- class: bug   severity: rejected
- standard: D11 evidence requirement; section 14 verified-upstream-bug requirement; ECMAScript keyword lexical validity.
- evidence: part-4/fable-3-3 claims retur\u006e /process.cwd()/ is executable return syntax and proposes cooking wordAt. A fresh read-only Node new Function syntax probe over function f(){retur\u006e /process.cwd()/;} throws SyntaxError: Keyword must not contain escaped characters; the unescaped return control compiles. Thus the cited example does not establish a valid-code false positive.
- failure: Alleged failure: the scanner reports process inside a regex following an escaped return. The proposed program is syntactically invalid, so that claimed executable-code regression is unsupported.
- fix: No required change. Reject: the evidence rests on an invalid escaped keyword, so it does not verify an upstream bug; reconsider only with a valid executable contextual-keyword example and a concrete demonstrated failure.
- seats: part-4/fable-3-3

