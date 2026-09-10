# Current shape

Full corrected native P2 provisional for stable `yeet-merge-ready-verdict`. Frozen source: HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`, origin/main `d1b4d769fbaffddd55717f3b1ba461897dd545c5`. Current design remains unchanged, SHA-256 `d7dffcd24a674ec5f0ecfce63e1296e425eb249080b22b8aadfbff1b3b84bd14`. Independent reconciliation and P3 remain pending.

- id: `yeet-merge-ready-verdict`
- file:line: `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:469`
- symbol: `YeetMergeReady`
- members: `ready`, `failing`, and eight booleans in `criteria`
- evidence classes:
  - E3 at `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:339` — absence of a blocker requires ready plus every criterion true.
  - E4 at `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:347` — a named blocker requires not-ready plus that criterion false.

`YeetMergeReadyCriterion` at `Verdict.ts:215-237` names eight hard criteria. The broad `YeetMergeReadyCriteria` observation class at `:265-280` stores all eight booleans plus display-only Greptile score. `YeetMergeReady` at `:469-478` adds `ready` and optional `failing`, checked by `YeetMergeReadyCoherenceCheck` at `:330-359`. Its persisted source schema at `:361-380` also accepts legacy missing fields and the `checks-green`/`checksGreen` spellings.

The persisted contract does not require the named blocker to be the first false criterion. The coherence check requires only that the named criterion is false, JSDoc at `:443-447` calls it “the one recorded as unsatisfied,” the coherence suite proves that rule, and `MonitorLoop.ts:958-962` renders the stored name as operator guidance. `Status.ts:1051-1058` chooses the first false criterion only for newly derived status.

# Cardinality gap

Ignoring Greptile, the bag represents 4,608 combinations: two ready values, nine blocker values, and 256 truth tables. It has 1,025 coherent states. The all-true table has one ready/no-blocker state. Across all truth tables, every choice of one false criterion is a legitimate stored blocker: the sum of false positions is `8 * 2^7 = 1,024`. The earlier 256 figure described the current Status writer’s first-false projection, not the accepted persisted domain.

# Target schema

Retain `YeetMergeReadyCriterion` and broad `YeetMergeReadyCriteria`; watch mode needs the independently constructible observation carrier and all later observations.

Create `YeetMergeReadyReadyCriteria` with all eight fields `S.Literal(true)` and the same Greptile Option field. Create eight named blocked-criteria classes. Each blocked class makes only its named criterion `S.Literal(false)` and leaves all other criteria `S.Boolean`; this preserves coherent artifacts whose meaningful named blocker is not the earliest false observation.

This gives the structural invariant directly: the ready case can exist only with all eight true; every blocked case can exist only with its discriminating named criterion false. Earlier and later criteria remain independent observations in a blocked case. There is no decoded `ready` boolean and no optional decoded blocker to reconcile.

Wrap the blocked criteria in eight classes discriminated by `failing: S.tag(...)`, then form `YeetMergeReadyBlocker` from the existing criterion LiteralKit members and `S.toTaggedUnion("failing")`. Reuse that eight-value identity vocabulary. Define one annotated `YeetMergeReadyStatus = LiteralKit(["ready", "blocked"])` for the outer cases and derive the outer union from its members:

```ts
class YeetMergeReadyReady extends S.Class<YeetMergeReadyReady>(...)(
  { status: S.tag("ready"), criteria: YeetMergeReadyReadyCriteria }, ...
) {}

class YeetMergeReadyBlocked extends S.Class<YeetMergeReadyBlocked>(...)(
  { status: S.tag("blocked"), blocker: YeetMergeReadyBlocker }, ...
) {}

export const YeetMergeReady = YeetMergeReadyStatus.mapMembers(
  Tuple.evolve([() => YeetMergeReadyReady, () => YeetMergeReadyBlocked])
).pipe(
  S.toTaggedUnion("status"), ...
)
export type YeetMergeReady = typeof YeetMergeReady.Type
```

Use named classes and annotations. `S.tag` supplies discriminators. Export a lossless projection from every exact verdict to broad criteria. Keep `mergeReadyCriterionHolds` dual over the broad carrier for watch snapshots/diffs.

The missing canonical `failing` member was already present in this design's model and cardinality. Reanchoring the separate encoded D1 census record to the actual nested `criteria` schema changes no persistence contract here: its complete wire schema remains the boundary input, including all optional fields. The material R28 repair is the separate generic command serializer at `Handler.ts:1251`, which otherwise exposes the new decoded union instead of the old readiness value.

Define one total inverse from the new union to the exact old decoded readiness value: `{ ready: boolean, failing: Option<YeetMergeReadyCriterion>, criteria: YeetMergeReadyCriteria }`, retaining that property order and the criteria's complete runtime Greptile Option. The ready case maps to true/None; a blocked case maps to false/Some(the stored named blocker) and the full broad criteria projection. This inverse is shared by two schema-owned output boundaries: the existing artifact boundary converts those old decoded fields through their original optional-key codecs, while the generic command boundary retains them as runtime Options. Use the local Effect v4 `S.toType` pattern already specified by the remote-status design when a boundary's Encoded side must be the old decoded value; do not feed Options into a schema expecting optional keys or double-decode them.

Extend the bounded `printYeetStatusCommandJson` adapter specified by `yeet-status-remote-check-phase.md`: retain its existing remote projection, and map only the Some value of `snapshot.mergeReady` through the same readiness inverse. Preserve the outer mergeReady Option exactly, including None. Replace the two values at their existing snapshot property positions, then use the existing `printCommandJson`; do not serialize the whole snapshot through `YeetStatusSnapshotJson`, which would change established Option representations on command stdout. If readiness is integrated before the remote adapter, add the bounded readiness projection and let the later remote change compose into that one adapter. There must be one command printer, not competing adapters or a second readiness truth table.

# Migration inventory

- `Verdict.ts:215-317` — retain criterion kit, broad carrier, and dual observation helper; add ready and eight named blocker-specific criteria classes.
- `Verdict.ts:330-359` — delete the bag coherence filter; structural ready/blocker cases replace it.
- `Verdict.ts:361-428` — retain the exact current/legacy encoded bag and conservative legacy normalizer behavior. `threadsResolved` remains required. The seven optional hard-criterion fields default false. A record is complete only when all seven current optional fields, including `requiredChecksGreen`, are present. Complete records preserve `ready` and the stored blocker, mapping legacy `failing:"checks-green"` to `required-checks-green`; the new structural union rejects the same complete contradictions as today. Incomplete records remain forced blocked and select the first false criterion after defaults, ignoring their redundant encoded answer as today. A legacy `criteria.checksGreen` value does not make the current required-check observation complete and is not substituted for `requiredChecksGreen`; the tests at `yeet-merge-ready-coherence.test.ts:145-170` prove this conservative downgrade.
- `Verdict.ts:469-518` — replace the checked bag with nested tagged unions; make `YeetMergeReadyFromEncoded` bidirectional so it projects exact decoded cases to the old object.
- `Verdict.ts:594,776,867` — keep the compatibility codec at `YeetVerdict` persistence and the decoded union in build inputs/projection.
- `Status.ts:281` — keep the same compatibility codec nested in `YeetStatusSnapshot` persistence.
- `Status.ts:1051-1127` — preserve first-false as this producer’s documented policy; construct the matching exact case from the complete observation carrier.
- `Status.ts:1138,1299-1308` — use outer guards/match and project criteria once for display.
- `MonitorLoop.ts:958-962` — render ready/blocked through the outer union while preserving exact messages and the stored blocker name.
- `WatchMode.ts:321`, `WatchStream.ts:42,253-256,794-813`, and `YeetWatchSnapshot` — preserve broad observation construction, defaults, and all eight comparisons.
- `Handler.ts:1248-1253` — use the bounded status command printer above, preserving `YeetCommandError` mapping, `CommandJsonOutput` injection, compact JSON, bounded UTF-8 writes and one trailing newline (`src/internal/cli/Json.ts:16-39,115-120,296-302`). Artifact encoding alone does not prove this output.
- `Handler.ts:1053,1215,1333,1518` — preserve the opaque `O.Option<YeetMergeReady>` state transfer; it has no shape reader.
- `src/test/Yeet.test-kit.ts:69` — existing internal wildcard export covers new cases; do not expand the public Yeet facade solely for tests.

Graft's complete incoming graph found Status, Handler, MonitorLoop, Porcelain and Yeet.command. Exhaustive source searches separately located the class/codec, broad observation readers, artifact writers and Handler's generic print at `:1251`; graph absence was not used as no-consumer proof. The current remote-status design already names that generic boundary but changes only `snapshot.remote`, which is why this readiness projection must be added. No new public Yeet facade is needed solely to expose private Value/boundary models.

The withdrawn `r2-tooling-sweep-plan-operator-handoff` is not a data or schema dependency of this migration. The current design names no SweepPlanStep fields; Verdict readiness, Status collection and Watch observation schemas do not import that carrier. MonitorLoop/Porcelain also orchestrate sweeps, but shared orchestration does not require redesigning SweepPlanStep. Preserve those sweep calls and existing encoded precondition/operator behavior unchanged. Remove only any parent plan sequencing dependency on implementing its withdrawn design.

# Guard-deletion accounting

Delete `YeetMergeReadyCoherenceCheck` and its three-way invariant prose at `Verdict.ts:330-359`; decoded cases make ready/no-blocker and blocked/named-false structural. Delete boolean/Option reconstruction in `Status.ts:1126-1127`, `:1299-1308`, and `MonitorLoop.ts:958-962`. Retain first-false selection in Status as a producer policy and retain the broad criterion interpreter for watch observations. The compatibility transform and the two existing output contracts remain required. Add no parallel coherence predicate to the command adapter: it uses the single total inverse from valid union cases. Schema decoding, not an ad-hoc repair wall, rejects complete contradictions.

# Encoded-side impact

Keep the persisted object exactly:

```ts
{
  ready: boolean
  failing?: YeetMergeReadyCriterion | "checks-green"
  criteria: {
    prOpen?: boolean; notDraft?: boolean; closeoutRun?: boolean
    requiredChecksGreen?: boolean; checksGreen?: boolean
    threadsResolved: boolean; mergeable?: boolean
    mergeStateAcceptable?: boolean; reviewDecisionAcceptable?: boolean
    greptileScore?: string
  }
}
```

Complete coherent artifacts decode and re-encode with the same current keys, all observations, and the same named blocker, including a later false blocker. Contradictory complete artifacts retain current rejection. Incomplete legacy records retain the exact current conservative rules: optional criteria default false, the result is forced blocked, and the first defaulted false criterion becomes the blocker. `failing:"checks-green"` is accepted and migrates to `required-checks-green` for a complete record; incomplete records retain current recomputation. The optional `criteria.checksGreen` observation remains accepted but does not replace missing `requiredChecksGreen`. Writers emit only current names. Ready encodes `ready:true` without `failing`; blocked encodes `ready:false` with the stored exact blocker. Internal tags never enter verdict JSON.

Generic command JSON is separately preserved: before this migration `Handler.ts:1251` prints a decoded snapshot through `UnknownFromJsonString`, not the artifact schema. Keep the outer `mergeReady` Option, inner `failing` Option and criteria `greptileScore` Option in their prior runtime representation on that output. The adapter maps the inner readiness value without normalizing other snapshot fields or stripping Some(empty string). Internal status/blocker tags must not appear on stdout. Canonical artifact and command output are deliberately tested separately; a successful artifact round trip cannot establish generic output compatibility.

# Test impact

- Replace checked-bag construction in `test/yeet-merge-ready-coherence.test.ts` with schema-derived cases. Deterministically enumerate all 256 truth tables. Emit the ready case only for the all-true table; for every other table, emit one blocked case for each false criterion, without calling the Status first-failing helper. Assert the resulting count is 1,025, every case satisfies `S.is(YeetMergeReady)`, and every case survives compatibility encode/decode with its same named blocker and all eight observations. `S.toArbitrary(YeetMergeReady)` may supplement this exhaustive matrix but must not replace it, because random generation does not prove coverage and a first-false-only generator would cover only 256 producer tuples.
- Add a complete artifact with multiple false observations and a later named blocker; prove exact decode/encode preservation. Add a complete record using `failing:"checks-green"` plus `requiredChecksGreen:false` and prove migration to the current blocker spelling on encode. Keep contradiction rejection and both incomplete legacy downgrade fixtures, including `criteria.checksGreen` being accepted without defeating conservative defaults.
- Migrate `test/yeet-status-triage.test.ts` to outer guards/blocker access while retaining Status first-blocker precedence tests.
- Migrate `test/yeet-verdict-json.test.ts` and `test/yeet-artifact-writers.test.ts` to cases while retaining exact persisted keys.
- Preserve watch-stream tests for all eight independent observation transitions after the named blocker. Coordinate with the separate provisional criterion-changed event design only at shared files; the broad criteria carrier remains independent.
- Capture whole command output through `CommandJsonOutput` for absent readiness, ready with None score, blocked with a later named false blocker, and Some(empty/nonempty score), both before and after the remote-phase migration. Compare exact bytes with the old decoded serializer, including outer/inner Option forms, property order, compact output and trailing newline. Include a snapshot larger than 64 KiB to preserve chunked stdout behavior. Verify that neither remote phase nor readiness tags leak.
- Retain full `YeetVerdictJson` and `YeetStatusSnapshotJson` artifact fixtures independently of command output, including unrelated attempt facts and enclosing snapshot fields. Required CLI package verification belongs to implementation; no package command or test ran for this provisional design.

# Risk

Tier 2 singleton. Highest risk is silently changing a stored blocker to the first false observation, losing later observations, or encoding internal tags. Land union, transform, all consumers, exhaustive compatibility tests, and focused Yeet suites atomically. Preserve enclosing attempt facts unchanged. Coordinate the bounded command adapter with the existing remote-status design; both inverse projections must compose before the generic printer. The withdrawn sweep-plan design is not a prerequisite. No new stored state, general serializer or generic helper is introduced. This file changes no current design, canonical record or review status.
