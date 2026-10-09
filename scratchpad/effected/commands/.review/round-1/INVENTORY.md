# commands — round 1 inventory

Seats read: `grok.md` (8 findings), `sol.md` (13), `fable.md` (17), and the adjacent `BRIEF.md` (one shared brief; no part-N directories). Reviewed commit: `3fa5876691901fccf3d1cd29e9324564df134b56`; branch verified: `@lab/effected`.

Counts after deduplication/classification: **Required 9 · Backlog 10 · Codemod 4 · Rejected 1 · Groups 2**. All 38 seat records are accounted for; mixed records are split by defect/class and list their contributing ids wherever applicable.

Binding basis: the entire operator revision/rulings/grilling block, D1–D20, sections 12.4–12.5 and 14. `standards/effect-laws.allowlist.jsonc` was parsed in full: 68 total entries, **0** for `scratchpad/effected/commands/**`; consequently no `allow-<n>` records are needed. No allowlist/config/ledger/Port-notes write is assigned.

Required write groups: **g1** owns six source files (`Tool.ts`, `LocalExec.ts`, `ToolDiscovery.ts`, `Run.ts`, `ScriptedSpawner.ts`, `internal/capture.ts`) and six existing test files; **g2** owns `Redaction.ts` and `Redaction.test.ts`. Executable import repair and suppressed-diagnostic repair share g1 to prevent overlapping test ownership. S2/S3 work stays in backlog.

## Required

### sol-1-2
- file: scratchpad/effected/commands/Tool.ts:16; scratchpad/effected/commands/Tool.ts:36; scratchpad/effected/commands/LocalExec.ts:24; scratchpad/effected/commands/ToolDiscovery.ts:38
- class: schema   severity: required
- standard: D5, D11; standards/effect-laws-v1.md law 19; standards/effect-first-development.md EF-12b.
- evidence: ToolSource, MismatchPolicy, Launcher and ResolvedSource are named, exported, annotation-bearing S.Literals values used through typeof X.Type, Record<Launcher, ...> and S.Array(ResolvedSource). Sol reports a runtime probe showing all four lack Enum, is and $match. Law 19 is outside the four supplied law gates, so green gates do not discharge this finding.
- failure: Four named literal domains lack the required LiteralKit surface.
- fix: Replace these four S.Literals declarations with LiteralKit from @beep/schema/LiteralKit, retaining literals, identity annotations and same-name type exports. Leave anonymous inline unions unchanged; do not add as const. Retain the LocalExec and ToolDiscovery oracle tests.
- seats: grok-1-2, grok-1-3, grok-1-4, sol-1-2, fable-1-1

### sol-1-3
- file: scratchpad/effected/commands/ToolDiscovery.ts:199
- class: law   severity: required
- standard: D11; standards/effect-first-development.md EF-3 and checklist 16; .patterns/error-handling.md.
- evidence: extractVersion still calls JSON.parse(stdout) in try/catch at lines 198–207, returning O.none on failure. Both Sol and Fable identify this surviving path in the reviewed green source; Run already uses S.fromJsonString. This is an EF-3 violation missed by the supplied gates.
- failure: VersionJson discovery retains a forbidden native JSON boundary.
- fix: Use S.decodeUnknownOption(S.fromJsonString(S.Unknown))(stdout), then traverse the existing dotted path with Option composition. Preserve None for malformed JSON, missing properties and non-string results, and retain the object/function/property checks. Keep the existing VersionJson oracle cases and add a focused malformed-JSON/path regression if absent.
- seats: sol-1-3, fable-1-2

### sol-1-4
- file: scratchpad/effected/commands/ToolDiscovery.ts:158; scratchpad/effected/commands/ToolDiscovery.ts:164
- class: schema   severity: required
- standard: D11; standards/schema-first-development-prompt.md, Schema owns pure data; standards/effect-first-development.md EF-12b and EF-33.
- evidence: Probe and Evidence are named, reused pure-data interfaces constructed in probe/cache lookup and consumed by resolution policy. Their fields are Boolean, Option<string>, Probe and Option<ExecContext>; they contain no service methods or type-level machinery. Fable confirms the exported-interface scan does not cover them; that scan gap does not exempt the cited internal-domain standard.
- failure: The internal cached discovery model has only erased interfaces instead of owning schemas.
- fix: Define module-local identity-annotated Probe and Evidence schemas and derive their same-name types. Preserve the current plain-object representation, Option values, cache lifetime and resolution behavior; an annotated S.Struct avoids introducing a new equality/prototype contract. Retain cache and policy tests.
- seats: sol-1-4, fable-1-9
- classification: Fable classified this as backlog because it is private and ungated; the cited internal-domain schema law makes it required under D11.

### sol-1-5
- file: scratchpad/effected/commands/internal/capture.ts:16; scratchpad/effected/commands/Run.ts:323
- class: law   severity: required
- standard: D5, D11; standards/effect-laws-v1.md law 7; standards/effect-first-development.md EF-1.
- evidence: OutputTooLarge extends Data.TaggedError with a type-only limit field and no IdentityComposer identity. Run maps that same object into public CommandOutputError.cause at lines 323–324. The cross-module/public-cause path disproves the never-escapes rationale; the green native-runtime gate did not enforce the S.TaggedError model requirement.
- failure: A cross-module capture error exposed to callers is not schema-backed or identity-annotated.
- fix: Convert OutputTooLarge directly to an identity-annotated S.TaggedError with an annotated limit field and update its construction in collectBounded. Preserve the OutputTooLarge tag, limit payload and instanceof behavior; do not introduce additional acceptance changes beyond a cited forcing law. Retain and strengthen the bounded-output Run test to check the mapped cause and limit.
- seats: sol-1-5, fable-1-3

### sol-1-6
- file: scratchpad/effected/commands/Run.ts:11; scratchpad/effected/commands/LocalExec.ts:8; scratchpad/effected/commands/ScriptedSpawner.ts:8; scratchpad/effected/commands/ToolDiscovery.ts:11; scratchpad/test/commands/Run.test.ts:11; scratchpad/test/commands/LocalExec.test.ts:5; scratchpad/test/commands/ScriptedSpawner.test.ts:14; scratchpad/test/commands/ToolDiscovery.test.ts:7; scratchpad/test/commands/Retry.test.ts:5; scratchpad/test/commands/e2e/Run.e2e.test.ts:13
- class: law   severity: required
- standard: Operator Imports step; AGENTS.md Code Laws; standards/effect-laws-v1.md law 2; D11.
- evidence: Source and executable test imports still take ChildProcess/ChildProcessSpawner from effect/process and TestClock from effect/testing. Sol reports successful resolution of effect/process/ChildProcess, effect/process/ChildProcessSpawner and effect/testing/TestClock. The supplied import gate therefore missed dedicated-path violations.
- failure: Dedicated-module import conversion is incomplete in source and six test files.
- fix: Use dedicated namespace imports from effect/process/ChildProcess, effect/process/ChildProcessSpawner and effect/testing/TestClock everywhere these executable imports occur; preserve type-only imports where applicable. Restrict this fix to source and executable test imports. JSDoc example imports belong to the deferred S2 record, not this required fix.
- seats: sol-1-6

### fable-1-4
- file: scratchpad/effected/commands/Redaction.ts:25; scratchpad/effected/commands/Redaction.ts:83; scratchpad/effected/commands/Redaction.ts:93; scratchpad/effected/commands/Redaction.ts:164
- class: type-safety   severity: required
- standard: D9, D11; section 14 and later 2026-10-09 ruling on unforced divergence; standards/effect-laws-v1.md law 6.
- evidence: The pinned oracle exports SECRET_FLAGS as ReadonlySet<string>; the lab exports MutableHashSet and exposes it again on Redaction. Fable reports that MutableHashSet.add(SECRET_FLAGS, "--totally-public") changes later scrubArgs output. The native-collection law forces an Effect collection, but does not force public mutability.
- failure: An unforced read-only-to-mutable API change permits consumers to modify process-wide redaction policy.
- fix: Restore the upstream read-only shape with HashSet.HashSet<string> and HashSet.fromIterable for SECRET_FLAGS; use HashSet.has. Convert the private extra-flags set consistently and retain Redaction.SECRET_FLAGS. Restore any upstream test lines changed solely to accommodate mutability; add a focused persistent-set test showing a derived set cannot change subsequent scrubbing. Native Set remains forbidden; record the law-forced collection replacement centrally.
- seats: fable-1-4

### fable-1-5
- file: scratchpad/effected/commands/Run.ts:92; scratchpad/effected/commands/Run.ts:151; scratchpad/effected/commands/Run.ts:259
- class: schema   severity: required
- standard: D11; standards/effect-laws-v1.md law 17; standards/effect-first-development.md EF-12b/EF-35; standards/schema-first-development-prompt.md, Precision carries invariants.
- evidence: The process exit code is independently declared as S.Finite in CommandOutput and both public errors and is matched by CommandOutput.succeeded. Fable reports S.decodeUnknownExit(S.Finite)(1.5) succeeds despite the integer process exit-code domain. This addresses the schema constraint itself, not merely recording the already-law-forced S.Number to S.Finite change.
- failure: The reused exit-code domain lacks an owning integer schema and accepts fractional exit codes.
- fix: Add one module-local identity-annotated ExitCode = S.Int building block and reuse it for all three fields, retaining optionality in the errors. Add focused integer/fractional constructor or decoder checks in Run.test.ts while preserving actual process/oracle cases. This cited integer-domain refinement is a law-forced change; its sites and adjusted tests go to the central deviation codemod.
- seats: fable-1-5

### fable-1-6
- file: scratchpad/test/commands/Run.test.ts:1; scratchpad/test/commands/LocalExec.test.ts:1; scratchpad/test/commands/ScriptedSpawner.test.ts:1; scratchpad/test/commands/ToolDiscovery.test.ts:1; scratchpad/test/commands/e2e/Run.e2e.test.ts:1
- class: tsgo   severity: required
- standard: D11; operator Green step/S1 diagnostics contract; tsconfig.base.json strictEffectProvide, globalTimers and newPromise; Quality.command.ts diagnostic-directive policy.
- evidence: Four unit files suppress strictEffectProvide file-wide; the e2e file also suppresses globalTimers and newPromise and implements realDelay with new Promise/setTimeout. The module tsconfig includes these files. Fable identifies the suppression mechanism and the repository directive checker that rejects unadmitted paths, demonstrating why a green tsgo run did not observe the underlying diagnostics.
- failure: File-wide diagnostic suppressions hide required Effect diagnostics in the module test gate.
- fix: Remove the five skip-file directives and clear the exposed diagnostics within these test files. Build required Layers into Contexts under a scope and provide those Contexts, or provide existing service values, preserving fresh scripted state and cache isolation. Use live-clock Effect execution plus Effect.sleep for the real-process delay while retaining lifecycle assertions. Do not waive diagnostics or change repo config. The separate it.layer/assertion/property canon migration remains S3 backlog; no new ScriptedSpawner API is required for this fix.
- seats: fable-1-6
- classification: Retained for suppressed diagnostics and the demonstrated gate miss; the suggested full vitest-canon migration is deferred separately.

### fable-1-7
- file: scratchpad/effected/commands/Run.ts:56; scratchpad/effected/commands/LocalExec.ts:42; scratchpad/effected/commands/ToolDiscovery.ts:155; scratchpad/effected/commands/ScriptedSpawner.ts:33; scratchpad/effected/commands/ScriptedSpawner.ts:57
- class: schema   severity: required
- standard: D2, D11; standards/schema-first-development-prompt.md, Schema owns pure data; standards/effect-first-development.md EF-33; SchemaFirstScan.ts exported-interface rule.
- evidence: RunOptions, LauncherPrefixes, ToolResolutionFailure, ScriptResult and SpawnRecord are exported pure-data interfaces/aliases. The lab falls outside the packages-only schema-first scan. ScriptResult and SpawnRecord contain PlatformError/ChildProcess.CommandOptions, but opaque declarations can preserve those external carriers; needing such a carrier alone does not exempt an otherwise concrete pure-data model from D11. Service contracts LocalExecShape/ToolDiscoveryShape and the SpawnScript function type remain valid interfaces/types.
- failure: Five public data models lack schema values, runtime guards and canonical identities.
- fix: Create identity-annotated same-name schemas with derived types for the five data models: string-array fields for LauncherPrefixes; a union of the four existing error schemas for ToolResolutionFailure; and faithful optional/opaque carriers for RunOptions, ScriptResult and SpawnRecord. Make LocalExecError a value import for the union. Preserve optional undefined handling, Duration.Input, Redacted values, PlatformError objects, full CommandOptions, writable unrefed state, and the upstream public type shapes. Reuse existing schemas where possible; do not use an arbitrary-object predicate as a faithful external-type validator or narrow numeric fields without a forcing standard. Retain all relevant oracle tests and add focused shape checks in the existing files. Added-export and deviation entries are generated centrally, never assigned to this group.
- seats: fable-1-7, fable-1-10
- classification: The two reports describe the same exported pure-data schema gap; fable-1-10 is promoted from backlog because implementation complexity is not a D11 exclusion.

## Backlog

### sol-1-1
- file: scratchpad/effected/commands/ToolDiscovery.ts:291; scratchpad/effected/commands/ToolDiscovery.ts:400; scratchpad/test/commands/ToolDiscovery.test.ts:366
- class: docs   severity: backlog
- standard: D9, D11, section 14; deferred S2; pinned oracle partial-evidence test and invalidate contract.
- evidence: Sol reports the same global-present/local-absent sequence returning first=global, second=ToolNotFoundError, afterInvalidate=local in both oracle and lab. The retained upstream test explicitly expects two spawns when a second policy uses partial evidence. Fable cites the adjacent invalidate escape and identifies the broader mid-process-install prose as over-promising. A differential probe reproducing intended, tested oracle behavior alone does not establish a verified upstream bug that authorizes changing TTL.
- failure: The prose over-promises discovery of a newly installed second copy; a zero-TTL change would also invalidate the existing partial-evidence reuse expectation.
- fix: During S2, clarify that only evidence with no found location expires immediately; installing another copy alongside a found one requires invalidate. Mirror this in the TTL comment. Keep the upstream TTL and probe-count assertions. Track the proposed partial-evidence refresh policy as a behavior-change proposal rather than a required fix absent an independent specification or failing property establishing an upstream bug.
- seats: sol-1-1, fable-1-13
- classification: Deferred documentation correction; TTL redesign lacks a verified upstream-bug basis under D9/section 14 and is outside D11.

### sol-1-7
- file: scratchpad/effected/commands/Run.ts:27; scratchpad/effected/commands/index.ts:5
- class: jsdoc   severity: backlog
- standard: Deferred S2; .patterns/jsdoc-documentation.md; sections 10.1–10.2.
- evidence: All three seats report legacy remarks/example carriers, missing canonical categories/since and compiling value Examples; Fable counts 61 remarks/example tags across the nine source files, including capture.ts and the barrel. Sol also identifies legacy effect/process references in examples through its import finding.
- failure: Exported documentation has not been converted to the beep carriers and import syntax.
- fix: In S2, convert to titled Example/Details/Gotchas prose, preserve every upstream sentence/example, add canonical category and since metadata and meaningful compiling Examples, and update all example Effect imports to dedicated paths.
- seats: grok-1-5, sol-1-7, fable-1-16, sol-1-6
- classification: S2 has not run; all JSDoc work is backlog by operator order.

### fable-1-11
- file: scratchpad/effected/commands/README.md:3; scratchpad/effected/commands/README.md:51; scratchpad/effected/commands/README.md:103
- class: docs   severity: backlog
- standard: Deferred S2; D4; section 10.3; standards/effect-laws-v1.md law 2; inventory write-surface restriction.
- evidence: Fable identifies upstream badges, pre-1.0/plugin/install text and upstream/root-effect Quick-start imports. Grok and Fable identify a truncated capture.ts grep line in Attribution. Sol independently cites both root-barrel examples.
- failure: The README still teaches upstream installation/imports and contains a broken attribution line.
- fix: During S2, adapt the non-Port-notes prose and examples to the lab, remove obsolete installation/release material and use dedicated Effect imports. Send deletion of the stray Port-notes attribution line to the central bookkeeping owner; do not assign any README Port notes or PORT_LEDGER.json edits to fix groups.
- seats: grok-1-6, sol-1-9, fable-1-11
- classification: S2 deferred; the Port-notes correction is outside the port's write surface.

### sol-1-10
- file: scratchpad/effected/commands/Tool.ts:16; scratchpad/effected/commands/Tool.ts:108; scratchpad/test/commands/Redaction.test.ts:103
- class: test   severity: backlog
- standard: Deferred S3; D10; section 11.4.
- evidence: All seats find only the two Redaction properties and no Arbitrary.schema encode/decode round-trip floor for exported schemas, literal domains, version-probe variants, command output/errors, ExecContext and ResolvedTool.
- failure: The per-exported-schema property floor is absent.
- fix: During S3, add one schema-derived round-trip property per exported schema, use schema-derived equivalence and fcRuns, and retain all upstream oracle/differential tests. Inventory newly added schema exports after the required fix wave.
- seats: grok-1-8, sol-1-10, fable-1-17
- classification: Property/coverage work is deferred until S3.

### sol-1-11
- file: scratchpad/test/commands/Redaction.test.ts:103
- class: test   severity: backlog
- standard: Deferred S3; D10; goals/effect-vitest-canon/SPEC.md section 1.3.
- evidence: The two existing Redaction properties supply no Arbitrary options and the commands tests contain no fcRuns import/call.
- failure: Existing properties use default run configuration instead of the repository run floor and seed.
- fix: During S3, supply explicit { arbitrary: fcRuns(400) } options to both Redaction properties.
- seats: sol-1-11, fable-1-17
- classification: Vitest/property canon is deferred until S3.

### sol-1-12
- file: scratchpad/test/commands/LocalExec.test.ts:120; scratchpad/test/commands/ToolDiscovery.test.ts:64; scratchpad/test/commands/ScriptedSpawner.test.ts:131
- class: test   severity: backlog
- standard: Deferred S3; goals/effect-vitest-canon/SPEC.md D5; .patterns/testing-patterns.md.
- evidence: Sol and Fable identify O.isNone, deep equality against O.some and manual fail-and-narrow branches; Sol additionally cites an Exit predicate assertion in ScriptedSpawner.test.ts.
- failure: Container assertions have not been migrated to canonical public vitest helpers.
- fix: During S3, use assertNone/assertSome and the appropriate Exit/failure helpers, preserving payload assertions and type narrowing.
- seats: sol-1-12, fable-1-17
- classification: Vitest-canon findings are backlog by operator order.

### sol-1-13
- file: scratchpad/test/commands/ToolDiscovery.test.ts:51
- class: test   severity: backlog
- standard: Deferred S3; goals/effect-vitest-canon/SPEC.md D14.
- evidence: The discovery run helper builds ToolDiscovery.layer per test with Effect.provide; the layer is Layer.effect at ToolDiscovery.ts:433. Sol and Fable propose scenario-specific it.layer blocks. File-wide diagnostic suppression is handled independently by required fable-1-6.
- failure: Effectful-layer tests retain the upstream per-test provision pattern.
- fix: During S3, migrate effectful production-layer scenarios to it.layer with fresh scripted state/cache isolation, preserving permitted pure-stub provision. Coordinate with the required diagnostic repair without using S3 migration as a prerequisite for removing suppressions.
- seats: sol-1-13, fable-1-17, fable-1-6
- classification: The it.layer canon requirement is deferred; only hidden diagnostics are required now.

### fable-1-8
- file: scratchpad/effected/commands/Run.ts:143; scratchpad/effected/commands/Run.ts:251; scratchpad/effected/workspaces/PackedInstall.ts:573
- class: schema   severity: backlog
- standard: D9, D11; standards/effect-first-development.md EF-13; standards/effect-laws-v1.md law 20; write-surface restriction.
- evidence: The two public errors carry kind-discriminated optional bags; consumers in workspaces/PackedInstall.ts inspect their _tag/kind contract and about 30 oracle tests assert it. The proposed per-kind TaggedError union migration requires updating those workspaces consumers.
- failure: Case-specific payloads are not enforced by discriminated variants, but the proposed fix crosses the module boundary.
- fix: Track a separately scoped, law-cited error-union migration preserving the retained export names, with consumer changes and oracle assertions addressed together. Do not assign workspaces files, ledger edits or Port notes to commands fix groups.
- seats: fable-1-8
- classification: outside the port's write surface

### fable-1-14
- file: scratchpad/effected/commands/LocalExec.ts:2; scratchpad/effected/commands/Retry.ts:1
- class: effect-idiom   severity: backlog
- standard: D11; standards/effect-laws-v1.md law 21 preference; AGENTS.md import conventions.
- evidence: LocalExec imports effect/Effect as both type-only Effect and runtime Eff; Retry imports effect/Schedule as type-only Schedule and runtime Sched. These aliases were carried from upstream. Each import already targets one dedicated Effect module.
- failure: Duplicate aliases add reader/codemod overhead; no current bug, diagnostic, missed enforced gate or measured regression is demonstrated.
- fix: Optionally consolidate each pair to one namespace import and rename Eff/Sched uses when an appropriate cleanup is scheduled.
- seats: fable-1-14
- classification: Stylistic preference outside D11, without an observable defect or enforced-law violation.

### fable-1-15
- file: scratchpad/effected/commands/ToolDiscovery.ts:307; scratchpad/effected/commands/Run.ts:217; scratchpad/effected/commands/Run.ts:265
- class: effect-idiom   severity: backlog
- standard: D11; AGENTS.md preference for match helpers; standards/effect-laws-v1.md law 11/12 spirit.
- evidence: Resolve uses ternary chains over source/onMismatch; public error messages use kind conditionals. Fable explicitly states the current branches are correct and no gate flags these chains.
- failure: Future literal additions could silently fall through, but no present behavior bug or measured regression is shown.
- fix: Optionally replace the chains with LiteralKit $match or exhaustive Match after the required literal-domain fix, keeping message bytes and resolution policy unchanged.
- seats: fable-1-15
- classification: Preventive stylistic rewrite outside D11; no currently missing case is evidenced.

## Handled by the deviation codemod

### codemod-1
- file: scratchpad/effected/commands/Run.ts:92; scratchpad/effected/commands/Run.ts:151; scratchpad/effected/commands/Run.ts:259; scratchpad/effected/commands/README.md:109
- class: docs   severity: backlog
- standard: D9/section 14; later 2026-10-09 per-module/per-class deviation-codemod ruling; schemaNumber diagnostic.
- evidence: Sol and Fable report the commands ledger has deviations=[] and README says None although S.Number became S.Finite; differential probes show NaN/Infinity accepted upstream and rejected in the lab.
- failure: The law-forced finite-number acceptance change is unrecorded.
- fix: The central codemod generates one commands S.Finite systemic-class entry, listing sites and adjusted upstream tests (or explicitly none). Include the separately required ExitCode refinement when applied; no lane edits PORT_LEDGER.json or README Port notes.
- seats: sol-1-8, fable-1-12
- disposition: handled centrally by the deviation codemod; not required.

### codemod-2
- file: scratchpad/effected/commands/Run.ts:18; scratchpad/effected/commands/Run.ts:415; scratchpad/effected/commands/ScriptedSpawner.ts:160; scratchpad/effected/commands/ToolDiscovery.ts:381
- class: docs   severity: backlog
- standard: D9/section 14; standards/effect-laws-v1.md law 7; later 2026-10-09 deviation-codemod ruling.
- evidence: Grok and Fable identify EmptyJsonLineError, ScriptedPipelineError and ToolDiscoveryUnstubbedError replacing native Error with no recorded deviations. The pipeline test still observes instanceof Error and its expected message.
- failure: The law-forced tagged-error replacement class is unrecorded.
- fix: The central codemod generates one commands tagged-error systemic-class entry listing all replacement sites and adjusted oracle tests (or none), including further law-forced capture-error changes when landed. Do not restore native Error and do not assign Port notes or the ledger to a fix group.
- seats: grok-1-7, fable-1-12
- disposition: handled centrally by the deviation codemod; not required.

### codemod-3
- file: scratchpad/effected/commands/Redaction.ts:25; scratchpad/effected/commands/Redaction.ts:83; scratchpad/effected/commands/Redaction.ts:93
- class: docs   severity: backlog
- standard: D9/section 14; standards/effect-laws-v1.md law 6; later 2026-10-09 deviation-codemod ruling.
- evidence: Sol and Fable identify the ReadonlySet to Effect collection replacement as observable and absent from the deviation record. The existing MutableHashSet choice is separately required fable-1-4; bookkeeping does not approve that choice.
- failure: The law-forced native-collection replacement is unrecorded.
- fix: After the read-only HashSet repair, the central codemod generates one commands native-runtime-replacement class entry with affected APIs/sites and adjusted oracle tests. List additions in exportsAdded only when applicable; no group owns bookkeeping files.
- seats: sol-1-8, fable-1-12
- disposition: handled centrally by the deviation codemod; not required.

### codemod-4
- file: scratchpad/effected/commands/Run.ts:39; scratchpad/effected/commands/Run.ts:392; scratchpad/effected/commands/Run.ts:432; scratchpad/effected/commands/README.md:109
- class: docs   severity: backlog
- standard: D9/section 14; standards/effect-first-development.md EF-3; later 2026-10-09 per-module/per-class deviation-codemod ruling.
- evidence: Sol reports malformed JSON changes the oracle SyntaxError cause to a lab SchemaError cause; Fable independently identifies the codec replacement and missing record. EF-3 explicitly requires Schema JSON codecs. Grok reports the same behavior but proposes a forbidden reversal, classified separately as rejected.
- failure: The law-forced JSON-codec diagnostic change is unrecorded.
- fix: The central codemod records one commands Schema-JSON-codec systemic-class deviation, with Run.json/Run.jsonLine sites and adjusted oracle tests (or none). Preserve the schema codec and public notJson classification; do not regenerate a native SyntaxError with JSON.parse.
- seats: sol-1-8, fable-1-12
- disposition: handled centrally by the deviation codemod; not required.

## Rejected

### grok-1-1
- file: scratchpad/effected/commands/Run.ts:392; scratchpad/effected/commands/Run.ts:432
- class: bug   severity: required
- standard: D9/section 14; standards/effect-first-development.md EF-3; operator law-forced deviation ruling.
- evidence: The SyntaxError-to-SchemaError cause difference is evidenced, but the codec replacement is forced by EF-3, which expressly prohibits JSON.parse. The supplied tests still assert the upstream notJson classification.
- failure: The reported cause difference is real and law-forced; it does not establish that the schema codec is wrong.
- fix: Reject the proposed Effect.try(JSON.parse) restoration. Preserve the schema codec and have its observable diagnostic change recorded by codemod-4.
- seats: grok-1-1
- rejection: The proposed fix restores forbidden JSON.parse and contradicts the law-forced-deviation ruling; bookkeeping is handled by codemod-4.
