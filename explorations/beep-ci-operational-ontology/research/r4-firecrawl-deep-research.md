# Deep Research: Live CI Practice for Monorepo Verification Scheduling

**Date:** 2026-08-27
**Depth:** thorough (Firecrawl Deep Research)
**Lane:** R4 of `explorations/beep-ci-operational-ontology`
**Method:** Firecrawl search + scrape of primary docs and 2025–2026 blogs.
X/Twitter threads were requested by the lane prompt but were not collected
in this run, so none are cited. Claims without a retrieved URL are marked
[INFERENCE]. No URL in this file was invented.

## Executive Summary

Turborepo 2.9 (Anthony Shew, 2026-03-30) made `turbo query` stable GraphQL,
with a shorthand `turbo query affected` that returns *why* a package or task
was selected. That `reason.__typename` table is the live invalidation
vocabulary: file change, lockfile change, global-deps change, or a
conservative "cannot tell, so everything is affected" fallback. The
summarize-JSON field `hashOfExternalDependencies` still appears in a 2.0.12
discussion; it is not a `turbo.json` knob. Public hashing is global-hash
inputs plus per-package lockfile/file inputs. Bun's text `bun.lock` matured
across 2.x: unusable for granular misses as `bun.lockb`, parseable as v0
(Dec 2024), broken by v1 (Jan 2025), then declared stable in 2.6 with
per-package miss behavior. `turbo-ignore` is deprecated in favor of query.

Fleet CI at scale is not fair queueing. GitHub's merge queue is FIFO with a
`merge_group` fan-out cap (1–100 concurrent builds) and merge-batch limits.
It has no package graph. Mergify, Nx Agents, and Bazel RBE each add a
different layer: graph-scoped batches and labeled hotfix priority;
historical-runtime task placement plus PR-size agent counts; hermetic action
dispatch with vendor priority queues (EngFlow) or Sparrow late-binding
(BuildBuddy). None publish DRR or DRF. Admission is "does this PR or action
have a seat in the current speculative group / worker pool," not "does this
agent deserve the next quantum."

The 2025–2026 agent-fleet literature is about shared CI as a *burst arrival
process*. Cursor's Wilson Lin experiments show lock-based self-coordination
collapsing twenty agents into two or three of effective throughput. Mergify's
own queue (`max_parallel_checks: 5`, `batch_size: 1`) choked on morning
bursts of agent PRs and responded by widening batch size *only under load*.
Merges/day did not rise (48.4 → 45.3). GitHub Actions, as of 2026-05-07, can
queue up to 100 runs in a concurrency group instead of dropping extra pending
runs. Shipped wasted-work handling is cancel-and-replay: GHA pending
replacement, Bazel dynamic execution (race local vs remote, cancel the
loser), Pants speculation/cancellation, Mergify batch bisection. Time to
feedback is dominated by skipping setup (`turbo query affected` before
install) and by merge-queue occupancy, not by turbo's task hash once a run
has started.

Prior art for "ontology-driven CI" — a reasoned T-Box that *computes* the
pipeline — was not found. Adjacent layers are mature: OSLC Automation 2.1
models Plan/Request/Result as lifecycle resources; SPDX 3.0.1's Build
profile attests what a build *was*; Bazel/Pants/Buck2/Nx/Turbo already *are*
semantic build graphs. Mergify can ingest Turborepo/Nx/Bazel scopes as
relatedness. [INFERENCE] beep-ci-ops would join those graphs to a
fairness/admission/stopping model. It would not be porting an existing CI
ontology scheduler.

## Key Findings

1. `turbo query affected` is stable in 2.9 and is the documented replacement
   for `turbo-ignore`. A too-shallow checkout makes *every* package affected.
2. `--affected` still defaults to package granularity. Task-input
   granularity is `futureFlags.affectedUsingTaskInputs` (default `false`) or
   `turbo query affected --tasks`.
3. `hashOfExternalDependencies` is a `--summarize` JSON field (seen on turbo
   2.0.12), not a config key. Lockfile hashing is now a package-hash input
   and a `LockfileChanged` reason.
4. GitHub merge queue is FIFO + `merge_group` throttle, graph-blind.
   Mergify adds scopes (including a Turborepo upload), batching with
   split-on-fail, and labeled hotfix priority "while fairness is preserved."
5. EngFlow RBE dequeues by integer priority then FCFS. BuildBuddy schedules
   with Sparrow (power-of-two / late-binding). Neither is contributor-fair
   DRR.
6. Agent fleets share CI as occupancy and burst arrivals. Mergify: AI PRs
   broke main *less* (1.9% vs 4.4%). Cursor: equal-status file locks failed.
   Willison: FastRender's GitHub Actions CI was initially failing.
7. No product found that derives CI jobs from a reasoned ontology. OSLC is
   lifecycle; SPDX Build is attestation; semantic *build systems* already
   encode the graph.

## Detailed Analysis

### 1. Turborepo internals as they stand now (2.x, 2025–2026)

**`turbo query affected`.** 2.2 (Tom Knickman / Anthony Shew, 2024-10-18)
shipped `turbo query` as experimental GraphQL. 2.9 (Shew, 2026-03-30) marks
it stable and highlights `turbo query affected`. The command compares two
git refs. Bare invocation returns affected tasks; `--packages` switches to
packages. `--tasks` plus `--packages` asks whether a named task in a named
package actually changed. Task-level selection uses the task's `inputs`
globs plus upstream affected tasks. Comparison needs the commits between
base and head. Official advice: `--filter=blob:none --depth=0`. A too-shallow
clone reports all packages changed.

The `reason.__typename` table is the operational ontology fragment.
Package-specific: `FileChanged`, `LockfileChanged`,
`ConservativeRootLockfileChanged`. Repository-wide (every package selected):
`RootInternalDepChanged`, `GlobalDepsChanged`, `DefaultGlobalFileChanged`
(`turbo.json` / `turbo.jsonc`), `LockfileChangeDetectionFailed`,
`LockfileChangedWithoutDetails`, `GitRefNotFound`, `ScmError`. Graph
expansion (not itself a cache miss): `DependencyChanged`,
`DependentChanged`, filters, `RootTask`. `RootInternalDepChanged` is tied to
the global hash: a workspace package used by the root `package.json`
changes, *every* cacheable task misses.

`turbo-ignore` is deprecated: "Use `turbo query affected` instead," with
task-level detection as the reason. The skipping-tasks guide's CI pattern
is: after checkout, before install, `turbo query affected --packages web`,
`jq` `.data.affectedPackages.length`, `exit 0` if zero — saving *setup*, not
just cache replay.

**`--affected` vs query.** Default `--affected` is package-level: any file
change selects every task in that package. `futureFlags.affectedUsingTaskInputs`
(default `false`) makes `--affected` honor task `inputs`. Changing
`package.json`, `turbo.json(c)`, the lockfile, or `globalDependencies` still
selects everything. Changing any future flag also changes the global hash.
Issue #10688 (y-hsgw, 2025-07-17, turbo 2.5.5-canary.1) reported unrelated
packages executing under `--affected` in GHA; chris-olszewski closed it
not-planned (2025-07-22) because `TURBO_SCM_BASE` included global changes.
[INFERENCE] Operators will misread conservative reasons as scheduler bugs
unless the reason type is first-class in the episode log.

**`hashOfExternalDependencies`.** Absent from the current configuration
reference and from the caching page. Discussion #9004 (turbo 2.0.12) shows
it as a field in `turbo lint --summarize` JSON beside the per-file input
map. Two machines can share that field and still disagree on the final hash
when a file input differs. The live public model: lockfile changes that
affect *this package* enter the package hash; lockfile changes that affect
the *workspace root* enter the global hash and miss everything. 2.6's Bun
note is exactly that distinction becoming true for `bun.lock`.

**`bun.lock` maturity.** Issue #9628 (turbo 2.3.3 era): text `bun.lock`
produced a package-graph warning; `bun.lockb` worked. 2.5 added `turbo prune`
for Bun v1.2+ because the lockfile is text. 2.6: "Bun package manager to
stable" — granular lockfile analysis. History in that post: beta `bun.lockb`
without granular detection; `bun.lock` v0 (Dec 2024) parseable; v1 (Jan
2025) broke the parser; rewrite after the format stabilized. Verdict:
*usable and granular on current v1*, not "has always worked."

**Global inputs / cache posture.** Config key `globalDependencies` (globs in
every task hash; any hit misses *all* tasks), plus `globalEnv` /
`globalPassThroughEnv`. Implicit global-hash inputs cannot be ignored: root
`package.json`, the lockfile, sources of internal packages the root depends
on. Task posture: `cache` (default true), `inputs` (default all VCS files;
`package.json` / `turbo.json` / lockfiles are always inputs), `envMode`
(`strict` default). Remote cache: `remoteCache.enabled` (default true, still
needs login/link), `signature` (HMAC, "not a security feature"),
`futureFlags.longerSignatureKey` (32-byte minimum), `preflight`, `timeout`
(30s), `uploadTimeout` (60s). `cacheDir` defaults to `.turbo/cache` and, in
a Git worktree, automatically shares the main worktree cache. 2.9 also
ships experimental OpenTelemetry and a claimed 96% Time-to-First-Task
gain; circular package dependencies no longer block adoption.

### 2. Fleet CI patterns at scale: admission and fairness

**GitHub merge queue.** PRs merge after required checks pass on the predicted
merge of latest target + already-queued PRs. CI *must* listen for
`merge_group` or required checks never report. **Build concurrency**
throttles how many `merge_group` webhooks fire at once (1–100). Merge
limits (min/max PRs, plus a wait timeout) only affect how many land on the
base *after* a group is green — they do not combine builds. **Only merge
non-failing PRs** can be turned off so a failing PR may ride in a group
whose last PR is green (flake-tolerance). There is no documented priority
class, deficit counter, or package graph. Mergify's 2026 critique matches
the docs: one line, duplicated PR CI then queue CI, no relatedness, no
freeze/hotfix as first-class concepts (Julian Maurin).

**Mergify.** GitHub's single queue becomes multiple `queue_rules`; batching
starts at `batch_size: 2` with automatic scope reduction on failure;
`priority_rules` (e.g. `label = hotfix` → `priority: high`) "jump ahead
while fairness is preserved" — vendor prose, not a published algorithm.
**Scopes** (Julien Danjou, 2026-06-11): `mode: parallel` with
`max_parallel_checks: 5`; file-pattern scopes *or* uploaded scopes from
Bazel, Nx, **Turborepo**, or Pants. Related PRs share speculative CI;
unrelated PRs do not share blast radius. This is the closest shipped
graph-aware admission to what beep-ci-ops wants, and it is still a merge
queue, not a machine-wide CPU/lock scheduler.

**Nx Cloud DTE / Nx Agents.** Affected + remote cache are not enough at
scale. Agents allocate tasks from historical runtimes and the task graph;
agent *count* is "allocated dynamically based on the size of the PR." Enable
is "one line" plus Nx Cloud. No fairness, quota, or per-user quantum is
documented. Nx Cloud 3.0 (2023-04-19) is older product history (prefetch,
faster uploads), not 2026 semantics.

**Bazel RBE.** Remote execution distributes hermetic actions. The official
RBE overview rendered as navigation chrome in this scrape; internals below
are from pages that yielded body text. **Dynamic execution** races local and
remote for the same action and cancels the loser — wasted-work handling as
a first-class strategy. **EngFlow** (docs + 2025-04-07 blog): default is
FCFS; `--remote_execution_priority` selects a priority queue per worker
pool; highest priority dequeues first, same priority is oldest-first. Their
own scale: 5 emergency, 4 interactive workstation, 3 releases, 2
pre-submit, 0 post-submit (Bazel default), −1 background, with 1 reserved
for a future merge queue. That is urgency, not deficit fairness. Changing a
checked-in priority is a migration because old branches keep old integers.
**BuildBuddy** (distributed-scheduling post): nginx round-robin failed on
heterogeneous action sizes (10ms compile vs 30min test); they implemented
Sparrow (power of two choices + late-binding: enqueue on multiple workers,
first free worker takes it). That optimizes *action placement*, not
contributor shares. BuildBuddy's 2022 cache-vs-execution explainer remains
the durable REv2 map. Hermetiq's RBE guide scraped as a JS shell — unused.

**GitHub Actions concurrency.** Default: unbounded concurrent workflow runs.
With a concurrency group, by default one in-progress + one pending; extra
pending *replaces* the waiting run. Changelog 2026-05-07: `queue: max` with
`cancel-in-progress` false queues up to 100. That is admission for
*workflows*, not for tasks inside turbo/nx. Pants (2021-02-01) still states
speculate-then-cancel; Buck2 exposes a queryable target graph plus RBE.
Those are semantic build graphs CI wraps, not contributor-fair schedulers.

### 3. LLM agent fleets sharing CI (2025–2026)

The load shape is the finding. Julian Maurin (Mergify, 2026-07-06): humans
plus a pile of agents landing into one repository. Their default queue ran
`batch_size: 1` and `max_parallel_checks: 5` on fixed-capacity machines.
Five in-flight PRs is also the drain ceiling when each speculative check
holds a whole machine. They let batch size widen only when the queue is
drowning (`{min: 1, max: 2}`), and sit at 1 when it is not (June 18 paired
nothing). Merges/day did not improve (48.4 → 45.3). They frame this as the
RCV theorem: reliability, cost, velocity — pick two. Agent fleets spend the
cost axis.

Julien Danjou, State of Merge Queues 2026 (2026-07-27): 153k merges / 160
teams / 90 days. AI-assisted PRs broke main 1.9% vs 4.4% for non-AI.
Broken-main rate scales ~16× with team size; private repos 4.5× open source.
[INFERENCE] Do not encode "agent PR" as intrinsically riskier than human PR
in the T-Box; encode *arrival burstiness* and *CI occupancy*.

Cursor (Wilson Lin, `scaling-agents` and `self-driving-codebases`):
planner/worker/judge fleets at hundred-to-thousand agent scale. Flat
equal-status lock-file coordination failed: agents held locks too long or
forgot to release; twenty agents → two or three effective; optimistic
concurrency was more robust but made agents risk-averse. Isolation of roles
fixed progress. FastRender ran about a week. Simon Willison (2026-01-19)
recorded that GitHub Actions CI was initially failing with no build
instructions; 2026-01-23 he confirmed a later windowed-browser build.
Generation fleets can look done while the shared verification loop is red.

Wasted-work handling that is actually implemented: cancel superseded runs
(GHA); race and cancel (Bazel dynamic, Pants speculate); bisect a red batch
(Mergify); skip the job before install (`turbo query affected`). Time to
feedback is dominated by *whether you start at all* and by merge-queue
head-of-line blocking.

### 4. Ontology- / knowledge-graph-driven CI

**Negative result:** this sweep did not find a system that takes a domain
ontology, reasons, and emits a CI pipeline. "Ontology pipeline" hits were
Jessica Talisman's knowledge-infrastructure framework (book due Fall 2026)
and enterprise EKG/ETL posts — wrong layer.

**Adjacent, real, and reusable:**

- **OSLC Automation 2.1** (OASIS PSD01, 2021-01-21, still the staged spec).
  Resources: AutomationPlan, AutomationRequest, AutomationResult. Providers
  may return a Request that is also a Result. This is a *lifecycle API* for
  "run this plan, here is the result." It does not decide *which* packages
  to build from a change set. MDPI 2023 extends OSLC with ECA rules: closer
  to a reasoner over CI *events*, still orchestrating when a known plan
  fires, not which proof to run.
- **SPDX 3.0.1 Build profile.** Spec TOC lists a `Build` class with
  `buildType`, `buildStartTime`, `configSourceDigest`, and related
  properties. Linux Foundation 3.0 press: profiles as templates for
  "software build attestation." Provenance of a build that already ran.
- **Semantic build systems** already *are* the graph: Bazel/Buck2 target
  graphs with query; Pants incrementality; Nx project graph + affected;
  Turborepo package/task graph + GraphQL `reason` types. Build Systems à la
  Carte (Mokhov, Mitchell, Peyton Jones, 2018 PDF retrieved) remains the
  theory of that graph (scheduler vs rebuilder). It is not an OWL T-Box.
- **Mergify scopes from Turbo/Nx/Bazel/Pants** is the only 2026 product
  found that *imports* a build graph into a CI admission controller.

[INFERENCE] An operational ontology for beep-ci-ops should *cite* OSLC for
episode identity (plan/request/result), SPDX Build for attestation of a
finished grant, and Turbo/Nx/Bazel graphs for *what is affected*. The
missing piece this literature does not supply is the one the packet already
named: DRR-style fairness across agents, admission against a vector budget,
and fail-fast stopping. Those are not in SPDX or OSLC.

## Contrarian Views And Risks

- **`turbo query affected` is not a scheduler.** It is a change-detection
  report with conservative fail-open. Encoding it as "the planner" would
  hide admission, fairness, and stopping. #10688 is the exhibit: operators
  saw extra packages and called it a bug; the tool had been told a
  global-changing base.
- **GitHub merge queue FIFO is not fair queueing.** Long jobs head-of-line
  block. Mergify hotfix priority is the usual escape and the usual way to
  destroy the fairness you thought you bought. "Fairness is preserved" is
  unverified.
- **RBE "priority" is urgency, not DRR.** EngFlow's integers starve
  background work by design. BuildBuddy Sparrow balances *workers*, not
  *users*. Mapping either to per-agent deficit would be a category error.
- **Do not special-case agent PRs as dirtier.** Mergify 2026: they break
  main *less*. The real agent tax is occupancy and burst arrivals.
- **Cursor-scale swarm claims outran their CI.** Willison's first look at
  FastRender: no build instructions, failing Actions. Any KPI that counts
  agent commits without counting proof outcomes will lie.
- **Dynamic batching is not free throughput.** Mergify's own numbers:
  merges/day flat. You trade revert-isolation for drain rate, and only when
  drowning.
- **Remote cache signatures are not authentication.** Turbo docs say so.
  `longerSignatureKey` is HMAC-length hygiene, not a tenant boundary.
- **Ontology theater.** SPDX/OSLC will look like a CI ontology in a source
  table and still not tell you who gets the next seat.

## Open Questions

1. What is the exact 2.9 GraphQL schema for `reason` (`turbo query --schema`
   on this repo's pinned turbo)? This scrape has the published table, not
   the installed schema.
2. Does `hashOfExternalDependencies` still exist in 2.9 summarize JSON, and
   is it a per-package lockfile subset? Unverified after 2.0.12.
3. Mergify's "fairness is preserved" under hotfix priority: which algorithm?
   Unpublished.
4. Do other RBE backends (BuildBarn, Aspect) expose user/org weights or DRF?
   EngFlow/BuildBuddy in this sweep do not.
5. GHA `queue: max` (100) plus a self-hosted runner pool: does it FIFO the
   *proof coordinator*, or do turbo remote-cache writes still stomp each
   other? Not evidenced.
6. For beep-ci-ops: should `reason.__typename` be an A-Box class of
   `Invalidation`, with repository-wide reasons mapping to a global grant,
   and should lock-bounce (Cursor; this packet already measures lock
   pressure) be a first-class `Contention` type rather than a cache miss?

## Sources

Every URL below was retrieved in this run (Firecrawl search and/or scrape).
One-line note is what it was used for. Search hits that were not scraped
are not listed.

### Turborepo (scraped)

- https://turborepo.dev/docs/reference/query — `turbo query` / `affected`
  flags, reason types, shallow-clone rule
- https://turborepo.dev/docs/guides/skipping-tasks — pre-install skip
  pattern with `jq`
- https://turborepo.dev/blog/2-9 — 2.9 (2026-03-30), query stable, TTFT,
  OTEL, turbo-ignore deprecation (Anthony Shew)
- https://turborepo.dev/blog/turbo-2-6 — Bun package manager stable,
  granular `bun.lock` (v0/v1 history)
- https://turborepo.dev/blog/turbo-2-5 — `prune` for Bun
- https://turborepo.dev/blog/turbo-2-2-0 — query experimental (2024-10-18)
- https://turborepo.dev/docs/reference/configuration — globalDependencies,
  remoteCache, cache/inputs, futureFlags, cacheDir worktree sharing
- https://turborepo.dev/docs/crafting-your-repository/caching — global vs
  package hash inputs
- https://turborepo.dev/docs/reference/turbo-ignore — superseded by query
  affected
- https://turborepo.dev/docs/support-policy — deprecation policy
- https://github.com/vercel/turborepo/issues/9628 — bun.lock graph warning
- https://github.com/vercel/turborepo/issues/10688 — --affected extras;
  closed not-planned
- https://github.com/vercel/turborepo/discussions/9004 —
  hashOfExternalDependencies in summarize JSON
- https://oneuptime.com/blog/post/2026-07-28-monorepo-only-affected-builds/view
  — affectedUsingTaskInputs vs package-level; git baseline pitfalls

### Merge queues, GHA, Nx, Bazel (scraped)

- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
  — merge_group, build concurrency 1–100, only-merge-non-failing
- https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency
  — default one pending; extra pending replaces
- https://github.blog/changelog/2026-05-07-github-actions-concurrency-groups-now-allow-larger-queues/
  — `queue: max`, 100 pending (2026-05-07)
- https://docs.mergify.com/migrate/github-merge-queue/ — mapping,
  batch_size, priority_rules, "fairness is preserved"
- https://docs.mergify.com/merge-queue/batches/ — batch docs (large scrape;
  body used mainly via migrate + blogs)
- https://mergify.com/blog/github-merge-queue-was-step-one-real-ci-orchestration-comes-next
  — scale critique (Julian Maurin)
- https://mergify.com/blog/dynamic-merge-queue-batch-size — agent-PR bursts,
  load-following batch size (Julian Maurin, 2026-07-06)
- https://mergify.com/blog/how-mergify-scopes-work — parallel scopes,
  Turborepo as a scope source (Julien Danjou, 2026-06-11)
- https://mergify.com/blog/state-of-merge-queues-2026 — AI vs human
  break-main rates (Julien Danjou, 2026-07-27)
- https://nx.dev/docs/features/ci-features/distribute-task-execution —
  Nx Agents DTE; historical runtimes; dynamic agents by PR size
- https://nx.dev/blog/nx-cloud-3-0-faster-more-efficient-modernized —
  Cloud 3.0 (2023-04-19)
- https://bazel.build/remote/dynamic — dynamic execution race/cancel
- https://bazel.build/remote/rbe — RBE overview (nav-heavy; existence only)
- https://www.buildbuddy.io/blog/bazels-remote-caching-and-remote-execution-explained/
  — cache vs execution (Brentley Jones, 2022-03-16)
- https://www.buildbuddy.io/blog/distributed-scheduling-for-faster-builds —
  Sparrow / late-binding scheduler
- https://blog.engflow.com/2025/04/07/not-all-builds-are-made-equal-using-priorities-to-expedite-remote-execution-of-the-builds-and-tests-that-matter-most/
  — RBE priority ladder (2025-04-07)
- https://docs.engflow.com/re/client/remote-execution-priority.html —
  `--remote_execution_priority`; FCFS within priority
- https://buck2.build/docs/about/why/ — graph, RBE, Watchman
- https://www.pantsbuild.org/blog/2021/02/01/fast-incremental-builds-speculation-cancellation
  — speculate/cancel (2021; idea still current)

### Agent fleets (scraped)

- https://cursor.com/blog/scaling-agents — Wilson Lin; locks vs
  planners/workers; twenty agents → two or three
- https://cursor.com/blog/self-driving-codebases — thousand-agent
  FastRender week
- https://simonwillison.net/2026/Jan/19/scaling-long-running-autonomous-coding/
  — critique; initial failing CI (2026-01-19)
- https://simonwillison.net/2026/Jan/23/fastrender/ — follow-up; it builds

### Ontology / attestation (scraped)

- https://docs.oasis-open-projects.org/oslc-op/auto/v2.1/automation-spec.html
  — OSLC Automation 2.1 Plan/Request/Result
- https://spdx.github.io/spdx-spec/v3.0.1/ — SPDX 3.0.1; Build profile TOC
- https://spdx.dev/understanding-spdx-profiles/ — profile conformance
- https://github.com/spdx/spdx-3-model — Build-profile repo (nav-heavy)
- https://www.linuxfoundation.org/press/spdx-3-revolutionizes-software-management-in-systems-with-enhanced-functionality-and-streamlined-use-cases
  — 3.0 profiles including build attestation
- https://www.mdpi.com/2079-9292/12/14/3043 — OSLC + ECA extension (2023)
- https://www.microsoft.com/en-us/research/wp-content/uploads/2018/03/build-systems-final.pdf
  — Build Systems à la Carte
- https://jessicatalisman.substack.com/p/the-ontology-pipeline — knowledge
  infrastructure, not CI (negative result)

### Scrapes that did not yield usable body (do not over-cite)

- https://www.hermetiq.com/blog/bazel-remote-execution-guide — JS shell
- https://nx.dev/docs/guides/tasks--caching/remote-caching — empty/thin
- https://docs.github.com/en/copilot/concepts/coding-agent — thin nav

## Rerun Inputs

workflow: firecrawl-deep-research
topic: live CI practice for monorepo verification scheduling (Turborepo
  2.x internals; merge-queue / RBE / Nx DTE fairness; LLM agent fleets
  sharing CI; ontology-driven CI prior art)
depth: thorough
output: markdown
date: 2026-08-27
notes: no scoping interview; four questions from
  explorations/beep-ci-operational-ontology/research/prompts/r4-live-practice.md;
  X threads not collected — do not invent them on rerun without a live
  x_keyword_search pass
