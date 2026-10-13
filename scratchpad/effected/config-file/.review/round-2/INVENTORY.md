# config-file — round-2 review inventory

Seats read: `grok.md` (2 findings), `sol.md` (2 findings), and `fable.md` (no findings), with `BRIEF.md` and the third-seat `BRIEF.grok3.md`. There are no part-N subdirectories. All four finding records are accounted for; narrative mentions of another seat do not contribute a finding id. The third seat's route header identifies Grok 4.7 medium standing in for Fable.

Reviewed commit: `60fcfb5ebcdc26765a66cc1f13afc88adcb05d11`; pinned oracle: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` at the cache path named in the briefs. Merge checkout: `@lab/effected-2`. Binding precedence: the entire operator revision block, including the 2026-10-09 rulings and later grilling, D1–D20, sections 12.4/12.5 and 14, then this merge task's explicit classifications and write-surface limits.

Counts after deduplication: **Required 2 · Backlog 2 · Codemod 0 · Rejected 0 · Groups 1**. The two required findings share a source file but describe different defects: invalid class construction and omitted symbol keys.

Native-runtime allowlist: parsed `standards/effect-laws.allowlist.jsonc`; **0 entries** match `scratchpad/effected/config-file/**`. No `allow-<n>` records are needed.

The briefs and Grok report claim S2/S3 are green. This merge task explicitly defers docs, JSDoc, coverage and vitest-canon findings, so both documentation records remain Backlog. Their concrete evidence shows documentation gaps, rather than merely repeating a gate-enforced rule. No seat requests a repo-level change; any such dependency belongs in Backlog with reason "outside the port's write surface".

Provenance check: `git log --format=%h:%s -- scratchpad/effected/config-file/internal/deepMerge.ts` exposes the squashed progress commit `7929b1f529`; `git log --all` also exposes the original step commits. Read diffs for `cc2b4a93da` (step 2: dual overloads), `460daa0998` (step 2: generic overload replacing casts), `03bf79d41b` (step 2: Effect Array/Record helpers), `6c3abd5e9b` (S1: predicates, HashSet and prototype literal), and `cf9011d347` (round 1: preserve constructor/prototype fields). These are diagnostic/law-forced adaptations or the previously evidenced upstream-bug fix. Neither round-2 defect is an unforced lab divergence: the pinned oracle already constructs a prototype-only object and enumerates only string keys. Do not restore native APIs or undo the round-1 fix. The required work is authorized by the separately evidenced upstream-bug exception in section 14, not by missing deviation bookkeeping.

Group `g1` owns `internal/deepMerge.ts` and `MergeStrategy.ts`, plus `MergeStrategy.test.ts`, `MergeStrategy.property.test.ts`, and `internal/deepMerge.property.test.ts`. The second source file carries the public merge contract that must agree with the class-handling fix. The tests cover the private-state regression, necessary class-merge expectation retargeting, and symbol preservation. Every source/test path has one owner; the group has two source files. These assignments authorize no shared ledger, configuration, lockfile or README Port notes writes. Required bug-fix deviations are recorded centrally by the orchestrator; they do not create extra bookkeeping findings.

Evidence below distinguishes the seats' reported read-only differential probes from this merge's source, oracle and history inspection. No vitest, coverage, compiler lane or scratch-copy diagnostic run was performed for this merge.

## Required

### sol-2-1 — Prototype-only construction creates class instances with invalid private state.
- file: scratchpad/effected/config-file/internal/deepMerge.ts:112
- class: type-safety   severity: required
- standard: D11; D9/section 14 verified upstream-bug exception; `MergeStrategy<A>.resolve` promises `Effect<A>`; the merge contract promises working class getters.   evidence: Sol reports a differential probe using a decoded `S.Class` with `port: S.Int`, private field `#secret = "ready"`, and a getter reading it. Both lab and pinned oracle returned `outputInstance: true`, but the result's getter threw `TypeError: Cannot access invalid private field`; the input getter returned `"ready"`. Source inspection confirms lab line 112 installs the prototype on a fresh object without running the class constructor; the oracle uses `Object.create(Object.getPrototypeOf(target))` with the same limitation. The existing class tests use getters backed by enumerable fields and do not exercise private-field brands.
- failure: `layeredMerge` returns a counterfeit instance that passes `instanceof` but cannot execute valid methods/getters using private state. `ConfigFile.load` forwards that value as `A`, so a successful load can fail on a correctly typed member access. This is independent of the closed round-1 constructor/prototype-field defect and is not repaired by documenting the law-forced prototype-literal substitution.
- fix: Treat non-plain class instances as atomic and return the highest-priority instance intact; merge only compatible plain records recursively. Cover both `canMerge`/`layeredMerge` and direct `deepMerge` calls so the helper cannot manufacture counterfeit instances. Add a decoded-schema-class private-field getter regression and identity assertions in `MergeStrategy.test.ts` and `internal/deepMerge.property.test.ts`; strengthen the class property in `MergeStrategy.property.test.ts`. Retarget the existing class-field-copy expectation at `MergeStrategy.test.ts:95` to the justified atomic representation while retaining inherited-accessor safety coverage for mergeable records. Update the affected contract prose/examples in `internal/deepMerge.ts` and `MergeStrategy.ts`. If field-wise class merging is retained instead, it requires an explicit constructor-aware reconstruction path that passes the same regressions. The orchestrator records this evidenced upstream-bug deviation and any adjusted upstream test lines centrally under section 14.
- seats: sol-2-1

### sol-2-2 — Deep merge drops required enumerable symbol fields.
- file: scratchpad/effected/config-file/internal/deepMerge.ts:119
- class: type-safety   severity: required
- standard: D11; D9/section 14 verified upstream-bug exception; `MergeStrategy<A>.resolve` promises `Effect<A>` and the generic `deepMerge` overload promises `T`.   evidence: Sol reports a differential probe decoding both inputs through `S.Struct({ [required]: S.String, port: S.Int })` with `required = Symbol("required")`. Both lab and pinned oracle returned `before true after false symbol undefined keys ["port"]`. Lab lines 119 and 123 call `R.keys`; the installed Effect implementation (`node_modules/effect/src/Record.ts:1555`) returns string keys through `Object.keys`. The oracle also uses `Object.keys` in both loops. The copy helper at lab line 139 accepts only `string`, and existing generated merge schemas have string keys.
- failure: Merging valid schema-decoded records silently removes required symbol properties and returns a value outside `A`/`T`; field access and subsequent schema encoding can fail. Preserving string-keyed constructor/prototype fields in round 1 did not fix this distinct key-domain defect. No green gate reported in the brief establishes symbol-key preservation.
- fix: Include own enumerable symbol keys alongside string keys in both copy loops, widen the property-copy helper and internal record access to a type-safe `PropertyKey` domain, and retain own-property checks, inert data-property definitions, higher-priority values, recursive plain-record merging and the string `__proto__` filter. Preserve non-enumerable exclusion and input immutability. Add schema-validity regressions in `MergeStrategy.test.ts` for symbols on both sources, priority collisions and nested records; extend `internal/deepMerge.property.test.ts` to exercise the helper directly. Keep the forced Effect-helper adaptations and the round-1 constructor/prototype protections. The orchestrator records the separately evidenced upstream-bug deviation centrally under section 14.
- seats: sol-2-2

## Backlog

### grok-2-1 — The internal crypto module lost its upstream lead documentation.
- file: scratchpad/effected/config-file/internal/crypto.ts:1
- class: jsdoc   severity: backlog
- standard: D4; sections 10.1/10.2; this merge task's documentation/JSDoc deferral.   evidence: The pinned oracle `src/internal/crypto.ts:1–14` contains the AES-GCM/WebCrypto lead, the dependency-cycle warning, and the contract that plain `CryptoFailure` records are lifted by `EncryptedCodec`. The lab begins with imports and lacks this lead. Grok explains that exported-symbol description enforcement does not inspect this file-level block, so the reported green docgen gate can miss it. This is the concrete remaining gap previously identified as `fable-1-13`, not a new runtime failure.
- failure: Carried design rationale and the failure-lifting contract are absent; a later maintainer can miss why importing `ConfigEncryptionError` here introduces a cycle. No currently failing decode, encryption operation or typed failure is demonstrated.
- fix: Restore the complete pinned-oracle lead above the imports, convert `@remarks` to `**Details**`, and retain `@internal` without dropping prose.
- seats: grok-2-1
- backlog reason: Documentation/JSDoc findings are deferred by this merge task, irrespective of the seat's S2-stage claim.

### grok-2-2 — Inline event fields and the short-ciphertext message lack descriptions.
- file: scratchpad/effected/config-file/ConfigEvent.ts:70; scratchpad/effected/config-file/EncryptedCodec.ts:15
- class: schema   severity: backlog
- standard: Operator identity step 4; `standards/schema-first-development-prompt.md`; D11; this merge task's documentation deferral.   evidence: The twelve `ConfigEventPayload` tagged variants at lines 70–99 retain upstream variant comments but their inline fields lack `annotateKey` descriptions; `CiphertextTooShortError.message` is a bare `S.String`. The enclosing union and error have identity/description annotations. Export-level description enforcement can remain green without inline field descriptions. This revisits the remaining documentation gap identified as `fable-1-12`.
- failure: Generated schema documentation omits field descriptions. The seat reports no decoding, encoding, identity or runtime correctness defect.
- fix: Add `annotateKey` descriptions to the fields of the nonempty event variants using the carried comments, and describe `CiphertextTooShortError.message`; preserve the comments until their prose is carried by the annotations. The empty `NotFound` variant has no fields to annotate.
- seats: grok-2-2
- backlog reason: Documentation-only schema annotations are deferred and the reported gap is outside D11's required correctness/idiom definition.

## Handled by the deviation codemod

None. No round-2 seat finding asks only to record identity keys, numeric schemas, tagged errors, added exports or native-runtime replacements. Existing law-forced changes and future required-bug deviation bookkeeping remain centralized; they are not new required findings or write assignments.

## Rejected

None. All four finding records have concrete evidence and fixes; none contradicts an operator ruling or merely repeats a green-gate-enforced finding without showing the gate's coverage gap. Fable's `NO FINDINGS` contributes no record.
