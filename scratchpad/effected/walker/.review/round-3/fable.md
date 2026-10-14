<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review the walker port read-only against the pinned upstream oracle, round-2 inventory, and the port decisions, and report only new findings.Round-2 already dispositioned 18 records. I'll inspect the walker tree at the pinned commit and compare it with the upstream oracle for anything new.The descent loop still looks like the round-2 shape change. I'll confirm that against the review commit and the oracle before treating it as a new finding.The descent loop still diverges from the oracle. Next I’ll check whether `orElseSucceed` swallows defects and whether the new schemas missed the property floor.### fable-3-1
- file: scratchpad/effected/walker/Walker.ts:251
- class: bug   severity: required
- standard: D9; section 14; AGENTS.md Code Laws (a direct helper ref only when behavior is unchanged).   evidence: `effect/Array.ts` `flatMap` calls `f(self[i], i)` (`Array.ts:3734`). The lab passes the public `candidatesFor` through unchanged. The pinned oracle (`packages/walker/src/Walker.ts:158`) calls `candidatesFor(dir)` with one argument. `(dir: string, file?: string) => ReadonlyArray<string>` is assignable to the declared unary callback, so tsgo accepts it. For `["/near", "/far"]` and `(dir, file = ".apprc") => [\`${dir}/${file}\`]`, the oracle probes `"/near/.apprc"` then `"/far/.apprc"`. The lab probes `"/near/0"` then `"/far/1"`, because a supplied index blocks the default. The effect-first ledger row does not record this argument change. Round-2 req-6 named `A.flatMap(dirs, candidatesFor)` and did not catch the arity.
- failure: A type-correct callback can miss the real file or select an index-derived path such as `"0/.apprc"`. Directory order is preserved; the candidate strings are not.
- fix: Call `A.flatMap(dirs, (dir) => candidatesFor(dir))`. Add one regression that records the arguments and the probe order.

### fable-3-2
- file: scratchpad/effected/walker/Descend.ts:513
- class: law   severity: required
- standard: D9; section 14; round-2 INVENTORY.md req-8 (2026-10-09 grilling: restore unforced shape).   evidence: At this commit the walk is still `for (const frame of frames)` (`Descend.ts:454-456`), and the parent real path is `O.getOrThrow(A.last(frame.ancestors))` (`Descend.ts:513`). The pinned oracle uses the head-index loop, the `frame === undefined` stop (`Descend.ts:306-308`), and `frame.ancestors[frame.ancestors.length - 1] ?? frame.absolute` (`Descend.ts:363`). `Option.getOrThrow` throws `Error("getOrThrow called on a None")` (`effect/Option.ts:1092`). No walker ledger deviation records either shape. The carried text still says the worklist is dequeued by head index (`Descend.ts:574-575`).
- failure: Round-2 req-8 is still unapplied. An empty ancestor chain dies where the oracle continues from `frame.absolute`. Seeding makes that chain unreachable today; that does not record the rewrite as an allowed deviation.
- fix: Restore the oracle head-index loop, the undefined-frame stop, its queue comment, and `frame.ancestors[frame.ancestors.length - 1] ?? frame.absolute`. Keep the schema, Option, collection, and sort changes around them.

### fable-3-3
- file: scratchpad/effected/walker/Descend.ts:51
- class: test   severity: required
- standard: D10; EFFECTED_PORT_GOAL.md section 11.4.   evidence: Round-2 exports `OnUnreadableArray` here and `DepthCap` at `Walker.ts:39`. `scratchpad/test/walker/**` never names `OnUnreadableArray`. `DepthCap` appears only in the fixed 11-value tables in `Walker.test.ts` and `Descend.test.ts`. No `it.effect.prop` uses `Arbitrary.schema(DepthCap)` or `Arbitrary.schema(OnUnreadableArray)`. Parent-struct properties and the coverage gate do not register those two schemas.
- failure: The two schemas added in round 2 have no generated encode/decode fidelity property. Section 11.4 requires one property per exported schema, with `Arbitrary.schema` and `fcRuns`.
- fix: Add an `it.effect.prop` for `DepthCap` in `Walker.property.test.ts` and one for `OnUnreadableArray` in `Descend.property.test.ts`. Assert `decode(encode(x))` equivalence and that decoding the encoded value succeeds.

REQUIRED: 3
BACKLOG: 0
