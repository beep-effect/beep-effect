# config-file — round-3 review inventory

Seats read: `grok.md` (no findings), `sol.md` (2 findings), and `fable.md` (no findings), plus `BRIEF.md` and the third-seat `BRIEF.grok3.md`. No part-N subdirectories exist. The `fable` report identifies Grok 4.7 medium as the substitute third seat. All two finding records are accounted for; they describe distinct defects and are not duplicates.

Counts: **Required 2 · Backlog 0 · Codemod 0 · Rejected 0 · Groups 1**. Reviewed commit: `3ad7b305790c7f0903f6d55766c55186745ba2d1`; merge checkout: `@lab/effected-2` (the requested branch name was `@lab/effected`). The pinned oracle is `af7566a9da2eff169cb74955efcc5ede1e5de9f8`, at the cache path in the briefs. Parsed `standards/effect-laws.allowlist.jsonc`: **0 entries** match `scratchpad/effected/config-file/**`, so no `allow-<n>` findings are needed.

Binding precedence: the entire operator revision block, including both 2026-10-09 rulings/grilling blocks, D1–D20, sections 12.4/12.5 and 14, and this merge task's classifications and write limits. The briefs' S2/S3-green claims do not override this task's docs/JSDoc/coverage/vitest-canon deferral; no round-3 seat finding belongs to those classes. Prior-round backlog remains in its prior inventory and is not counted again here.

Provenance: read `git log --format=%h:%s -- <file>` for both affected source files and the original `git log --all` history for `internal/deepMerge.ts`. Inspected its step-2 diffs `cc2b4a93da` (dual overloads), `460daa0998` (generic overload instead of casts), `03bf79d41b` (Effect Array/Record helpers), and S1 diff `6c3abd5e9b` (predicates, HashSet and prototype literal), plus round-2 diff `cdea8d9088` (atomic class values and enumerable symbol preservation). These forced or previously justified changes are not restore targets. Both new defects also exist in the pinned oracle; their required status follows the evidenced upstream-bug exception, not an accusation of unforced lab divergence or missing deviation bookkeeping.

Group `g1` owns `ConfigFile.ts` and `internal/deepMerge.ts`, with `ConfigFile.test.ts`, `MergeStrategy.test.ts`, and `internal/deepMerge.property.test.ts` under `scratchpad/test/config-file/`. Both fixes need public-load regressions in `ConfigFile.test.ts`, so they share one group. Each file has exactly one owner; the group has two source files. Assignments exclude repo configuration, lockfiles, PORT_LEDGER.json and README Port notes; the orchestrator owns deviation bookkeeping. Round 3 ends with the final fix wave and gates, without a fourth review.

Evidence below attributes differential runtime results to Sol's reported read-only probes. This merge independently inspected source, the pinned oracle and commit diffs; it did not rerun runtime probes, vitest, coverage, compiler lanes or scratch-copy diagnostics.

## Required

### sol-3-1 — Merged configuration can violate its decoded schema.
- file: scratchpad/effected/config-file/ConfigFile.ts:777
- class: bug   severity: required
- standard: D11; D9/section 14 verified upstream-bug exception; `standards/schema-first-development-prompt.md`, “Precision carries invariants”; ConfigFile's schema-validated document contract.   evidence: Sol reports a read-only differential probe with `S.Struct({ a: S.optionalKey(S.Int), b: S.optionalKey(S.Int) }).check(...)`, forbidding simultaneous `a` and `b`. Higher-priority `{ a: 1 }` and lower-priority `{ b: 2 }` each decode and satisfy `S.is(schema)`, but both lab and pinned oracle return successful `ConfigFile.load` results `{ a: 1, b: 2 }` for which `S.is(schema)` is false. Sol separately confirms `S.decodeUnknownEffect(S.toType(schema))` rejects the merged value. Source inspection confirms lab `mergeAndEmit` at lines 775–782 and oracle `src/ConfigFile.ts:510–516` forward the strategy output and emit `Loaded` without validating it. Per-source checks and existing merge properties do not establish the merged cross-field invariant, so the green gates miss this defect.
- failure: `load` and the nonempty-source branch of `loadOrDefault` successfully return a value outside the caller's declared decoded schema and announce `Loaded`. Independently valid sources need not remain valid after field-wise merging.
- fix: Validate the strategy output with `S.decodeUnknownEffect(S.toType(options.schema))` before returning it or emitting `Loaded`; preserve the applicable parse options. Map `SchemaError.issue` to `ConfigValidationError.make({ path: O.none(), issue: error.issue })` and widen the internal helper's error annotation. Validate the decoded domain so wire transformations are not applied twice. In `scratchpad/test/config-file/ConfigFile.test.ts`, add mutually exclusive optional-field regressions for both `load` and `loadOrDefault`, assert the typed validation failure and absent path, and verify no `Loaded` event on rejection. Include a transformed-schema success case to protect against double decoding. Preserve the empty-source default behavior. The orchestrator records this evidenced upstream-bug deviation centrally under section 14.
- seats: sol-3-1

### sol-3-2 — Compatible cyclic plain records exhaust the merge stack.
- file: scratchpad/effected/config-file/internal/deepMerge.ts:124
- class: bug   severity: required
- standard: D11; D9/section 14 verified upstream-bug exception; unrestricted plain-record inputs of `deepMerge` and the `MergeStrategy.layeredMerge.resolve` Effect result contract.   evidence: Sol reports a read-only differential probe with two plain records, each having `record.self = record`. Both lab and pinned oracle throw `RangeError: Maximum call stack size exceeded` through `layeredMerge`. A public-load probe using a custom ConfigCodec, an in-memory filesystem and `S.Struct({ self: S.Unknown })` confirms both sources decode successfully, but both implementations exit with `Die(RangeError: Maximum call stack size exceeded)`. Source inspection confirms the recursive call at lab line 124 and oracle `src/internal/deepMerge.ts:76` revisits the same pair without a termination condition. Existing generated merge tests exercise acyclic JSON-shaped values, so the green gates miss this defect. This is distinct from the closed round-2 class-private-state and symbol-key defects.
- failure: Valid decoded cyclic records cause an unbounded recursive merge; direct helper/strategy calls throw synchronously, and `ConfigFile.load` dies instead of returning the merged configuration.
- fix: Within each top-level merge, track active target/source pairs and their allocated results using an ancestor stack scanned with `===`, as the operator's identity-cycle ruling requires. Register each result before descending, reuse it when the same pair recurs, and thread that per-operation state through the internal recursion. Do not add native Map/Set/WeakMap/WeakSet or global reference marks. Preserve priority, own enumerable string/symbol keys, prototype compatibility, atomic class values, pollution protections and input immutability. Add self-cycle and mutual-cycle regressions for the helper in `scratchpad/test/config-file/internal/deepMerge.property.test.ts`, a public strategy regression in `scratchpad/test/config-file/MergeStrategy.test.ts`, and a successful public-load regression using a custom codec and `S.Struct({ self: S.Unknown })` in `scratchpad/test/config-file/ConfigFile.test.ts`. The orchestrator records this evidenced upstream-bug deviation centrally under section 14.
- seats: sol-3-2

## Backlog

None. Neither round-3 record is deferred documentation/test-canon work, outside D11, or dependent on a repo-level write. Earlier-round backlog is not reopened.

## Handled by the deviation codemod

None. No round-3 finding asks only to record identity-derived keys, S.Finite, tagged errors, added exports or native-runtime replacements. Forced adaptation bookkeeping remains centralized and is not an additional finding.

## Rejected

None. Both records supply concrete evidence and a fix, demonstrate runtime defects missed by the green gates, and satisfy section 14's upstream-bug exception. Neither contradicts an operator ruling. The two `NO FINDINGS` reports contribute no finding records.
