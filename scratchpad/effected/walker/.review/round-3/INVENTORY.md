# walker — round-3 inventory

Seats read: `grok.md` (1 record), `sol.md` (3 records), and `fable.md` (3 records; route header identifies the separate grok-4.7 medium third seat), plus `BRIEF.md` and `BRIEF.grok3.md`. No `part-N` directories exist. All 7 seat records merge into 3 findings.

Counts: **Required 2 · Backlog 1 · Codemod 0 · Rejected 0 · Groups 2**.

The briefs review `3ad7b305790c7f0903f6d55766c55186745ba2d1`. The live checkout is `@lab/effected-2` at `843c475bfdf0e57f6f5d813d956a92b06bd73cdc` (the request names `@lab/effected`); `git diff 3ad7b305 -- scratchpad/effected/walker scratchpad/test/walker` is empty. Unrelated checkout edits are outside this inventory. The complete operator revision block, including the 2026-10-09 rulings and later grilling, D1–D20, sections 12.5 and 14, and this merge request govern disposition. The request defers docs, JSDoc, coverage and vitest-canon findings regardless of the briefs' S2/S3-green claim.

The live `standards/effect-laws.allowlist.jsonc` has **0 walker entries**, so no `allow-<n>` findings are added. Historical removed entries are not recreated. Source history, retained pre-squash step-2/S1/law diffs, the S3 and round-2 diffs, and the pinned upstream oracle were inspected read-only. No compiler scratch copy, test, coverage, repair, session, closeout or ledger command ran.

Write groups: `g1` owns `Walker.ts` and `Walker.test.ts`; `g2` owns `Descend.ts` with no required test edits. Each group has one source file and no overlapping source or test ownership. Deferred property files do not belong to required groups. Root manifests, lockfiles, repo configuration, `PORT_LEDGER.json` and README Port notes are excluded. Future vitest runs must pass `--maxWorkers=2`, one run at a time; module coverage must use `beep-heavy --slot-only`.

## Required

### req-1 — Preserve the unary candidate callback contract

- file: scratchpad/effected/walker/Walker.ts:251; scratchpad/test/walker/Walker.test.ts
- class: bug   severity: required
- standard: D9; section 14; AGENTS.md Code Laws and effect-laws-v1.md law 21 permit direct helper references only when behavior is unchanged.
- evidence: The pinned oracle `packages/walker/src/Walker.ts:158` invokes `candidatesFor(dir)` with exactly one argument. The lab uses `A.flatMap(dirs, candidatesFor)`. The Effect reference `packages/effect/src/Array.ts:3734` invokes `f(self[i], i)`. sol-3-1 reports a read-only differential probe with a valid rest-parameter callback, directories ["/near", "/far"], and `exists` accepting /far/.apprc and 0/.apprc: upstream returns Some("/far/.apprc") after probing /near/.apprc then /far/.apprc; the lab returns Some("0/.apprc") after probing /near/.apprc then 0/.apprc. fable-3-1 supplies the same arity defect with an optional defaulted second argument. `git show 5791464f47 -- scratchpad/effected/walker/Walker.ts` identifies the direct flatMap reference as the round-2 helper migration. These callbacks are type-correct, so green type and test gates miss the contract change.
- failure: A public callback receives a numeric index where upstream supplies no second argument. It can manufacture extra candidates, miss the intended file, select the wrong file, or defect while treating rest arguments as strings. A law-forced helper migration does not authorize this behavior change; this finding challenges the implementation itself, rather than its deviation bookkeeping.
- fix: Use `A.flatMap(dirs, (dir) => candidatesFor(dir))`. Add a regression in Walker.test.ts using a type-correct rest-parameter callback that records its arguments and an injected exists probe that records candidate order; assert each callback invocation receives exactly one directory and the selected file and probe order match upstream. Preserve directory-major candidate ordering and existing oracle assertions.
- seats: sol-3-1; fable-3-1

### req-2 — Restore the unforced descent worklist and ancestor fallback

- file: scratchpad/effected/walker/Descend.ts:454-456,511-513
- class: law   severity: required
- standard: D9; section 14; Grilling, 2026-10-09 (later), restore unforced lab changes and any upstream test lines they rewrote; round-2 req-8.
- evidence: The pinned oracle `packages/walker/src/Descend.ts:304-308` uses the head-index queue comment, `for (let head = 0; head < frames.length; head += 1)`, `const frame = frames[head]`, and `if (frame === undefined) break`; :363 uses `frame.ancestors[frame.ancestors.length - 1] ?? frame.absolute`. `git log --format=%h:%s -- scratchpad/effected/walker/Descend.ts` and retained history via `--all` locate the forcing commits. Inspected step-2 diffs 7f67982f77, cef8540629 and 03bf79d41b do not rewrite either site; S1 03c27d2a90 drops the frozen empty ancestor chain but retains both shapes. The pre-S3 source retains them. `git show 7aae242a6e -- scratchpad/effected/walker/Descend.ts` explicitly replaces them with array iteration and `O.getOrThrow(A.last(frame.ancestors))` during S3 coverage work, with no law, diagnostic or verified upstream bug forcing those edits. `git show 5791464f47` changes the loop comment and adds an ancestor invariant comment while keeping both rewrites. All three seats confirm round-2 req-8 remains unapplied. The S3 diff for the upstream Descend.test.ts is empty.
- failure: The coverage-driven source rewrites remain an unforced divergence from the oracle and an outstanding required restoration. The throwing ancestor read also lacks upstream's empty-chain fallback. Current seeding makes that case unreachable; no reachable runtime failure or measured performance regression is claimed. Green gates do not enforce upstream source-shape parity. The carried head-index paragraph at :574-575 corroborates the retained oracle contract; this is a source restoration, not a required documentation cleanup.
- fix: Restore the upstream head-index loop, guarded frame lookup, undefined-frame break and queue comment. Restore `frame.ancestors[frame.ancestors.length - 1] ?? frame.absolute`, removing the added justification for a throwing read. Preserve the surrounding forced schema, tagged-error, Option probe, sorting, collection and non-freezing changes. Restore any upstream test lines rewritten specifically for these two source changes; the inspected S3 diff shows none, so this group requires no test edit. Do not weaken or delete tests, add coverage-ignore comments, substitute another structural refactor, or record these unforced changes as accepted deviations. Any coverage-policy conflict belongs to deferred S3 work.
- seats: grok-3-1; sol-3-2; fable-3-2

## Backlog

### backlog-1 — Add round-trip properties for the two new schema exports

- file: scratchpad/effected/walker/Descend.ts:51; scratchpad/effected/walker/Walker.ts:39; scratchpad/test/walker/Descend.property.test.ts; scratchpad/test/walker/Walker.property.test.ts
- class: test   severity: backlog
- standard: D10; section 11.4; merge request defers coverage and vitest-canon/S3 findings.
- evidence: Round-2 commit 5791464f47 exports OnUnreadableArray and introduces DepthCap. Search of scratchpad/test/walker finds no OnUnreadableArray reference; DepthCap appears in example-table checks in Walker.test.ts and Descend.test.ts, but neither schema has its own `Arbitrary.schema` round-trip registration. Both seats explain that enclosing-schema properties and green coverage do not enforce the per-export property floor.
- failure: The two added schema exports lack the generated encode/decode fidelity contracts required at S3. This is a demonstrated property-floor gap, with no demonstrated schema implementation defect, so the request's S3 deferral makes it backlog despite the seats' required classification.
- fix: During S3 work add an `it.effect.prop` for DepthCap in Walker.property.test.ts and one for OnUnreadableArray in Descend.property.test.ts, using `Arbitrary.schema`, `fcRuns` and Effect Schema codecs to assert successful decoding and `decode(encode(x))` equivalence. Keep existing enclosing-schema properties and depth acceptance tables.
- seats: sol-3-3; fable-3-3

## Handled by the deviation codemod

None. No round-3 seat finding only requests bookkeeping for a forced change. The existing law-forced schema, collection, identity, tagged-error and export changes remain subject to central per-module, per-class bookkeeping; this inventory does not create additional findings for them or assign ledger/Port-notes edits.

## Rejected

None. Every seat record supplies evidence and a concrete fix. Duplicate reports are merged above, rather than counted as rejections. The two required defects demonstrate gaps in the green gates; the remaining test finding is deferred to backlog.
