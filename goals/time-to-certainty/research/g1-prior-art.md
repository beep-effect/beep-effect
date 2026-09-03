<!-- Provenance: Grok 4.6 (xhigh) headless research lane via the local proxy, 2026-09-03, live web search; prompt in the session scratchpad. Claims carry their own dated URLs; nothing here is verified by execution. Reviewed by the orchestrator before adoption; adopted items become SPEC/DECISIONS entries. -->

# Time-to-certainty: prior art (lane proof reuse)

Survey date: **2026-09-03**. Scope: reuse keys, affected/cache invalidation, RTS/PTS,
fail-fast scheduling, merge queues vs stacked PRs vs merge-main, detached runners.
Target: TS/Bun/Turborepo ~140 packages; same lane runs ~3× (local pre-push,
merged-preview, hosted checks).

**Established** = vendor docs, REAPI, or numbered results in a dated paper/post.
**Opinion** = extrapolation to this repo / agent fleets. Every factual claim has a
URL and a date (publication, or *accessed 2026-09-03* for undated living docs).

X/GitHub practitioner record is cited via dated issues/discussions (Nx #35838,
Turbo #9329, gh-stack threads). Native X search did not add independent numbered
claims beyond those vendor/paper sources.

---

## 1. Action-cache reuse keys (Bazel / Buck2 / REAPI)

**Established.** Remote-execution reuse is keyed by the digest of a canonical
serialized `Action`, not by git SHA. Fields: `command_digest`, `input_root_digest`,
`timeout`, `do_not_cache`, `salt`, `platform`. `Command.environment_variables` MUST
be sorted by name. `salt` namespaces otherwise-identical actions (toolchain/policy
epoch). `platform` is part of the digest ([remote_execution.proto](https://github.com/bazelbuild/remote-apis/blob/main/build/bazel/remote/execution/v2/remote_execution.proto),
copyright 2018; `Action.platform` since API v2.2).

**Established.** Bazel includes only env vars whitelisted via `--action_env`.
Different `$PATH` ⇒ different keys ⇒ missed remote hits
([Bazel remote caching](https://bazel.build/remote/caching), *accessed 2026-09-03*;
same warning in [Bazel 4.2.4 remote-caching](https://docs.bazel.build/versions/4.2.4/remote-caching.html), 4.2.4).
Tools *outside* the workspace are **not** hashed: two compilers can share a key
and silently reuse a wrong result (same pages).

**Established.** Hermeticity = same sources + config ⇒ same outputs. Undeclared
host tools, `/usr/bin`, timestamps, or absolute paths make cache hits *incorrect*,
not just rare ([Bazel hermeticity](https://docs.bazel.build/versions/main/hermeticity.html),
*accessed 2026-09-03*). Remote rules: obtain compilers via toolchain rules, not
`PATH`/`JAVA_HOME`; every file the action needs is an explicit input
([Adapting rules for RE](https://docs.bazel.build/versions/main/remote-execution-rules.html),
*accessed 2026-09-03*).

**Established.** Buck2 hashes command + all declared inputs, looks up that digest
in the action cache, and on hit skips the command
([Buck2 architecture](https://buck2.build/docs/concepts/architecture/), © 2026).
Default digest is SHA-256; RE can split engine / action-cache / CAS endpoints and
attach platform properties such as `container-image`
([Buck2 remote execution](https://buck2.build/docs/users/remote_execution/),
*accessed 2026-09-03*). `remote_execution_action_key` injects an extra key
component to partition cache by build mode / memory class
([CommandExecutorConfig](https://buck2.build/docs/api/build/CommandExecutorConfig/),
*accessed 2026-09-03*). Hermetic toolchains should download or vendor tools, not
discover them on `PATH` ([Buck2 toolchains](https://buck2.build/docs/concepts/toolchain/),
*accessed 2026-09-03*).

**Established.** CAS stores bytes by content hash; AC maps action digest → result
metadata. Platform properties live on the stored action result and affect hit
rate; `--remote_instance_name` is another namespace
([BuildBuddy, 2022-03-16](https://www.buildbuddy.io/blog/bazels-remote-caching-and-remote-execution-explained/)).

**Opinion.** Map *lane input digest* → `Action` (command + declared files +
sorted env) and *cache epoch* → `salt` ∪ `platform` ∪ `instance_name` ∪ Buck2
`remote_execution_action_key`. Epoch changes (Bun/Node/policy) bust all lanes
without waiting for a lockfile edit. Git SHA is the wrong reuse key: Graphite’s
optimizer exists because stacked rebases change SHAs with unchanged content
([Graphite CI optimizer, 2024-05-09](https://graphite.com/blog/ci-optimizer)).

---

## 2. Monorepo task caches and “affected”

### Turborepo (this repo’s engine)

**Established.** Two hashes: *global* (root `turbo.json`, root lockfile, root
internal-package sources, `globalDependencies`, `globalEnv`, runtime flags,
passthrough args) and *task* (package `turbo.json` / `package.json`,
package-scoped lockfile, `inputs` files)
([Turbo caching](https://turborepo.dev/repo/docs/crafting-your-repository/caching),
*accessed 2026-09-03*). Root lockfile / root `package.json` ⇒ **all tasks miss**.
`globalDependencies` globs: “If any file matching these globs changes, all tasks
will miss cache.” Lockfiles remain inputs even with custom `inputs`. Future flag
`affectedUsingTaskInputs` makes `--affected` honor task globs; without it,
`--affected` is package-granularity. Root config/lockfile still selects all
([Turbo configuration](https://turborepo.dev/repo/docs/reference/configuration),
*accessed 2026-09-03*).

**Established.** `--affected` (git changed packages + dependents) is **not** the
task hash. A file in `inputs` can miss cache without being selected
([vercel/turborepo#9329](https://github.com/vercel/turborepo/issues/9329), 2024-10-24).
A 12-file docs change that still walks every package is consistent with
package-level `--affected` plus a global-hash hit (root files / `globalDependencies`).

**Established.** Turbo 2.6 (2025-10-28) made Bun’s text `bun.lock` stable and
package-granular: “only miss cache for packages that have changes in their
dependencies,” vs earlier `bun.lockb` which could invalidate the whole repo
([Turbo 2.6](https://turborepo.dev/blog/turbo-2-6)).

### Nx

**Established.** Task hash = project files + dependency files + config + external
dep versions + OS/arch + CLI args
([How caching works](https://nx.dev/docs/concepts/how-caching-works), *accessed 2026-09-03*).
Default: **any lockfile change marks all projects affected**.
`projectsAffectedByDependencyUpdates: "auto"` diffs resolved lockfile metadata
and marks only dependents (pnpm/npm/Yarn/Bun; binary `bun.lockb` needs Bun)
([Nx affected](https://nx.dev/docs/features/ci-features/affected), *accessed 2026-09-03*).
Prefer `{ "externalDependencies": ["typescript"] }` over hashing the whole
lockfile file; a file input invalidates every consumer of that input
([Nx inputs](https://nx.dev/docs/reference/inputs), *accessed 2026-09-03*).
Hash `node --version` as a runtime input when toolchain affects output
([Configure inputs](https://nx.dev/docs/kb/configure-inputs), *accessed 2026-09-03*).

**Established.** pnpm catalog edits can fail to invalidate until Nx 22+; adding
the lockfile as a file input “fixed” staleness by busting *unrelated* workspaces
([nrwl/nx#35838](https://github.com/nrwl/nx/discussions/35838), 2026-05-30 /
2026-07-07: “Drop the lockfile input.”).

### Pants / Gradle

**Established.** Pants remote cache is REAPI (CAS + action cache + execution).
Fine-grained invalidation beats restoring a coarse CI directory cache
([Pants in CI, v2.33](https://www.pantsbuild.org/stable/docs/using-pants/using-pants-in-ci);
[remote caching](https://www.pantsbuild.org/stable/docs/using-pants/remote-caching-and-execution)).
Python: a process uses only the **needed subset** of a lockfile, so unrelated
requirement edits do not invalidate
([Pants lockfiles, v2.33](https://www.pantsbuild.org/stable/docs/python/overview/lockfiles)).
`cache_scope`: `success` (until inputs change), `session` (this invocation),
`success_per_pantsd_restart` ([shell_command](https://www.pantsbuild.org/stable/reference/targets/shell_command),
*accessed 2026-09-03*).

**Established.** Gradle 9.7.1 cache key = task type/classpath + declared input
properties + plugin/buildSrc classpaths + relevant build-script content; **task
path is excluded** so equivalent tasks share. `package-lock.json` participates
only if declared. Missing inputs ⇒ *incorrect hits*
([Build cache](https://docs.gradle.org/current/userguide/build_cache.html), © 2025).
Java toolchains track major version (+ vendor/implementation if requested), not
minor; env vars are **not** auto-tracked; prefer dependency locking
([Common caching problems](https://docs.gradle.org/current/userguide/common_caching_problems.html),
*accessed 2026-09-03*). Configuration-cache (not build-cache) treats lockfiles as
config inputs ([Configuration cache](https://docs.gradle.org/current/userguide/configuration_cache.html)).

**Opinion.** Global-hash / whole-lockfile inputs are why a docs PR burns 85 min:
the lane is not keyed by *its* files. Port Nx `externalDependencies` + Pants
subset-lockfile + Turbo 2.6 granularity; keep a Bazel-style epoch for Bun/Node.

---

## 3. RTS and predictive test selection

**Established (safe RTS).** Select tests that *may* fail given the change;
unsafe skip is the failure mode. Microsoft TIA (docs dated 2018-12-07, updated
2026-05-07) maps test→source via a collector, always includes previously failing
and new tests, and **falls back to the full suite** on unknown file types
(HTML/CSS, multi-machine, data-driven, .NET Core unsupported)
([Azure TIA](https://learn.microsoft.com/en-us/azure/devops/pipelines/test/test-impact-analysis?view=azure-devops)).

**Established (NameRTS, Python, ISSTA 2026).** Name-dependency RTS skipped
69.90% of test files, −45.59% end-to-end time, selected all affected tests on
99.6% of commits vs BabelRTS 76.6%
([arXiv:2605.25356](https://arxiv.org/abs/2605.25356), 2026-05-25).

**Established (Facebook PTS).** GBDT over a *dependency-selected candidate
pool* (file history, authors, test fail rates, dep distance, path tokens).
Production: >95% individual-failure recall, >99.9% **faulty-change** recall,
<1/3 of dep-selected tests, ~3× fewer executions, ~2× infra cost. Flakes ~4×
persistent fails; train only on all-retry-fail (up to 10 retries)
([arXiv:1810.05286](https://arxiv.org/abs/1810.05286), 2018-10-11 / 2019-05-29).
Precision is not the headline metric; selection *rate* is the cost proxy.

**Established (Google).** Pre-submit *selection* + post-submit *prioritization*,
no coverage required ([Elbaum/Rothermel/Penix, FSE 2014](https://research.google/pubs/techniques-for-improving-regression-testing-in-continuous-integration-development-environments/)).
ICSE 2019: recent-transition heuristics underperformed; trigger frequency and
distinct authors did better; “still far from optimal”
([Leong et al.](https://research.google/pubs/assessing-transition-based-test-selection-algorithms-at-google/)).
Micco 2018: TAP evaluates *safety* of new selectors
([Test selection safety](https://research.google/pubs/test-selection-safety-and-evaluation-framework/)).
ICSE 2017: workload control + result summarization at Google scale
([Taming Google-scale CT](https://research.google/pubs/taming-google-scale-continuous-testing/)).

**Established (Uber BITS, 2024-08-22).** Trace-indexed E2E selection over 1000+
services / several thousand tests; incidents/1000 diffs −71% in 2023; tests
<90% placebo pass rate become non-blocking. No RTS precision/recall numbers
([Uber](https://www.uber.com/us/en/blog/shifting-e2e-testing-left/)).

**Established (Yelp, 2017-04-26).** Duration-sorted bin packing (~10 min
bundles), not RTS: 20M tests/day, sequential “2 days” → “30 minutes”
([Yelp](https://engineeringblog.yelp.com/2017/04/how-yelp-runs-millions-of-tests-every-day.html)).

**Not found.** A Netflix PTS/RTS monorepo paper. Do not cargo-cult one.

**Opinion.** For ~140 TS packages: *safe skip* (docs → skip typecheck/coverage)
beats ML PTS. Use PTS-style P(red) only to *order* remaining lanes. Safety bar
= faulty-change recall (Facebook 99.9%), with TIA-style full-suite fallback on
unknown inputs (lockfile, codegen, path-alias, turbo.json).

---

## 4. Fail-fast / cheapest-check-first

**Established.** “Cheapest first” is **not** the literature. Cost-cognizant
APFDc weights detection by execution cost; APFD vs APFDc correlate at class
granularity (τb=0.722) but less at method (τb=0.556) because long tests distort
rankings ([Luo et al., 2018-06-26](https://arxiv.org/abs/1806.09774)).

**Established (RETECS, ISSTA 2017 / arXiv 2018-11-09).** RL state = duration +
last-run + recent verdicts. Select max quality s.t. Σ duration ≤ budget M;
reward failed tests, penalize passing tests scheduled before fails
([arXiv:1811.04122](https://arxiv.org/abs/1811.04122)).

**Established.** Prior failures have strong predictive power even with short
history; diversity helps when history is empty
([Haghighatkhah et al., 2018-09-01](https://arxiv.org/abs/1809.00143)).
DeepOrder ranks on duration + historical status
([arXiv:2110.07443](https://arxiv.org/abs/2110.07443), 2021-10-14).
Commit-aware TCP (2026-04-28) estimates P(suite reveals a failure) from diff +
coverage + history; no explicit cost objective
([arXiv:2604.25363](https://arxiv.org/abs/2604.25363)).
SLR: 29 ML TSP studies 2006–2020 ([arXiv:2106.13891](https://arxiv.org/abs/2106.13891),
2021-06-25).

**Opinion (portable objective).** Time-to-true-red ≈ min over lanes of
`cost_i / (P(red_i) × precision_i)`. Cheap low-precision lint that fires on
docs is *worse* than a slightly slower typecheck with high precision. Flakes
inflate P(red) and destroy the schedule (Facebook 4×; GitHub flakes 1/11 → 1/200
commits, [2020-12-16](https://github.blog/engineering/engineering-principles/reducing-flaky-builds-by-18x/)).
Nx Cloud: “The narrower the task, the cheaper the retry” (max 2 tries, other
agent) ([Nx flaky tasks](https://nx.dev/docs/features/ci-features/flaky-tasks),
*accessed 2026-09-03*).

---

## 5. Merge queues vs stacked PRs vs merge-main

**Established (GitHub MQ).** FIFO. Each entry is tested on a temp branch =
latest base + PRs ahead. CI **must** handle `merge_group` (or
`gh-readonly-queue/{base}`); otherwise required checks never report and merge
fails. Fail/timeout/conflict ⇒ eject, rebuild groups. Jumping the queue rebuilds
in-flight groups. Concurrency and min/max group size are knobs
([Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue),
*accessed 2026-09-03*; `merge_group` event [2022-08-18](https://github.blog/changelog/2022-08-18-merge-group-webhook-event-and-github-actions-workflow-trigger/)).
GA 2023-07-12: updating a PR/base “caused a new round of continuous integration”;
queue tests with PRs ahead instead
([changelog](https://github.blog/changelog/2023-07-12-pull-request-merge-queue-is-now-generally-available/),
updated 2024-04-25). Internal: 30k+ PRs, 4.5M CI runs before GA; groups of 30+
vs trains of ~15; 500 engineers, ~2500 PRs/month, wait −33%
([2024-03-06](https://github.blog/engineering/engineering-principles/how-github-uses-merge-queue-to-ship-hundreds-of-changes-every-day/)).
Stacks: groups may exceed max size by 50% to keep a stack together
([Merging stacked PRs](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-stacked-pull-requests),
*accessed 2026-09-03*).

**Established (Shopify).** 2018-06-08: >90% of core-app PRs used Shipit queue
([Introducing the merge queue](https://shopify.engineering/introducing-the-merge-queue)).
2019-11-14, 1000+ devs, ~400 commits/day: v1 had **no CI while waiting** (soft
conflicts). v2: predictive branch, batch=8, 3 batches in flight, flake rate
assumed 25%, eject after 4 consecutive fails (~0.39% false eject)
([Successfully merging](https://shopify.engineering/successfully-merging-work-1000-developers)).

**Established (Graphite).** Stack-aware queue; incompatible with GitHub MQ
([graphite-merge-queue](https://graphite.com/docs/graphite-merge-queue),
*accessed 2026-09-03*). Parallel CI = speculative stack combinations, claimed
~1.5× generally / ~2.5× heavy-stacking; failed batches bisect
([merge-queue-optimizations](https://graphite.com/docs/merge-queue-optimizations),
*accessed 2026-09-03*). Optimizer: CI on bottom-N (optional top), wait for
downstack, fail-open; rebase SHA churn is the cost driver
([stacking-and-ci](https://graphite.com/docs/stacking-and-ci); [blog 2024-05-09](https://graphite.com/blog/ci-optimizer);
[graphite-ci-action](https://github.com/withgraphite/graphite-ci-action)).

**Established (ghstack / gh-stack).** Meta `ghstack`: one PR/commit; **cannot**
use GitHub merge UI; `ghstack land` ([ezyang/ghstack](https://github.com/ezyang/ghstack),
*accessed 2026-09-03*). GitHub `gh-stack` public preview 2026-07-30: coding
agents use the `gh-stack` skill; MQ support rolling out
([changelog](https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview/)).
2026-08-04: “each pull request will be evaluated against the stack base”; lower
edits rebase the stack and **re-run checks**
([Turn one giant AI PR into a stack](https://github.blog/engineering/turn-one-giant-ai-generated-pull-request-to-a-reviewable-stack/)).
Practitioner pain (MQ ∩ stacks): only bottom enqueued, `invalid_merge_commit` on
squash ([gh-stack#172](https://github.com/github/gh-stack/discussions/172),
[#223](https://github.com/github/gh-stack/discussions/223)).

**Opinion.** For an *agent fleet*, merge-main-into-branch is the worst of three:
every landing rebases every open agent PR and re-runs all three tiers. MQ
removes that rebase storm at the cost of `merge_group` CI (mitigate with lane
digests, not SHAs). Stacks help review, **hurt** CI unless bottom-N +
content-digest skip. Prefer: small agent PRs → GitHub MQ; stacks only when a
human must review layers. Do not run GitHub MQ and Graphite MQ together.

---

## 6. Detached / durable local runners

**Established (nohup is not a job runner).** POSIX `nohup` ignores SIGHUP and
may redirect stdio; it does **not** reparent, leave the session, or survive
other signals. Children can reset the handler. Race: SIGHUP between fork and
exec ([nohup(1p)](https://www.man7.org/linux/man-pages/man1/nohup.1p.html);
[SO 42608290](https://stackoverflow.com/questions/42608290/process-started-with-nohup-is-not-detached-from-parent);
[UL 480934](https://unix.stackexchange.com/q/480934)).

**Established (systemd-run).** Default transient **service**: parent is the
user/system manager, async, `--no-block` returns immediately, `--setenv` for
env (clean manager env otherwise). `--scope`: parent stays `systemd-run`,
**synchronous**, inherits caller env — wrong for “survive agent death.”
`--remain-after-exit` keeps the unit for inspection; `--collect` GC’s it
([systemd-run 260.1](https://manpages.debian.org/testing/systemd/systemd-run.1.en.html),
source 2026-07-23). Without linger, `user@.service` dies at last logout;
`loginctl enable-linger` keeps the user manager (and its services) after logout
([loginctl, systemd 252](https://manpages.debian.org/bookworm/systemd/loginctl.1.en.html)).

**Established.** Nx Agents: continuous assignment from the task graph;
boot-failed agent’s work is taken by another; remote cache “guarantees tasks
are not run twice”
([Distribute task execution](https://nx.dev/docs/features/ci-features/distribute-task-execution),
*accessed 2026-09-03*). Bazel remote persistent workers (proposal implemented
2021-03-06) keep tools warm *inside* RE, still keyed as hermetic actions
([proposal](https://github.com/bazelbuild/proposals/blob/main/designs/2021-03-06-remote-persistent-workers.md)).

**Opinion.** Agent-launched proofs must be **jobs**, not children: `systemd-run
--user --no-block --unit=lane-$digest` + linger + journald, with cancellation
via `systemctl --user stop`. Durability of *results* is the action cache (Nx
Agents / Bazel workers), not the process tree.

---

## 7. Eight design ideas to port (Effect-TS)

Ranked by expected cut in time-to-certainty for this 3-tier, 140-package,
agent-fleet setup. Each: source → idea → main risk.

1. **Lane `Action` digest + epoch salt, shared by all three tiers.** Source:
   REAPI `Action` + `salt`/`platform` ([proto, 2018](https://github.com/bazelbuild/remote-apis/blob/main/build/bazel/remote/execution/v2/remote_execution.proto)),
   Buck2 `remote_execution_action_key`. A coverage/typecheck/lint-policy lane is
   reusable iff digest(command, sorted env, input files, toolchain epoch)
   matches, regardless of git SHA or which tier ran it. **Risk:** undeclared
   inputs (Bazel’s classic false hit). Start conservative; epoch-bump on
   Bun/Node/policy.

2. **Never hash the whole lockfile into every lane.** Source: Nx
   `externalDependencies` + `projectsAffectedByDependencyUpdates: "auto"`
   ([nx.dev affected](https://nx.dev/docs/features/ci-features/affected));
   Pants subset lockfile ([v2.33](https://www.pantsbuild.org/stable/docs/python/overview/lockfiles));
   Turbo 2.6 `bun.lock` ([2025-10-28](https://turborepo.dev/blog/turbo-2-6)).
   Typecheck hashes `typescript` + package tsconfig + src; docs hash markdown.
   **Risk:** catalog/workspace protocol holes ([nx#35838, 2026](https://github.com/nrwl/nx/discussions/35838)).

3. **`--affected` by task inputs, not by package.** Source: Turbo
   `affectedUsingTaskInputs` + [#9329, 2024-10-24](https://github.com/vercel/turborepo/issues/9329).
   A 12-file docs change must not select `typecheck`/`coverage`. **Risk:**
   undeclared codegen/schema files (the #9329 failure mode). Put shared schema
   in an internal package with real deps.

4. **Schedule by E[time-to-true-red] = cost / (P(red)×precision), not cheapest.**
   Source: APFDc ([Luo 2018](https://arxiv.org/abs/1806.09774)), RETECS
   ([2017/2018](https://arxiv.org/abs/1811.04122)), PTS P(fail)
   ([2018](https://arxiv.org/abs/1810.05286)). Maintain per-lane moving averages
   of duration, red rate, flake rate; run high-precision cheap lanes first;
   quarantine flakes (GitHub 18×, [2020](https://github.blog/engineering/engineering-principles/reducing-flaky-builds-by-18x/);
   Uber 90% placebo, [2024](https://www.uber.com/us/en/blog/shifting-e2e-testing-left/)).
   **Risk:** correlated reds (one tsconfig break paints every typecheck “high P”).

5. **Safe skip + unknown-input fallback, not ML PTS (yet).** Source: Azure TIA
   fallback ([2018/2026](https://learn.microsoft.com/en-us/azure/devops/pipelines/test/test-impact-analysis?view=azure-devops));
   NameRTS 99.6% affected-commit recall ([2026](https://arxiv.org/abs/2605.25356)).
   Docs/markdown → skip typecheck/coverage; `turbo.json`/lockfile/codegen → full
   lane. **Risk:** TS path aliases and generated types look “unrelated.”

6. **Detached proof = systemd user service, result = content-addressed store.**
   Source: [systemd-run 260.1](https://manpages.debian.org/testing/systemd/systemd-run.1.en.html)
   + linger ([loginctl 252](https://manpages.debian.org/bookworm/systemd/loginctl.1.en.html));
   Nx Agents reassignment
   ([nx.dev](https://nx.dev/docs/features/ci-features/distribute-task-execution)).
   Agent spawn: `systemd-run --user --no-block --unit=beep-lane-$digest`. Agent
   death must not SIGTERM the proof. **Risk:** no linger ⇒ logout kills proofs;
   unit-name collisions; journald retention; no cgroup ⇒ runaway bun.

7. **Merge queue over merge-main-into-branch for the fleet.** Source: GitHub MQ
   ([2023-07-12](https://github.blog/changelog/2023-07-12-pull-request-merge-queue-is-now-generally-available/),
   [2024-03-06](https://github.blog/engineering/engineering-principles/how-github-uses-merge-queue-to-ship-hundreds-of-changes-every-day/));
   Shopify predictive branch ([2019-11-14](https://shopify.engineering/successfully-merging-work-1000-developers)).
   Agents enqueue; they do not rebase-on-green. Hosted CI listens to
   `merge_group` and **reuses lane digests** from local/preview. **Risk:**
   missing `merge_group` workflows; flake ejects rebuild groups (Shopify’s 4-strike
   rule); group-size vs bisect cost.

8. **Stacks only with digest-skip + bottom-N CI.** Source: Graphite optimizer
   ([2024-05-09](https://graphite.com/blog/ci-optimizer)); GitHub agent stacks
   ([2026-07-30](https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview/),
   [2026-08-04](https://github.blog/engineering/turn-one-giant-ai-generated-pull-request-to-a-reviewable-stack/)).
   If agents stack: run expensive lanes on bottom (+ maybe tip); skip when lane
   digest already green; never GitHub MQ + Graphite MQ. **Risk:** upstack SHA
   churn re-runs everything ([2026-08-04](https://github.blog/engineering/turn-one-giant-ai-generated-pull-request-to-a-reviewable-stack/));
   squash + stacks break MQ ([gh-stack#223](https://github.com/github/gh-stack/discussions/223)).

**Do not port (yet):** Facebook-scale ML PTS (needs failure volume this repo
does not have); Netflix (no matching RTS writeup); `nohup` as the detached
abstraction; hashing `bun.lock` as a `{workspaceRoot}` file input.
