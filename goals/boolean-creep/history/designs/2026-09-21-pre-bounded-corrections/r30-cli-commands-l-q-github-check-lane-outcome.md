# r30-cli-commands-l-q-github-check-lane-outcome

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
Tasks1600–2074, including the complete four-payload carrier, both writers,
view evidence, persistence gate, serial fold, reports and journal encoder,
are byte-identical to the original source. The previous finite behavioral proof
therefore remains design evidence for those same expressions; this rebind does
not rerun it or claim new implementation/test proof. Its receipt is copied with
origin/hash metadata. Current test collector alias is3431; the relevant marker
and wave fixtures map +14 (test1616–1647 and2181–2271).

Preserve complete lane/session/laneRun/failures payloads, optional-run/duration
fallbacks, journal→failure→stop→proof ordering, and ran-with-imprecise-failure
proof exclusion. New quality:storybook and repo-sanity:config-typecheck lanes
enter the same generic result path. A Storybook affected-probe skip is a
successful wrapper execution, not an active proof reuse or a wave's unlaunched
tail. No fourth contribution state follows from it. Its status remains whatever
the unchanged collector emits. Non-required hosted context metadata does not
remove a real local failure from the existing precise-red policy.

R27's current companion ownership prose is retained. The prior body describes
R30's original admission as historical provenance; R30 is now terminal and the
case is already canonical. This prefix supplies the current binding without
reclassifying or reimplementing it. The private carrier placement tradeoff stays
explicit for independent P3; no new public carrier export is introduced here.

**Retained design and original provenance**

Private P2 design, proposed status `designed`, bound to HEAD
`e7b1e907726421c7d2a2e1cdd140280df47f2353` and main
`bed30c6adf3beed7de8538209fbdc84d26a3b8ce`. Native Codex job:
`gpt-6-astra`, reasoning `xhigh`, `fork_turns: none`, confirmed by the parent
launch record. This task's explicit routing overrides the current repository
`medium` default. No model fallback occurred.

Source paths abbreviated below are relative to
`packages/tooling/tool/cli/src/commands/Quality/`; `test/` and `src/test/`
are relative to the CLI package. Exact complete copies and hashes remain in the private P2 bundle bound by
[the parent integration receipt](../data/r30-parent-integration.json).
The raw R30 row is source-qualified; its `storage: stored` is corrected to
`derived`. Tier 1, ordered Tier1E Quality work, with serial shared-file edits.
This proposal grants no P3, GATE 2, implementation, test-suite, or census credit.

## Current shape

`Tasks.ts:1702–1709` declares the module-private `GithubCheckLaneOutcome`:

```ts
type GithubCheckLaneOutcome = {
  readonly lane: GithubCheckWaveLane;
  readonly session: O.Option<LaneProofSession>;
  readonly laneRun: O.Option<QualityTaskLaneRun>;
  readonly failures: ReadonlyArray<QualityTaskFailed>;
  readonly reused: boolean;
  readonly stopAfterRed: boolean;
};
```

This is a real same-carrier two-Boolean net hit. The complete carrier has four
payload properties, including the three named lane/session/laneRun objects and
the failures array, plus the two Boolean properties. Those payload properties
are retained in every case. There is no external outcome decoder, independent
setter, mutable Ref, or durable storage for these bits. `runGithubCheckLane`
returns the carrier and the wave folds its results once in declaration order.

The active-reuse writer at1722–1737 returns the original lane and session,
`Some(QualityTaskLaneRun.make({ id, label, status: "reused", inputDigest: None }))`,
empty failures, and `true/false`. The execution writer at1740–1757 runs one
lane through `collectQualityTaskLaneRuns`, takes `A.head(result.report.lanes)`,
retains all failures, and returns `false` plus the conjunction of nonempty
failures and a present `stop-after-red` decision in that optional lane run.
`qualityTaskLaneRunFromOutcome` at1600–1622 produces passed or failed run status;
only failures receive the supplied scheduling decision. `redSchedulingDecision`
at1644–1654 maps precise and estimate-less lanes to stop, and imprecise to continue.

Both Booleans are a disposable view of a completed execution result. Active
reuse is already represented by the reused laneRun status; executed stopping is
already represented by failure evidence and the laneRun scheduling decision.
Therefore `derived` describes this pair more faithfully than the raw `stored`
label. It is materialized on an in-process object today, but does not represent
an independently stored state machine. No new stored disposition is proposed.

Readers are the persistence exclusion at1763 and wave reuse attribution at1820
and stop accumulation at1828. The wave's remaining Option journal check,
failure append, and proof call at1823–1829 consume the full payload. The only
producer call is in the concurrent chunk at1816–1818. Graft's missing call edge
for this Effect.fn symbol is not absence proof: textual uses and the full
producer/consumer body were inspected.

Distinct ownership: `r27-cli-commands-l-q-github-check-lane-proof-reuse` owns
`reusable/activeReuse` at1717–1718 and their pre-execution hit/bypass readers.
This R30 case owns `reused/stopAfterRed` on the completed result. It receives no
credit for deleting the R27 conjunction, hit log branch, or bypass branch.

## Cardinality gap

| reused | stopAfterRed | Meaning and witness |
| --- | --- | --- |
| false | false | Ran without a stopping contribution: passed execution or imprecise failure; execution writer1748–1757. |
| true | false | Reused an active exact proof; writer1723–1737. |
| false | true | Executed failure with a present stopping decision; writer1748–1757. |
| true | true | Unreachable: the only reuse writer fixes stop false and the only execution writer fixes reused false. |

The Boolean projection admits four pairs and the real result domain admits
three. E1 is proved at1735–1736 and1753–1756. This is neither a set of independent
configuration flags (D1) nor an external driver wire mirror (D2).

Three states do not mean three possible report payloads. In particular:

- `ran` includes a failed imprecise lane. It must remain failed in both reports,
  contribute all failures, and never gain a successful proof.
- Active session mode alone does not prove reuse; an active miss runs. A shadow
  hit also runs. Do not re-read session policy to classify the completed result.
- An empty failures array does not distinguish passed execution from reuse.
- `failed` status alone does not distinguish stopping and imprecise reds.
- Preserve `laneRun: None`, absent scheduling decision, and absent duration
  fallbacks; do not strengthen them to Some or invent a default run record.
  The present singleton collector normally supplies Some, but the old type and
  predicates deliberately tolerate None. Its absence maps to ran and duration0.
- A stopping contribution does not itself stop collect-all scheduling. The
  unchanged wave failure policy controls the latch.

`finite-table-proof.json` records nine abstractions: the four ordinary reachable
payload cases (reuse, pass, imprecise failure, stopping failure) and five explicit
no-decision/optional-run defensive cases. These preserve every old flag
projection on the admitted producer domain. The combined-true row remains
unconstructible as a literal. Synthesized carriers with status reused plus
failures are not outputs of either producer and are not a supported external
input contract; no new decoder/normalizer is introduced for them.

## Target schema

Add the single payload-free domain in the existing `Quality.schemas.ts` role,
using its existing `$I` composer and existing `LiteralKit` import:

```ts
export const GithubCheckLaneContribution = LiteralKit([
  "reused",
  "ran",
  "stop-after-red",
]).pipe(
  $I.annoteSchema("GithubCheckLaneContribution", {
    description: "Derived scheduling and proof contribution of a completed GitHub-check lane.",
  })
);
export type GithubCheckLaneContribution = typeof GithubCheckLaneContribution.Type;
```

Add titled Example documentation and the normal type-level documentation.
No handwritten literal union, duplicate Enum, custom guard, `as const`, or
payload-bearing tagged-union taxonomy is needed. `ran` deliberately says
nothing about success. The kit gives `.Enum`, `.thunk`, `.is`, and `$match`.

Reuse the exact existing `GithubCheckLaneRunStatus.is.reused` and
`GateRedSchedulingDecision.is["stop-after-red"]` helpers for classification.
`GithubCheckLaneRunStatus` cannot serve as the contribution kit: its failed
case splits into stopping and continuing results and it includes unlaunched
status. `GateRedSchedulingDecision` cannot serve alone: it omits reuse and
successful execution. The R27 `LaneProofDisposition` design distinguishes
miss/shadow-hit/reused before execution and cannot replace this result view.
No existing `GithubCheckLaneContribution` definition was found.

Delete both flag properties from the result carrier. Use an annotated,
module-private `S.Class<GithubCheckLaneOutcome>` at the current Tasks owner,
with exactly the four retained fields, built from existing schemas:

```ts
class GithubCheckLaneOutcome extends S.Class<GithubCheckLaneOutcome>(
  $I`GithubCheckLaneOutcome`
)(
  {
    lane: S.toType(GithubCheckLaneSpec),
    session: S.Option(S.toType(LaneProofSession)),
    laneRun: S.Option(S.toType(QualityTaskLaneRun)),
    failures: S.Array(S.toType(QualityTaskFailed)),
  },
  $I.annote("GithubCheckLaneOutcome", {
    description: "Complete in-process lane result retained for ordered wave journaling and proof persistence.",
  })
) {}
```

Tasks gains its own `$RepoCliId.create("commands/Quality/Tasks")` composer and
runtime imports for existing `GithubCheckLaneSpec` and `LaneProofSession`;
`S`, `QualityTaskLaneRun`, and `QualityTaskFailed` already exist there. This is a
private technical transfer carrier at its sole implementation owner. It avoids
exporting a carrier containing proof-session internals or moving session models
into the public schema facade. The newly introduced reusable literal belongs
in the existing schema role. There is no new source file, service, package,
public carrier export, boundary decoder, or normalization. Source-first P3
must assess this explicit local-carrier placement under the command-role law;
it is not an instruction to silently widen the facade if relocation is desired.

The class models complete common payloads, not case-specific fields. Keep both
Options, all failures, and every nested schema field; do not narrow any case to
empty failures or mandatory session/run. Use type-side `S.toType` because all
inputs are existing runtime schema objects and Options, not encoded forms.
Effect reference `Schema.ts:2458–2492,12746–12824` confirms type-side extraction
and runtime Option schema support. Class construction replaces `satisfies`
without decoding JSON or changing report values/defaults.

Add one private `githubCheckLaneContribution(outcome)` pure view in Tasks.
It returns reused for a present reused laneRun. Otherwise it returns
stop-after-red only when failures are nonempty and the optional laneRun has
the existing stop decision; all remaining results return ran. Use Option and
Array matching and the existing derived schema predicates/thunks. Do not
introduce reusable Boolean aliases or put the literal back onto the carrier.
Derive it once at the beginning of each serial outcome fold, before mutations.
The view adds no I/O and never recomputes the session or report payload.

## Migration inventory

| Exact owner / surface | Required change or preserved dependency |
| --- | --- |
| `Quality.schemas.ts:8–24,954–967,1108–1233` | Define/document the one new contribution kit and type in the existing role. Reuse the current lane, run-status, red-decision, and lane-run schemas. No existing literal values or schema fields change. |
| `Tasks.ts:8–29,87–120,1697–1709` | Add the Tasks identity composer and the existing schema runtime imports. Replace only the private result declaration with the complete four-field class. Add the pure derived view beside it. No new carrier export. |
| `Tasks.ts:1723–1737` | Return the class with the exact original lane/session, reused run construction, inputDigest None, and empty failure array. Delete only the two flag writes; preserve preparation, R27 decision, logging, and active bypass. |
| `Tasks.ts:1740–1757` | Retain execution log, singleton collector input and observer, optional first run, original result failures, and original session/lane. Construct the four-field carrier; delete flag writes. The former stop predicate moves into the one derived view, with identical Option/nonempty semantics. |
| `Tasks.ts:1760–1779` | Helper becomes the executed non-stopping contribution's proof attempt. Delete the reused side of its OR guard. Retain the independent nonempty-failure return (imprecise failures), complete session matching, duration Option fallback0, persist call, and caught warning. Its only caller dispatches via the contribution literal after journaling/stop accumulation. |
| `Tasks.ts:1816–1822` | Keep concurrent `Effect.forEach` and returned declaration order. For each result derive contribution once. Replace reused-bit bookkeeping with exhaustive contribution matching: reused appends its lane id; ran/stop retain the existing array. No I/O moves into this mapping. |
| `Tasks.ts:1823–1829` | Keep optional run append/await before laneRuns append; keep failure append next. Set the stop latch by exhaustive matching: stop uses existing `stoppedAfterRed || failFast`; reused/ran retain latch. Last, match contribution to no-op for reused/stop and existing proof helper for ran. Never return/continue early before the common journal and failure work. |
| `Tasks.ts:1794–1815,1832–1851,1888–1965` | Preserve chunk width `Math.max(1, concurrency)`, stopped-tail journal, accumulated result fields, skipped/reused/failed/passed report precedence, inter-wave stopping, firstRed and skipped counts, and both report codecs. |
| `Tasks.ts:1600–1695,1968–1995,2059–2074,3428` | Preserve lane run construction and timestamps/status/exitCode/red-decision projection, ignored concurrent observer versus default journaling observer, exact durable journal behavior, runner signature and default1, and existing test collector alias. |
| `Quality.command.ts:667–687,898–915`; `internal/GithubChecks.ts` | Preserve actual CLI callers, evidence ordering, cheap-gates concurrency versus pre-push default, canonical lane IDs/step labels, required tier metadata and all gate policies. No planned source edits. |
| `internal/LaneProofReuse.ts:22–28,86–96,202–255,257–287,294–339` | Reuse the session runtime schema only. Retain off/shadow/active handling, volatile security/bun-audit exclusions, exact identity matching, refreshed proof inputs, store merges and atomic ledger writes. No session or proof schema changes. |
| `Quality.errors.ts:191–220` | Reuse full `QualityTaskFailed`; preserve label, command, exitCode, typed failure channel, and error rendering. No source edits. |
| `Quality/index.ts:49`; `src/test/Quality.test-kit.ts:25–58` | The existing schema wildcard exposes the new documented literal only; add it to the existing explicit schema test-kit list if tests import it there. The carrier and pure view remain private. Keep the existing Tasks test seam. |
| `test/quality-tasks.test.ts:1466–1633,2107–2257` | Extend existing behavioral tests as below, using `@beep/repo-cli/test/Quality` for any new imports. Do not widen direct deep source imports or add a test-only public result API. |
| CLI `package.json:22–76,92–142,180,192,203`; `src/index.ts` | Existing facade and test patterns suffice. No manifest, generated scripts, root barrel, dependency, lockfile, or new subpath changes. |

Binding of reuse primitives: `@beep/schema` root `src/index.ts:287` exports
`LiteralKit/index.ts`, which exports `LiteralKit.schema.ts:730–770`.
`@beep/identity/packages` exports `$RepoCliId` at its source `packages.ts:502`.
The CLI already declares both workspace dependencies plus catalog Effect.
All exact source/test/barrel/manifests and local Effect reference files used
are frozen. Do not treat a matching Git SHA as sufficient if their bytes drift.

Implementation coordination must amend the R27 design's statement that the
outcome bits remain untouched to say "outside R27 ownership; R30 owns their
migration." That is a scope clarification, not duplicated guard credit or a
change to R27's 4/3 qualification. The private bundle does not edit that document.

## Guard-deletion accounting

| Existing check / invariant | Accounting |
| --- | --- |
| Two Boolean declarations1707–1708 and paired assignments1735–1736/1753–1756 | Remove two carrier bits and their four assignment slots. The E1 exclusion becomes the three-literal domain. No compatibility bit object survives. |
| `outcome.reused || nonempty(outcome.failures)` at1763 | Delete the compound reused-or-failed check. Literal dispatch at the existing call position excludes reused/stop contributions; the helper retains its failure-only exclusion for ran. This removes Boolean reconstruction while preserving two separate proof safety reasons. |
| `if (outcome.reused)` at1820 | Remove the Boolean gate and use the exhaustive contribution match for attribution. Bookkeeping remains; the branch is not claimed as eliminated work. |
| `failFast && outcome.stopAfterRed` at1828 | Remove the outcome Boolean read and its independent state channel; one literal stop case updates the existing policy latch. Keep failure policy and prior-latch behavior. |
| Nonempty failures plus optional red decision at1755–1756 | Relocate once into the derived view; do not claim this legitimate domain classification disappeared. No new correlation checker is added. |
| Optional laneRun/session/duration handling, failure persistence guard, exact proof identity refresh, stopped chunk handling, error catch | Retain. None are counted as coherence guards removed. |
| `reusable/activeReuse`1717–1722 | R27 ownership; zero deletion credit here. |

No defensive combined-true normalizer exists today; no fictional normalizer
is credited. The meaningful reduction is removal of two independent bit
channels and replacement of their multi-reader dispatch with one derived
literal, including eliminating the persistence OR reconstruction. Matching
still performs the necessary bookkeeping and policy decisions. Do not describe
this as removal of all runtime branching or a proof that tests are unnecessary.

## Encoded-side impact

The carrier and contribution stay inside the executor. No JSON codec sees the
new literal or carrier. Keep `github-check-run/v1`, `quality-task-lane-run/v1`,
and `yeet-lane-proofs/v2` byte contracts and accepted legitimate payloads intact.
The four payload fields pass through unchanged; all nested run status, timing,
exitCode, inputDigest, scheduling decision, session records/identities/path/mode,
and failure label/command/exitCode remain exact. Do not map stop to a new report
status, turn ran into passed, or strip fields to obtain a cleaner union.

The only report writers remain `Tasks.ts:1963–1995` and the existing output
path. A reused lane retains its missing timing/exitCode fields and inputDigest
None; an executed lane retains its observed values. Missing run remains missing;
missing proof duration still falls back to0. Proof ledger persistence remains
serialized after the same lane's journal/failure/stop fold. Reused and failed
lanes do not write successful proofs. Existing identity rechecks may still
refuse an otherwise eligible success; that behavior remains in the helper.
Warning text and nonfatal recovery remain unchanged.

Finite proof compares abstract complete event traces and direct payload
passthrough, not encoded bytes from modified source. P4 must additionally
compare controlled-time report/NDJSON and ledger output through the unchanged
codecs using the real harness. Concurrency can change completion/log timing
naturally; do not impose a new global order. Declaration-order journal and
proof behavior are the stable contracts. No wire migration or Tier2 codec is
needed for this internal result view.

## Test impact

Retain the source-backed fixtures at `test/quality-tasks.test.ts`:

| Existing tests | Relevant assertion / extension |
| --- | --- |
|1466–1516 precise red;1518–1551 imprecise red;1553–1577 estimate-less red;1579–1600 collect-all | Preserve failure payloads, red decisions, firstRed/skipped counts, optional run fields, and policy differences. Add a precise-versus-imprecise failed result comparison proving both remain failed but only one latches under fail-fast. |
|1602–1633 exact proof marker | Preserve first execution, reuse bypass, shadow execution, tree invalidation. Extend complete reused laneReport/empty-failure assertions without changing the fixture's command count. |
|1635–1700 session/environment fallbacks;1700–1881 identity environments;1882–2105 missing base/cross-wave/volatile/mutation/worktree cases | Preserve all proof eligibility and identity rules. No new environment reads or session normalizers. |
|2107–2135 failure then success then reuse | Preserve failed proof exclusion. Add an imprecise failure using the existing seed/marker harness: it continues scheduling, remains failed, writes no successful proof, and executes again on the next run. This specifically kills the false shortcut ran==passed. |
|2167–2221 concurrent attribution/journal | Preserve actual overlap, first-declared red attribution, failure order, lane report and NDJSON declaration order. Add a mixed reused/pass/imprecise-failure/stopping-red chunk with deterministic outcomes and a later tail; observe complete report and proof ledger, including serial successful proof merges. |
|2223–2257 next-chunk fail-fast | Preserve completion of already-launched siblings and skipping only subsequent chunks, including the tail journal. Run the same mixed case under collect-all to prove policy still owns stopping. |

For the new literal, a small schema acceptance/rejection test through the
existing test facade may establish exactly three options and reject unknown
literals. Behavioral tests above are the essential checks; don't add a
Boolean-to-literal compatibility normalizer merely to test the unreachable pair.
The private model tests None run/no decision/no duration defensive cases without
forcing a new public source test seam. Any source-level test seam considered
necessary in P4 must preserve the existing source-only test-facade boundary.

P2 performed only `validate-inventory.ts` against the private row, an eight-section
structural check, frozen-byte checks, and the standalone finite behavioral model.
No source package tests or production code were run/changed. P4, after independent
P3 and the campaign's other admission gates, must run the focused Quality suite
using the package Vitest configuration (for example from the CLI package:
`bun run beep:test test/quality-tasks.test.ts`), then the mandated full
`bun run beep quality package-verify @beep/repo-cli`, then the canonical Yeet
proof for the ordered batch. Add no manifest script or generated file.

## Risk

Primary risks are substituting session policy for completed reuse, treating ran
as success, narrowing away Option absence, interpreting every failed run as a
stopping red, or moving proof writes/journaling into concurrent lane execution.
All are covered by explicit counterexamples and the event-order invariant.

The private carrier class makes the remaining technical result schema-backed
without exposing proof internals. Its placement at the sole Tasks owner is an
explicit narrow choice; the new reusable literal stays in the canonical schema
role. If P3 requires another role placement, revise this design before apply
and bind all resulting imports/barrel consequences; do not quietly export a
carrier or restructure `LaneProofReuse` during implementation. `S.Class.make`
introduces construction validation over already schema-produced values; P4
must verify complete payload equality and preserved error behavior, rather
than adding new narrowing/defaults to make constructors convenient.

The literal classifier's equivalence relies on the verified producer invariant
that only the active reuse branch emits reused laneRun status and that it
emits empty failures. Keep a direct source binding to both writers and the
run-status constructor when reviewing any later source version. Do not claim
its finite-table model covers an arbitrary unsupported synthetic outcome bag.

This proposal was prepared against canonical inventory
`5e0eaffd2584e0d81b780622111bd71862691b4ecd1cdd4038c6e634e5a7da4d`
(698 records /141 qualified). The parent integration receipt records its
subsequent admission after terminal reconciliation.
The proposed row, design, and this bundle do not update that inventory, source,
existing designs, index, refs, or running census inputs. P3 remains pending.
