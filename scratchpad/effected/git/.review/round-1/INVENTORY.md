# git — round-1 merged inventory

Read all six seat reports and both adjacent briefs: `part-1/{grok,sol,fable}.md` and `part-2/{grok,sol,fable}.md`; briefs pin review commit `3fa5876691901fccf3d1cd29e9324564df134b56` and upstream oracle `af7566a9da2eff169cb74955efcc5ede1e5de9f8`. Part-2 Grok reports no findings. Seat ids below include the part because ids repeat between reports.

Counts after deduplication/classification: **Required 20 · Backlog 11 · Handled by the deviation codemod 5 · Rejected 1 · Groups 2**. The source reports contain 43 findings; merged records may split a systemic bookkeeping report or a local/repo-level request. All contributing finding ids are retained.

Binding order: the full operator revision/rulings and later grilling override older stage wording; D1–D20, §§12.4–12.5 and §14 apply. S2/S3 work remains backlog. Bookkeeping is central: no repair group owns PORT_LEDGER.json, README Port notes, root manifests, locks, configuration or shared runner files. Verified Git/oracle failures justify upstream-bug fixes; their evidence/test sites must reach central deviation bookkeeping before behavior edits. Reported probes are seat evidence, not new executions claimed by this merge.

`standards/effect-laws.allowlist.jsonc` has **zero entries for `scratchpad/effected/git/**`**, so there are no `allow-<n>` records. The later removal ruling has no additional git site to assign.

`required.json` owns two non-overlapping surfaces: **g1** owns Git.ts, GitCommand.ts, index.ts, internal/run.ts and the Git.ts-E deletion (5 source/artifact files), plus Git/GitLog/GitCommand/run tests; **g2** owns GitConfig.ts, Gitmodules.ts and internal/config.ts (3 source files), plus GitConfig/Gitmodules tests. Cross-file fixes share their owning group; no source or test file occurs twice. Existing tests outside these surfaces can be run read-only, but are not assigned for edits.

## Required

### git-r1
- file: scratchpad/effected/git/Git.ts:3304
- class: bug   severity: required
- standard: D9, D11; §14 upstream-bug.
- evidence: part-1 Sol's read-only Git probe returned '\0one\0\0' for values ['', 'one', '']; both port and pinned oracle returned ['one']. Git.test.ts:2775 covers only nonempty values and unset keys.
- failure: configGetAll drops explicit empty values and loses their positions.
- fix: Use a configGetAll-specific NUL parser that removes only the final terminator token, preserving empty values and order. Keep silent exit-1 handling for an unset key; add single-empty and mixed-empty regressions in Git.test.ts. Supply the verified upstream-bug evidence and adjusted test sites to central deviation bookkeeping.
- seats: part-1/sol:sol-1-1

### git-r2
- file: scratchpad/effected/git/Git.ts:787
- class: bug   severity: required
- standard: D9, D11; §14 upstream-bug; CommitLogEntry.paths raw-path contract.
- evidence: Sol's scripted-spawner probe with pathname 'left\x1eright.txt' failed in both port and pinned oracle with 'a log record carried fewer fields than the format declares'; the record otherwise matched GitLog.test.ts's five-field/NUL layout.
- failure: Splitting whole log output on the record-separator byte corrupts valid pathnames.
- fix: Change GitCommand.log framing and the Git.ts parser together to use an unambiguous NUL-framed commit boundary and positional header/path parsing. Preserve record-separator bytes inside paths; extend GitCommand.test.ts and GitLog.test.ts with framing and pathname-fidelity regressions. Supply upstream-bug evidence to central bookkeeping.
- seats: part-1/sol:sol-1-2

### git-r3
- file: scratchpad/effected/git/Git.ts:434
- class: schema   severity: required
- standard: D5, D11; standards/effect-first-development.md EF-12b; Effect laws 19–20.
- evidence: Classified at :435–444 is a handwritten nine-case domain payload union, reused by classify and service matches; ClassifyKind at :455 is another named literal union. Green compiler/lint gates do not enforce schema-first construction of these domains.
- failure: Central classification shapes and vocabulary have no schema-derived contracts or guards.
- fix: Define an identity-annotated module-local S.TaggedUnion preserving all Classified tags/payloads and an annotated LiteralKit for ClassifyKind; derive their types. Preserve classification precedence and results, retaining existing service regressions.
- seats: part-1/sol:sol-1-3

### git-r4
- file: scratchpad/effected/git/Git.ts:826
- class: schema   severity: required
- standard: D5, D11; Effect law 19; EF-12b.
- evidence: porcelainCode is a named S.Literals schema reused by StatusEntry.x/:851 and .y/:853. Sol identifies why schemaUnionOfLiterals does not check LiteralKit adoption; Fable independently confirms the same site.
- failure: A named, reused finite domain bypasses the required LiteralKit and identity metadata.
- fix: Replace porcelainCode with an annotated module-local LiteralKit containing exactly the same ten codes and retain both field references. Preserve accepted values and upstream tests; any incidental added public export is central exportsAdded bookkeeping.
- seats: part-1/sol:sol-1-4; part-1/fable:fable-1-2

### git-r5
- file: scratchpad/effected/git/Git.ts:412
- class: schema   severity: required
- standard: D5, D11; Effect law 19; AGENTS.md named internal literal domains.
- evidence: NameStatusEntry.status is an inline S.Literals declaration whose type is reused by name in NAME_STATUS_CODES at :664; Fable's finding distinguishes this from anonymous, never-referenced inline unions.
- failure: The named/reused status vocabulary lacks a single annotated LiteralKit contract.
- fix: Extract an annotated module-local NameStatusCode LiteralKit with exactly the existing spellings, use it for NameStatusEntry.status, and type NAME_STATUS_CODES from its Type. Preserve T -> typeChanged and B -> broken. Do not turn the report's optional sweep of other anonymous domains into required work.
- seats: part-1/fable:fable-1-2

### git-r6
- file: scratchpad/test/git/Git.test.ts:1
- class: tsgo   severity: required
- standard: D11; operator step 2; Quality.command.ts directive policy (:338, :386–388, :465ff).
- evidence: Git.test.ts and GitLog.test.ts suppress strictEffectProvide and multipleEffectProvide for the whole file; run.test.ts suppresses strictEffectProvide. They are absent upstream and are not admitted exemptions. The per-module compiler honors them, while the lab gate omits the repository directive scan.
- failure: A green per-module compiler run conceals diagnostics rather than proving they are fixed.
- fix: Remove the directives from Git.test.ts, GitLog.test.ts and run.test.ts; fix actual diagnostics with composed Layers and a single Layer provisioning boundary where appropriate. Keep test semantics and assertions. Do not edit repo exemptions or runner/config files; the repo-level scan request is separately backlogged.
- seats: part-1/fable:fable-1-3

### git-r7
- file: scratchpad/effected/git/Git.ts:1472
- class: effect-idiom   severity: required
- standard: D9; later operator ruling: restore changes no law/diagnostic/ruling forced; EF-14 allows fnUntraced.
- evidence: Fable compares upstream untraced generator closures (:1374, :1412, :1553, :2489, :2510) with newly traced resolveSshEnv, runForNetwork, collectPaths, runVoid and runParsed (:1472, :1509, :1676, :2860, :2887). The fn idiom can be met without adding child spans.
- failure: Five private helpers add observable spans to upstream tracing behavior without a forced reason.
- fix: Use Effect.fnUntraced for these five helpers, preserving their bodies and upstream public Git.<method> spans. Retain or restore any upstream test lines this change rewrote; add a focused tracing regression in Git.test.ts if needed to prove no helper child spans are added.
- seats: part-1/fable:fable-1-4
- classification: Promoted from backlog: the later restoration ruling makes the evidenced unforced tracing divergence required.

### git-r8
- file: scratchpad/effected/git/internal/run.ts:29
- class: effect-idiom   severity: required
- standard: D5, D11; EF-14; Effect law 22.
- evidence: runCollected is exported and reused (Git.ts:616, run.ts:67), but wraps Effect.gen in Effect.scoped. Fable cites EffectFn.ts:227–242's direct-return-only scanner, explaining the green gate miss.
- failure: The reusable spawn/collection primitive escapes the required fn/fnUntraced idiom.
- fix: Wrap its generator with Effect.fnUntraced and retain Effect.scoped via the trailing pipeline form. Preserve the public signature, concurrent stdout/stderr/exit-code collection, resource scope, and available() behavior. Prefer untraced here to retain upstream tracing behavior rather than adding an unnecessary span.
- seats: part-2/fable:fable-1-1

### git-r9
- file: scratchpad/effected/git/GitCommand.ts:308
- class: law   severity: required
- standard: D5, D11; Effect law 19; schema-first named literal domains.
- evidence: GitConfigScope is the named exported union 'local'|'global'|'system'|'worktree', reused in scopeArgs and four Git.ts option bags. The brief's green gates do not enforce LiteralKit adoption.
- failure: Scope has only a type declaration, without the required annotated runtime literal contract.
- fix: Create an identity-annotated exported GitConfigScope LiteralKit, derive the same-name type, and change index.ts:35 from a type-only to a value/type re-export. Preserve scope argv behavior and test it in GitCommand.test.ts. New value-export bookkeeping belongs to the central codemod.
- seats: part-2/fable:fable-1-2

### git-r10
- file: scratchpad/effected/git/Gitmodules.ts:36
- class: schema   severity: required
- standard: D9, D11; §14 upstream-bug; schema-first precision.
- evidence: Sol's port-and-oracle probe constructed path 'p\0q', encoded through FromString successfully, then failed to decode because GitConfig rejects NUL. A NUL-containing branch reproduces the defect.
- failure: The codec emits an invalid document from schema-valid path/url/branch/update values.
- fix: Use one named, annotated NUL-free string schema for path, url, branch and update, preserving optionality. Add construction/encode-decode regressions in Gitmodules.test.ts; provide failing round-trip evidence to central upstream-bug bookkeeping.
- seats: part-2/sol:sol-1-1

### git-r11
- file: scratchpad/effected/git/Gitmodules.ts:142
- class: schema   severity: required
- standard: D9, D11; §14 upstream-bug established by fidelity failure.
- evidence: Sol's port-and-oracle probe encoded two entries named 'a', with paths p1 and p2; input paths ['p1','p2'] decoded as ['p2'].
- failure: A schema-valid model silently loses duplicate-name entries on encode/decode.
- fix: Add a case-sensitive name-uniqueness check to the entries schema. Keep last-wins duplicate-section merging for incoming text; reject duplicate names in constructed/decoded typed models. Add fidelity regressions in Gitmodules.test.ts and supply evidence to central bookkeeping.
- seats: part-2/sol:sol-1-2

### git-r12
- file: scratchpad/effected/git/internal/config.ts:255
- class: bug   severity: required
- standard: D9, D11; §14 upstream-bug; git-config(1) deprecated subsection syntax.
- evidence: Sol's Git probe over [branch.Master] returned origin only for branch.master.remote, whereas the scanner preserves Master and matchesSection folds both operands. Port and oracle also incorrectly split [submodule.Alpha]/[submodule.alpha], producing missingUrl for alpha.
- failure: Dotted subsection normalization/lookup differs from Git and can split one logical submodule.
- fix: Lowercase dotted subsection names while scanning, then compare decoded subsections case-sensitively in matchesSection. Preserve quoted-name case and original source bytes. Update dotted-subsection corpus expectations in GitConfig.test.ts and add mixed-case merged-submodule coverage in Gitmodules.test.ts; provide upstream-bug evidence centrally.
- seats: part-2/sol:sol-1-3

### git-r13
- file: scratchpad/effected/git/internal/config.ts:247
- class: bug   severity: required
- standard: D9, D11; §14 upstream-bug; git-config(1) inline declaration syntax.
- evidence: Sol's Git probe accepted '[core] bare = false\n' and returned 'core.bare\nfalse\0'; port and oracle returned invalidSectionHeader, 'unexpected text after the section header'.
- failure: Valid entries sharing a line with a section header cannot be parsed.
- fix: Scan an inline declaration after closing ], with its own entry span separate from the header. Adjust GitConfig.ts edit span handling if needed; add parsing and surgical-edit regressions to GitConfig.test.ts. Preserve the header when replacing/removing the inline entry and provide upstream-bug evidence centrally.
- seats: part-2/sol:sol-1-4

### git-r14
- file: scratchpad/effected/git/Gitmodules.ts:93
- class: bug   severity: required
- standard: D9, D11; §14 upstream-bug; Git boolean conversion; Effect law 13.
- evidence: Sol's git config --bool probes returned true for 2, -1, +1 and 0x10 and false for 00; port/oracle rejected shallow=2 and fetchRecurseSubmodules=2. Fable identifies the same parseBool hand-maintained vocabulary, used twice, as a schema-transformation opportunity.
- failure: Valid Git numeric booleans fail .gitmodules decoding; boolean truth is maintained in ad-hoc parsing.
- fix: Use one named, annotated GitBoolean schema codec/transform, consumed by both boolean fields, that supports Git's verified integer syntax (zero false, nonzero true), existing word aliases and bare-key semantics; preserve on-demand handling and reject malformed numbers. Add both-field regressions in Gitmodules.test.ts and supply upstream-bug evidence centrally.
- seats: part-2/sol:sol-1-5; part-2/fable:fable-1-14
- classification: Merged the boolean parser idiom suggestion with the evidenced boolean bug; do not maintain two independent fixes to parseBool.

### git-r15
- file: scratchpad/effected/git/internal/config.ts:146
- class: bug   severity: required
- standard: D9, D11; §14 upstream-bug; malformed-input contract.
- evidence: Git rejected '[core]\n\rbad@line\n' and '[core]\nbare\rjunk\n' with exit 128/'bad config line 2'; port/oracle succeeded, discarding suffixes. Sol locates the same CR handling at header :247 and key :289 boundaries.
- failure: A nonterminal carriage return allows malformed text to be silently discarded.
- fix: Distinguish CRLF/allowed terminal CR from CR followed by non-newline text at line, header and bare-key boundaries; diagnose the latter. Add both malformed-input regressions to GitConfig.test.ts while retaining valid CRLF behavior; supply upstream-bug evidence centrally.
- seats: part-2/sol:sol-1-6

### git-r16
- file: scratchpad/effected/git/internal/config.ts:133
- class: bug   severity: required
- standard: D9, D11; §14 upstream-bug; Git UTF-8 BOM acceptance.
- evidence: Git accepted '\uFEFF[core]\nbare=false\n'; port/oracle reported invalid variable-name and entry-before-section diagnostics.
- failure: Valid BOM-prefixed configuration cannot be parsed.
- fix: Recognize only an initial U+FEFF while preserving source text and absolute offsets. Add BOM-prefixed parse/stringify and offset regressions to GitConfig.test.ts; provide upstream-bug evidence centrally.
- seats: part-2/sol:sol-1-7

### git-r17
- file: scratchpad/effected/git/Gitmodules.ts:98
- class: schema   severity: required
- standard: D5, D11; Effect laws 17, 19; derive behavior from schemas.
- evidence: GitmodulesEntry.ignore at :51 and IGNORE_VALUES at :98 independently list all/dirty/untracked/none; :206 uses .find for membership. Both Sol and Fable cite this duplicate truth missed by green gates.
- failure: Schema acceptance and decoder membership can drift independently.
- fix: Define one annotated internal SubmoduleIgnore LiteralKit; use it for the field and derive decoder membership with S.is/the kit guard, preserving case folding. Delete IGNORE_VALUES and retain accepted/rejected-value tests.
- seats: part-2/sol:sol-1-8; part-2/fable:fable-1-3

### git-r18
- file: scratchpad/effected/git/internal/config.ts:25
- class: law   severity: required
- standard: D5, D11; Effect law 19; schema-first single domain truth.
- evidence: RawDiagnosticCode's six-literal type duplicates GitConfigDiagnostic.code's S.Literals at GitConfig.ts:41–48, with no schema-derived type link; no LiteralKit gate checks this.
- failure: Scanner and public diagnostic vocabularies are independently maintained.
- fix: Export an annotated GitConfigDiagnosticCode LiteralKit from internal/config.ts, derive RawDiagnosticCode from its Type, and use the shared kit for GitConfigDiagnostic.code in GitConfig.ts. Keep the scanner's no-import-from-facade boundary and existing error codes unchanged.
- seats: part-2/fable:fable-1-4

### git-r19
- file: scratchpad/effected/git/Git.ts-E:1
- class: law   severity: required
- standard: D4; §5.1 source mapping; Effect law 2; gate-miss exception.
- evidence: Both Fable seats identify a tracked 172,512-byte upstream editor backup. Part-2 cites root effect-barrel imports at :1, stale @effected/git references at :4109/:4169/:4268, and exclusion from all *.ts gate globs.
- failure: An unscanned stale duplicate carries forbidden imports inside the module and misleads source searches.
- fix: Remove only scratchpad/effected/git/Git.ts-E, the unreferenced editor artifact; preserve Git.ts and all real upstream source/tests. No root config or README Port-notes edits are assigned.
- seats: part-1/fable:fable-1-10; part-2/fable:fable-1-5

### git-r20
- file: scratchpad/effected/git/internal/config.ts:103
- class: schema   severity: required
- standard: D5, D11; Effect law 17; EF-12b and schema-derived guards.
- evidence: isValidKey/:103 and isValidSectionName/:106 are named reused regex predicates; Gitmodules.ts:34 already demonstrates S.String.check(S.isPattern(...)) for comparable domain constraints. Compiler/native-runtime gates do not check schema-derived guards.
- failure: Named Git key/section constraints are outside the required schema-first contracts.
- fix: Define annotated module-local string schemas with the existing key and section regexes and derive the exported guards through S.is. Preserve exact accepted strings and existing edit-error behavior; retain/add boundary cases in GitConfig.test.ts.
- seats: part-2/fable:fable-1-15
- classification: Promoted from backlog: this is a concrete named-domain law-17 violation under D11, not an optional public API expansion.

## Backlog

### git-b1
- file: scratchpad/effected/git/Git.ts:232; scratchpad/effected/git/GitCommand.ts:545; scratchpad/effected/git/GitConfig.ts:325; scratchpad/effected/git/Gitmodules.ts; scratchpad/effected/git/internal/run.ts:21
- class: jsdoc   severity: backlog
- standard: D4; .patterns/jsdoc-documentation.md; operator S2 deferral.
- evidence: Sol and Fable identify legacy @remarks/@example carriers, absent categories/since/examples, and relative imports in GitConfig's example and NotStubbedError's lab-authored example. Part-2 Fable counts 45/9/6/1 @remarks in GitCommand/GitConfig/Gitmodules/run.
- failure: Public documentation is not yet in the final docgen grammar; S2 has not run.
- fix: During S2, preserve prose and every upstream example, convert carriers to titled **Example** (Title) and **Details**/**Gotchas**, add canonical @category/@since and meaningful examples, and use compilable @beep/scratchpad imports from the actual export home. Do not use the report's optional example-deletion alternative.
- seats: part-1/sol:sol-1-5; part-1/fable:fable-1-11; part-2/sol:sol-1-9; part-2/fable:fable-1-9; part-2/fable:fable-1-10
- classification: Merged the documentation grammar and example-import reports as one S2 conversion task; not part of required.json.

### git-b2
- file: scratchpad/effected/git/Git.ts:659,917,947,952,1193
- class: perf   severity: backlog
- standard: D11: measured regression or algorithmic-class improvement required for perf.
- evidence: S.asserts(input, parsed) precedes Schema.Class.make(parsed) at five parser sites; Fable cites installed Class constructor validation. The evidence establishes repeated validation, but no measured regression or algorithmic-class change.
- failure: Potential constant-factor double validation for parsed entries.
- fix: Consider a single typed decode pass or a proven check-disabled make after assertion, preserving the current failure contract. Measure before making performance required.
- seats: part-1/fable:fable-1-5

### git-b3
- file: scratchpad/effected/git/Git.ts:1276; scratchpad/effected/git/Gitmodules.ts:180,225
- class: effect-idiom   severity: backlog
- standard: Effect law 21, tersest equivalent helper preference; D11.
- evidence: Worktree construction has four separate one-key O.getSomesStruct spreads; Gitmodules construction has five, plus a nullable conditional spread. Reports describe cosmetic equivalence rather than a required semantic defect.
- failure: Optional-field elision is verbose and allocates several transient structs.
- fix: When touching these constructors, consolidate each group into one O.getSomesStruct over all optional keys and use O.fromNullable at the error-value spread, preserving omission semantics.
- seats: part-1/fable:fable-1-7; part-2/fable:fable-1-12

### git-b4
- file: scratchpad/effected/git/Git.ts:1520–3247
- class: effect-idiom   severity: backlog
- standard: AGENTS.md helper reuse; Effect law 21; D11.
- evidence: Fable locates about 45 near-identical unexpected-classification closures produced by switch-to-Match conversion.
- failure: Repeated handler-message boilerplate; no shown bug or required performance improvement.
- fix: Consider one method-parameterized helper preserving every existing defect message, instead of copying the closure in each method.
- seats: part-1/fable:fable-1-8

### git-b5
- file: scratchpad/effected/git/Git.ts:1569,2013,2399,2546,2556
- class: docs   severity: backlog
- standard: D4/D9 comment preservation; operator docs/S2 deferral.
- evidence: Fable cites comments between property keys and values and one shared upstream log comment duplicated in absent/unknownRef arms.
- failure: Comment attachment and duplicated prose obscure the handler being described.
- fix: Move notes above their owning properties and retain one copy of shared explanatory text without dropping upstream meaning.
- seats: part-1/fable:fable-1-9

### git-b6
- file: scratchpad/effected/git/README.md:170; scratchpad/effected/runner/Knowledge.ts:132–141
- class: docs   severity: backlog
- standard: §10.3 attribution; S2 pending; outside the port's write surface.
- evidence: README lists ordinary GitConfig.ts 'derived from the offset' and internal/config.ts 'Never exported' prose as vendor notices; Fable identifies the runner's overbroad scanVendorNotices pattern. Git vendors no engine.
- failure: Two false third-party notices are generated into attribution.
- fix: Central/S2 work should remove the false attribution bullets and tighten the runner's vendor-notice matcher. No runner or README Port-notes edits belong to a required git repair group.
- seats: part-2/fable:fable-1-6
- reason: outside the port's write surface

### git-b7
- file: scratchpad/effected/git/README.md:3,10,34
- class: docs   severity: backlog
- standard: §10.3 README adaptation; operator S2 deferral.
- evidence: Fable cites npm/License/Node/TypeScript badges, pre-1.0 stability/install prose, pnpm-plugin-effect reference and @effected/git example imports carried verbatim.
- failure: The README still presents the upstream npm package instead of the lab module.
- fix: Apply §10.3 adaptation during S2, preserve substantive prose and use @beep/scratchpad/effected/git/index imports. Central bookkeeping owns Port notes.
- seats: part-2/fable:fable-1-7

### git-b8
- file: scratchpad/effected/git/GitConfig.ts:52,145,170
- class: schema   severity: backlog
- standard: Schema-first precision preference; D9 and §14 permit changed acceptance only for a forced law or verified bug.
- evidence: S.Finite span fields accept -1 and 1.5 though scanner-produced spans are nonnegative integers. Fable provides no failing round-trip or downstream bug caused by those constructed values.
- failure: Suggested additional invariant would narrow a public schema beyond the diagnostic-forced S.Finite change.
- fix: Consider S.Int with a nonnegative check only after establishing a qualifying forced law/verified upstream bug and preserving the deviation protocol. Do not fold this optional narrowing into the codemod's S.Finite bookkeeping.
- seats: part-2/fable:fable-1-13
- classification: Retained as backlog: construction-domain tightening is not yet justified under §14.

### git-b9
- file: scratchpad/test/git/GitConfig.test.ts:10; scratchpad/test/git/Gitmodules.test.ts
- class: test   severity: backlog
- standard: D10; §§11.2/11.4; goals/effect-vitest-canon/SPEC.md D5/D10; S3 deferred.
- evidence: Fable cites hand-rolled Result unwrappers, deepStrictEqual on Option rather than canon assertions, and no Arbitrary.schema round-trip properties for GitConfig/Gitmodules/FromString.
- failure: The S3 canon and property floor are pending.
- fix: During S3, migrate assertions/test carriers to canon and add schema/codec properties using Arbitrary.schema and fcRuns(n), preserving every upstream test. Coverage, canon and property-floor work is excluded from required.json.
- seats: part-2/fable:fable-1-16

### git-b10
- file: scratchpad/effected/git/internal/run.ts:68
- class: effect-idiom   severity: backlog
- standard: Effect law 21 preference; D11.
- evidence: available maps success through () => true; Effect.as(true) is an equivalent helper. Fable explicitly classifies this as cosmetic.
- failure: An optional shorter expression, with no demonstrated bug or gate miss.
- fix: Use Effect.as(true) when otherwise touching available, retaining spawn-failure false behavior.
- seats: part-2/fable:fable-1-11

### git-b11
- file: scratchpad/effected/runner (directive-scan integration); packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:465
- class: tsgo   severity: backlog
- standard: D11; directive policy; outside the port's write surface.
- evidence: part-1 Fable's suppression finding also asks to run the repository directive scan in the lab runner or expand repo exemption configuration; both are outside git's source/test directories.
- failure: The lab runner can report green without checking forbidden diagnostic directives.
- fix: Central tooling work should integrate the existing directive scan into the lab gate. Do not add a broad exemption without a binding ruling; git-r6 independently fixes the three local test files.
- seats: part-1/fable:fable-1-3
- reason: outside the port's write surface

## Handled by the deviation codemod

### git-c1
- file: scratchpad/effected/git/Git.ts:21,4660; scratchpad/effected/git/Gitmodules.ts; scratchpad/test/git/Gitmodules.test.ts:294
- class: docs   severity: backlog
- standard: Later operator ruling: per-module, per-class deviation codemod.
- evidence: Fable reports $I schema/service identities replacing upstream identifiers; the Gitmodules JSON Schema assertion was adjusted to definitions.@beep/scratchpad/effected/git/Gitmodules/GitmodulesEntryEncoded.... README/ledger currently show no deviations.
- failure: Law-forced identity/key changes are not centrally recorded.
- fix: Generate one module identity-keys deviation entry listing schema/service sites and the adjusted Gitmodules.test.ts assertion. Do not restore upstream identities or manually edit Port notes/PORT_LEDGER.json here.
- seats: part-1/fable:fable-1-6; part-2/fable:fable-1-8

### git-c2
- file: scratchpad/effected/git/Git.ts:255,1330; scratchpad/effected/git/GitConfig.ts:52–58,145–147,170–172
- class: docs   severity: backlog
- standard: schemaNumber diagnostic; later operator per-class S.Finite bookkeeping ruling.
- evidence: Grok and Fable compare upstream S.Number to S.Finite for GitCommandError.exitCode, LsFilesEntry.stage and config spans. Nonfinite values now fail; no upstream exitCode/stage test uses them.
- failure: Diagnostic-forced finite-number acceptance changes lack central records.
- fix: Generate one S.Finite deviation entry per module listing all fields and any adjusted tests; state explicitly where no upstream test needed retargeting. Keep S.Finite.
- seats: part-1/grok:grok-1-2; part-1/fable:fable-1-6; part-2/fable:fable-1-8

### git-c3
- file: scratchpad/effected/git/Git.ts:4577–4588; scratchpad/effected/git/GitConfig.ts:256–278; scratchpad/test/git/GitTestDouble.test.ts:37
- class: docs   severity: backlog
- standard: Effect law 7/no-native-runtime; later tagged-error per-class bookkeeping ruling.
- evidence: Grok compares upstream notStubbed's new Error with NotStubbedError; GitTestDouble.test.ts changes Error to NotStubbedError. Fable adds GitConfigInvariantError replacing a native invariant error, with the same message.
- failure: Forced native-error replacements/observable defect tags are not recorded.
- fix: Generate one tagged-error deviation entry covering both replacements, citing the adjusted GitTestDouble test and any other affected test lines. Keep the tagged errors; do not restore native Error.
- seats: part-1/grok:grok-1-1; part-1/fable:fable-1-6; part-2/fable:fable-1-8

### git-c4
- file: scratchpad/effected/git/Git.ts:101,1737; scratchpad/effected/git/Gitmodules.ts:165–180
- class: docs   severity: backlog
- standard: Effect law 6/no-native-runtime; later native-runtime per-class bookkeeping ruling.
- evidence: part-1 Fable lists OPENSSH_VARIANTS -> HashSet and Set-based path dedupe -> A.dedupe. Part-2 Grok reports MutableHashMap substitutions with first-appearance order and last-wins behavior preserved by existing Gitmodules tests.
- failure: Forced native-runtime replacements need consolidated provenance, not independent repair findings.
- fix: Generate one native-runtime replacement entry listing sites and affected upstream tests/order evidence. Keep order and last-wins behavior; no allowlist removal is needed for git because it has zero entries.
- seats: part-1/fable:fable-1-6

### git-c5
- file: scratchpad/effected/git/Git.ts:4577; scratchpad/effected/git/GitCommand.ts:308
- class: docs   severity: backlog
- standard: D2; later exportsAdded codemod ruling.
- evidence: Fable identifies NotStubbedError as an added file-level export absent from index.ts, with empty exportsAdded. git-r9 also adds the runtime GitConfigScope export; other kit exports are only needed if the implementer chooses a public home.
- failure: Added-export bookkeeping is missing or will become necessary after the required law fixes.
- fix: Central codemod populates exportsAdded for actual added exports, including NotStubbedError and the GitConfigScope value after repair. Do not hand-edit Port notes/ledger or add unnecessary public exports solely to satisfy bookkeeping.
- seats: part-1/fable:fable-1-6; part-1/fable:fable-1-2; part-2/fable:fable-1-2

## Rejected

### git-x1
- file: scratchpad/effected/git/Git.ts:2414
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md EF-3 (:104); D9/later operator restoration ruling applies only to unforced changes.
- evidence: Fable proposes restoring upstream JSON.stringify(answer), arguing that NoNativeRuntime.ts does not ban JSON. EF-3 nevertheless explicitly says never use JSON.parse/JSON.stringify and requires schema JSON codecs.
- failure: The alleged unforced divergence is law-forced; green native-runtime checks and other remaining JSON.stringify calls do not override EF-3.
- fix: Reject restoration; keep the schema JSON codec. This inventory assigns no source edit for this finding.
- seats: part-1/fable:fable-1-1
- reason: Restoring JSON.stringify would violate EF-3; the native-runtime scanner's narrower coverage does not make this schema-codec rewrite unforced.

REQUIRED: 20  BACKLOG: 11  CODEMOD: 5  REJECTED: 1  GROUPS: 2
