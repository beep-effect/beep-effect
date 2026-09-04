# Instance

- id: `yeet-merge-ready-verdict`
- file:line: `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:469`
- symbol: `YeetMergeReady`
- members: `ready`, `failing`, and the eight booleans in `criteria`
- evidence classes:
  - E1 — `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1054`:
    `firstFailingCriterion` walks the ordered criteria and the constructor at
    lines 1114-1127 writes `ready` and `failing` from that same result.

# Current shape

The source has changed materially since the original 2026-08-23 design. The
current merge protocol owns eight ordered hard criteria:

```ts
export const YeetMergeReadyCriterion = LiteralKit([
  "pr-open",
  "not-draft",
  "closeout-run",
  "required-checks-green",
  "threads-resolved",
  "mergeable",
  "merge-state-acceptable",
  "review-decision-acceptable",
])
```

`YeetMergeReadyCriteria` at `Verdict.ts:265-280` stores those eight booleans
plus the display-only Greptile score. `YeetMergeReady` at lines 469-478 adds
`ready` and an optional `failing` criterion, then relies on the coherence
filter at lines 330-359. `Status.ts:1054-1127` independently discovers the
first false criterion and writes all three surfaces. `Status.ts:1299-1308`,
`MonitorLoop.ts:958-963`, and `WatchStream.ts:794-809` reconstruct or compare
the same meaning again.

The persisted source schema at `Verdict.ts:361-380` accepts current fields and
older artifacts that may lack newer criteria or still spell the check blocker
and observation as `checks-green` / `checksGreen`.

# Cardinality gap

Ignoring the independent Greptile display value, the current decoded bag
represents 4,608 combinations:

- two `ready` values;
- nine `failing` values (`None` or one of eight criteria); and
- 256 truth tables for the eight criterion booleans.

There are exactly 256 legal protocol states. Every truth table has one
canonical answer: all true is `ready`; otherwise the first false criterion in
protocol order is the blocker. The target must preserve all later criterion
observations because the operator and watch stream display how the state
changed, while making the answer and first blocker structural.

# Target schema

Retain the existing `YeetMergeReadyCriterion` `LiteralKit` and the broad
`YeetMergeReadyCriteria` observation carrier. That carrier is not the verdict
authority: it remains independently constructible because `WatchMode`,
`YeetWatchSnapshot`, `WatchStream`, default snapshots, comparisons, and their
tests need to record and diff all eight observations even before an exact
verdict is available. Define one exact criteria class for ready and one for
each first blocker for the persisted verdict's decoded union. Every exact class
contains all eight observations and `greptileScore`, but the fields through its
first blocker use literal schemas:

| Criteria class | Required prefix |
| --- | --- |
| `YeetMergeReadyReadyCriteria` | all eight fields `S.Literal(true)` |
| `YeetMergeReadyPrOpenBlockedCriteria` | `prOpen: S.Literal(false)` |
| `YeetMergeReadyDraftBlockedCriteria` | `prOpen: true`, `notDraft: false` |
| `YeetMergeReadyCloseoutBlockedCriteria` | prior two true, `closeoutRun: false` |
| `YeetMergeReadyChecksBlockedCriteria` | prior three true, `requiredChecksGreen: false` |
| `YeetMergeReadyThreadsBlockedCriteria` | prior four true, `threadsResolved: false` |
| `YeetMergeReadyMergeableBlockedCriteria` | prior five true, `mergeable: false` |
| `YeetMergeReadyMergeStateBlockedCriteria` | prior six true, `mergeStateAcceptable: false` |
| `YeetMergeReadyReviewBlockedCriteria` | prior seven true, `reviewDecisionAcceptable: false` |

Fields after the first blocker remain `S.Boolean`. Use named `S.Class`
members with meaningful `$I.annote(...)` metadata; do not generate anonymous
structs. The exact verdict does not decode to the broad carrier and needs no
coherence filter; the broad carrier survives as the watch-observation model.

Wrap each blocked criteria class in a blocker class whose `failing` field is
supplied by `S.tag(...)`, then derive the nested union:

```ts
export class YeetMergeReadyChecksBlocker extends S.Class<YeetMergeReadyChecksBlocker>(
  $I`YeetMergeReadyChecksBlocker`
)(
  {
    failing: S.tag("required-checks-green"),
    criteria: YeetMergeReadyChecksBlockedCriteria,
  },
  $I.annote("YeetMergeReadyChecksBlocker", {
    description: "Merge readiness blocked first by required hosted checks.",
  })
) {}

export const YeetMergeReadyBlocker = S.Union([
  YeetMergeReadyPrOpenBlocker,
  YeetMergeReadyDraftBlocker,
  YeetMergeReadyCloseoutBlocker,
  YeetMergeReadyChecksBlocker,
  YeetMergeReadyThreadsBlocker,
  YeetMergeReadyMergeableBlocker,
  YeetMergeReadyMergeStateBlocker,
  YeetMergeReadyReviewBlocker,
]).pipe(
  S.toTaggedUnion("failing"),
  $I.annoteSchema("YeetMergeReadyBlocker", {
    description: "The first failed merge criterion with its exact observation state.",
  })
)
export type YeetMergeReadyBlocker = typeof YeetMergeReadyBlocker.Type
```

The outer union has one ready case and one blocked case:

```ts
export class YeetMergeReadyReady extends S.Class<YeetMergeReadyReady>($I`YeetMergeReadyReady`)(
  {
    status: S.tag("ready"),
    criteria: YeetMergeReadyReadyCriteria,
  },
  $I.annote("YeetMergeReadyReady", {
    description: "Every hard merge criterion is satisfied.",
  })
) {}

export class YeetMergeReadyBlocked extends S.Class<YeetMergeReadyBlocked>($I`YeetMergeReadyBlocked`)(
  {
    status: S.tag("blocked"),
    blocker: YeetMergeReadyBlocker,
  },
  $I.annote("YeetMergeReadyBlocked", {
    description: "Merge readiness blocked by the first unsatisfied hard criterion.",
  })
) {}

export const YeetMergeReady = S.Union([YeetMergeReadyReady, YeetMergeReadyBlocked]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("YeetMergeReady", {
    description: "Exhaustive ready or first-blocked merge verdict.",
  })
)
export type YeetMergeReady = typeof YeetMergeReady.Type
```

Case construction omits `status` and `failing`; `S.tag(...)` supplies both.
Branch with the schema-derived `.match`, `.guards`, and `.cases` helpers.

Provide a lossless projection from every exact verdict case to
`YeetMergeReadyCriteria`, preserving later observations and `greptileScore`.
Keep `mergeReadyCriterionHolds` dual and accepting the broad carrier so current
watch snapshots and diffs retain data-first/data-last behavior. Exact-verdict
renderers may call the projection once before using that helper. Do not make
watch-mode observation capture depend on constructing a persisted verdict.

# Migration inventory

- `Verdict.ts:215-280` — retain the eight-value criterion kit and the broad
  `YeetMergeReadyCriteria` carrier; add the nine exact verdict-only criteria
  classes without replacing the carrier.
- `Verdict.ts:303-359` — preserve the dual `mergeReadyCriterionHolds` API over
  the observation carrier; delete `YeetMergeReadyCoherenceCheck` completely.
- `Verdict.ts:361-423` — retain the current/legacy encoded bag, including
  optional newer criteria and the `checks-green` / `checksGreen` aliases.
  Replace normalization with a criteria-authoritative decoder that supplies
  the current conservative defaults and constructs exactly one union case.
- `Verdict.ts:469-518` — replace the checked class with the nested tagged
  unions and make `YeetMergeReadyFromEncoded` bidirectional.
- `Verdict.ts:594`, `:773`, and `:864` — keep the transformed codec at the
  persisted verdict boundary and the decoded union in build inputs.
- `Status.ts:1051-1127` — delete `firstFailingCriterion`. Compute the eight
  observations once in `YeetMergeReadyCriteria`, branch in protocol order, and
  construct the exact ready or blocker case from that carrier. This retains one
  complete observation value for watch snapshots without letting it become an
  unchecked verdict.
- `Status.ts:1138` — use `YeetMergeReady.guards.ready` for the next-command
  decision.
- `Status.ts:1299-1308` — render through `YeetMergeReady.match`; read the
  Greptile score from the projected criteria and the blocker name from the
  blocked case.
- `MonitorLoop.ts:958-963` — render ready versus blocked through the outer
  union match.
- `WatchMode.ts`, `YeetWatchSnapshot`, and `WatchStream.ts:42,253-256,794-809`
  — preserve broad criteria defaults, capture, and comparisons; continue
  diffing every criterion with the dual helper.
- `Handler.ts` only carries `O.Option<YeetMergeReady>`; update imports/types if
  inference requires it, with no shape-specific branching.
- Update the Yeet package barrels so the cases, blocker union, and projection
  helpers used by current tests remain package-alias accessible.

Whole-repository search on 2026-09-03 found no other production reads of
`mergeReady.ready`, `.failing`, or the old broad criteria model.

# Guard-deletion accounting

- Keep the broad criterion interpreter as a read-only observation helper for
  watch mode; delete only its use as verdict authority.
- Delete `YeetMergeReadyCoherenceCheck` and its comment-only invariant in
  `Verdict.ts:319-359`.
- Delete `firstFailingCriterion` in `Status.ts:1051-1058` and the
  `ready: O.isNone(failing)` / optional-failing coherence write at
  `Status.ts:1126-1127`.
- Delete the read-time Option reconstructions in `Status.ts:1299-1308` and
  `MonitorLoop.ts:958-963`; both match the tagged union once.
- Delete JSDoc prose that says callers must keep `ready`, `failing`, and
  criteria coherent. Only the encoded compatibility bag retains those keys.
- Delete no watch observation field, default, comparison branch, or fixture;
  their carrier is intentionally broader than the exact persisted verdict.

The legacy/current transform is not deleted: it is the required Tier 2
boundary that keeps existing `.beep/yeet` artifacts readable and writable.

# Encoded-side impact

Tier 2 compatibility design: keep the current persisted object shape and its
legacy input acceptance. The encoded side remains:

```ts
{
  ready: boolean
  failing?: YeetMergeReadyCriterion | "checks-green"
  criteria: {
    prOpen?: boolean
    notDraft?: boolean
    closeoutRun?: boolean
    requiredChecksGreen?: boolean
    checksGreen?: boolean
    threadsResolved: boolean
    mergeable?: boolean
    mergeStateAcceptable?: boolean
    reviewDecisionAcceptable?: boolean
    greptileScore?: string
  }
}
```

Compatibility proof requirements:

1. Current complete artifacts decode to the unique case selected by their
   criterion truth table and re-encode with the same current keys and values.
2. Older artifacts missing newer hard criteria remain accepted and safely
   decode blocked on the first missing/default-false criterion.
3. Legacy `checks-green` is accepted as an input blocker spelling; writers emit
   only `required-checks-green`.
4. Contradictory redundant `ready` or `failing` inputs are canonicalized from
   criteria and cannot create an incoherent decoded value.
5. Encoding a ready case emits `ready: true` and no `failing`; encoding a
   blocked case emits `ready: false` and its exact blocker.
6. Internal `status` and `blocker` tags never appear in `YeetVerdictJson`.

# Test impact

- `packages/tooling/tool/cli/test/yeet-merge-ready-coherence.test.ts` — replace
  checked-bag construction with all 256 schema-derived legal states; prove
  current and legacy decode canonicalization, exact current-shape re-encoding,
  legacy blocker alias handling, and absence of internal tags.
- `packages/tooling/tool/cli/test/yeet-status-triage.test.ts` — retain every
  first-blocker precedence scenario across all eight criteria, asserting outer
  guards and `blocker.failing`.
- `packages/tooling/tool/cli/test/yeet-verdict-json.test.ts` and
  `yeet-artifact-writers.test.ts` — construct decoded cases through `.cases`
  and preserve exact persisted keys.
- `packages/tooling/tool/cli/test/yeet-watch-stream.test.ts` (or the current
  watch-stream suite) — retain the broad criteria fixture and prove all eight
  criterion transitions still diff/render, including later observations after
  the first blocker.
- Tests continue importing source through `@beep/repo-cli` aliases; do not add
  relative imports into package `src`.

# Risk & sequencing

This Tier 2 change lands alone, after or atomically with
`yeet-status-remote-check-phase` because status derivation consumes that phase.
PR #964 added immutable attempt facts (`attemptId`, `resolvedHeadSha`,
`diffFingerprint`, and `proofTier`) plus per-lane timing, input-digest, and
outcome facts to the enclosing verdict. Those fields are orthogonal to merge
readiness and must be preserved unchanged in the singleton migration; they do
not belong in the exact merge-ready union or its compatibility transform.
The highest risks are dropping one of the eight criteria, erasing broad watch
observations after the first blocker, weakening first-blocker ordering,
breaking watch-stream change rendering, or writing internal union tags into
persisted artifacts. Keep the old source schema on the encoded side, preserve
the separate watch carrier, construct only exact decoded verdict cases, and
require exhaustive current plus legacy codec proofs before publication.
