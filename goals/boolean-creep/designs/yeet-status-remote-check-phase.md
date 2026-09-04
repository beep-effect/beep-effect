## Instance

- id: `yeet-status-remote-check-phase`
- file:line: `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:206`
- symbol: `YeetStatusRemote`
- members: `available`, `checked`
- evidence classes:
  - E1 — `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:858`: Three writes only: skipped (available=false,checked=false), no-PR/truncated (false,true), and success (true,true). available=true with checked=false is never constructed.
  - E4 — `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:972`: available is only written after a successful check; available implies checked — skipped | checked-empty | checked-present.

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
    requiredCheckCount: S.optionalKey(S.Finite),
    failingRequiredCheckCount: S.optionalKey(S.Finite),
    pendingRequiredCheckCount: S.optionalKey(S.Finite),
    optionalCheckCount: S.optionalKey(S.Finite),
    failingOptionalCheckCount: S.optionalKey(S.Finite),
    pendingOptionalCheckCount: S.optionalKey(S.Finite),
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

class YeetStatusRemoteValue extends S.Class<YeetStatusRemoteValue>($I`YeetStatusRemoteValue`)(
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
    requiredCheckCount: S.optionalKey(S.Finite),
    failingRequiredCheckCount: S.optionalKey(S.Finite),
    pendingRequiredCheckCount: S.optionalKey(S.Finite),
    optionalCheckCount: S.optionalKey(S.Finite),
    failingOptionalCheckCount: S.optionalKey(S.Finite),
    pendingOptionalCheckCount: S.optionalKey(S.Finite),
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
  $I.annote("YeetStatusRemoteValue", {
    description: "Optional remote pull request summary for yeet status.",
  })
) {}
```

The `YeetStatusRemoteValue` class shown above is the decoded value schema. Retain a private
`YeetStatusRemoteEncoded` schema containing `available`, `checked`, and every
existing sibling field, then expose the `YeetStatusRemote` schema through a
named `S.decodeTo(YeetStatusRemoteValue, ...)` transformation and export its
decoded type from `typeof YeetStatusRemote.Type`. The transform maps the three
legal pairs exactly and rejects `available: true, checked: false`. Internal
writers construct `YeetStatusRemoteValue.make`; encode/decode operations use
the `YeetStatusRemote` compatibility schema. The transformed codec does not
have a `.make` constructor: public examples and tests construct decoded values
by decoding the legacy encoded object, never by calling
`YeetStatusRemote.make`. Every decoded phase check uses
`YeetStatusRemotePhase.is.*`; no parallel `isChecked`/`isAvailable` helper is
added.

## Migration inventory

Refreshed against current `main` on 2026-09-03. Preserve the newer required/optional check-count partitions in every phase; the refactor changes only `available` plus `checked` into `phase`.

- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:199-200` — update the JSDoc example to obtain the decoded skipped value through `S.decodeUnknownSync(YeetStatusRemote)({ available: false, checked: false, ... })` and log `remote.phase`; do not call `.make` on the transformed codec.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:208` — retain `available`/`checked` in a private encoded schema and expose only `phase` in the decoded value schema.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:245-260` — update the `YeetStatusSnapshot` JSDoc fixture so its remote is produced by decoding the old skipped pair through `YeetStatusRemote`, not by calling a nonexistent codec `.make`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:858` — construct `skippedRemote` with `YeetStatusRemoteValue.make` and `.Enum.skipped`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:926` — construct the no-PR result with `YeetStatusRemoteValue.make` and `.Enum["checked-absent"]`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:933` — construct the truncated result with `YeetStatusRemoteValue.make` and `.Enum["checked-absent"]`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:972` — construct the decoded PR result with `YeetStatusRemoteValue.make` and `.Enum["checked-present"]`, preserving all full/required/optional check summaries.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1086-1097` — update the `deriveYeetMergeReady` JSDoc fixture to decode the old checked-present object through `YeetStatusRemote`; the resulting value has phase `checked-present`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1112` — replace the two-boolean early return with `!YeetStatusRemotePhase.is["checked-present"](remote.phase)`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1157` — select the open-PR command with `checked-absent`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1158` — select remote follow-up with `checked-present`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1231-1242` — render check partitions only for `checked-present`, while retaining the legacy unsplit snapshot fallback.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1269-1273` — update the review-thread JSDoc fixture to decode the old skipped pair through `YeetStatusRemote`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1282` — return “not checked” unless phase is `checked-present`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1327-1340` — update the status-summary JSDoc fixture so its skipped remote is decoded through `YeetStatusRemote` rather than constructed on the codec.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1358` — render remote detail for both checked phases and “remote not checked” only for `skipped`.
- `packages/tooling/tool/cli/src/commands/Yeet/index.ts:31` — export the new phase kit/type with `YeetStatusRemote`.
- Yeet status artifact schemas and writers — keep the compatibility codec at the nested status boundary so persisted files retain `available` and `checked` exactly.

The whole-repo member search found no other production reads or writes.

## Guard-deletion accounting

- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1112` — delete the `!checked || !available` implication guard.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1157` — delete the `checked && !available` state reconstruction.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1158` — delete the independent `available` branch.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1282` — delete the duplicate `!checked || !available` review-thread guard.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1358` — delete the renderer's comment-only assumption that `checked` determines whether `detail` is meaningful.

## Encoded-side impact

Tier 2 compatibility codec. `YeetStatusRemote` is nested inside persisted Yeet
status artifacts. Preserve the old `available` and `checked` property names and
values, every sibling payload field/default, and all supported artifact input.
The decoded `phase` key never appears in persisted output.

## Test impact

- `packages/tooling/tool/cli/test/yeet-status-triage.test.ts:91-174`, `:293`, `:342`, and `:456-469` — replace the `YeetStatusRemote.make` fixture helper/calls with one test-local decoder over wire-compatible `{ available, checked, ... }` objects. Assert the corresponding decoded phase while retaining required/optional check partitions and converting any decoded `Option` fixture conveniences back to their encoded optional-key form before decode.
- `packages/tooling/tool/cli/test/yeet.test.ts:2070,2102,2134,2141` — construct every remote by decoding its legacy boolean-pair object through `YeetStatusRemote`; the round trip at `:2079-2080` must assert the literal and check partitions survive.
- `packages/tooling/tool/cli/test/yeet-artifact-writers.test.ts:356-364` — construct the live checked-present snapshot remote by decoding the old-key object through `YeetStatusRemote` before nesting it in `YeetStatusSnapshot`.
- Add a schema-derived test over `YeetStatusRemotePhase.Options` proving only the three legal states can be constructed; no `(available=true, checked=false)` fixture remains expressible.
- Add old-shape artifact round trips for all three legal boolean pairs, exact
  output assertions, rejection of the illegal pair, and absence of `phase` in
  persisted JSON.

## Risk & sequencing

This Tier 2 singleton lands after the repo-CLI Tier 1 batch and before the
Yeet-verdict singleton. `deriveYeetMergeReady` consumes the decoded phase.
Update the transform, status artifact boundary, export barrel, and focused
tests atomically; do not combine it with the verdict migration.
