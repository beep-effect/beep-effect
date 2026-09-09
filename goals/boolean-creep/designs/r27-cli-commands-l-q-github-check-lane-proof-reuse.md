# r27-cli-commands-l-q-github-check-lane-proof-reuse

**Current source-forward binding (P2 only)**

Revalidated against HEAD `4509872869eb87071250c67717769260f850bcf5` and merged main
`d68f1a11dd41579660a6c72f3d3e060d6b61352d`, after the R30 packet commit
`578b25de24f325a7240ed5321d708531c6d55536`. Native continuation uses
`gpt-6-astra` / `xhigh`; it preserves the original job provenance below.
This is a bounded source rebind, not another design or a P3 approval.
The canonical inventory at admission was 738 records /146 qualified, SHA256
`ea376cff64c549eb542d8bc4dc10c5aec519246b0f20a6720a8f9ad5c64a98d1`.

The full eight-section design below is retained byte for byte from the canonical
packet at this HEAD. Its prior source header and numbered locators describe
main `bed30c6adf3beed7de8538209fbdc84d26a3b8ce`. Apply the following exact
source-location mappings when reading it against d68; these mappings and the
current preservation notes govern this rebind. Equal source slices, full source
copies, consumer search, dependency bindings, and proposal hashes are frozen in
the private `pre-r31-main-d68-quality-designs` handoff. No product test or
independent review ran, and source implementation remains pending.

| Retained locator file | Exact current mapping |
| --- | --- |
| `Tasks.ts` | Old1–2578 stays identical. Old2579–2671 maps +3; old2673–3532 maps +3. The unrelated old2672 lint inventory log is replaced at2675. |
| `Quality.command.ts` | Old1–2074 stays identical; old2075–2081 maps +10; old2085–3938 maps +11. The only changed prior lines2082–2084 belong to local Effect plugin resolution, not these designs. |
| `internal/GithubChecks.ts` | Old1–421 stays identical; old422–507 maps +11; old508–891 maps +20. Two additional lane entries cause the shifts. |
| `test/quality-tasks.test.ts` | Old1–832 stays identical; old837–933 maps +11; old934–1024 maps +12; old1025–1029 maps +13; old1031–2926 maps +14; old2927–2964 maps +15; old2965–6197 maps +16. Changed earlier expectations are listed below. |

Qualification and target remain 4/3, derived/internal LiteralKit, designed/Tier1.
The actual pre-execution owner at Tasks1717–1722 and complete lane/wave bodies
remain exact. Current marker fixture is test1616–1647; concurrent journal and
next-chunk fixtures are2181–2271. The test collector alias moves3428→3431.
The canonical R30 ownership clarification is retained: R27 owns pre-execution
reusable/activeReuse; R30 owns the completed outcome's reused/stopAfterRed.
No shared guard receives duplicate credit.

Preserve additive `quality:storybook` at GithubChecks422–432 and
`repo-sanity:config-typecheck` at519–527, and the corresponding WaveOrder seed
rows. Build now receives `--affected --base origin/main --summarize` through
the unchanged ciLaneStep133–134 and the changed CiLane flag dispatch2542–2578.
The Storybook lane uses Turbo's dependency-aware affected dry-run probe at
CiLane1720–1761 and skips its own work at1778–1781 when no target is selected;
the older nearby GithubChecks comment about a path-profile git diff is stale.
Do not copy that comment into a new policy or turn an ordinary successful
wrapper execution into reused/not-run-early-stop. The declared lane ids, complete
args, current tier metadata, ordered results, proof identity and precise-red
policy all remain binding. Root lint's new tsconfig-overlay2581/log2675 are
preserved with zero Boolean-creep implementation credit.

**Retained design and original provenance**

Native P2 refresh bound to HEAD `e7b1e907726421c7d2a2e1cdd140280df47f2353` and immutable main
`bed30c6adf3beed7de8538209fbdc84d26a3b8ce`, compared with main
`3657f8f97f7135c53c3c0b9fa99aa19093c3e5ee`. Prepared by Codex
`gpt-6-astra` / `xhigh` under the user's current AGENTS instructions.
Status remains `designed`; cardinality remains 4/3. Tier 1: ordered Tier1E subsystem batch, with serial shared-file edits.
This document supplies no implementation or independent P3 approval.
Short source paths are relative to `packages/tooling/tool/cli/src/commands/Quality/`;
`src/` and `test/` paths are relative to the CLI package.

## Current shape

The actual sibling values now live in `runGithubCheckLane`, `Tasks.ts:1711–1758`.
They moved from the old `runGithubCheckWave`; their source did not disappear.
At1716 the lane prepares an `Option<LaneProofSession>`, at1717 it derives
`reusable` through the existing exact-proof predicate, and at1718 derives
`activeReuse = reusable && O.exists(session, prepared => prepared.mode === "active")`.
The values are local Booleans, not callable predicates or anonymous input flags.

Readers at1719–1737 log a hit and return the existing reused outcome only for
active reuse. Miss and shadow hit execute the command at1740–1757. The pair is
not returned, encoded, or stored. The new outcome object at1702–1709 contains
separate run-result fields; the R30 GithubCheckLaneOutcome design owns their
migration, outside this pair's guard accounting.

## Cardinality gap

| reusable | activeReuse | Supported decision |
| --- | --- | --- |
| false | false | Miss: disabled/unavailable preparation, absent exact record, or excluded volatile lane. |
| true | false | Shadow hit: exact record with a shadow session; execute the live command. |
| true | true | Reused: exact record with an active session; bypass the live command. |

Four representable pairs, three legal producer outcomes. False/true is excluded
by the sole assignment at1718. `internal/LaneProofReuse.ts:22–28,202–255,279–287`
provides the real off/shadow/active policy, shadow/active session subset, failure
fallbacks and exact-proof lookup. An active policy can miss, so input mode is
not the result domain.

The real repository/marker fixture at `test/quality-tasks.test.ts:1602–1633`
proves first active execution, second active reuse, shadow execution with an
existing record, then invalidation after a virtual-tree change. The marker
contains exactly the corresponding execution lines. This is source and fixture
proof of all three states, not a schema-permissiveness argument.

## Target schema

Reuse the existing `Quality.schemas.ts` role for the previously proposed
`GithubCheckLaneProofDisposition = LiteralKit(["miss", "shadow-hit", "reused"])`,
with `$I` annotation, same-name derived type and exported-symbol JSDoc. No new
package, role file, service or stored schema is needed. Its placement adds the
named schema export through the existing `index.ts:49` wildcard; account for
that intentional decoded schema export, without adding a separate barrel alias.
It does not change any existing public function signature or report codec.

No existing literal domain has these semantics. `LaneProofMode` is input policy;
`GithubCheckLaneRunStatus` is a later run outcome (a shadow hit can fail);
Yeet's payload-bearing `ProofReuseDecision` belongs to another ledger. Reuse
none of those as a misleading alias and add no duplicate taxonomy.

Immediately after the unchanged session preparation, derive one disposition
from that Option and one exact-proof observation: absent session or no exact
record gives miss; a hit on shadow gives shadow-hit; a hit on active gives
reused. Use Option matching, the kit's derived helpers and shared thunks where
they shorten equivalent code. Keep `hasReusableLaneProof` itself and the full
session payload for persistence. Delete both local Boolean aliases. Do not
introduce tagged object classes for these three payload-free cases or retain a
compatibility object with the two flags.

## Migration inventory

| Owner / consumer | Atomic migration and preservation |
| --- | --- |
| `Quality.schemas.ts`, existing schema import in `Tasks.ts` | Define/import the one annotated kit and derived type; document its intentionally exported schema surface. Existing required `GithubCheckLaneSpec.tier` at1108–1118 and tier kit at896–909 stay exact. |
| `Tasks.ts:1716–1737` | Replace the local pair and hit/reuse readers. Reused still returns the same `GithubCheckLaneOutcome`: original lane/session, `Some(QualityTaskLaneRun.make(...))`, status reused, inputDigest None, empty failures, reused true, stopAfterRed false. |
| `Tasks.ts:1740–1758` | Miss/shadow keep the current log, per-lane collector with concurrency1 and `ignoreQualityTaskLaneRun`, optional first run, full failures, reused false and precise-red stop predicate. No journal write moves into this concurrent lane body. |
| `Tasks.ts:1656–1666,1760–1779` | Preserve observer default versus ignored observer; keep successful-only proof persistence, optional duration fallback0, complete session payload, and caught warning. Outcome flags are outside this cluster; the R30 GithubCheckLaneOutcome design owns their migration. Preserve all optional fields. |
| `Tasks.ts:1794–1833` | The only runtime caller executes chunks concurrently, then folds outcomes in declaration order. Preserve `Math.max(1, concurrency)` chunking, serial chunks, active ID accumulation, serial journal append, failure order, stop accumulation and serial proof persistence. Already-started chunk members finish; precise fail-fast reds stop the next chunk. Stopped chunks append skipped records without preparing sessions. |
| `Tasks.ts:1835–1851,1888–1963` | Preserve skipped/reused/failed/passed precedence, inter-wave stopping, complete lane/run reports, first-red and skipped counts. |
| `Tasks.ts:2059–2074,3428` | Preserve public runner concurrency default1 and the test collector signature `(label,waves,policy,mode?,concurrency=1)`. Do not exchange the optional mode and concurrency arguments. |
| `Quality.command.ts:667–687,901–916` | Keep pre-push default1, evidence-ordered caller, cheap-gates concurrency4 and changeset lane tier rehoming. |
| `internal/GithubChecks.ts:187–231,320–383,535–563,582–583,590–632` | Preserve stable command IDs/step labels, independent tier metadata, doctest lane, canonical quality:secrets/security/sast/nix IDs, shared command lanes, complete order/args and the fallow:health gate. Do not restore deleted duplicate tsgo lanes or old tier-prefixed IDs. |
| `internal/LaneProofReuse.ts:22–28,202–255,257–287,294–339` | No model/API change. Retain all preparation fallbacks, seven identity fields, virtual-tree/base/head checks, refreshed-identity equality, merge ordering and atomic store write. Volatile exclusion now names quality:security and repo-sanity:bun-audit. |
| `src/test/Quality.test-kit.ts:58,64–78`, `index.ts:49`, package exports49/63/66/68 | Retain existing Tasks/testing routes and package export map. No new test-only adapter is necessary. |

Targeted Graft discovery followed by exhaustive package source/test text search
found only this lane body for the pair, its wave caller, the public runner,
Quality command callers and existing task-suite/test-facade exports. An absent
Effect.fn graph edge is not treated as proof of absence.

The exact ambient proof identity at `LaneProofReuse.ts:124–139` remains:
local-env lanes and commands whose spawn extends ambient environment hash the
complete inherited environment; isolated spawns omit that contribution.
Platform, architecture, Bun/Node versions and explicit lane environment remain.
Do not persist raw environment values. Preserve its alignment with the existing
spawn policy. New root-check/lint ownership, including package-scripts and
policy-fingerprint at `Tasks.ts:2600–2601`, remains unchanged by this design.

## Guard-deletion accounting

Delete two parallel local Boolean values at1717–1718 and the reconstructed
implication. Replace the reusable gate/log ternary at1719–1720 with exhaustive
miss/shadow-hit/reused handling; preserve exact hit logs. Replace the active
branch at1722 with the derived reused case, preserving its returned payloads
and behavior; the R30 companion owns the outcome representation. Miss/shadow still enter the shared execution path, without cloning it.

No coherence filter or normalizer currently exists, so none is credited as
removed. The outcome's `reused` branch at1820 and persistence guard at1763
are outside R27 deletion accounting. The R30 companion migrates their
representation while preserving completed-work attribution and proof safety.
Keep stop state, precise-red scheduling,
optional-run checks, failure policy and all ledger safety checks. The dispatch
must not bring back two equivalent sibling flags under different names.

## Encoded-side impact

The new disposition stays transient. Preserve `yeet-lane-proofs/v2`,
`github-check-run/v1` and `quality-task-lane-run/v1`, complete lane IDs,
stage/wave/status, failure and journal order, inputDigest None, duration,
timestamps, scheduling metadata and property/omission behavior. No disposition
key or new literal is emitted into a report or ledger.

Hit logs remain exactly `[lane-proof] shadow hit for exact lane proof: <lane-id>`
and `[lane-proof] reusing exact lane proof: <lane-id>`. Miss emits neither.
Concurrent lanes may finish/log at different times; do not impose new global
log sequencing. The journal and ledger writes remain serial in wave order.
An active reuse neither executes nor writes a newly successful proof; shadow
hits preserve the actual command failure or success. Persist warnings remain
nonfatal with their current text and timing.

## Test impact

Retain `test/quality-tasks.test.ts:1602–1633` and add behavior-sensitive hit-log,
command-bypass and reused-record assertions. Add a shadow-hit command failure
using the existing real repository fixture, proving shadow does not bypass or
manufacture a green result. Preserve defaults/mixed-cwd failure safeguards,
ambient/local-env/isolated hashing, cross-wave refresh, volatile exclusion,
mutating commands, linked worktrees and unsuccessful proofs at1635–2163.

The new concurrent fixtures at2167–2257 are mandatory: later-completing first
red still owns firstRed; lane report and NDJSON journal retain declaration order;
later lanes really overlap; fail-fast skips only after the current chunk.
Add a mixed miss/shadow/reused chunk assertion using those existing harnesses
if needed to cover the changed seam, including serial proof writes. Preserve
canonical lane IDs/tiers, cheap4/pre-push1 and doctest/topology assertions.
Do not recreate removed duplicate tsgo gates in expected arrays. Existing
security mitigation ordering remains outside this refactor.

Implementation must run focused Quality tests and the required
`bun run beep quality package-verify @beep/repo-cli`, then canonical Yeet checks
for the ordered Tier1E batch. This P2 preparation runs no package tests.

## Risk

The moved owner is still qualified. The risks are confusing policy with result,
a shadow hit with an execution bypass, or moving serial journal/ledger work into
the new concurrent helper. Preserve the complete new outcome and chunk protocol
while replacing only the local decision. No new domain policy or implementation
credit follows from upstream's extraction. Independent P3 remains pending.
