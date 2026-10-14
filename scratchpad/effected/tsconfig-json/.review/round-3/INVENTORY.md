# tsconfig-json — round-3 merged inventory

Seats read: `grok.md` (no findings), `sol.md` (`sol-3-1`), and `fable.md` (`fable-3-1`), with `BRIEF.md` and `BRIEF.grok3.md`. The fable filename identifies the separate grok-4.7 medium fallback seat. There are no part-N reports. Two seat records describe two distinct defects; neither is a duplicate.

Counts: **Required 2; Backlog 0; Codemod 0; Rejected 0; Groups 2**.

The briefs name commit `3ad7b305790c7f0903f6d55766c55186745ba2d1`. The inspected checkout is `@lab/effected-2` at `9f73185dd8517933985c39c9a3ba6f9765480185`, rather than the requested `@lab/effected`. The affected source files and assigned existing test files have no diff from the brief commit. No branch change was made. Binding precedence is the complete operator revision block, including the 2026-10-09 rulings and later grilling, D1–D20, sections 12.5 and 14, and this task's explicit merge/write-surface rules. Documentation, JSDoc, coverage, and vitest-canon findings would be deferred under this task regardless of the briefs' S3 claim; no seat raised one. Reported green gates were not rerun or independently certified. Verification here used source/history reads and in-memory Bun probes, with no vitest or coverage run.

`standards/effect-laws.allowlist.jsonc` contains **zero entries** for `scratchpad/effected/tsconfig-json/**`, so there are no `allow-<n>` findings to add. The round-2 inventory and its fix commit were read to distinguish new defects from closed findings. Neither retained finding merely requests recording a law-forced change.

## Required

Each group owns one source file and its listed test files. Every source/test file belongs to at most one group. Ownership excludes README Port notes, `PORT_LEDGER.json`, root/package manifests, lockfiles, and repo configuration. These are round-3 fix instructions, not edits performed by this inventory merge.

| Group | Source ownership | Test ownership | Findings |
| --- | --- | --- | --- |
| g1 | `scratchpad/effected/tsconfig-json/ResolvedTsconfig.ts` | `scratchpad/test/tsconfig-json/ResolvedTsconfig.test.ts` | `sol-3-1` |
| g2 | `scratchpad/effected/tsconfig-json/PortableTsconfig.ts` | `scratchpad/test/tsconfig-json/PortableTsconfig.test.ts` | `fable-3-1` |

### sol-3-1
- file: scratchpad/effected/tsconfig-json/ResolvedTsconfig.ts:118; scratchpad/effected/tsconfig-json/ResolvedTsconfig.ts:231
- class: law   severity: required
- standard: `standards/effect-laws-v1.md`, short law 6 and Allowlist Contract; `standards/effect-first-development.md`, EF-5; D5/D11.   evidence: The live `rebuildRecord` and `extractPassthrough` implementations both call `Object.defineProperty`, and neither differs from the reviewed commit. This is concrete surviving native Object use despite the brief's green native-runtime claim, with no module allowlist entry. Sol's replacement probe is corroborated by an independent in-memory Bun comparison of the current loop with `R.fromEntries(A.map(R.toEntries(source), ...))` on own `__proto__`, `constructor`, and ordinary keys: `sameValues: true`, `samePrototype: true`, `sameDescriptors: true`. The two sites share one prohibited record-construction root cause and were absent from the round-2 required findings.
- failure: Compiler-option path rebuilding and unknown-key passthrough still use native Object operations prohibited in domain logic. Replacing them carelessly could also lose own hostile keys or change getter evaluation order.
- fix: Replace both construction loops with `R.fromEntries`. In `rebuildRecord`, map `R.toEntries(source)` to transformed entries while preserving enumeration and transformation order. In `extractPassthrough`, filter `R.keys(source)` against `consumed` before reading retained values and constructing entries; do not eagerly read consumed getters. Preserve own `__proto__` and `constructor` keys as data and the ordinary output prototype. Add focused regressions in `ResolvedTsconfig.test.ts` for hostile own keys through both helpers' public call paths and for skipping consumed getters. The inspected ResolvedTsconfig tests do not contain the pollution assertions the seat says to retain, so add them rather than assuming existing coverage. Keep all existing behavior assertions. Central codemod bookkeeping remains outside this group.
- seats: sol-3-1

### fable-3-1
- file: scratchpad/effected/tsconfig-json/PortableTsconfig.ts:196
- class: schema   severity: required
- standard: D5/D11; `standards/schema-first-development-prompt.md`, deterministic schema transformations and Derive behavior instead of duplicating truth; round-2 `sol-2-1` requires deriving the portable options model from preserved CompilerOptions fields.   evidence: `PortableCompilerOptions` picks `CompilerOptions.schema.fields` but wraps the resulting struct in `S.toType`, discarding the field codecs' case-folding decode transformations (`CompilerOptions.ts:37–45`). An independent read-only Bun probe uses the actual `$schema` from `PortableTsconfig.make({})`: `{ target: "ES2022", noEmit: true, composite: false }` and `{ lib: ["ESNEXT"], noEmit: true, composite: false }` both decode through CompilerOptions to lowercase; portable decoding returns `None` for the uppercase inputs and `Some` for their canonical counterparts. The property tests generate canonical Type values, so their green status does not demonstrate this external-input behavior. `git log --format=%h:%s --` and the `53bc616e8f` round-2 diff locate this wrapper in the new precise model. Step-2 `8c0a95cc38` and law `03bf79d41b` only adapt the discrimination guards; S1 `2ef54156d6` shows no PortableTsconfig change. The law-forced S.Opaque model and required round-2 invariant tightening are retained; this finding concerns a defect in that model, not bookkeeping or wholesale restoration of the pre-schema upstream interface.
- failure: A portable document boundary rejects supported mixed/uppercase compiler-option spellings that the source CompilerOptions codecs accept and normalize. Deriving the fields and then stripping their transformations makes the new portable decoder inconsistent with those codecs.
- fix: Remove only the outer `S.toType` around the portable options struct, retaining the picked field codecs, identity annotations, optional types, required `noEmit: true` / `composite: false`, and excess-key stripping. Add decode regressions in `PortableTsconfig.test.ts` for mixed/uppercase target, module, jsx, moduleResolution, moduleDetection, and lib values, checking canonical lowercase output and unchanged canonical encoding. Retain invalid-option/forced-flag rejection and machine-path stripping assertions. Keep `make` as the upstream projection of CompilerOptions.Type; the seat's hand-built uppercase make example does not authorize adding normalization to that typed projection. No upstream test lines were rewritten to require uppercase rejection in the inspected round-2 diff, so no upstream-test restoration is needed for this fix.
- seats: fable-3-1

## Backlog

None. No seat finding is documentation/JSDoc/coverage/vitest-canon work, outside D11, or outside the port's write surface.

## Handled by the deviation codemod

None. Neither seat requests only recording identity keys, finite numbers, tagged errors, added exports, schema statics, or native-runtime replacements. Any bookkeeping generated after the fixes remains centrally owned.

## Rejected

None. Both findings cite live evidence, a binding standard, an observable defect, and a concrete in-surface fix. The native-runtime finding demonstrates surviving prohibited calls despite the green gate claim; the schema finding identifies decoder behavior not enforced by the canonical-value property tests. Neither contradicts an operator ruling.
