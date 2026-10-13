# Engine — round-2 merged review inventory

Seats read: `grok.md`, `sol.md`, `fable.md` and the shared adjacent `BRIEF.md`; no `part-N` reports exist. Brief commit: `a12bef261998d2ad92153dada46373be06950692`. Grok reports no findings; Sol reports 3 and Fable reports 11. The 14 seat records become 13 distinct defects: Fable's combined `fable-2-11` contributes to both Sol property records and is not counted again.

Counts: **Required 6 · Backlog 6 · Handled by the deviation codemod 1 · Rejected 0 · Groups 3**.

Authority: the entire operator revision block, including “Operator rulings, 2026-10-09” and “Grilling, 2026-10-09 (later)”; D1–D20; sections 12.5 and 14; the task's explicit S2/S3 deferral and write-surface limits. Despite the brief's S2/S3-green context, docs/JSDoc/property-canon work remains backlog as requested. The timeout and walker restorations are required under the more specific unforced-divergence ruling, rather than as general S3 improvements. Guard identity/key-annotation defects repair the implementation of the forced schema changes and do not ask only for a deviation record.

Provenance: the available checkout is `@lab/effected-2`, not the requested `@lab/effected`; reports and current engine sites were read in place without switching branches. Historical step-2/S1/S3 diffs were read via `git log --all --format=%h:%s -- <file>` and `git show` because the current history includes a squashed progress PR. No compiler scratch-copy probe or test run was performed. Seat probe outputs below are attributed to the seats, not claimed as fresh executions.

Allowlist audit: current `standards/effect-laws.allowlist.jsonc` has **zero** entries for `scratchpad/effected/engine/**`, so no `allow-<n>` findings are added. Round 1's former `native-error` entry is already absent; current `InjectedCrash` is an `S.TaggedError` (S1 commit `460424e2c6`). No stale exemption is reintroduced.

Dispatch ownership: `g1` owns LaunchContext source, `g2` owns ProcessGuard source and its two affected tests, and `g3` owns the two import/purity oracle test restorations. Every assigned source/test path belongs to exactly one group; each group has at most one source file. Existing LaunchContext tests verify the behavior-preserving helper replacement without requiring edits; its property corrections remain backlog. No README Port notes, root configuration, allowlist, or port-ledger writes belong to a group.

## Required

### sol-2-3
- file: scratchpad/effected/engine/LaunchContext.ts:99
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5 and checklist item 6; AGENTS.md Code Laws; D5.   evidence: The reviewed source directly calls `value.indexOf("${")` at line 99, `value.indexOf("}", open + 2)` at line 100, and `value.trim()` at line 127. These remain despite the green gates and have no recorded native-helper deviation. The Effect reference exposes `Str.indexOf(searchString)` returning `Option<number>`, `Str.includes(searchString, position)`, and `Str.trim`, which can preserve the existing behavior and linear scanning strategy.
- failure: Launch-context domain logic still uses direct native string helpers contrary to the required Effect-native idiom. The documented full beep-native end state is therefore unmet; the cited sites are concrete residue that the green gates did not remove.
- fix: Import `effect/String` as `Str` and `effect/Option` as `O`. Replace trimming with `Str.trim(value)`, and implement placeholder detection with `O.match(Str.indexOf("${")(value), { onNone: () => false, onSome: (open) => Str.includes("}", open + 2)(value) })`. Retain the existing oracle behavior and linear scan.
- seats: sol-2-3

### fable-2-1
- file: scratchpad/effected/engine/ProcessGuard.ts:418
- class: bug   severity: required
- standard: D9 (behaviour-preserving; upstream `run` is `async` and always yields a Promise); section 14 (an observable difference needs a law or upstream-bug cause); ledger deviation #14 claims the simplification was "without a behaviour change"; the lab's own comment at ProcessGuard.ts:355-356 promises "an async function's contract"   evidence: `start` (lines 413-421) catches a synchronous throw from `options.load` with `return startupFailed(error)`, and `startupFailed` (409-412) ends in `return host.exit(1)`. Node 24.20.0 probe importing oracle and lab side by side with a host whose `exit` returns (`exit: () => undefined`) and `load: () => { throw new Error("sync") }`: UP `run()` -> Promise; LAB `run()` -> undefined (typeof). The rejecting-load path still yields a Promise in both. tsgo accepts it only because `never` is assignable to `Promise<void>`; the built dist/dev/pkg/guard.js is plain JS where no such contract exists.
- evidence: Historical attribution: git log --all --format=%h:%s -- ProcessGuard.ts and git show bbe25d50b2 trace startupFailed void -> never and deletion of the catch path Promise.resolve() to S3 coverage simplification. The step-2 diff 7c239d76bc had preserved that settled Promise after the diagnostic-forced async-to-chain rewrite. The forced rewrite therefore does not force this regression; current coverage exercises an exit double that throws and misses the returning-host boundary.
- failure: For any host whose `exit` returns instead of throwing or ending the process (a JS double, a mock), `ProcessGuard.run` returns `undefined` instead of a Promise: `.then`/`.catch` on the result throws TypeError and `await` silently skips the startup-failure report ordering. Upstream never did this. The 11.3 coverage simplification changed behaviour and the deviation record says it did not.
- fix: Restore an always-Promise synchronous-load-failure path while retaining the step-2 diagnostic-forced explicit promise chain: return Promise.resolve(startupFailed(error)) from the catch (or an equivalent promise boundary). Preserve reporting, exit code, and rejection behavior when exit throws. Add a ProcessGuard.coverage.test.ts regression using the existing deliberatelyInvalid<ProcessGuardHost> helper for a returning-exit double, asserting the result is a Promise and the startup report/exit behavior. Restore any upstream test lines changed solely for this regression; leave central ledger/deviation wording to the orchestrator/codemod, outside this group.
- seats: fable-2-1

### fable-2-2
- file: scratchpad/test/engine/purity.test.ts:12
- class: test   severity: required
- standard: D9; section 11.1 (no upstream timeout raised); later Grilling ruling: restore changes no law, diagnostic, or ruling forced. Canon D6 is corroborating evidence, not the reason to require deferred S3 work.   evidence: The pinned upstream purity.test.ts:11 and the already-green S1 version at 460424e2c6 use layer(NodeServices.layer)((it) => { with no options. git log --all and git show bdca1c58e5 trace the sole options-object addition to the S3 checkpoint: { timeout: "30 seconds" }. The step-2 diffs (808e222d79, 7f67982f77) change only the lab path and nodeBuiltinImport diagnostic header; the S1 law commit does not increase this timeout. The seat explains that the option raises the beforeAll hook timeout from the default 10 seconds to 30 seconds. No forcing diagnostic, law, or operator ruling is shown.
- failure: An upstream test was weakened by a raised hook timeout without a recorded cause; a slow or hung NodeServices build on a loaded seat is hidden for 30 s instead of surfacing at the oracle's limit, contrary to the S1/S3 contract that upstream tests keep their meaning.
- fix: Restore exactly the upstream registration layer(NodeServices.layer)((it) => { by deleting the timeout options object. Keep the diagnostic-forced header, lab source path, existing test bodies and assertions. Restore the upstream registration line rather than recording the unforced increase as a deviation.
- seats: fable-2-2

### fable-2-4
- file: scratchpad/effected/engine/ProcessGuard.ts:66
- class: schema   severity: required
- standard: D5; operator step 4 (identity annotations on every schema); standards/effect-first-development.md EF-12; later Grilling effect/*-only guard exception.   evidence: The seat's annotation-key probe shows Distribution has description/schemaId/identifier/iri/curie/title while ProcessGuardPolicy and ProcessGuardInjection have identifier/title/description only; current blocks at ProcessGuard.ts:66-70,99-103 and InjectedCrash:218-221 confirm the missing metadata. Id.ts:1807-1823 derives schemaId from the composed symbol and emits iri/curie with identifier/title. git show 460424e2c6 confirms the effect/*-only schema conversion was law-forced, but the guard exception forbids the identity package import, not primitive identity metadata. This is an incomplete schema implementation, not a request to record a forced change.
- failure: The two public guard schemas carry a different, smaller identity surface than every other exported schema in the lab: an identity registry or IRI consumer keyed on `schemaId`/`iri`/`curie` does not see them, and the recorded deviation implies equivalence it does not deliver.
- fix: Using only primitives and effect/* in ProcessGuard.ts, complete the identity metadata for ProcessGuardPolicy, ProcessGuardInjection and InjectedCrash to match the canonical $ScratchpadId.create("effected/engine/ProcessGuard").annote(name, { description }) result, including schemaId = Symbol.for(fullIdentifier), iri and curie and the canonical title. Keep schema shapes and guard import boundaries intact; do not import @beep/identity into the guard. In ProcessGuard.test.ts (not the entrypoint import-boundary tests), compare the public schemas' annotations with the composer output; check injected error identity through its schema/instance as appropriate. Central deviation recording remains outside this group.
- seats: fable-2-4

### fable-2-5
- file: scratchpad/effected/engine/ProcessGuard.ts:64
- class: schema   severity: required
- standard: Operator step 4 explicitly requires annotations on fields and schemas; D5; Effect SCHEMA.md Key Annotations (annotateKey); schema-idiom violation under D11.   evidence: The seat probes ast.propertySignatures and reports null key contexts for guard fields; descriptions are on type.annotations instead. Current ProcessGuard.ts:64,65,97,98 uses annotate for onUncaught, onRejection, at and kind, whereas LaunchContext.ts and Distribution.ts use annotateKey. The Effect reference Key Annotations section documents annotateKey for key descriptions and missing-key messages. The law-forced guard-schema conversion in 460424e2c6 introduced these misplaced annotations; no gate validates this key/type distinction.
- failure: Field descriptions in the guard are type-level, not key-level, so tooling that reads key annotations (missing-key messages, key docs, the identity field census the other three modules satisfy) sees undocumented fields on `ProcessGuardPolicy` and `ProcessGuardInjection`; the module is inconsistent with its siblings for no recorded reason.
- fix: Replace .annotate({ description }) with .annotateKey({ description }) on the four guard Struct field schemas (onUncaught, onRejection, at, kind). Preserve optionality, literal domains and schema-level identity annotations. Add ProcessGuard.test.ts assertions that all four property signatures carry their intended key-level descriptions. This repairs the field-annotation implementation; it is not a general S2 documentation conversion or a central bookkeeping task.
- seats: fable-2-5

### fable-2-10
- file: scratchpad/test/engine/entrypoints.test.ts:18
- class: test   severity: required
- standard: D9; section 11.1 (upstream tests keep their meaning); section 14; later Grilling ruling: restore lab divergences no law, diagnostic or ruling forced.   evidence: The seat identifies the regex-to-TypeScript-AST import walker swap at entrypoints.test.ts:18-38, which additionally counts side-effect imports and changes the oracle helper's behavior. The pinned oracle __test__/entrypoints.test.ts:15-20 uses source.matchAll followed by filter/map. git log --all -G createSourceFile and git show bdca1c58e5 place the AST rewrite in the S3 checkpoint. git show 7f67982f77 (step 2) changes only the nodeBuiltinImport header, and git show 460424e2c6 (S1, green strict parity/check/laws/tests) retains the regex helper while fixing BUILT and allowing effect/* packages. These diffs establish that the AST swap was not necessary to clear the earlier diagnostic/law gates, and no later forcing diagnostic, law or ruling is shown.
- failure: The upstream graph-check helper was replaced with a stricter helper without an allowed cause. Merely adding a deviation record, as the seat proposes, would preserve the unforced divergence that the operator explicitly requires restoring.
- fix: Restore runtimeImportsOf from the pinned oracle __test__/entrypoints.test.ts:15-20 (readFileSync text plus the upstream matchAll/filter/map lines), and remove the A, Result and TS imports added solely for the AST walker. Restore any upstream test lines rewritten solely for that walker swap. Retain the diagnostic-forced nodeBuiltinImport header, module-local SRC/BUILT paths, per-module effect/Schema positive control, and operator-mandated effect/*-only source/built guard assertions; those were forced separately in steps 2/3 and S1. Do not record the unforced AST rewrite as an accepted deviation.
- seats: fable-2-10

## Backlog

### sol-2-1
- file: scratchpad/test/engine/LaunchContext.test.ts:106
- class: test   severity: backlog
- standard: D9; EFFECTED_PORT_GOAL.md §§11.2, 11.4; goals/effect-vitest-canon/SPEC.md §1.3.   evidence: A read-only Bun differential probe against the pinned oracle used `{ argv: [], env: {}, keys: ["OKFIT_PROJECT_DIR", "CLAUDE_PROJECT_DIR"], cwd: "${CLAUDE_PROJECT_DIR}" }`. Both oracle and lab returned `"${CLAUDE_PROJECT_DIR}"`; the retained property predicate evaluated to `false` for both. The reviewed surface matches commit `a12bef261998d2ad92153dada46373be06950692`. This round-1 backlog obligation remains unresolved after S3; the added schema round-trip property does not correct it.
- failure: The property rejects correct upstream fallback behavior. Its generator permits a placeholder-bearing nonempty `cwd`, and `projectDir` deliberately returns that fallback unchanged when no argv or environment candidate is usable. A generated counterexample therefore makes the suite fail without a production regression; the green sampled run missed this input.
- fix: Preserve the nonempty-result assertion, permit an unchanged `cwd` fallback to contain placeholders, and apply placeholder rejection to selected argv/environment candidates. Add the demonstrated fallback as a fixed regression case. Preserve production behavior.
- disposition: Backlog under the requested S3/vitest-canon deferral; fable-2-11 contributes to this defect and the other LaunchContext property defect, rather than creating a third record. Its request to close central ledger rows is not a worker write surface.
- seats: sol-2-1, fable-2-11

### sol-2-2
- file: scratchpad/test/engine/LaunchContext.test.ts:108
- class: test   severity: backlog
- standard: D10; EFFECTED_PORT_GOAL.md §11.4; goals/effect-vitest-canon/SPEC.md §1.3.   evidence: This registration still supplies `{ arbitrary: { runs: 200 } }`. A read-only probe with `BEEP_FC_NUM_RUNS=400 BEEP_FC_SEED=20260708` produced `fcRuns(200) → {"runs":400,"seed":20260708}`, while the retained registration remains `{"runs":200}`. The new property files use `fcRuns`, but this existing registration still bypasses it.
- failure: The retained property ignores the configured run floor and reproducible seed. Under the demonstrated CI settings it runs 200 cases instead of 400 and receives no configured seed, despite the green canon gate.
- fix: Import `fcRuns` from `@beep/fc-runs/FastCheckRuns` and replace the options with `{ arbitrary: fcRuns(200) }`, preserving the original minimum while honoring higher environment floors and the configured seed.
- disposition: Backlog under the requested S3/vitest-canon deferral; fable-2-11 contributes to this defect and the other LaunchContext property defect, rather than creating a third record. Its request to close central ledger rows is not a worker write surface.
- seats: sol-2-2, fable-2-11

### fable-2-6
- file: scratchpad/effected/engine/README.md:5
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 10.3 (remove the Install section; keep API prose); ledger backlog sol-1-5 (S2 README adaptation)   evidence: Upstream README places the paragraph "All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` ... fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` ..." inside `## Install` (after the npm/pnpm commands and the Node requirement, before `## Distribution`). The lab removed the heading, commands and Node line but kept this paragraph verbatim as line 5. The lab module has no package.json or exports map.
- failure: The adapted README still describes npm publication mechanics (exports-map conditions, `require()` failure mode) that do not exist for the lab module, contrary to the Install-section removal 10.3 prescribes and the S2 note's claim that the README was adapted.
- fix: Delete README.md line 5 (the ESM-only/exports-map paragraph).
- disposition: Backlog under the requested S2/docs/JSDoc deferral. README Port-notes bookkeeping remains centrally owned.
- seats: fable-2-6

### fable-2-7
- file: scratchpad/effected/engine/README.md:7
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 10.3 (API prose kept, port notes record what changed) and section 14 (deviations recorded); README line 104 (effect-imports deviation) and 105 (identity-annotations) do not mention the new package edge   evidence: README.md:7 states "`effect` v4 is the only peer dependency, and it is the only dependency of any kind — no parser, no polyfill, no platform package rides in behind it" and :73 "Pure tier: `effect` is the only peer". Distribution.ts:1, LaunchContext.ts:1 and Remediation.ts:1 import `@beep/identity/packages`; the emitted dist/dev/pkg/Distribution.js line 1 carries that bare runtime import, so the main entry's runtime graph now includes @beep/identity (Id.ts pulls effect/* plus a type-only @beep/types). purity.test.ts forbids only node:/@effect/platform*/@effected/*, so no test contradicts the sentence.
- failure: The README's dependency claim is false for the lab main entry; a reader or the promotion step relying on "effect is the only dependency of any kind" would misplace the module's tier.
- fix: Amend README.md:7 (and the Tier paragraph at :73) to say the lab main entry additionally loads `@beep/identity/packages` for identity annotations while `./guard` reaches effect/* only, and point at the identity-annotations deviation bullet.
- disposition: Backlog under the requested S2/docs/JSDoc deferral. README Port-notes bookkeeping remains centrally owned.
- seats: fable-2-7

### fable-2-8
- file: scratchpad/effected/engine/Distribution.ts:24
- class: jsdoc   severity: backlog
- standard: tsconfig.base.json:194 `preferTypedSchemaDecoder: "error"` and :211 `schemaSync: "error"` (the lab's own gate, which the brief says runs with every Effect rule at error); ledger deviation #6 ("step-2 schema diagnostics force Result-based test codecs"); .patterns/jsdoc-documentation.md (examples are the taught usage)   evidence: The Distribution example runs `S.decodeUnknownSync(Distribution)({ name: "@okfit/plugin", version: "0.5.1" })` and README.md:17 repeats it. effect-tsgo docs/rules/schema-sync.md and prefer-typed-schema-decoder.md show exactly this call shape as their diagnostic preview (`decodeUnknownSync` on a literal already assignable to Encoded). The module's tests were rewritten to `Result.getOrThrowWith(S.decodeResult(...))` (Distribution.test.ts:13) precisely because the gate rejects the sync form; sibling lab modules jsonl/jsonc have no `decodeUnknownSync` in examples or READMEs. Docgen compiles examples without the tsgo rule set, so the gate does not see it.
- failure: The carried example teaches the one decode form the lab forbids in source and tests; a reader copying it into a lab or package file gets two error-severity diagnostics.
- fix: Rewrite the example (and README.md:17) to the module's own test idiom, e.g. `const carrier = Result.getOrThrowWith(S.decodeResult(Distribution)({ name: "@okfit/plugin", version: "0.5.1" }), (error) => error)` with `import * as Result from "effect/Result"`, or use `S.is(Distribution)(...)` for a validation-only example; keep the printed output.
- disposition: Backlog under the requested S2/docs/JSDoc deferral. README Port-notes bookkeeping remains centrally owned.
- seats: fable-2-8

### fable-2-9
- file: scratchpad/effected/DIAGNOSTIC_EXCEPTIONS.md:19; scratchpad/effected/engine/ProcessGuard.ts:1
- class: docs   severity: backlog
- standard: scratchpad/effected/DIAGNOSTIC_EXCEPTIONS.md contract ("Every place where an @effect/tsgo rule is switched off ... remove the directive and the diagnostic comes back"); round-1 INVENTORY fable-1-1 fix ("The exception reason must acknowledge that effect/* imports are now allowed; the former no-Effect premise is obsolete")   evidence: DIAGNOSTIC_EXCEPTIONS.md:19 still lists `effected/engine/ProcessGuard.ts` line 2, whole file, asyncFunction/newPromise/globalTimers with the reason "before Effect loads". `grep -rn "@effect-diagnostics" scratchpad/effected/engine/*.ts` returns nothing: the source carries no directive since the fix wave moved both injections to `Effect.runPromise(Effect.sleep("1 millis"))` and the file now imports effect/Effect. The only engine directives live in the three test headers (ProcessGuard.test.ts:1, entrypoints.test.ts:1, purity.test.ts:1), which the registry's aggregate header table covers.
- failure: The registry records a source-level rule suppression that no longer exists, with a premise ("before Effect loads") the round-1 ruling retired; an operator auditing suppressions is pointed at a phantom site.
- fix: Regenerate DIAGNOSTIC_EXCEPTIONS.md (or delete row 19) in the same wave that touches ProcessGuard.ts, and update the "30 in source" total accordingly.
- disposition: Backlog: outside the port's write surface. The stale suppression registry is outside both engine directories; no required group may regenerate or edit it.
- seats: fable-2-9

## Handled by the deviation codemod

### fable-2-3
- file: scratchpad/effected/engine/README.md:90
- class: docs   severity: backlog
- standard: D2 (superset export rule: additions are listed in README Port notes -> Added exports); section 10.3 (Added exports subsection present even if none); round-1 INVENTORY fable-1-3/sol-1-3 ("Record new exports centrally", "Added exports requested by the schema fixes go to exportsAdded")   evidence: index.ts:7 now exports `ProjectDirInput` as a runtime value and guard.ts:12,14 export `ProcessGuardInjection` and `ProcessGuardPolicy` as runtime values; ledger exportsExpected records all three upstream as kind `type` (confirmed: `{'name': 'ProjectDirInput', 'kind': 'type'}` etc.). README Port notes still reads `### Added exports` / `None.` and the ledger row has `exportsAdded: []`. Only `ledger --verify`'s `exportsExpected ⊆ lab exports` check runs, so the omission is invisible to the gate.
- failure: Three runtime exports that did not exist upstream are unrecorded; a consumer or the promotion step cannot tell lab additions from carried surface, and the round-1 fix wave's own bookkeeping instruction was not completed.
- fix: The central per-module deviation codemod records the law-forced runtime additions in exportsAdded (ProjectDirInput value at ., ProcessGuardInjection and ProcessGuardPolicy values at ./guard) and emits the corresponding README Added exports entries. Do not assign PORT_LEDGER.json or README Port notes to a required fix group; no defect in the added schemas/exports themselves is shown by this bookkeeping finding.
- seats: fable-2-3

## Rejected

None. Every distinct seat finding supplies evidence and a concrete fix; retained required findings identify specific gaps missed by the reported green gates. Duplicate reports are merged, not counted as rejections. The record-only remedy proposed for `fable-2-10` is superseded by the operator's restore ruling; the underlying defect is retained as required.
