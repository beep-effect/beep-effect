### sol-3-1

- file: scratchpad/effected/walker/Walker.ts:251
- class: bug   severity: required
- standard: D9 behavior preservation; section 14; standards/effect-laws-v1.md law 21 permits equivalent helper substitutions when behavior is unchanged.   evidence: A read-only `bun --eval` differential probe imported the pinned oracle’s `Walker.ts` and the lab source, which has no diff from the reviewed commit. With the valid callback `const candidatesFor = (...dirs: readonly string[]): readonly string[] => dirs.map(dir => `${dir}/.apprc`)`, directories `["/near", "/far"]`, and an injected `exists` accepting `/far/.apprc` and `0/.apprc`, the oracle returned `Some("/far/.apprc")` after probing `["/near/.apprc", "/far/.apprc"]`; the lab returned `Some("0/.apprc")` after probing `["/near/.apprc", "0/.apprc"]`.
- failure: Passing `candidatesFor` directly to `A.flatMap` supplies its index argument to a public callback that upstream invokes with exactly one directory argument. A type-correct rest-parameter callback receives a number among its declared strings and can produce extra candidates, select the wrong file, or defect when applying string operations. The recorded Effect-helper migration does not authorize this callback-contract change.
- fix: Use `A.flatMap(dirs, (dir) => candidatesFor(dir))` to preserve the callback’s unary invocation. Add a regression test that checks the callback arguments and resulting probe order.

### sol-3-2

- file: scratchpad/effected/walker/Descend.ts:456
- class: law   severity: required
- standard: D9; the 2026-10-09 grilling ruling requiring restoration of unforced lab changes; round-2 INVENTORY.md req-8.   evidence: At the reviewed commit, lines 454–456 still use array iteration, and line 513 still uses `O.getOrThrow(A.last(frame.ancestors))`. The pinned oracle uses a head-index loop with a guarded frame lookup and an ancestor fallback to `frame.absolute`. Round-2 req-8 explicitly requires restoring both changes. The round-2 repair commit `5791464f47` instead edits the array-iteration comment and adds a justification above the throwing ancestor lookup, retaining both implementations. Neither restoration is recorded as an accepted deviation or deferred required item in the walker ledger.
- failure: The required round-2 restoration remains unapplied. The source retains the two S3 coverage-driven rewrites that the binding inventory identified as unforced. The ancestor lookup also retains a defect-producing empty-chain case where upstream has a fallback; no reachable empty-chain runtime failure is claimed here.
- fix: Apply round-2 req-8 as written: restore the head-index worklist loop and guarded frame lookup, and restore the ancestor fallback to `frame.absolute`. Preserve the surrounding law-forced schemas, Option probes, collection helpers, and sorting.

### sol-3-3

- file: scratchpad/effected/walker/Descend.ts:51
- class: test   severity: required
- standard: D10; EFFECTED_PORT_GOAL.md section 11.4 requires an `it.effect.prop` round-trip property using `Arbitrary.schema(schema)` for every exported schema.   evidence: Round-2 commit `5791464f47` introduces the exported `OnUnreadableArray` schema here and `DepthCap` at `Walker.ts:39`. An exhaustive `git grep` at `3ad7b305` over `scratchpad/test/walker/**` finds no test reference to `OnUnreadableArray`. `DepthCap` appears only in the finite example-table checks in `Walker.test.ts` and `Descend.test.ts`; no property generates either exported schema directly. The property files retain their earlier schema list. Thus the green suite and coverage gate miss the property-floor obligations introduced by these new subpath exports.
- failure: The two newly exported schemas lack the required generated encode/decode fidelity contracts. Existing properties for enclosing option schemas and the depth acceptance tables do not supply the per-export property registrations specified by section 11.4.
- fix: Add focused `it.effect.prop` tests for `DepthCap` in `Walker.property.test.ts` and `OnUnreadableArray` in `Descend.property.test.ts`, using `Arbitrary.schema`, `fcRuns`, and Effect schema codecs to assert successful round trips and equivalent decoded values.

REQUIRED: 3
BACKLOG: 0