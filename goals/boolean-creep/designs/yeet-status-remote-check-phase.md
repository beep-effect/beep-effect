## Instance

- id: `yeet-status-remote-check-phase`
- file:line: `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:208`
- symbol: `YeetStatusRemote`
- members: `available`, `checked`
- evidence classes:
  - E1 — `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:758`: Three writes only: skipped (available=false,checked=false), no-PR/truncated (false,true), and success (true,true). available=true with checked=false is never constructed.
  - E4 — `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:877`: available is only written after a successful check; available implies checked — skipped | checked-empty | checked-present.

## Current shape

Live declaration at `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:206`:

```ts
export class YeetStatusRemote extends S.Class<YeetStatusRemote>($I`YeetStatusRemote`)(
  {
    available: S.Boolean,
    checked: S.Boolean,
    detail: S.String,
    checkCount: S.optionalKey(S.Finite),
    failingCheckCount: S.optionalKey(S.Finite),
    isDraft: S.optionalKey(S.Boolean),
    mergeStateStatus: S.optionalKey(S.String),
    mergeable: S.optionalKey(S.String),
    number: S.optionalKey(S.Finite),
    pendingCheckCount: S.optionalKey(S.Finite),
    unresolvedReviewThreadCount: S.optionalKey(S.Finite),
    unresolvedReviewThreads: S.Array(S.String).pipe(S.optionalKey),
    unresolvedThreads: S.Array(YeetStatusReviewThread).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    headSha: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    rerunFailedCommand: S.optionalKey(S.String),
    rerunFailedDecision: S.optionalKey(S.String),
    reviewDecision: S.optionalKey(S.String),
    state: S.optionalKey(S.String),
    url: S.optionalKey(S.String),
  },
  $I.annote("YeetStatusRemote", {
    description: "Optional remote pull request summary for yeet status.",
  })
) {}
```

## Cardinality gap

Two booleans represent four combinations. Three are legal: `skipped` (remote was not requested), `checked-absent` (the check ran but produced no usable PR, including truncated output), and `checked-present` (a PR was decoded). `available=true, checked=false` is illegal.

## Target schema

Use the file's existing `LiteralKit` import for the payload-free phase and preserve the existing report payload fields:

```ts
export const YeetStatusRemotePhase = LiteralKit(["skipped", "checked-absent", "checked-present"]).pipe(
  $I.annoteSchema("YeetStatusRemotePhase", {
    description: "Whether remote status was skipped, checked without a usable PR, or checked with a PR.",
  })
)

export type YeetStatusRemotePhase = typeof YeetStatusRemotePhase.Type

export class YeetStatusRemote extends S.Class<YeetStatusRemote>($I`YeetStatusRemote`)(
  {
    phase: YeetStatusRemotePhase,
    detail: S.String,
    checkCount: S.optionalKey(S.Finite),
    failingCheckCount: S.optionalKey(S.Finite),
    isDraft: S.optionalKey(S.Boolean),
    mergeStateStatus: S.optionalKey(S.String),
    mergeable: S.optionalKey(S.String),
    number: S.optionalKey(S.Finite),
    pendingCheckCount: S.optionalKey(S.Finite),
    unresolvedReviewThreadCount: S.optionalKey(S.Finite),
    unresolvedReviewThreads: S.Array(S.String).pipe(S.optionalKey),
    unresolvedThreads: S.Array(YeetStatusReviewThread).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    headSha: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    rerunFailedCommand: S.optionalKey(S.String),
    rerunFailedDecision: S.optionalKey(S.String),
    reviewDecision: S.optionalKey(S.String),
    state: S.optionalKey(S.String),
    url: S.optionalKey(S.String),
  },
  $I.annote("YeetStatusRemote", {
    description: "Optional remote pull request summary for yeet status.",
  })
) {}
```

Every phase check uses `YeetStatusRemotePhase.is.*`; no parallel `isChecked`/`isAvailable` helper is added.

## Migration inventory

- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:199` — update the JSDoc example to `phase: "skipped"` and log `remote.phase`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:208` — replace `available`/`checked` with `phase`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:248` — update the `YeetStatusSnapshot` JSDoc fixture to `phase: "skipped"`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:758` — construct `skippedRemote` with `.Enum.skipped`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:826` — construct the no-PR result with `.Enum["checked-absent"]`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:833` — construct the truncated result with `.Enum["checked-absent"]`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:877` — construct the decoded PR result with `.Enum["checked-present"]`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:980` — update the `deriveYeetMergeReady` JSDoc fixture to `checked-present`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1003` — replace the two-boolean early return with `!YeetStatusRemotePhase.is["checked-present"](remote.phase)`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1043` — select the open-PR command with `checked-absent`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1044` — select remote follow-up with `checked-present`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1112` — render checks only for `checked-present` with a `checkCount`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1146` — update the review-thread JSDoc fixture to `skipped`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1156` — return “not checked” unless phase is `checked-present`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1208` — update the status-summary JSDoc fixture to `skipped`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1232` — render remote detail for both checked phases and “remote not checked” only for `skipped`.
- `packages/tooling/tool/cli/src/commands/Yeet/index.ts:31` — export the new phase kit/type with `YeetStatusRemote`.

The whole-repo member search found no other production reads or writes.

## Guard-deletion accounting

- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1003` — delete the `!checked || !available` implication guard.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1043` — delete the `checked && !available` state reconstruction.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1044` — delete the independent `available` branch.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1156` — delete the duplicate `!checked || !available` review-thread guard.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1232` — delete the renderer's comment-only assumption that `checked` determines whether `detail` is meaningful.

## Encoded-side impact

none (internal). `YeetStatusRemote` is an internal status snapshot shape; its schema round-trip test changes from two booleans to the phase literal. It is not the persisted Tier 2 `.beep/yeet` verdict covered by `yeet-merge-ready-verdict`.

## Test impact

- `packages/tooling/tool/cli/test/yeet-status-triage.test.ts:84`, `:134`, `:147`, `:157`, and `:276` — replace each fixture's boolean pair with the corresponding phase.
- `packages/tooling/tool/cli/test/yeet.test.ts:1768`, `:1800`, `:1832`, and `:1839` — update phase fixtures; the schema round trip at lines 1777–1778 must assert the literal survives.
- `packages/tooling/tool/cli/test/yeet-artifact-writers.test.ts:241` — update the checked-present snapshot fixture.
- Add a schema-derived test over `YeetStatusRemotePhase.Options` proving only the three legal states can be constructed; no `(available=true, checked=false)` fixture remains expressible.

## Risk & sequencing

This file is shared with the `yeet-merge-ready-verdict` apply because `deriveYeetMergeReady` consumes `YeetStatusRemote`. Land the remote phase first or in the same PR, then adapt verdict derivation to use `checked-present`. Update the Yeet export barrel and all three focused test files atomically.
