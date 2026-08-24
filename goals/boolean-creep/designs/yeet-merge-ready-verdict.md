## Instance

- id: `yeet-merge-ready-verdict`
- file:line: `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:389`
- symbol: `YeetMergeReady`
- members: `ready`, `criteria.closeoutRun`, `criteria.checksGreen`, `criteria.threadsResolved`
- evidence classes:
  - E3 — `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:291`: YeetMergeReadyCoherenceCheck exists solely to reject the illegal ready/failing/criteria combinations — a runtime guard standing in for the type.

## Current shape

The current criteria declaration is at `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:239`:

```ts
export class YeetMergeReadyCriteria extends S.Class<YeetMergeReadyCriteria>($I`YeetMergeReadyCriteria`)(
  {
    closeoutRun: S.Boolean,
    checksGreen: S.Boolean,
    threadsResolved: S.Boolean,
    greptileScore: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetMergeReadyCriteria", {
    description: "Observed state of each merge-protocol criterion; the Greptile score is display-only.",
  })
) {}
```

The live verdict declaration is at `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:387`:

```ts
export class YeetMergeReady extends S.Class<YeetMergeReady>($I`YeetMergeReady`)(
  S.Struct({
    ready: S.Boolean,
    failing: YeetMergeReadyCriterion.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    criteria: YeetMergeReadyCriteria,
  }).pipe(S.check(YeetMergeReadyCoherenceCheck)),
  $I.annote("YeetMergeReady", {
    description: "Merge readiness as data, naming the criterion that blocks the merge when one does.",
  })
) {}
```

## Cardinality gap

The encoded bag represents 64 combinations: two `ready` values × four `failing` states (`none` plus three criteria) × eight criterion truth tables. Exactly eight canonical protocol states are legal when `failing` means the first failed criterion in protocol order:

- `ready`: closeout, checks, and threads are all satisfied.
- `blocked / closeout-run`: closeout is false; checks and threads may independently be false or true (four states).
- `blocked / checks-green`: closeout is true, checks are false; threads may be false or true (two states).
- `blocked / threads-resolved`: closeout and checks are true, threads are false (one state).

The Greptile score is display-only and does not affect cardinality.

## Target schema

Keep the existing `YeetMergeReadyCriterion` `LiteralKit`; do not duplicate it. Model the eight states with exact criterion classes, a blocker union discriminated by `failing`, and an outer union discriminated by `status`. These are payload-varying variants, so `S.Union(...).pipe(S.toTaggedUnion(...))` is the correct shape rather than a new status literal kit.

```ts
const GreptileScore = S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault)

export class YeetMergeReadySatisfiedCriteria extends S.Class<YeetMergeReadySatisfiedCriteria>(
  $I`YeetMergeReadySatisfiedCriteria`
)(
  {
    closeoutRun: S.Literal(true),
    checksGreen: S.Literal(true),
    threadsResolved: S.Literal(true),
    greptileScore: GreptileScore,
  },
  $I.annote("YeetMergeReadySatisfiedCriteria", {
    description: "All hard merge criteria satisfied.",
  })
) {}

export class YeetMergeReadyCloseoutBlockedCriteria extends S.Class<YeetMergeReadyCloseoutBlockedCriteria>(
  $I`YeetMergeReadyCloseoutBlockedCriteria`
)(
  {
    closeoutRun: S.Literal(false),
    checksGreen: S.Boolean,
    threadsResolved: S.Boolean,
    greptileScore: GreptileScore,
  },
  $I.annote("YeetMergeReadyCloseoutBlockedCriteria", {
    description: "Criteria whose first protocol blocker is closeout-run.",
  })
) {}

export class YeetMergeReadyChecksBlockedCriteria extends S.Class<YeetMergeReadyChecksBlockedCriteria>(
  $I`YeetMergeReadyChecksBlockedCriteria`
)(
  {
    closeoutRun: S.Literal(true),
    checksGreen: S.Literal(false),
    threadsResolved: S.Boolean,
    greptileScore: GreptileScore,
  },
  $I.annote("YeetMergeReadyChecksBlockedCriteria", {
    description: "Criteria whose first protocol blocker is checks-green.",
  })
) {}

export class YeetMergeReadyThreadsBlockedCriteria extends S.Class<YeetMergeReadyThreadsBlockedCriteria>(
  $I`YeetMergeReadyThreadsBlockedCriteria`
)(
  {
    closeoutRun: S.Literal(true),
    checksGreen: S.Literal(true),
    threadsResolved: S.Literal(false),
    greptileScore: GreptileScore,
  },
  $I.annote("YeetMergeReadyThreadsBlockedCriteria", {
    description: "Criteria whose first protocol blocker is threads-resolved.",
  })
) {}

export class YeetMergeReadyCloseoutBlocker extends S.Class<YeetMergeReadyCloseoutBlocker>(
  $I`YeetMergeReadyCloseoutBlocker`
)(
  {
    failing: S.tag("closeout-run"),
    criteria: YeetMergeReadyCloseoutBlockedCriteria,
  },
  $I.annote("YeetMergeReadyCloseoutBlocker", { description: "Merge blocked first by closeout proof." })
) {}

export class YeetMergeReadyChecksBlocker extends S.Class<YeetMergeReadyChecksBlocker>(
  $I`YeetMergeReadyChecksBlocker`
)(
  {
    failing: S.tag("checks-green"),
    criteria: YeetMergeReadyChecksBlockedCriteria,
  },
  $I.annote("YeetMergeReadyChecksBlocker", { description: "Merge blocked first by hosted checks." })
) {}

export class YeetMergeReadyThreadsBlocker extends S.Class<YeetMergeReadyThreadsBlocker>(
  $I`YeetMergeReadyThreadsBlocker`
)(
  {
    failing: S.tag("threads-resolved"),
    criteria: YeetMergeReadyThreadsBlockedCriteria,
  },
  $I.annote("YeetMergeReadyThreadsBlocker", { description: "Merge blocked first by review threads." })
) {}

export const YeetMergeReadyBlocker = S.Union([
  YeetMergeReadyCloseoutBlocker,
  YeetMergeReadyChecksBlocker,
  YeetMergeReadyThreadsBlocker,
]).pipe(
  S.toTaggedUnion("failing"),
  $I.annoteSchema("YeetMergeReadyBlocker", {
    description: "The first failed hard criterion with its statically coherent observations.",
  })
)
export type YeetMergeReadyBlocker = typeof YeetMergeReadyBlocker.Type

export class YeetMergeReadyReady extends S.Class<YeetMergeReadyReady>($I`YeetMergeReadyReady`)(
  {
    status: S.tag("ready"),
    criteria: YeetMergeReadySatisfiedCriteria,
  },
  $I.annote("YeetMergeReadyReady", { description: "Every hard merge criterion is satisfied." })
) {}

export class YeetMergeReadyBlocked extends S.Class<YeetMergeReadyBlocked>($I`YeetMergeReadyBlocked`)(
  {
    status: S.tag("blocked"),
    blocker: YeetMergeReadyBlocker,
  },
  $I.annote("YeetMergeReadyBlocked", { description: "Merge is blocked by the first failed hard criterion." })
) {}

export const YeetMergeReady = S.Union([YeetMergeReadyReady, YeetMergeReadyBlocked]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("YeetMergeReady", {
    description: "Merge readiness as an exhaustive ready or blocked verdict.",
  })
)
export type YeetMergeReady = typeof YeetMergeReady.Type

export const yeetMergeReadyCriteria = YeetMergeReady.match({
  ready: (value) => value.criteria,
  blocked: (value) => value.blocker.criteria,
})
```

Constructors omit `status`/`failing` because `S.tag(...)` supplies those discriminator fields, matching current repo idioms. Branch with `YeetMergeReady.match`, `.guards`, and `YeetMergeReadyBlocker.match`; do not add hand-written boolean predicates.

## Migration inventory

- `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:203` — retain `YeetMergeReadyCriterion` for the stable encoded `failing` domain and public options.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:239` — replace the broad `YeetMergeReadyCriteria` class with the four exact criterion classes above.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:269` — delete `mergeReadyCriterionHolds`; exact class fields and union cases replace this parallel interpreter.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:291` — delete `YeetMergeReadyCoherenceCheck` in full.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:321` — retain the legacy/current encoded bag as the source schema for the compatibility transform.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:336` — replace `normalizeLegacyYeetMergeReady` with a canonical decoder that defaults missing legacy `closeoutRun` to false, derives the first blocker from criteria in closeout/checks/threads order, and ignores redundant encoded `ready`/`failing` as authorities.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:387` — replace the checked class with the outer tagged union and nested blocker union.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:425` — make `YeetMergeReadyFromEncoded` bidirectional: decode the old bag to the canonical union; encode the union back to the old bag.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:508` — keep `YeetVerdict.mergeReady` on `YeetMergeReadyFromEncoded` so persisted verdict JSON uses compatibility encoding.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:666` — `BuildYeetVerdictInput.mergeReady` continues to use the decoded `YeetMergeReady` union.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:756` — no semantic change: carry the optional decoded union into the verdict.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:32` — remove `mergeReadyCriterionHolds` and broad-criteria imports; import the needed case classes/union helpers.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:945` — delete `firstFailingCriterion`; branch once in protocol order while constructing an exact union case.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1003` — after confirming the paired remote phase is `checked-present`, compute the three criterion facts and construct exactly one case: closeout blocker, checks blocker, threads blocker, or ready.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1013` — replace `YeetMergeReady.make({ ready, failing, criteria })` with `YeetMergeReady.cases.*.make(...)` and the appropriate blocker case constructor.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1024` — replace `.ready` with `YeetMergeReady.guards.ready`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1173` — obtain Greptile display data through `yeetMergeReadyCriteria`, then render with `YeetMergeReady.match`; the blocked branch reads `value.blocker.failing`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:761` — replace the `Option` match on `.failing` with `YeetMergeReady.match`; the blocked branch reads `blocker.failing`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:911` — type remains `O.Option<YeetMergeReady>`; no shape-specific read occurs.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:1015` — optional decoded union continues into `BuildYeetVerdictInput` unchanged.

The remaining source occurrences at `Handler.ts:632`, `:793`, and `:1110` only copy or initialize the enclosing `mergeReady` option and require no case-specific logic. `Verdict.ts` JSDoc examples at lines 224, 257, 373, and 414 must be rewritten to demonstrate case constructors and compatibility decoding.

## Guard-deletion accounting

- `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:269` — delete the criterion-to-boolean `$match` helper that reinterprets the broad criteria bag.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:280` — delete the comment-only invariant through line 289; the exact variants become the documentation and type.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:291` — delete the complete runtime coherence filter through line 319, including both `ready`/`failing` branches and the named-criterion check.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:364` — delete the “mutually derivable fields” gotcha through line 368; those parallel decoded fields no longer exist.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:942` — delete `firstFailingCriterion` and its ordered array search through line 949; construction branches create the correct blocker case directly.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1012` — delete the `failing` Option plus `ready: O.isNone(failing)` coherence write.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1178` and `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:762` — delete two read-time `Option` branches that reconstruct ready-versus-blocked from `failing`.

The encoded normalizer remains only at the persisted boundary; it no longer validates decoded-object coherence. It deterministically projects a legacy boolean bag into one of the statically legal variants.

## Encoded-side impact

Tier 2 compatibility design: keep today's JSON object unchanged.

`YeetMergeReadyEncoded` remains:

```ts
{
  ready: boolean
  failing?: "closeout-run" | "checks-green" | "threads-resolved"
  criteria: {
    closeoutRun?: boolean
    checksGreen: boolean
    threadsResolved: boolean
    greptileScore?: string
  }
}
```

Decode migration proof:

1. Missing legacy `criteria.closeoutRun` becomes `false`, preserving the current safety downgrade.
2. Derive the canonical first blocker from the three criteria, in protocol order.
3. Construct the matching exact criteria class and blocker/ready case; encoded `ready` and `failing` are compatibility inputs, not a second source of truth.
4. Therefore every accepted old/current artifact decodes to one of exactly eight legal states. Previously incoherent bags normalize to their criteria-derived canonical state instead of creating an incoherent decoded value.

Encode stability proof:

1. `ready` case encodes `{ ready: true, criteria }` with no `failing` key.
2. `blocked` case encodes `{ ready: false, failing: blocker.failing, criteria: blocker.criteria }`.
3. Every canonical JSON artifact produced today is byte-shape equivalent after decode/encode (subject to the existing JSON formatter's key ordering), including optional `greptileScore` behavior.
4. `YeetVerdict` continues to decode via `YeetMergeReadyFromEncoded` at `Verdict.ts:508`; writers continue through `YeetVerdictJson`, so no caller can accidentally emit the new internal tags into `.beep/yeet`.

## Test impact

- `packages/tooling/tool/cli/test/yeet-merge-ready-coherence.test.ts:12` — retain decoding through `YeetMergeReadyFromEncoded`, but change illegal-bag rejection tests to criteria-authoritative canonicalization tests; lines 108–114 construct a blocked case through union/blocker cases.
- `packages/tooling/tool/cli/test/yeet-merge-ready-coherence.test.ts:124` and `:139` — assert union guards/status and blocker tags instead of `.ready`/optional `.failing`; keep the legacy closeout downgrade assertions.
- `packages/tooling/tool/cli/test/yeet-status-triage.test.ts:155`–`:305` — replace `.ready`, optional `.failing`, and broad `.criteria` assertions with outer guards, `blocker.failing`, and `yeetMergeReadyCriteria`; preserve every first-blocker ordering case.
- `packages/tooling/tool/cli/test/yeet-status-triage.test.ts:331`, `:363`, and `:382` — enclosing status snapshot/JSON behavior remains optional; update the decoded blocked assertion.
- `packages/tooling/tool/cli/test/yeet-verdict-json.test.ts:88`–`:106` — construct a blocked union case and assert the encoded JSON still contains `"ready":false`, `"failing":"threads-resolved"`, and the unchanged criteria bag.
- `packages/tooling/tool/cli/test/yeet-verdict-json.test.ts:113`–`:123` — keep pre-`mergeReady` compatibility and `YeetMergeReadyCriterion.Options` coverage.
- `packages/tooling/tool/cli/test/yeet-artifact-writers.test.ts:72`–`:83`, `:130`, `:255`–`:266` — replace the shared blocked fixture with union case construction; keep persisted writer assertions against the old encoded keys.
- `packages/tooling/tool/cli/test/yeet-monitor-phase-empty.test.ts:34` and `:65` — no case-shape change; it proves the enclosing option remains absent when no status snapshot exists.
- Add a schema-derived table covering all eight decoded legal states and an encode/decode identity test over all eight. Add explicit legacy bags with missing `closeoutRun` and contradictory redundant `ready`/`failing` to prove deterministic normalization.

## Risk & sequencing

This is the only Tier 2 item in the batch and should land alone after `yeet-status-remote-check-phase` or include that phase atomically. It touches the persisted verdict codec, status derivation/rendering, monitor rendering, Handler types, Yeet barrels, and five focused test files. The highest risk is accidentally encoding internal `status`/`blocker` tags into `.beep/yeet`; keep the old source schema on the encoded side and prove canonical old-shape round trips before changing consumers. Do not land a temporary state that changes `YeetVerdict.mergeReady` directly to the internal union without the transformation.
