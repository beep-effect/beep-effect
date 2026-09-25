# r29-yeet-sweep-worktree-probe-address

## Exact-source P2 refresh — 2026-09-24

Source HEAD: `f97a89bdfdc5bc71b69aab09b8d425591698d42a`. Source hashes, frozen-head equality and input/output bindings are in the companion `audit.json`. This document supersedes historical source coordinates for this owner only. It is a P2 proposal awaiting independent P3; it grants no implementation, dryness or Gate 2 credit.

Disposition: retain the admitted minimal reliability/address cluster at **4 representable / 3 legal**. Reject the R32 expansion to mainCheckedOutElsewhere and branchCheckedOutElsewhere with 16/9. No canonical inventory/design was edited by this audit.

Unless prefixed otherwise, paths below are relative to `packages/tooling/tool/cli/`.

## Current shape and complete-owner boundary

`src/commands/Yeet/internal/Sweep.ts:178-201` defines `SweepGitState`, an exported S.Class and the documented world/planner seam at :120-146. Seven Boolean members pass the campaign net. This design selects only `worktreeProbeUnreliable` (:189) and `mainWorktreePath` (:190), an actual Option-valued field with optional encoded key and constructor None default.

The other fields stay intact: required NonEmptyString branch/mainBranch/headBranch; independent mainCheckedOutElsewhere and branchCheckedOutElsewhere; branchMergedIntoBase; lockfileMovedOnMainUpdate; worktreeDirty/statusProbeUnreliable (separately admitted status owner); and optional-key/None-default mainTip, localTip, remoteTip, pullRequestState, pullRequestHeadBranch, pullRequestHeadOid. Do not constrain branch names, revision text, PR strings, empty absence, ancestry or unrelated combinations through this owner.

The full generic class currently accepts all four selected Boolean/Option-presence projections. Qualification does not infer a restriction merely because the live producer is narrower. It rests on the explicit addressed-observation/handoff contract: the observer at :758-764 discards partial/unreliable addresses and explains why an unobserved holder must not be named; the exported `refreshNotCompletedHandoff` gotcha at :1010-1017 requires a bare command when the holder is unknown. No alternate supported construction combining unreliable with Some(path) was found. Known supported callers agree with the selected restriction.

## R32 expansion adjudication

The raw proposal uses the class gotcha (:142-146), conservative observer writes (:752-764), and the truncated-probe fixture to argue unreliable implies both checkout booleans true plus None path. That describes the observer's normal output, but is too narrow for the supported public helper seam:

- `test/yeet-sweep-plan.test.ts:846-854` deliberately tests an unreadable probe with `mainCheckedOutElsewhere: true`, `worktreeProbeUnreliable: true`, and inherited `branchCheckedOutElsewhere: false`, `mainWorktreePath: None` from :46-68. Its bare handoff is legitimate and must remain representable. The raw 16/9 proposal rejects it.
- Reliable held-main/no-address inputs at :280 and :286 are legitimate partial information. None must not mean main is free.
- `test/support/RetireFenceInvoker.ts:33-51` constructs reliable Some(owningClone) with BOTH checkout booleans false. The retirement gate reads only PR facts. Preserve this fixture instead of tightening its unrelated fields to imitate the observer.
- `Sweep.ts:582-591` derives occupancy and path from the same lookup in the real observer. Thus a pure producer-image analysis would also correlate reliable main occupancy with path presence, contradicting the raw proposal's claim that all eight reliable four-axis combinations are the producer image. Producer reachability and public helper construction are different domains.

The class gotcha needs clarification during implementation: its conservative assignment explanation describes `observeSweepGitState`, while planner/helper construction supports partial facts. It must not be used to silently outlaw supported helper tuples. Preserve both occupancy booleans without defaults or derivation from the new observation. The separate worktreeDirty/statusProbeUnreliable 4/3 owner is neither reopened nor redesigned here.

## Cardinality gap and finite table

| worktreeProbeUnreliable | mainWorktreePath | Contract | Target |
| --- | --- | --- | --- |
| false | None, including omitted constructor address | Supported reliable observation without address; occupancy remains independent | unaddressed |
| false | Some(path) | Supported reliable addressed observation | addressed(path) |
| true | None, including omitted constructor address | Supported unreliable observation without address | unreliable |
| true | Some(path) | Excluded by the explicit no-unobserved-holder contract | unrepresentable |

`finite-table.json` enumerates these four rows and all sixteen proposed expanded projections. The minimal model preserves twelve projections when multiplied by the untouched occupancy pair; this is not a whole-owner cardinality claim. Payload values remain the complete S.NonEmptyString domain. The table is static proof, not a runtime test result.

## Target schema

Keep `SweepGitState` as an annotated class. Replace only the two selected fields with required `mainWorktreeObservation: SweepMainWorktreeObservation`. Use the existing LiteralKit helper to own the discriminants and produce the internal tagged-record union:

```ts
const SweepMainWorktreeObservationKind = LiteralKit([
  "unreliable", "unaddressed", "addressed",
]);
const SweepMainWorktreeObservation =
  SweepMainWorktreeObservationKind.toTaggedUnion("kind")({
    unreliable: {},
    unaddressed: {},
    addressed: { mainWorktreePath: S.NonEmptyString },
  }).pipe($I.annoteSchema("SweepMainWorktreeObservation", {
    description: "A reliable worktree holder address, a reliable unaddressed observation, or an unreadable probe.",
  }));
type SweepMainWorktreeObservation = typeof SweepMainWorktreeObservation.Type;
```

This is a concrete internal discriminated-record composition boundary: local LiteralKit.toTaggedUnion constructs S.Struct members with schema-defaulted tags and calls upstream S.toTaggedUnion. Keep the outer owner class. Add annotations to the literal domain using the repo helper that preserves LiteralKit statics if needed; do not export an unannotated shared schema. No new role file or package is required. Avoid needless new public exports; the class field provides the schema for tests, or export only if an actual consumer requires it.

Use `.cases.unreliable.make({})`, `.cases.unaddressed.make({})`, and `.cases.addressed.make({ mainWorktreePath: path })`; do not supply a defaulted kind. Use schema-derived `.isAnyOf`, `.guards` and `.match`. No manual predicate, parallel union type, broad unknown field, runtime coherence filter, legacy adapter or duplicated field getter.

Keep the replacement field required. Old omission of path meant None, but the old reliability Boolean was required: explicitly migrate each caller to its correct case. Never silently default missing replacement observations. Do not introduce a stricter path schema, trimming, existence check or canonicalization. Spaces, whitespace-only nonempty paths, quotes and shell metacharacters remain valid constructor payloads; existing parser trim and shell quoting retain their current boundary roles.

Reference verification: `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:710-719,793-815` implements and demonstrates this helper. `.repos/effect/packages/effect/SCHEMA.md:2137-2163` and `src/Schema.ts:6178-6233` establish tagged cases/guards/match. `src/Schema.ts:14159-14179` and local `SchemaUtils/withConstructorDefaults.ts:49-54` establish optional-key decode/encode and constructor None semantics. No advanced API is assumed from memory.

## Migration inventory

1. `Sweep.ts:178-201`: replace the selected fields only. Preserve the other fifteen fields and all defaults. Revise owner gotcha :140-146 to distinguish observer conservative writes from legitimate partial helper construction; retain the independent status-pair contract and its separate migration.
2. `Sweep.ts:155-171,458-474`: change both documented class constructors from reliable/omitted address to unaddressed, retaining every other example input.
3. `Sweep.ts:556-591,714-775`: keep probe ordering, captured output, parseWorktreeList, self-path exclusion and first matching branch lookup. Construct the new observation once: unreliable probe -> unreliable; reliable probe -> O.match(worktreeHolding(...)) for unaddressed/addressed. Never retain an address parsed from failed/nonzero/truncated output. Preserve both conservative occupancy writers :752-754 exactly and preserve all other observation fields. Do not add subprocesses or re-read the worktree list.
4. `Sweep.ts:268-279`: replace reliability tests in mainFreePrecondition and branchFreePrecondition with the schema-derived unreliable-case test. Keep exact unreadable-command blocker priority. For either reliable case, use the two untouched occupancy booleans and headBranch exactly as before. Do not infer free/held from an address or None.
5. `Sweep.ts:305-349,404-411`: ff-main, local deletion and end-state continue to use those preconditions with the same arrays/order; head-on-main fast-forward still uses cleanWorktreePrecondition. Remote deletion :351-382 remains independent of worktree-probe failure.
6. `Sweep.ts:1034-1060`: replace the two separate O.match(mainWorktreePath) expressions with one exhaustive observation match that constructs the complete SweepStepNeedsOperator. Both unreliable and unaddressed produce the identical existing bare command and unknown-holder reason; addressed uses its exact path in reason and POSIX-quoted cd/--branch command. Reuse one local no-address thunk if it reduces duplication. Preserve dual invocation forms, full localMain/trackingMain Options, optionText formatting, reason punctuation and shellQuote behavior. Do not rebuild the old Boolean/Option bag.
7. State forwarding/execution stays unchanged: `Sweep.ts:486-507,800-805,842-864,894-917,951-986,1065-1124,1194-1263,1320-1344`. These cover build/plan, leased remote deletion, local/remote revalidation, post-refresh install decision and handoff, end-state routing, step execution, and report writing. Keep time ordering, tip guards, lease semantics, original observed mainTip and post-refresh lockfile diff. No guard deletion credit for these safety checks.
8. `test/yeet-sweep-plan.test.ts:46-76`: base fixture becomes unaddressed. Update stateWith's Partial override input honestly for the new field; remove old Boolean/Option knobs instead of adding a normalizing adapter. `:200-235` truncated fixture becomes unreliable but retains its explicit two true occupancy fields; `:540-585` observer assertions inspect the new case and keep occupancy assertions. The held-main/no-path cases :280/:286 remain unaddressed with main occupancy true. `:801-854` handoff constructors use addressed/unreliable while preserving all unrelated overrides, especially branch occupancy false in :848.
9. `test/support/RetireFenceInvoker.ts:33-51`: migrate reliable Some(owningClone) to addressed(owningClone), preserving both false checkout booleans and all PR facts. This new direct constructor was absent from the historical design's migration inventory and is required for complete current-source coverage. `test/yeet-sweep-retire.test.ts:227` runs this helper; preserve its test process/session-fence behavior.
10. `src/test/Yeet.test-kit.ts:71-72,83-84` exposes Retire/Sweep modules and schemas through the existing test seam. `package.json:67,70,77` blocks internal route imports, maps test imports, and excludes test source from packaged files. Change known decoded TypeScript construction atomically; no old alias/codec is justified for an unsupported raw serialization route.
11. Retirement consumers: `Retire.ts:99-124` retireBlocker reads only pullRequestState/pullRequestHeadBranch; :229-271 retireInvokingWorktree applies that gate; :362-380 renderRetirePlan formats it. None reads the selected fields or requires occupancy tightening. Keep the exact gate, process cwd transition, WorktreeRemovalService request, archive behavior and invoker exemption untouched.
12. CLI routes: `Porcelain.ts:140-169` encodes ordinary SweepPlan/SweepReport; :172-214 encodes retirement documents; :222-245 observes lane facts, forwards them to retirement, then plans/executes a fresh owning-clone sweep. Preserve stdout document shape and plan-versus-execute routing. `Merge.ts:258` and `MonitorLoop.ts:1344` invoke executeSweep without constructing this class or inspecting the selected fields.

Targeted corpus and test searches found no other direct constructor/field reader and no raw SweepGitState codec consumer. Graft edges were supplemented with text/barrel searches, not treated as complete TypeScript reference resolution.

## Guard-deletion accounting

- Delete two independently stored fields and the comment-only unreliable/Some(path) prohibition from the decoded owner; the new tagged schema makes that contradictory combination unavailable.
- Replace the reliability-dependent address write with one complete observation construction. Its input reliability branch and Option choice remain necessary boundary work; do not falsely count them as deleted safety checks.
- Replace the two precondition reliability branches with schema-derived case selection. Observable blockers and their priority remain unchanged; no precondition is removed.
- Delete the two independent Option matches in refreshNotCompletedHandoff and construct one coherent reason/command pair through the union. Two no-address cases share exact output while retaining their distinct observation meaning.
- Retain probeUnreliable, occupancy reads/writes, head comparisons, status/dirty checks, PR/tip/ancestry checks, shellQuote, post-refresh lockfile checks, deletion revalidation and lease enforcement. None earns deletion credit here. Add no compatibility getter rebuilding the removed pair.

## Encoded-side impact

This is Tier 1: a decoded internal/test seam with no located persisted raw-class codec. Known TypeScript callers migrate atomically. Do not serialize the new tag or add a speculative legacy codec.

Preserve existing encoded surfaces exactly: `Sweep.schemas.ts` SweepPrecondition, SweepPlanStep, SweepPlan, SweepStepOutcome, SweepReport; codecs at :383/:412; `Retire.schemas.ts` YeetRetireSweepPlanJson :88 and YeetRetireSweepReportJson :123. Versions stay yeet-sweep-plan/v1, yeet-sweep-report/v1, yeet-retire-sweep-plan/v1 and yeet-retire-sweep-report/v1. Keep every plan action, blocker description/order, status, omission, duration field, reason and operatorCommand. executeSweep continues writing the same sweep-report artifact via its codec. No migration of historical artifacts is needed because raw state is not stored in them.

## Test impact and implementation validation

No product tests or runtime sweep were run during this P2 audit. After independent P3 and Gate 2, implementation must:

- Run focused `yeet-sweep-plan.test.ts` and `yeet-sweep-retire.test.ts` suites, including RetireFenceInvoker; run the required full `bun run beep quality package-verify @beep/repo-cli` and campaign/Yeet checks appropriate to the eventual batch.
- Cover all three target cases and explicitly reject constructing unreliable with an address through the declared model; assert exact path payload preservation. Check old omitted-path constructors migrate to reliable unaddressed or unreliable as their original reliability dictates.
- Preserve held-main/None, unreliable with branch occupancy false, and reliable addressed with both occupancy fields false. These are regression tests against the rejected R32 narrowing.
- Check failed/nonzero/truncated worktree output containing plausible addresses yields unreliable, never addressed, while occupancy remains conservatively true in observer results.
- Compare precondition order and exact handoff command/reason for ordinary paths, spaces, embedded quotes, whitespace-only nonempty direct payloads and shell metacharacters. Cover data-first/data-last handoff calls and full localMain/trackingMain absence/presence combinations.
- Preserve report codec round trip (`yeet-sweep-plan.test.ts:523-537`), untouched remote-deletion behavior on probe failure (:234-235), in-place main rules and retirement JSON shapes. Use finite table as coverage guidance; an equation-only enumeration is not runtime or P3 proof.

## Risk and landing

The main risk is mistaking observer invariants for the full supported constructor contract. The proposed minimal model avoids that by retaining occupancy, including the newly found retirement construction. Other risks are naming a path from truncated output, changing bare/addressed command quoting, or conflating unaddressed with main-free. The migration and tests above cover each explicitly.

Keep this owner separate from the status/dirty owner and unadmitted ancestry/tip correlations. Apply shared Sweep.ts edits serially within the authorized Tier 1 batch after independent exact-source review; rebind if sources change. This P2 refresh is not permission to mutate source now.
