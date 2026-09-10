# Design: r28-cli-internal-root-tmpfs-discovered-classified-skip

Current P2 design on source `93217d998f851e2e93d9864e2b5315552eaa58a7`, main `d1b4d769fbaffddd55717f3b1ba461897dd545c5`.
Native source audit and private proof: `data/design-refresh-2026-09-09-r28-tmpfs-observation-owner.md`.
Independent P3 and merged packet ratification remain required. Coordinate both
Tmpfs models in the ordered Tier 1E subsystem batch, with guard credit allocated below.

## Current shape

`packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts:61-69` declares
the actual private `DiscoveredCandidate` type. Its connected members are
`reapClass: TmpfsReapClass`, `classified: boolean`, `shapeSkipReason:
Option<TmpfsReapSkipReason>` and `parentRepo: Option<string>`. Root, path and
idleSinceMillis are required payloads with their existing string/number types.
No nested member, required payload emptiness or ApplyOutcome Boolean is added.

The public class kit at `TmpfsReap.schemas.ts:34-41` has six literals. The public
reason kit97-109 has twelve: live-cwd-ref, live-fd-ref, live-flock, dirty-worktree,
too-young, parent-repo-missing-but-refs, wrong-shape, gitdir-target-exists,
parent-repo-present, contents-present, live-runner and unclassified. All twelve
are representable in the current private shape field, although constructors
use four. The actual Option parent payload contributes genuine presence.

Complete constructors are Git worktrees286-295; Vitest367-369; dangling373-397;
escaped root/path419-427 and452-460; head-install/fallow/scoped512-536. This is
returned discovery state, not a public request whose invalid combination has a
specified diagnostic. No public constructor accepts arbitrary private fields.

## Cardinality gap

The full product is `6 * 2 * (1 + 12) * 2 = 312`. Exactly13 rows are supported:

| reapClass | classified | shapeSkipReason | parentRepo |
| --- | --- | --- | --- |
| git-worktree | true | None | Some(path) |
| git-worktree | false | None | None |
| head-install | true | None | None |
| fallow-cache | true | None | None |
| scoped-temp | true | None | None |
| vitest-forks-tmp | true | None | None |
| dangling-worktree-stub | true | None | Some(path) |
| dangling-worktree-stub | false | gitdir-target-exists | None |
| dangling-worktree-stub | false | gitdir-target-exists | Some(path) |
| dangling-worktree-stub | false | parent-repo-present | Some(path) |
| dangling-worktree-stub | false | wrong-shape | None |
| dangling-worktree-stub | false | wrong-shape | Some(path) |
| dangling-worktree-stub | false | contents-present | Some(path) |

Git worktree classification is exactly parent presence293 (E3). Four other
families fix true/None/no-parent in their complete constructors. Dangling cases
have the parent/reason implications proved by373-397 (E4). Unknown stat results
may preserve a known parent with wrong-shape. An existing Git target need not
have the recognized parent marker, so gitdir-target-exists permits both parent
states. Parent-present, contents-present and classified dangling states require
a recognized parent. Do not remove any of these distinctions.

These13 rows project to exactly the six classified/reason states in the
completed independent correction. Its26/6 arithmetic and immutable receipt are
valid for that selected pair. It did not prove that the other co-carried fields
were independent. This expansion replaces that pair-only design prospectively;
it does not add a duplicate row or claim another independent review.

## Target schema

Use one private schema-derived candidate family with the existing six reap-class
values as its outer discriminator. Every case retains required root, path and
idleSinceMillis payloads with unchanged types. Use existing `TmpfsReapClass`
and named schema building blocks; never introduce thirteen new public classes.

- Four cache/temp cases (`head-install`, `fallow-cache`, `scoped-temp`,
  `vitest-forks-tmp`) need no parent/classification/reason member.
- `git-worktree` owns a two-case private discovery union: `RecognizedParent`
  with required parentRepo string, or `UnrecognizedParent` without it.
- `dangling-worktree-stub` owns seven private cases: `Exact` with parentRepo;
  `GitTargetExistsUnrecognizedParent`; `GitTargetExistsKnownParent` with
  parentRepo; `ParentPresent` with parentRepo; `WrongShapeUnrecognizedParent`;
  `WrongShapeKnownParent` with parentRepo; and `ContentsPresent` with parentRepo.

The sum4+2+7 is13. Build the six outer structs with their existing single
reapClass literal and augment their union with `S.toTaggedUnion("reapClass")`,
whose custom-tag API is present at
`.repos/effect/packages/effect/src/Schema.ts:6105-6175`. Each outer literal is
unique; the Git/dangling alternatives belong to nested private schemas.
Use named case schemas and private LiteralKits/derived guards for those domains.
Local Effect v4 `S.TaggedUnion` at
`.repos/effect/packages/effect/src/Schema.ts:6200-6250` provides schema-derived
cases, guards and match; compose private tagged subfamilies under the existing
outer class discriminator. No ad-hoc validator should recreate four mutually
dependent fields. Infer runtime types from these schemas. Required payload
types retain the current unconstrained strings and numbers; this migration
does not validate path syntax or introduce timestamp refinements.

Unrecognized Git worktree maps to the existing later unclassified fallback;
do not install Some(unclassified) at discovery. Each rejected dangling case
maps to exactly its current shape reason. Exact dangling and the four static
families proceed through the same later eligibility checks. The companion
local observation schema supplies a pure14-to-seven dangling projection with
existing reason precedence. Unknown status with known parent remains distinct
from no parent, and both variants retain their appropriate full payload.

## Migration inventory

- `TmpfsReap.ts:61-69`: replace the full connected four-member product with
  the private family. Keep required payloads and the separate MeasuredCandidate
  nesting94. ApplyOutcome101-104 is another owner and does not change.
- `235-246`, `373-397`: replace classifier pair normalization and final pair
  writes with the pure projection from the companion's14 local cases. This
  design owns the helper's firstSome/reason precedence once. The companion
  owns optional stat dispatch and lazy contents construction; implement both
  together without changing filesystem order.
- `270-298`, `367-369`, `419-427`, `452-460`, `512-536`: migrate every producer
  listed above. Preserve malformed/unrecognized Git parents, escaped-path
  rejection, directory enumeration order, idle timestamps and full paths.
- `108`, `665-689`: identity, locks and process-reference readers use common
  fields and existing class guards. Keep all liveness/lock semantics.
- `692-725`: dirty-worktree handling matches recognized Git parents with a
  required path. Non-Git and unrecognized Git cases still return false.
  Keep marker parsing, locked-file probe, Git status order and fail-closed
  status-error handling; a known parent does not prove it still exists.
- `739-788`: classification matches the private case before unchanged live-
  runner, liveness, state and age decisions. Preserve shape-reason precedence
  and the unclassified fallback; later skip reasons remain separate outcomes.
- `817-841`: head-install nested release preserves canonical checkout checks,
  failed/absent discovery behavior and empty-warning return when no recognized
  parent exists. Recognized Git cases pass their required payload to removal.
- `844-917`, `924-958`, `961-974`: directory/dangling/Git removal and containment
  retain all actual probes and warnings. Match unrecognized Git separately;
  recognized Git passes its parent string while still probing parent/.git,
  retaining missing-parent fallback removal, Git remove/prune order and errors.
- `978-1014`: rediscovery, skip checks and application retain timing, liveness,
  containment and unchanged ApplyOutcome aggregation. The new discovery case
  never replaces a later filesystem safety observation.
- `1016-1033`, `1214-1278`: report projection, deduplication, class filters,
  measurement and aggregation derive old public fields from cases. Preserve
  ordering, refCount, bytes, age and warning behavior.

The private type has no external constructor or decoder. Only public
runTmpfsReap/resolveBeepCacheRoot and report schemas are exposed through
`internal/repo-run/index.ts:27-28` and `src/test/RepoRun.test-kit.ts`.
`Quality.command.ts:129,3505-3523,3565-3567` and
`Yeet/internal/Sweep.ts:1141-1180` consume the same public reports. Existing
source/consumer coverage in the current design is retained by this correction.

## Guard-deletion accounting

Delete independent classified and shapeSkipReason writes, including helper
normalization245 and final pair393-394. Replace `danglingStubShape`239-245's
two-input Boolean/firstSome coordination with one exhaustive projection from
the local cases. Replace classificationSkipReason739-745's reason-first/false-
flag reconstruction with one candidate match. Schema-owned parent paths remove
Option reconstructions at696,836,932 and report projection1030; the corresponding
unrecognized-parent behavior remains an explicit case, not discarded input.

The local companion alone owns optionalStatIsMissing226-230, path/status
coordination379-385 and the gated contents temporary387. Do not claim those
deletions here. The helper's temporary true/Some(wrong-shape) before normalization
is legal constructor work, covered once here rather than independently counted
as a candidate tuple. The withdrawn dotted-field local4/3 owner stays withdrawn.

Actual liveness, dirty-state, age, root containment, symlink, contents, rediscovery,
nonrecursive marker removal, guarded rmdir, parent cleanup and failed-operation
warnings remain. Changing an Option test to a case match is a structural
replacement, not permission to remove its semantic safety behavior. No guard
credit is borrowed from ApplyOutcome or final reaped/warning aggregation.

## Encoded-side impact

The target is private. Keep public `TmpfsReapCandidate` schemas147-162 and
`TmpfsReapReport`188-203 unchanged, including all six class values, all twelve
skip reasons, `tmpfs-reap/v1`, defaults and historic decoder acceptance.
Projection1016-1033 emits the same root/path/reapClass/age/refCount/action and
optional skipReason/parentRepo/bytes values. Required internal parent paths are
projected to the old optional output field only for cases that had Some(parent).
Absent output fields stay omitted through the existing report construction;
do not emit null, false or empty strings. Quality JSON/text and Yeet summaries
must receive identical public values. No persisted-state codec migration exists.

## Test impact

The bound private source-extraction proof executed all14 local observation
states and their seven dangling candidate projections, checked full payloads,
and combined the inspected static constructors to enumerate13 full candidate
rows out of312. It also verifies that those rows project to the historical six
pair states. The five other-family constructors were source inspected, not
claimed executed by that proof. No product tests or package commands ran here.

At implementation, cover all13 cases through supported constructors and test
the exact public projection, not only internal tags. Include both parent states
for gitdir-target-exists/wrong-shape; preserve false/None unrecognized Git;
check known-parent permission errors and race schedules. A finite schema test
may enumerate312 old internal tuples and assert the13 mappings, without making
unsupported claims about public JSON input legality. Retain discovery/apply
fixtures in `test/tmpfs-reap.test.ts:450-810`, codec/default cases1139-1184 and
1572-1583, `test/quality-tmpfs-render.test.ts`, Quality dispatch help/JSON and
Yeet sweep coverage. Run focused suites and full package verification only in
an authorized implementation; independent P3 remains pending.

## Risk

Tier1E private owner, with filesystem deletion as its downstream effect. The
material risks are losing parent provenance, narrowing unknown/raced states,
changing skip-reason precedence or skipping fresh safety probes. Keeping all13
cases and the companion's full14 observations prevents those losses. Land both
private migrations in the ordered Tier 1E subsystem batch, preserve public codecs and original correction
history, and allocate guard credit as stated. This full-owner correction is
integrated native P2 evidence, not a new independent correction; independent P3 remains pending.
