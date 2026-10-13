# github-commands — round-2 merged inventory

Seats read: `grok.md`, `sol.md`, `fable.md`, and their shared `BRIEF.md`; recursive discovery found no `part-N` reports. Eight seat findings merge to four records: **Required 1; Backlog 2; Handled by the deviation codemod 1; Rejected 0. Groups: 1.** Sol reports no findings. Seat labels identify the report files; Fable's route is governed by the operator's seat-fallback ruling.

The brief pins `a12bef261998d2ad92153dada46373be06950692`. The live checkout is `@lab/effected-2` at `2f515ae2519cc72223c94917019bf7ebfe92a4a5`; `git diff --name-only <brief-sha> HEAD -- scratchpad/effected/github-commands scratchpad/test/github-commands` is empty. The operator revision block, including the later grilling, D1–D20, §12.5 and §14 govern this merge. Documentation, coverage and vitest-canon work stays backlog under the inventory instructions despite the brief's S2/S3-green claim. Required groups authorize only the listed module test files; ledger and README Port-notes writes belong to the central codemod.

Allowlist scan: **0 entries** in `standards/effect-laws.allowlist.jsonc` for `scratchpad/effected/github-commands/**`; consequently there are no `allow-<n>` findings. No tests, compiler lanes, coverage, session/ledger commands or source fixes were run.

History check: ordinary path history reaches squash `7929b1f529`; `git log --all` recovers the original port commits. The diff of `03bf79d41b` (`effected-port step 2`) replaces `Object.entries` with `R.toEntries`. The diff of `028852e4d0` (`effected-port S4`, round-1 law fixes) adds the schema, identity annotations, finite numeric domains and Effect helpers. `27c4f64603` (`effected-port S1`) has no source diff for these files. `8ff6872c57` (`effected-port S3`) adds both reflective constructor tests. The pinned oracle retains both private constructors. No report establishes an unforced source divergence requiring an upstream restore; in particular, the enumeration replacement is law-forced.

## Required

### fable-2-1 — inferred `any` in both private-constructor tests

- file: scratchpad/test/github-commands/CommandNeutralizer.coverage.test.ts:8; scratchpad/test/github-commands/WorkflowCommand.coverage.test.ts:8
- class: type-safety   severity: required
- standard: EFFECTED_PORT_GOAL.md D15 and §16 (no `any`); Operator rulings, 2026-10-09 (one sanctioned `deliberatelyInvalid<T>` helper per module); §12.5 (dedupe by root cause).   evidence: Both tests bind `const instance = Reflect.construct(<class>, [])` and pass the result to `Object.getPrototypeOf` and `Object.keys`. The classes have private constructors at CommandNeutralizer.ts:64 and WorkflowCommand.ts:108. `node_modules/typescript/lib/lib.es2015.reflect.d.ts:39-44` has a typed construct overload requiring a public `new` signature, followed by a `(target: Function, ...): any` overload; these private-constructor classes select the latter. Fable's strict in-memory checker probe reported `type of instance: any`, `diagnostics: []`. Direct inspection of runner/Exports.ts's `assertionKind` confirms that D15 checks cast/non-null syntax and `AnyKeyword`, so this inferred `any` escapes the green gate. Commit `8ff6872c57` adds both sites.
- failure: The same library-returned `any` enters both test bodies unchecked; a green syntax scan does not prove the stated no-`any` contract.
- fix: Preserve the upstream private constructors and all existing assertions. Add exactly one `scratchpad/test/github-commands/deliberatelyInvalid.ts` exporting `deliberatelyInvalid = <T>(value: unknown): T => value as T` in the sanctioned shape. Import it into both coverage tests and replace the reflective calls with `new (deliberatelyInvalid<new () => CommandNeutralizer>(CommandNeutralizer))()` and `new (deliberatelyInvalid<new () => WorkflowCommand>(WorkflowCommand))()`, respectively. This uses the seat's concrete alternative remedy and gives each instance a known type. Do not delete the tests or change the classes to abstract merely to satisfy coverage; those are unnecessary for this type-safety repair. No README or ledger edit belongs to this group.
- seats: fable-2-1, fable-2-2
- group: g1 — test-only; both coverage tests and their shared new helper.

## Backlog

### grok-2-1 — dependency-free prose contradicts the lab imports

- file: scratchpad/effected/github-commands/index.ts:2; scratchpad/effected/github-commands/README.md:4
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D4, §10.1 and §10.3; inventory instruction deferring documentation/JSDoc findings.   evidence: The entrypoint says “no dependencies and no IO”; the README says “no `effect`, and no dependency at all.” WorkflowCommand.ts:1-7 imports `@beep/identity/packages` and six Effect modules; CommandNeutralizer.ts:1-3 imports three Effect modules. All four contributing reports identify the same false dependency guarantee across the two carriers. Docgen does not validate the factual claim. These are the surviving portions of round-1 grok-1-3/grok-1-4, not the already-corrected badges, installation instructions or usage import.
- failure: The carried lead prose promises a dependency-free module even though the lab source imports Effect and identity.
- fix: During the documentation pass, rewrite both leads to preserve pure string processing and no IO while naming `effect` and `@beep/identity` as the lab dependencies. Keep the accurate no-service/no-layer/no-platform statements. Any requested Port-notes/ledger citation is central deviation-codemod bookkeeping, not a module fix-lane write.
- seats: grok-2-1, grok-2-2, fable-2-3, fable-2-4
- disposition: Documentation backlog; Grok's `law` label does not make prose repair required under the explicit merge instructions.

### fable-2-6 — getter/enumerability deviation lacks an executable witness

- file: scratchpad/test/github-commands/WorkflowCommand.test.ts:52; scratchpad/effected/github-commands/WorkflowCommand.ts:147
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9, §14 and §11.3; inventory instruction deferring coverage/test-floor work and assigning law-forced bookkeeping centrally.   evidence: README.md:58 points to the plain-data rendering test at WorkflowCommand.test.ts:52-57 and explicitly acknowledges that the getter/enumerability edge has no pinning test. Fable cites round-1 evidence: a first-property getter hides the second property's enumerability; upstream `Object.entries` yields `::debug first=a::m`, while Effect `R.toEntries` snapshots keys and yields `::debug first=a,second=b::m`. The step-2 diff `03bf79d41b` proves the replacement was law-forced; round-1 INVENTORY.md already accepts this evidence under the native-runtime deviation. The reported gap is a missing test, not new evidence that the allowed change itself is wrong.
- failure: Current assertions do not pin the accepted accessor/enumerability difference, so its documented lab behavior can change without a regression test failing.
- fix: In the later test/coverage pass, add a case beside the property-rendering test whose first getter makes `second` non-enumerable and assert the lab result `::debug first=a,second=b::m`, retaining all upstream assertions. Name the upstream result in a comment. Keep `R.toEntries`; do not restore forbidden `Object.entries`. Route the resulting README Port-notes/ledger citation update to the per-module native-runtime deviation codemod, with no central-file write assigned to a module lane.
- seats: fable-2-6
- disposition: Missing regression-test/coverage witness stays backlog; recording the law-forced replacement remains central work.

## Handled by the deviation codemod

### fable-2-5 — record the added AnnotationProperties value export

- file: scratchpad/effected/github-commands/README.md:52; scratchpad/effected/github-commands/index.ts:27; scratchpad/effected/github-commands/WorkflowCommand.ts:33
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D2 and D9; Grilling, 2026-10-09 (later), per-module/per-class deviation codemod and `exportsAdded` ruling.   evidence: README Added exports says “None.” The pinned oracle's src/index.ts:14 exports `type AnnotationProperties`; the lab's index.ts:27 exports the schema value and derived type. `028852e4d0` adds `S.Struct` and the type derivation as the round-1 schema-first law repair. Fable also identifies why the green export gate misses the bookkeeping mismatch: added names are checked by name and both-over-type is accepted. The runtime export itself is already required by the accepted schema-first repair, and the report asks only to record it.
- failure: Added-export bookkeeping omits the runtime value gained under an existing upstream type name.
- fix: Have the central codemod list `AnnotationProperties` as a runtime schema value added alongside the upstream type, update `exportsAdded` and relevant export-kind bookkeeping, and link the schema-first deviation. This record does not authorize editing README Port notes or PORT_LEDGER.json in a module repair group.
- seats: fable-2-5
- disposition: Handled centrally; excluded from required.json.

## Rejected

None. Every reported defect has evidence and a concrete admissible remedy after deduplication and reclassification. The inferred-`any` finding specifically demonstrates a green-gate miss. The required fix selects Fable's sanctioned-helper alternative rather than its optional abstract-class/test-deletion proposal; that remedy choice is not an additional rejected finding. Sol's `NO FINDINGS` contributes no record.
