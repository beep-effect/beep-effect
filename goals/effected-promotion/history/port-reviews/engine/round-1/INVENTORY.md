# Engine — round-1 merged review inventory

Seats read: `grok.md`, `sol.md`, `fable.md` and their shared adjacent `BRIEF.md`; no `part-N` reports exist. Reviewed commit: `3fa5876691901fccf3d1cd29e9324564df134b56`. All 18 seat findings are accounted for below; six duplicate reports collapse into 12 records, plus one required allowlist record.

Counts: **Required 6 · Backlog 6 · Handled by the deviation codemod 1 · Rejected 0 · Groups 2**.

Authority: the full operator revision block (including both 2026-10-09 rulings), D1–D20, sections 12.5 and 14. S2/S3 work stays backlog. Remedies below supersede stale package-free claims and the option to keep unforced scheduler divergence. Necessary restoration of rewritten timing prose accompanies its behavior fix; general JSDoc conversion remains S2. Law-forced recording and global allowlist/build bookkeeping remain centrally owned and are not independent worker write surfaces.

## Required

### fable-1-1
- file: scratchpad/effected/engine/ProcessGuard.ts:281,313
- class: bug   severity: required
- standard: D9; section 14; later grilling ruling: restore unforced oracle divergence
- evidence: All three seats identify upstream setTimeout(callback, 0) replaced by setImmediate at both injection sites. Fable reports Node 24.20.0 side-by-side probes: connected injection from an I/O callback is UPSTREAM [sibling setImmediate, injection, sibling setTimeout0] versus LAB [injection, sibling setImmediate, sibling setTimeout0]; load injection is UPSTREAM [caller setImmediate, caller setTimeout0, injection, load] versus LAB [caller setImmediate, injection, load, caller setTimeout0]. Sol independently observed the connected-order reversal. Fable traces the swap to 7c239d76bc; DIAGNOSTIC_EXCEPTIONS.md:19 already grants globalTimers for preserving host crash timing. Existing eventual-report tests miss the phase change.
- failure: An exit policy can terminate before callbacks that the upstream timers-phase injection allows to run. The lab changed scheduling without a law, diagnostic or ruling requiring that behavior change.
- fix: Restore setTimeout(callback, 0) at both sites and the upstream timing sentences at ProcessGuard.ts:133-140. Use only the narrowly justified globalTimers diagnostic exception for oracle event-loop ordering; do not retain setImmediate as a recorded deviation. Preserve the equivalent promise-chain/Promise.withResolvers rewrites. Restore any upstream test lines rewritten for this scheduler change and add the seat ordering counterexamples to ProcessGuard.test.ts. The exception reason must acknowledge that effect/* imports are now allowed; the former no-Effect premise is obsolete.
- seats: grok-1-1, sol-1-1, fable-1-1

### sol-1-2
- file: scratchpad/effected/engine/Distribution.ts:37
- class: schema   severity: required
- standard: D5; operator step 4; standards/effect-first-development.md EF-3
- evidence: DistributionField is exported as S.NullOr(Distribution) without an outer annotation or same-name type companion. Sol and Fable report imports showing DistributionField.ast.annotations === undefined while Distribution has composed schemaId/identifier/iri/curie/title. Fable identifies the wrapper as a public index.ts:6 export and cites Id.ts:1212: annoteSchema annotates the schema passed to it, not a surrounding NullOr. This is a demonstrated miss of the completed identity step, rather than a repeat of a green diagnostic.
- failure: The public nullable envelope schema lacks its own identity; annotating its member does not identify the wrapper. Its runtime schema also lacks the required same-name derived type.
- fix: Keep S.NullOr(Distribution) and pipe it through $I.annoteSchema("DistributionField", { description }) using the carried field description; export type DistributionField = typeof DistributionField.Type. Preserve the wire shape and verify identity plus null/non-null cases in Distribution.test.ts. Added-export and identity deviation bookkeeping belongs to the central codemod, not this group.
- seats: grok-1-3, sol-1-2, fable-1-2

### sol-1-3
- file: scratchpad/effected/engine/LaunchContext.ts:11
- class: schema   severity: required
- standard: standards/ARCHITECTURE.md section 5; standards/schema-first-development-prompt.md: Schema owns pure data; standards/effect-first-development.md EF-33
- evidence: ProjectDirInput is an exported interface consisting solely of optional readonly string-array argv, string-or-undefined-valued env, readonly string-array keys and string cwd. It has no callbacks, service methods, overloads or type machinery requiring the interface exception. index.ts:7 currently exports it type-only.
- failure: The pure input model has no runtime schema for validation, annotations or generators, contrary to the cited schema-first standard.
- fix: Define an IdentityComposer-annotated ProjectDirInput S.Struct and derive the same-name type. Preserve readonly fields, omitted or explicitly undefined argv, undefined environment values and unchanged projectDir behavior. Re-export the runtime schema from index.ts and verify the accepted shapes in LaunchContext.test.ts. Added-export bookkeeping is central codemod work.
- seats: sol-1-3

### fable-1-3
- file: scratchpad/effected/engine/ProcessGuard.ts:41-59,154-158,231-238
- class: schema   severity: required
- standard: standards/effect-laws-v1.md laws 17 and 19; standards/effect-first-development.md EF-35; standards/schema-first-development-prompt.md Pattern 1; later grilling ruling allowing only effect/* packages in the guard
- evidence: ProcessGuardPolicy and ProcessGuardInjection are pure-data interfaces; isInjectedKind is a hand-written literal guard; INJECT_AT/INJECT_KIND are parallel arrays; parseInjectCrash validates them with find. Fable cites SchemaFirstDetectors.ts:300 classifying the interfaces as schema-first candidates. These are concrete schema/guard violations, not a tsgo diagnostic already proven green. The former package-free exception is superseded by the ruling and the native-error replacement will load effect/Schema anyway.
- failure: The domain shape and injection grammar have multiple manually maintained representations rather than schema-derived validation.
- fix: Use effect/Schema literal domains and annotated Struct schemas with same-name types for ProcessGuardInjection and ProcessGuardPolicy; derive isInjectedKind with S.is and validate the parsed pair with the injection schema. Preserve missing/explicit-undefined onRejection, all accepted pairs, invalid-input rejection and the rest-length check. Use effect/* only, without @beep/identity or LiteralKit package imports on this entrypoint. Re-export the new runtime schemas through guard.ts, keeping the root index separate. Retarget both source and built entrypoint tests to assert that every bare runtime import starts with effect/ and that the guard still reaches only its two local modules. Keep parser/policy cases in ProcessGuard.test.ts. Record new exports centrally.
- seats: fable-1-3

### fable-1-4
- file: scratchpad/test/engine/entrypoints.test.ts:7-9
- class: test   severity: required
- standard: D9; section 11.1; later grilling ruling to repair engine lab build environment
- evidence: ROOT resolves the test directory parent to scratchpad/test, so BUILT resolves to scratchpad/test/dist/dev/pkg, whereas SRC has already been moved to scratchpad/effected/engine. Both Grok and Fable identify the mismatch with the oracle package-local dist layout. TESTS_NOT_PASSING.md:49 records the missing built guard artifact; its claim that the test was copied unchanged misses the SRC rewrite. This shows an actual failing test/path bug despite the brief generalizing that gates are green.
- failure: The built-graph contract inspects the wrong directory and remains red even after engine output is emitted beside its source; unrelated output under scratchpad/test could satisfy it.
- fix: Set BUILT = resolve(SRC, "dist", "dev", "pkg") and delete ROOT. Keep existsSync and graph assertions active, and combine the edit with the effect/*-only retargeting required by fable-1-3/allow-1. Do not skip or waive the test. The operator-mandated lab build must emit the module-local artifact before the S1 gate can pass; the shared build/environment lane owns emission and correction of TESTS_NOT_PASSING.md, outside this source/test dispatch.
- seats: grok-1-2, fable-1-4

### allow-1
- file: scratchpad/effected/engine/ProcessGuard.ts:162
- class: native-error   severity: required
- standard: beep-laws/no-native-runtime; standards/effect-laws.allowlist.jsonc:334-339; later grilling ruling removing every scratchpad/effected allowlist entry
- evidence: The module has exactly one allowlist entry: file scratchpad/effected/engine/ProcessGuard.ts, kind native-error, issue EFFECTED-ENGINE-DEPENDENCY-FREE-GUARD. emitInjected constructs new Error(`[injected] ${kind}`) at line 162. The entry reason cites package-free startup, which the later ruling explicitly lifts for effect/* imports. The operator requires replacement even though the old allowlist made the law gate green.
- failure: The injected native Error retains a removed native-runtime exemption and blocks the required allowlist-free end state.
- fix: Replace the injected new Error with an effect/Schema S.TaggedError carrying the injected kind and message; keep listener installation before load, host event/origin delivery, handled rejection promise, policy and formatter behavior. Retarget the injected-error representation assertions in ProcessGuard.test.ts (including line 287) to the tagged error without deleting the assertions. Both source and built guard tests must permit only effect/* bare imports, with positive checks that effect/Schema is seen. Coordinate deletion of this exact allowlist entry with the shared allowlist owner; deviation/tagged-error bookkeeping is the central codemod. The guard must import no other package.
- seats: allowlist:EFFECTED-ENGINE-DEPENDENCY-FREE-GUARD; operator:Grilling-2026-10-09-later

## Backlog

### sol-1-4
- file: scratchpad/effected/engine/Distribution.ts:11; LaunchContext.ts; ProcessGuard.ts; Remediation.ts
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md; operator deferral of S2
- evidence: Sol identifies @remarks/@example carriers in all four files, absent @category/@since metadata, and missing runtime Examples in Distribution.ts.
- failure: The carried API documentation has not yet met the deferred JSDoc standard.
- fix: At S2 retain the prose while converting to **Details** and titled **Example** (Title), add canonical categories and @since 0.0.0, supply meaningful compilable runtime examples and run docgen.
- seats: sol-1-4

### sol-1-5
- file: scratchpad/effected/engine/README.md:3-32,43-44,58-59,83-84
- class: docs   severity: backlog
- standard: section 10.3; standards/effect-laws-v1.md law 2; operator deferral of S2
- evidence: Both seats cite the three root-effect imports at lines 44/59/84. Fable additionally cites npm/license/runtime badges, the pre-1.0 stability block and pnpm-plugin reference, Install section and @effected/engine example imports.
- failure: The lab README still presents a published npm package and teaches forbidden root Effect imports.
- fix: At S2 apply section 10.3: remove the carried badges, Install/stability blocks and pnpm-plugin reference; use lab module imports and dedicated effect/Schema, effect/Option and effect/Effect imports, preserving the example outputs.
- seats: sol-1-5, fable-1-5

### sol-1-6
- file: scratchpad/test/engine/LaunchContext.test.ts:74; Distribution.test.ts; Remediation.test.ts
- class: test   severity: backlog
- standard: D10; section 11.4; goals/effect-vitest-canon/SPEC.md section 1.3; operator deferral of S3
- evidence: The only property registration hardcodes arbitrary.runs = 200; the seat reports no fcRuns references in engine tests. Distribution, DistributionField and Remediation have only fixed schema examples.
- failure: The property omits the configured run floor/seed and exported schemas lack the required generated encode/decode laws.
- fix: At S3 use fcRuns and canonical property settings; add Arbitrary.schema-derived encode/decode round trips for every exported schema, including schemas introduced by the required fix wave.
- seats: sol-1-6

### sol-1-7
- file: scratchpad/test/engine/LaunchContext.test.ts:72
- class: test   severity: backlog
- standard: D9; section 11.2; goals/effect-vitest-canon/SPEC.md section 1.3; operator deferral of S3
- evidence: The property generates cwd with S.NonEmptyString and unconditionally rejects placeholders in the result. Sol reports an oracle and lab counterexample: argv [], env {}, cwd "${CLAUDE_PROJECT_DIR}" both return the unchanged cwd, falsifying that property.
- failure: The inherited property can reject correct oracle fallback behavior; this is an S3 property-contract correction, not a production bug.
- fix: At S3 preserve the non-empty-result assertion, check placeholder rejection only for selected argv/env candidates and allow unchanged cwd fallback. Add the demonstrated fixed case and preserve production behavior.
- seats: sol-1-7

### sol-1-8
- file: scratchpad/test/engine/Distribution.test.ts:31,38
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D5; section 11.2; operator deferral of S3
- evidence: Inside it.effect the suite uses assert.isTrue(O.isNone(current)) and deepStrictEqual on an entire Option instead of @effect/vitest/utils helpers.
- failure: The retained upstream assertions have not yet met the deferred Option assertion canon.
- fix: At S3 use assertNone(current) for the default and assertSome(current, { name: "@okfit/plugin", version: "0.5.1" }) for provisioned values.
- seats: sol-1-8

### fable-1-7
- file: scratchpad/effected/engine/LaunchContext.ts:32; Remediation.ts:18; ProcessGuard.ts:200,207
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md compilable Examples; section 10.2; operator deferral of S2
- evidence: The examples import ./index.ts and ./guard.ts from generated example files, and ProcessGuard dynamically imports nonexistent ./server.ts. Fable cites the existing jsonl package-alias precedent. The concrete import/stub defects are evidenced; no fresh docgen run was performed for this inventory.
- failure: The examples cannot compile as relocated docgen examples, independently of the legacy carrier conversion tracked in sol-1-4.
- fix: At S2 use @beep/scratchpad/effected/engine/index and /guard aliases and replace the nonexistent server import with a meaningful inline startServer stub; verify through docgen.
- seats: fable-1-7

## Handled by the deviation codemod

### fable-1-6
- file: scratchpad/effected/engine/README.md:117; Distribution.ts:49-52; Remediation.ts; scratchpad/test/engine/ProcessGuard.test.ts:16
- class: docs   severity: backlog
- standard: D9; D2; section 14; later grilling ruling: per-module, per-systemic-class deviation codemod
- evidence: Fable reports CurrentDistribution.key changed from @effected/engine/CurrentDistribution to the identity-composed @beep/scratchpad/effected/engine/Distribution/CurrentDistribution; Distribution and Remediation gained identity annotations. README says Deviations: None and the ledger has empty deviations/exportsAdded. The report also requests the S.Finite record for ProcessGuard.test.ts:16, which uses S.UndefinedOr(S.Finite).
- failure: The record omits law-forced identity and finite-number changes. The finding requests bookkeeping and does not establish that either change is wrong.
- fix: Let the central codemod generate one engine ledger plus README entry per systemic class, with sites and adjusted upstream tests: identity keys/annotations and S.Finite here, and tagged errors/native-runtime replacements as the fix wave lands. Added exports requested by the schema fixes go to exportsAdded. No manual README or PORT_LEDGER.json edit belongs to a required group.
- seats: fable-1-6

## Rejected

None. Every distinct seat finding has concrete evidence and a concrete fix; no retained defect contradicts the current operator rulings.
