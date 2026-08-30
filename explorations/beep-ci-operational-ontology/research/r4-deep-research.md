# R4: live practice sweep (Turborepo, fleet CI, agent
verification, semantic builds)

**Date:** 2026-08-27

Current practice does not compute a CI schedule from a reasoned
domain model. It cheapens verification by hashing, affected
selection, remote cache, and admission into shared executors.
Agent fleets change the arrival process: bursts of PRs and
in-repo lock contention, not a new scheduler primitive. The
closest reusable pieces for beep-ci-ops are (1) turbo's typed
affected reasons, (2) merge-queue isolation of blast radius,
(3) RBE priority as a scarce-executor policy, and (4) Pants-style
speculation/cancellation as wasted-work handling. None of these
is an ontology reasoner that emits a pipeline.

This checkout pins `turbo@2.10.12`. GitHub's latest stable
release of vercel/turborepo is `v2.10.12` (published 2026-08-25);
canary `2.10.13-canary.1` landed 2026-08-26. Local `turbo.json`
already enables `futureFlags.affectedUsingTaskInputs`,
`filterUsingTasks`, and `globalConfiguration`, and uses
`global.inputs` rather than `globalDependencies`.

## 1. Turborepo internals now

`turbo query` is a GraphQL surface over the workspace plus
shorthands `ls` and `affected`. Anthony Shew's 2.9 release post
(turborepo.dev, 2026-03-30) marks it stable. Docs
(turborepo.dev/docs/reference/query, fetched 2026-08-27) show
`turbo query affected --tasks|--packages --base --head`, JSON
with `reason.__typename`, and `--exit-code` (`0` none, `1`
affected, `2` error). `turbo-ignore` is deprecated in favor of
this command. Shallow checkouts that lack the base–head range
treat **all** packages as changed. Task-level detection reports a
task only if its `inputs` match a changed file or an upstream
task is affected. Package-level `--packages` is coarser.

Documented change-detection reasons include `FileChanged`,
`LockfileChanged`, `ConservativeRootLockfileChanged`,
`RootInternalDepChanged` (all packages; global hash changes),
`GlobalDepsChanged`, `DefaultGlobalFileChanged` (`turbo.json` /
`turbo.jsonc`), `LockfileChangeDetectionFailed`,
`LockfileChangedWithoutDetails`, `GitRefNotFound`, and
`ScmError`. The last five are fail-open: Turborepo cannot
narrow, so it selects everything. Selection reasons
(`DependencyChanged`, `DependentChanged`, filters, `RootTask`)
expand the graph rather than invalidate cache. Caching docs
repeat that `RootInternalDepChanged` is related to, but distinct
from, cache behavior.

`hashOfExternalDependencies` is a dry-run JSON field hashing a
package's lockfile external-dep closure. kutysam opened
vercel/turborepo#12252 on 2026-03-12 against `2.8.17-canary.4`:
Rust `HashMap` + `RandomState` made the field non-deterministic
on pnpm lockfile v9, so identical `expandedInputs` still missed
cache. PR #12254 (merged 2026-03-12, commit `08515b4438`)
replaced `HashMap` with `BTreeMap` through the lockfile pipeline;
the PR body notes a test that observed 50 distinct iteration
orders. 2.9.0 shipped 18 days later. [INFERENCE] beep-effect on
2.10.12 includes that fix; this report did not re-run the
dry-run loop on bun.lock.

Bun lockfile support matured across 2.4–2.6. Issue #9628
("Warning when using text-based Bun lockfile") recorded noisy
graph-construction warnings and some full failures on `bun.lock`
versus working `bun.lockb`. chris-olszewski's PR #9783,
`feat(bun): support bun.lock`, is in v2.4.1 (GitHub release
2025-02-10). Shew and Tom Knickman, Turborepo 2.6
(turborepo.dev, 2025-10-28), call Bun-as-package-manager
**stable**: granular lockfile analysis so a dep change in `web`
does not miss cache for `docs`. Timeline they give: beta
`bun.lockb` since 2023-09 (repo-wide miss on any lock change);
text `bun.lock` v0 in 2024-12 (parsable); v0→v1 format break in
2025-01 (parser rewrite). Support-policy docs were updated with
that post.

`futureFlags.globalConfiguration` is not a rename. Config docs
(turborepo.dev/docs/reference/configuration, fetched 2026-08-27)
state that `globalDependencies` becomes `global.inputs` **and
its semantics change**: files are prepended to every task's
`inputs` for per-task hashing instead of contributing to the
global hash, so a task can negate a global file. Old top-level
keys hard-error when the flag is on. `affectedUsingTaskInputs`
moves `--affected` from package-level to task-level `inputs`;
root `package.json` / `turbo.json` / lockfile /
`globalDependencies` (legacy name in that paragraph) still
select all tasks.

Cache posture flags, same docs plus caching guide: `--force`
disables **reading**, not writing. `"cache": false` or `--cache`
can skip writes. `cacheMaxAge` / `cacheMaxSize` default `"0"`
(disabled); eviction is opt-in, expected on by default in 3.0.
Git worktrees share the local cache unless an explicit
`cacheDir` (e.g. `.turbo/cache`) scopes it per worktree.
Absolute paths inside cached outputs can then point at another
checkout. The daemon is deprecated for `turbo run` (removed in
3.0) but still used by `turbo watch` and the LSP.

## 2. Fleet CI at scale: admission and fairness

GitHub merge queue (docs.github.com, Managing a merge queue,
fetched 2026-08-27) is FIFO onto a protected branch. Admission
is write access plus passing required checks, then a
`merge_group` (Actions) or a `gh-readonly-queue/{base_branch}`
push (third-party CI). Build concurrency is 1–100
`merge_group` webhooks. Merge limits (min/max PRs 1–100 plus a
wait) affect **merges to the base**, not how many groups
build. Fail-and-rebuild: a failed required check removes that
PR and recreates later groups without it. Jump-to-front
reorders the commit graph and **rebuilds every in-progress
group**. There is no per-author fair share and no agent class.

Mergify treats GitHub's queue as the first step, not the last.
The 2026 State of Merge Queues post (mergify.com/blog, fetched
2026-08-27) reports more than 200,000 merges across 477 teams
platform-wide, with a 90-day slice of 153,000 merges / 160
teams for some charts. Median queue time ~7 minutes; 90% within
an hour. Broken-main rate scales ~16× with team size; private
code 4.5× open source (5.1% vs 1.1%). AI-assisted PRs (mostly
those that stamp a "Generated with" footer; Copilot/Cursor
inline use is invisible) broke main 1.9% vs 4.4% non-AI. The
post calls this observational, not a trial, and notes batching
is the unused lever.

Julian Maurin, Mergify, 2026-07-06 ("How we made our merge
queue lower its own quality bar"): agent-PR bursts saturated
`max_parallel_checks: 5` at `batch_size: 1`. They shipped
`batch_size: {min, max}` with
`clamp(ceil(remaining_pulls / free_slots), min, max)`. Own
queue `{min: 1, max: 2}`: 0% paired before; 74% of checks
size-2 on 2026-06-16; 0% on a calm 2026-06-18. Merges/day did
**not** rise (48.4 → 45.3). The cited RCV theorem
(docs.mergify.com merge-queue performance): a queue picks two
of reliability, cost, velocity. Scopes (Mergify, "How we run
parallel merge queues on our own monorepo") partition by file
patterns or an uploaded API (Bazel/Nx/Turborepo). Overlapping
scopes batch together; independent scopes run parallel lanes so
a dashboard failure does not stall engine.

Nx Agents (nx.dev DTE docs, fetched 2026-08-27) allocate by
historical run times and the task graph, replay artifacts via
remote cache, and scale agent count with PR size. Enablement is
declarative (`npx nx connect` plus a coordinator job). GitHub
nrwl/nx#16942 reports `--skip-nx-cache` still runs agents but
hides the run from Nx Cloud: cache posture and observability
are not the same switch.

Bazel RBE is action-level, not PR-level. EngFlow docs
(Remote Execution Priority, fetched 2026-08-27): default
dequeue is FCFS; `--priority_range` must include `0` (Bazel's
default); `--remote_execution_priority` higher = sooner; out of
range fails the invocation. EngFlow blog, 2025-04-07 ("Not all
builds are made equal"): they encode a workflow ladder
(emergency 5, interactive 4, release 3, pre-submit 2, reserved
merge-queue 1, post-submit 0, background −1) and warn that
inserting a new integer later is a cross-branch migration.
BuildBuddy's Tyler Williams ("Distributed scheduling for faster
builds") found nginx round-robin put two large actions on one
worker while others idled; they implemented Sparrow
(late-binding two-choice, Ousterhout et al., SOSP 2013) because
the balancer did not know request size.

GitHub Changelog, 2026-05-07: Actions concurrency groups may
set `queue: max`. Previously one in-flight and one pending;
a third run cancelled the pending job. That is local serial
admission, not cross-contributor fairness.

## 3. LLM agent fleets doing verification (2025–2026)

Published practice is coordination-inside-the-repo, not a
shared CI kernel. Wilson Lin, Cursor blog, 2026-01-14
("Scaling long-running autonomous coding"): hundreds of
concurrent agents, >1M lines, trillions of tokens. Flat
self-coordination via a shared file failed: agents held locks
too long or never released; twenty agents collapsed to one
effective worker; failures while holding locks; lock-free
optimistic concurrency was simpler but agents became
risk-averse. Hierarchy (planners / sub-planners, workers that
do not coordinate, a judge at cycle end) scaled to hundreds
pushing the **same branch** with "minimal conflicts." An
integrator role was removed as extra fragility. FastRender
(browser-from-scratch, ~one week) and a three-week Solid→React
migration (+266K/−193K) are the named experiments. Simon
Willison, 2026-01-19, reproduced a working FastRender window
and noted rendering glitches as evidence it was not a wrapped
engine; 2026-01-23 he published a 47-minute interview with Lin.

Digital Applied, 2026-08-19: Cursor changelog that day lets
cloud agents subscribe to PRs they open, hold a `/goal`, watch
Slack, run on a schedule; Codex Cloud added GitLab beta the
same day. No concurrency, cost, or reliability figures. Admin
grants repo write. GitHub Copilot cloud-agent concepts
(docs.github.com, fetched 2026-08-27) describe research,
planning, a branch, then a human-created PR; automations can
fire on schedule or repo events, with confidence gating.

Mergify's 2026-07-06 post is the clearest **CI** measurement of
agent fleets: humans plus agents share a fixed runner pool;
speculative checks hold a whole machine; batching is the
safety valve, not per-agent DRR. [INFERENCE] Cursor's lock
bottleneck is the same contention class as yeet lock bounces:
shared mutable coordination, not CPU. No attributed X/Twitter
engineering thread was used for this section.

## 4. Ontology- or KG-driven CI / semantic build systems

No 2025–2026 product was found that **reasons over a domain
model and emits a CI schedule**. Adjacent prior art:

OSLC Automation 2.1 Part 1 (Jim Amsden and Fabio Ribeiro, OASIS
PSD 01, 2021-01-21, CC BY 4.0) defines HTTP REST resources
`oslc_auto:` Automation Plan, Request, Result, and parameter
definitions/instances. It is an integration vocabulary for
build/test/deploy tools, not a reasoner. Namespace
`http://open-services.net/ns/auto#`.

SPDX 3.0 (Linux Foundation press, 2026-04-16 is **not** the
date; the press release is 16 April **2024**) adds profiles
including security, licensing, AI, and **software build
attestation**. That is provenance of what was built, not
admission of what to run next.

Build Systems à la Carte (Andrey Mokhov, Neil Mitchell, Simon
Peyton Jones; Microsoft Research PDF, 2018) classifies rebuild
and early cutoff. Stu Hood, Pants blog, 2021-02-01, implements
early cutoff via generation numbers and **speculative**
re-execution of pure, cancellable `@rule`s so a data dependency
(import extraction) does not stall tests. Cancellation is
cheap because outputs live in a CAS, not a mutable workspace.
Buck2 (buck2.build "why") is another incremental engine in that
lineage; this sweep did not treat its docs as a CI ontology.

Jessica Talisman's Ontology Pipeline (Substack) and OntoEKG
(arXiv:2602.01276) concern knowledge-architecture and LLM
ontology extraction, not CI. r2 already maps PROV-O / P-Plan
as provenance and plan/step vocabularies that do not encode
lanes, budgets, or hash membership.

[INFERENCE] beep-ci-ops can *project* cheapening levers
(affected reasons, cache posture, queue isolation, RBE
priority) as T-Box individuals. That is the packet's thesis,
not a practice found in the wild.

## Contrarian findings

1. Agent PRs are not the merge-time hazard in Mergify's 2026
   observational set; team-size arithmetic is. Extra gates on
   "AI code" are unsupported as a merge-time policy.
2. `global.inputs` is a **semantic** change. Treating it as
   `globalDependencies` with a new path would mis-model the
   hash surface this repo already opted into.
3. Fail-open affected reasons (`LockfileChangeDetectionFailed`,
   `GitRefNotFound`, shallow clones) are the opposite of
   cheapening: they select the whole graph. A T-Box projection
   that ignores those `__typename`s will lie about certainty.
4. Jump-to-front and EngFlow-style priority are urgency, not
   fairness. They burn in-flight work. DRR (r3) is a different
   mechanism; do not encode priority as deficit.
5. Dynamic batching absorbed a burst and did not raise
   throughput. KPI "P50 time-to-certainty" can move while
   merges/day stay flat.
6. `--force` still writes cache. "Disable cache" in yeet must
   name read vs write vs remote vs local vs worktree sharing.
7. Ontology-driven CI, as a reasoner that schedules, is a gap,
   not a competitor. OSLC/SPDX/PROV describe *what ran*, not
   *what is admissible next*.

## Open questions

- Does `hashOfExternalDependencies` stay stable on this repo's
  bun.lock v1 under 2.10.12 across worktrees and CI?
- Which `reason.__typename`s should map to "run this lane"
  versus "epoch invalidation / run everything"?
- Should agent and human flows be separate Mergify-style
  scopes, EngFlow priorities, or DRR quanta (r3)? Those three
  disagree.
- Can Pants speculation/cancellation apply to yeet `WorkUnit`s
  that are not pure (locks, remote cache writes)?
- SPDX Build / OSLC Result as proof-artifact types versus
  minting local `Proof` (see r2)?
- GitHub `queue: max` on yeet workflows: serial certainty vs
  cancelled pending proofs when agents stampede.

## Sources

- Anthony Shew, turborepo.dev blog, Turborepo 2.9, 2026-03-30.
- Anthony Shew and Tom Knickman, turborepo.dev blog, Turborepo
  2.6, 2025-10-28.
- Turborepo docs: query, configuration, caching; fetched
  2026-08-27. GitHub releases v2.4.1 (2025-02-10), v2.9.0
  (2026-03-30), v2.10.12 (2026-08-25).
- kutysam, vercel/turborepo#12252, 2026-03-12; PR #12254
  merged 2026-03-12.
- vercel/turborepo#9628 and PR #9783 (chris-olszewski).
- GitHub Docs, Managing a merge queue; Copilot cloud agent
  concepts. GitHub Changelog, Actions concurrency `queue: max`,
  2026-05-07.
- Mergify blog: State of Merge Queues 2026; Julian Maurin,
  dynamic batch size, 2026-07-06; scopes post; RCV docs.
- Nx docs, Distribute Task Execution; nrwl/nx#16942.
- EngFlow docs + blog 2025-04-07; BuildBuddy distributed
  scheduling (Tyler Williams); Bazel remote/rbe and dynamic
  execution pages.
- Wilson Lin, cursor.com/blog/scaling-agents, 2026-01-14.
  Simon Willison, 2026-01-19 and 2026-01-23. Digital Applied,
  2026-08-19.
- Jim Amsden and Fabio Ribeiro, OSLC Automation 2.1, OASIS
  2021-01-21. Linux Foundation, SPDX 3.0, 2024-04-16.
- Mokhov, Mitchell, Peyton Jones, Build Systems à la Carte,
  2018. Stu Hood, Pants speculation/cancellation, 2021-02-01.
- Local: `turbo.json` futureFlags and `package.json` catalog
  `turbo@^2.10.12` / lock `turbo@2.10.12`, 2026-08-27.

No X/Twitter threads are cited. Firecrawl search and GitHub
API were used; WebSearch/WebFetch 503ed in this session.
