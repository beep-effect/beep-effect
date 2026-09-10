# Provisional DiscoveredCandidate classification design

Native P2 proposal only, pending parent admission and independent correction.
Stable candidate: `r28-cli-internal-root-tmpfs-discovered-classified-skip`.
Source HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`, main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. Paths below are repository-relative.
This replaces the raw report's 4/3 proof with 26/6. It does not modify the
current cross-type lifecycle design or the dangling-stub local disposition design.

## Current shape

`packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts:61-69` declares a
private `DiscoveredCandidate` with required `root`, `path`, `reapClass`,
`idleSinceMillis`, `classified: boolean`, `shapeSkipReason:
Option<TmpfsReapSkipReason>`, and `parentRepo: Option<string>`. It is a real
named data owner. Neither a callable nor an application outcome supplies its
second axis. `ApplyOutcome.reaped` at101-104 belongs to another owner.

The declared reason is the twelve-member public literal family in
`TmpfsReap.schemas.ts:97-109`: live-cwd-ref, live-fd-ref, live-flock,
dirty-worktree, too-young, parent-repo-missing-but-refs, wrong-shape,
gitdir-target-exists, parent-repo-present, contents-present, live-runner,
unclassified. The shape field can represent every one even though discovery
only writes four. Do not count an arbitrary nonempty Option as a single value.

## Cardinality gap

The selected finite cluster represents `2 * (1 + 12) = 26` states. Exactly six
are supported by complete discovery writers:

| classified | shapeSkipReason | Supporting construction |
| --- | --- | --- |
| true | None | Git worktree with recognized parent at286-295; classified head installs, Vitest and caches at336-368,477-535; exact dangling stub at373-397 |
| false | None | Git worktree whose gitdir does not identify a parent repository at286-295 |
| false | Some(gitdir-target-exists) | `danglingStubShape` at239-245 when target exists |
| false | Some(parent-repo-present) | Same helper when gitdir is missing and parent exists |
| false | Some(wrong-shape) | Helper fallback; root/path escape cases at419-426,452-459 |
| false | Some(contents-present) | Initially classified dangling shape with non-exact directory contents at387-394 |

All true/Some rows and false/Some of the other eight reasons are representable
but never shape states. Those other reasons belong to later liveness/age/state
classification. Required payloads and `parentRepo` remain preserved siblings;
this proof does not claim their contents are Boolean axes.

## Target schema

Define a private `CandidateClassification` through `S.TaggedUnion`:
`Classified {}`, `Unclassified {}`, `RejectedShape { reason }`. The last
case owns a private `LiteralKit` restricted to the four shape reasons above.
This has six values and no redundant Boolean or optional reason. Keep all
other `DiscoveredCandidate` fields with their exact current types; the new
schema supplies only its `classification` member and inferred runtime type.
Use the existing file identity and schema annotations. No public alias or
wire compatibility schema is needed for this private owner.

`Unclassified` preserves the actual false/None state. Do not normalize it to
Some(unclassified) at construction: the existing constructor distinction is
part of this proof. The later classification reader maps it to the existing
unclassified skip reason. `RejectedShape` returns its exact reason, and
`Classified` proceeds to the existing reap-class/Vitest gate.

Exact local API reference: `.repos/effect/packages/effect/src/Schema.ts:6200-6250`
defines the TaggedUnion inferred types, cases, guards, match and field-set
constructor. Use its schema-derived cases/guards/match; do not recreate an
imperative Boolean validator or introduce speculative codec APIs.

## Migration inventory

- `TmpfsReap.ts:61-69`: replace only the two selected members. Preserve root,
  path, all `TmpfsReapClass` values, number semantics and `parentRepo` Option.
- `235-246`: change `danglingStubShape`'s Pick result to the classification
  schema. Preserve target/parent precedence and failure fallback. A temporary
  local decision Boolean is not a duplicate stored carrier.
- `270-535`: migrate all Git worktree, Vitest, head-install, dangling-stub,
  escaped-root/path, fallow and scoped-temp constructors. Git worktrees with
  unrecognized parents must retain Unclassified. Preserve discovery order,
  stat failures, timestamps and parent repository payloads.
- `373-397`: use schema-derived classification guards for the existing lazy
  contents inspection and map wrong contents to RejectedShape(contents-present).
  Coordinate with `tmpfs-dangling-stub-disposition`; this candidate migration
  does not separately implement its local three-state refactor or retire its
  `contentsAreExact` local.
- `665-724`, `739-788`, `817-841`, `925-951`, `974-1013`: update type consumers
  and classification checks. The dirty-worktree reader still needs parentRepo;
  eligibility guards and filesystem operations retain their exact order.
- `1214-1253`: deduplication, class filters, parallel measurement, byte probes
  and MeasuredCandidate retain all existing non-classification fields.
- `1016-1033`, `1255-1278`: report projection and aggregation are consumers.
  `ApplyOutcome`, reaped writes, reaped-count filters and warning aggregation
  remain outside this record. The cross-type old Q must be adjudicated as an
  owner error before an implementation uses its broader deletion promises.
- Public reachability is through `internal/repo-run/index.ts` exports of
  `TmpfsReap.ts`/`.schemas.ts`, package test alias `@beep/repo-cli/test/RepoRun`,
  Quality.command.ts129,3505-3523,3565-3567 and Yeet/internal/Sweep.ts1141-1180.
  No external caller constructs DiscoveredCandidate or supplies its pair.

## Guard-deletion accounting

Delete the two stored fields and all paired writes. Replace the two-input
firstSome/coherence sequence at739-745 with one classification match: there
is no independent shape Option to prefer over a separate false flag. The
classified/None normalization branch at245 becomes direct case construction.
Classification membership checks elsewhere become schema guards; they remain
semantic eligibility checks and are not falsely counted as eliminated guards.

Do not delete liveness, dirty-state, age, root containment, symlink, exact `.git`
contents, second dangling rediscovery or raced-content checks. Keep the
nonrecursive `.git` removal at855, guarded `rmdir`, empty-parent cleanup and
the warnings for every failed/raced step. Do not count changes to reaped or
the separate local dangling disposition as this record's deletion benefit.

## Encoded-side impact

No new encoded shape. `TmpfsReapCandidate` at schemas147-162 preserves root,
path, reapClass, ageHours, refCount, action, skipReason, parentRepo and bytes,
including omission generated by `O.getSomesStruct` at1028-1032. The full public
twelve-reason family remains unchanged. `TmpfsReapReport` at188-203 preserves
`schemaVersion: tmpfs-reap/v1`, scannedAt, tmpRoot, optional tmpRoots, applied,
candidates, reapedCount, reclaimedBytes and warnings with their current defaults.
No schema tightening of public historical JSON is permitted. Quality's schema
encoder, text renderer and Yeet's report summary must receive identical values.

## Test impact

At implementation, exercise six discovery cases through `runTmpfsReap` and
existing temporary filesystem fixtures, preserving exact skip reasons and the
unclassified fallback. A pure schema test should enumerate 26 old projected
tuples and verify the six supported target mappings without asserting those
26 are accepted public inputs. Cover apply false/true and all existing safety
failure paths; report absence, zero and false must remain distinct.

Retain `test/tmpfs-reap.test.ts` discovery/safety cases450-810 and codec/default
checks1139-1184,1572-1583, `test/quality-tmpfs-render.test.ts`, Quality command
dispatch help/JSON tests, and Yeet tmpfs sweep coverage. Add missing six-state
fixtures if required. Run focused suites then full `@beep/repo-cli` package
verification only during authorized implementation. No tests ran in P2.

## Risk

Tier1 internal state, but filesystem deletion makes behavior preservation
critical. Restrict only the private discovery classification. Preserve None
versus reason provenance, fail-closed errors and every repeated safety probe.
Do not combine the withdrawn cross-type Q or the still separate dangling-local
Q into this record. Parent admission and independent 26/6 correction are pending.
