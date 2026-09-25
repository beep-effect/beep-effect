# yeet-merge-ready-verdict

## Current shape

Current P2 refresh at `0be1f13d62fa00cb65e34ff69ec99043380f8d81`,
2026-09-22. Independent P3 and implementation pending. This audit preserves
the complete accepted codec domain, not only producer first-blocker policy.

- id: `yeet-merge-ready-verdict`
- file:line: `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:475`
- symbol: `YeetMergeReady`
- members: `ready`, `failing`, and eight booleans in `criteria`
- evidence classes:
  - E3 at `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:345` — absence of a blocker requires ready plus every criterion true.
  - E4 at `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:353` — a named blocker requires not-ready plus that criterion false.

`YeetMergeReadyCriterion` at `Verdict.ts:221-243` names eight hard criteria. The broad `YeetMergeReadyCriteria` observation class at `:271-286` stores all eight booleans plus display-only Greptile score. `YeetMergeReady` at `:475-478` adds `ready` and optional `failing`, checked by `YeetMergeReadyCoherenceCheck` at `:336-365`. Its persisted source schema at `:367-386` also accepts legacy missing fields and the `checks-green`/`checksGreen` spellings.

The persisted contract does not require the named blocker to be the first false criterion. The coherence check requires only that the named criterion is false, JSDoc at `:449-453` calls it “the one recorded as unsatisfied,” the filter itself admits any named false criterion (the existing suite has a one-false example, not exhaustive later-blocker coverage), and `MonitorLoop.ts:990-994` renders the stored name as operator guidance. `Status.ts:1176-1180` chooses the first false criterion only for newly derived status.

## Cardinality gap

Ignoring Greptile, the bag represents 4,608 combinations: two ready values, nine blocker values, and 256 truth tables. It has 1,025 coherent states. The all-true table has one ready/no-blocker state. Across all truth tables, every choice of one false criterion is a legitimate stored blocker: the sum of false positions is `8 * 2^7 = 1,024`. The earlier 256 figure described the current Status writer’s first-false projection, not the accepted persisted domain.

## Target schema

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
  /* annotate union here */, S.toTaggedUnion("status")
)
export type YeetMergeReady = typeof YeetMergeReady.Type
```

Use named classes and annotations. Preserve the intact private criterion/status
LiteralKit bases until mapping; the existing exported criterion kit remains its
same public vocabulary/helper surface. Do not call mapMembers on an annotation-
erased schema. Annotate each resulting union before toTaggedUnion. The sketch
is not compiled proof; validate constructors and generated statics against the
current installed/local Effect APIs at implementation. `S.tag` supplies discriminators. Export a lossless projection from every exact verdict to broad criteria. Keep `mergeReadyCriterionHolds` dual over the broad carrier for watch snapshots/diffs.

The canonical `failing` member remains included in this design's model and cardinality. Reanchoring the separate encoded D1 census record to the actual nested `criteria` schema changes no persistence contract here: its complete wire schema remains the boundary input, including all optional fields. The material R28 repair is the separate generic command serializer at `Handler.ts:1385`, which otherwise exposes the new decoded union instead of the old readiness value.

Define one total inverse from the new union to the exact old decoded readiness value: `{ ready: boolean, failing: Option<YeetMergeReadyCriterion>, criteria: YeetMergeReadyCriteria }`, retaining that property order and the criteria's complete runtime Greptile Option. The ready case maps to true/None; a blocked case maps to false/Some(the stored named blocker) and the full broad criteria projection. This inverse is shared by two schema-owned output boundaries: the existing artifact boundary converts those old decoded fields through their original optional-key codecs, while the generic command boundary retains them as runtime Options. Use the local Effect v4 `S.toType` projection when a boundary's Encoded side must be the old decoded value; do not feed Options into a schema expecting optional keys or double-decode them.

Add a bounded printYeetStatusCommandJson adapter for readiness only: map the
Some value of snapshot.mergeReady through the single inverse, preserve the
outer Option including None and replace only that property at its original
position, then invoke existing printCommandJson. Preserve snapshot.remote
unchanged. Do not run the entire snapshot through YeetStatusSnapshotJson, which
would change runtime Option output. The remote-phase owner is on a contract
hold; readiness has no dependency on admitting or implementing it. If a later
approved remote migration needs a projection, compose it into this same bounded
printer without duplicating readiness truth or introducing another printer.

## Migration inventory

- `Verdict.ts:221-323` — retain criterion kit, broad carrier, and dual observation helper; add ready and eight named blocker-specific criteria classes.
- `Verdict.ts:336-365` — delete the bag coherence filter; structural ready/blocker cases replace it.
- `Verdict.ts:367-434` — retain the exact current/legacy encoded bag and conservative legacy normalizer behavior. `threadsResolved` remains required. The seven optional hard-criterion fields default false. A record is complete only when all seven current optional fields, including `requiredChecksGreen`, are present. Complete records preserve `ready` and the stored blocker, mapping legacy `failing:"checks-green"` to `required-checks-green`; the new structural union rejects the same complete contradictions as today. Incomplete records remain forced blocked and select the first false criterion after defaults, ignoring their redundant encoded answer as today. A legacy `criteria.checksGreen` value does not make the current required-check observation complete and is not substituted for `requiredChecksGreen`; the tests at `yeet-merge-ready-coherence.test.ts:145-170` prove this conservative downgrade.
- `Verdict.ts:475-524` — replace the checked bag with nested tagged unions; make `YeetMergeReadyFromEncoded` bidirectional so it projects exact decoded cases to the old object.
- `Verdict.ts:600,819` — keep the compatibility codec at `YeetVerdict` persistence and the decoded union in build inputs/projection.
- `Status.ts:307` — keep the same compatibility codec nested in `YeetStatusSnapshot` persistence.
- `Status.ts:1176-1249` — preserve first-false as this producer’s documented policy; construct the matching exact case from the complete observation carrier.
- `Status.ts:1260,1421-1430` — use outer guards/match and project criteria once for display.
- `MonitorLoop.ts:990-994` — render ready/blocked through the outer union while preserving exact messages and the stored blocker name.
- MonitorLoop.ts1074-1094 is a second current producer absent from the older
  design. bindRequiredCensus returns the exact snapshot unchanged when no
  failed check is required by observed flags or settled census. Otherwise it
  maps only Some readiness, projects complete criteria, changes only
  requiredChecksGreen to false and recomputes first false in criterion order.
  Construct the corresponding blocked case and preserve every other observation,
  score and snapshot field. Do not preserve a former stored blocker here: this
  is explicit producer recomputation, unlike lossless artifact decode.
- MonitorLoop.ts1178/1248 reads closeoutRun from criteria; migrate through the
  lossless broad projection. Readiness checks1251/1356/1398 become generated
  ready guards, keeping the existing compound conditions and unknown Option
  handling. Monitor termination/polling/census behavior does not change.
- `WatchMode.ts:347`, `WatchStream.ts:44,210-242,856-869`, and `YeetWatchSnapshot` — preserve broad observation construction, defaults, and all eight comparisons.
- `Handler.ts:1382-1387` — use the bounded status command printer above, preserving `YeetCommandError` mapping, `CommandJsonOutput` injection, compact JSON, bounded UTF-8 writes and one trailing newline (`src/internal/cli/Json.ts:16-39,115-120,296-302`). Artifact encoding alone does not prove this output.
- `Handler.ts:1061,1352,1454-1458,1628,1846` — preserve the opaque `O.Option<YeetMergeReady>` state transfer; it has no shape reader.
- `src/test/Yeet.test-kit.ts:81` — existing internal wildcard export covers new cases; do not expand the public Yeet facade solely for tests.

Graft symbol/property search found direct shape use in Verdict, Status, MonitorLoop and broad observation modules; Handler carries Options and generic serialization. Porcelain/Yeet.command participate in orchestration rather than adding a direct shape consumer in this search. Exhaustive source searches separately located the class/codec, broad observation readers, artifact writers and Handler's generic print at `:1385`; graph absence was not used as no-consumer proof. The held remote-status owner shares the generic boundary but is not part of this migration; readiness projects independently and leaves current remote unchanged. No new public Yeet facade is needed solely to expose private Value/boundary models.

The withdrawn `r2-tooling-sweep-plan-operator-handoff` is not a data or schema dependency of this migration. The current design names no SweepPlanStep fields; Verdict readiness, Status collection and Watch observation schemas do not import that carrier. MonitorLoop/Porcelain also orchestrate sweeps, but shared orchestration does not require redesigning SweepPlanStep. Preserve those sweep calls and existing encoded precondition/operator behavior unchanged. Remove only any parent plan sequencing dependency on implementing its withdrawn design.

## Guard-deletion accounting

Delete `YeetMergeReadyCoherenceCheck` and its three-way invariant prose at `Verdict.ts:336-365`; decoded cases make ready/no-blocker and blocked/named-false structural. Migrate boolean/Option reconstruction in `Status.ts:1248-1249`, `:1421-1430`, and `MonitorLoop.ts:990-994`. Retain first-false selection in Status and MonitorLoop.bindRequiredCensus as producer policies and retain the broad criterion interpreter for watch observations. The compatibility transform and the two existing output contracts remain required. Add no parallel coherence predicate to the command adapter: it uses the single total inverse from valid union cases. Schema decoding, not an ad-hoc repair wall, rejects complete contradictions.

## Encoded-side impact

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

Generic command JSON is separately preserved: before this migration `Handler.ts:1385` prints a decoded snapshot through `UnknownFromJsonString`, not the artifact schema. Keep the outer `mergeReady` Option, inner `failing` Option and criteria `greptileScore` Option in their prior runtime representation on that output. The adapter maps the inner readiness value without normalizing other snapshot fields or stripping Some(empty string). Internal status/blocker tags must not appear on stdout. Canonical artifact and command output are deliberately tested separately; a successful artifact round trip cannot establish generic output compatibility.

## Test impact

- Replace checked-bag construction in `test/yeet-merge-ready-coherence.test.ts` with schema-derived cases. Deterministically enumerate all 256 truth tables. Emit the ready case only for the all-true table; for every other table, emit one blocked case for each false criterion, without calling the Status first-failing helper. Assert the resulting count is 1,025, every case satisfies `S.is(YeetMergeReady)`, and every case survives compatibility encode/decode with its same named blocker and all eight observations. Current schema-derived Arbitrary support may supplement this exhaustive matrix but must not replace it, because random generation does not prove coverage and a first-false-only generator would cover only 256 producer tuples.
- Add a complete artifact with multiple false observations and a later named blocker; prove exact decode/encode preservation. Add a complete record using `failing:"checks-green"` plus `requiredChecksGreen:false` and prove migration to the current blocker spelling on encode. Keep contradiction rejection and both incomplete legacy downgrade fixtures, including `criteria.checksGreen` being accepted without defeating conservative defaults.
- Add bindRequiredCensus behavior coverage: no relevant failed check returns
  unchanged snapshot; readiness None remains None; settled-census required
  failure overrides only requiredChecksGreen, then picks first false including
  an earlier false criterion. Preserve later observations and Some(empty score).
  This test must distinguish producer recomputation from codec preservation.
- Migrate `test/yeet-status-triage.test.ts` to outer guards/blocker access while retaining Status first-blocker precedence tests.
- Migrate `test/yeet-verdict-json.test.ts` and `test/yeet-artifact-writers.test.ts` to cases while retaining exact persisted keys.
- Preserve watch-stream tests for all eight independent observation transitions after the named blocker. Coordinate with the separate criterion-changed event design only at shared files; the broad criteria carrier remains independent.
- Capture whole command output through `CommandJsonOutput` for absent readiness, ready with None score, blocked with a later named false blocker, and Some(empty/nonempty score), with the current unchanged remote value; any future admitted remote migration reruns the same output contract. Compare exact bytes with the old decoded serializer, including outer/inner Option forms, property order, compact output and trailing newline. Include a snapshot larger than 64 KiB to preserve chunked stdout behavior. Verify readiness tags do not leak and current remote output is byte-identical.
- Retain full `YeetVerdictJson` and `YeetStatusSnapshotJson` artifact fixtures independently of command output, including unrelated attempt facts and enclosing snapshot fields. Required `bun run beep quality package-verify @beep/repo-cli` belongs to implementation; no package command or test ran for this P2 design.

## Risk

Tier 2 singleton. Highest risk is silently changing a stored blocker to the first false observation, losing later observations, or encoding internal tags. Land union, transform, all consumers, exhaustive compatibility tests, and focused Yeet suites atomically. Preserve enclosing attempt facts unchanged. Land the readiness-only command adapter independently of the held remote-status owner; preserve remote verbatim. Future approved projections compose in that one adapter. The withdrawn sweep-plan design is not a prerequisite. No new stored state, general serializer or generic helper is introduced. The completed source correction does not constitute independent P3 design approval.

Landing: Tier 2 remains a singleton PR. The remote-status contract hold does not block readiness review/implementation. Keep shared WatchStream, Status and Handler edits serial.

All eight hard criteria are required Booleans in the decoded observation class;
there are no defaults there. Greptile is arbitrary String Option default None,
including Some(empty string); it is display-only and cannot be a blocker.
YeetMergeReady.ready and criteria are required, failing defaults None. These
constructor rules must survive the new typed cases without making a blocked
case a default. The4608/1025 projection excludes the independent score payload;
score presence would multiply it9216/2050 but introduces no new correlation.
The legacy optional-field normalization is a separate input grammar, not a
second finite-state claim. No actual Yeet/proof/provider job ran for this P2.
