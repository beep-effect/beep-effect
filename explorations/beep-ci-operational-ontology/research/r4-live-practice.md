# Lane R4: Current-practice sweep (2025–2026)

**Date:** 2026-08-27
**Lane:** live-web / X-primary (Grok)
**Method:** X posts and threads actually retrieved this lane.
Official turbo.build, GitHub, Nx, Mergify, and Bazel docs were
**not** independently fetched (HTTP fetch gated). Do not treat
the URLs quoted *inside* tweets as independently verified page
content. Inference is marked `[INFERENCE]`.

---

## 1. Turborepo internals NOW

The live operator surface in 2025–2026 is `turbo query`, not
`turbo-ignore`. Anthony Shew (`@anthonysheww`, Vercel/Turborepo)
shipped `turbo query affected` mid-March 2026 as “an easier way
to get a report of packages/tasks that need rebuild/redeploy if
you’re handrolling that.”[[1]](https://x.com/anthonysheww/status/2033220411262165271) On 2026-03-23 he
deprecated `npx turbo-ignore` in public: “You all use it in a
way it wasn't meant to be used,” with a canary replacement
aimed at the next minor.[[2]](https://x.com/i/status/2036151374090739945)
The first reply on that thread was the real CI question: Aaron
(`@Aaron9305631176`) asked whether `turbo query affected` needs
deep git history or only “until the merge head,” because large
monorepos run shallow checkouts. That question was not answered
in the retrieved thread.[[2]](https://x.com/i/status/2036151374090739945)

By April 2026 Shew was pitching `turbo query` as an *agent*
interface, not just a CI filter: `turbo query --schema` dumps
the GraphQL schema into agent context, then the agent proposes
task-graph optimizations.[[3]](https://x.com/anthonysheww/status/2039812921845502371) Phil Zona
(`@philzona`, Vercel, 2026-03-30) independently called it “a
full GraphQL server to query your task graph” and “one of the
coolest and most useful features I’ve seen in a build
tool.”[[4]](https://x.com/philzona/status/2038689919942709538) Earlier in this same lane
(Shew, 2026-06-25, post `1937882371115082201`, not re-hydrated
here because the thread fetch lacked `conversation_id`) he
stated `--experimental-query` was gone in 2.6 and showed
`turbo query "affected(base: HEAD~1, head: HEAD)"` plus a docs
page titled “Affected packages in CI.” Treat that as
practitioner/vendor X, not as a fetched MDX page.

`--affected` still has a GitHub Actions footgun. On 2026-08-20
Shew told an operator who had “tried to use some other ref
instead of main”: you must make the needed history available
where `--affected` runs; “GitHub Actions is awkward about what
is in history.” He pointed at
`https://turborepo.dev/docs/reference/query#--affected` and
said Turbo will later pick the right `origin/main` in GHA
automatically.[[5]](https://x.com/anthonysheww/status/2090414874975248565)
`[INFERENCE]` affected-query is a git-range query over the
workspace graph, so a shallow clone that does not contain the
base ref will silently mis-report. That matches Aaron’s March
question and Shew’s August warning, but the exact empty-history
behavior was not shown in a log.

**2.6 and Bun.** Turborepo’s own account announced 2.6 on
2025-10-31: microfrontends, “Bun package manager support is now
stable,” TUI task-list search
(`https://turborepo.dev/blog/turbo-2-6`). Shew quote-tweeted
it the same day.[[6]](https://x.com/anthonysheww/status/1984318548257489247) “Stable” on the
package-manager check is **not** the same as mature lockfile
hashing. Earlier in this lane, Nathan Wang (`@nwjsmith`,
2025-12-18, post `2001691300901740985`) said they hashed
`bun.lock` via `globalDependencies` because bun.lock hashing
was “pretty broken,” and that `hashOfExternalDependencies` was
poorly understood. Alexander (`@aheissenberger`, 2026-08-14,
post `1956008478675239302`) still called bun.lock support
“pretty new” and cited GitHub issues `11022`, `10900`,
`10548`. This continuation could not re-fetch those two
threads (missing `conversation_id`). **No 2025–2026 X post in
this sweep defined `hashOfExternalDependencies` from vendor
docs.** `[INFERENCE]` putting the lockfile in
`globalDependencies` is the working workaround: it forces a
global hash invalidation when the lockfile changes, bypassing
the per-package external-deps hasher.

**Cache posture.** This sweep did **not** re-retrieve Jared
Palmer’s Dec 2025 `cache:remote:rw` vs `r` / `--summarize`
thread (`2003188851804873175` from the earlier window). What
*was* retrieved now: Shew on 2026-08-13 said
`"cacheMaxAge"` “will become default in Turborepo 3.0,”
pointing at
`https://turborepo.dev/docs/reference/configuration#cachemaxage`.
Anish Srinivasan (`@iamAnish`) set `"cacheMaxAge": "7d"` and
“reclaimed 80GB of turbo cache.”[[7]](https://x.com/iamAnish/status/2087981690149073381)
Benjamin Woodruff (`@_bgwoodruff`, Vercel, 2026-08-03) gave
the same pair: `cacheMaxAge` or `cacheMaxSize` until 3.0.
[[8]](https://x.com/_bgwoodruff/status/2084119154911789310) Earlier-window changelog posts
(not re-hydrated): `@turbodotbuild` 2.8.3 `--cache` as alias
for `--cache-dir` (2026-06-04); 2.5.6 `globalEnv` string panic
(2026-07-16); 2.5.8 `--dangerously-disable-package-manager-check`
(2026-08-21). `[INFERENCE]` cache posture in 2026 is two
layers: (a) remote r/rw flags from the Action/CLI, (b) local
eviction via max-age/max-size because `.turbo/` unbounded
growth is now a workstation incident, not a footnote.

`globalInputs` as a named 2.x knob was **not** seen in the
retrieved posts. The live substitute operators talk about is
`globalDependencies` (lockfiles, env files). Eric Matthys
(`@ematthys`, 2022 — kept only as contrast) already used
`globalDependencies` for gitignored Next.js env files; that is
old semantics, not 2026 news.[[9]](https://x.com/ematthys/status/1582796106026872832)

---

## 2. Fleet CI at scale: admission, fairness, shared compute

**GitHub merge queue** is the default *named* admission valve
in 2026 X, and it is showing strain under agents. Linear
shipped “merge queue status in diffs” on 2026-08-25; Dima
Zaytsev (`@dizaytsev`, Linear) said he added “in merge queue
for X min” because his PR stuck during a GitHub
outage.[[10]](https://x.com/dizaytsev/status/2092365429201145993) zach bai (`@zach_bai`, Warp,
2026-08-19) called “resolving conflicts from a clogged merge
queue” a literal bottleneck while GitHub was
down.[[11]](https://x.com/zach_bai/status/2090149783474450848) Jarrod Watts (`@jarrodwatts`,
2026-08-24), moving “cloud agents,” said his main wastage is
constant rebases and asked about GitHub’s merge queue, “but
only for enterprise customers.”[[12]](https://x.com/jarrodwatts/status/2091728270160982470)
Arindam Majumder (`@Arindam_1729`, 2026-08-21) reported a
rollout bug: enabling Merge Queue made GitHub stacked-PR UI
disappear; GitHub blamed squash+queue complexity and a
gradual rollout, with broader availability “expected by
August 14.”[[13]](https://x.com/Arindam_1729/status/2090785620780265539) KinLab (`@kinlab_ai`,
2026-08-26) claimed that in April, “GitHub's merge queue
quietly undid work that people had already merged” for three
and a half hours with no alarm, “because nothing was
down.”[[14]](https://x.com/kinlab_ai/status/2092601707221979527) That is a single secondary
claim; it was not corroborated in this sweep.

The agent-aware prescription on X is: **queue as isolation,
not as a linked list of humans.** Madeactual (`@Madeactual`,
2026-08-21): “Put a merge queue in front of it (GitHub's, or
Graphite) so every branch is tested against current main
before it lands — then a bad agent blocks only itself. Plus
one worktree per agent, scoped to non-overlapping
paths.”[[15]](https://x.com/Madeactual/status/2090821227782734238) Ólafur Páll Geirsson
(`@olafurpg`, 2026-08-24) scaled that fear: even *with* a
merge queue, “you could expect to have 100k+ open PRs in the
near future on a busy monorepo that need mergeability checks
*before* entering the merge queue.”[[16]](https://x.com/olafurpg/status/2091810491311997386)
Jacob Gold (`@jacobgold`, origin Graphite / Cursor / xAI,
2026-08-27) said they are “thinking about the best solution
for a first class merge queue” after “lessons building the
graphite merge queue.”[[17]](https://x.com/jacobgold/status/2092788010014392482) Forkbench
(`@Forkbench_lab`, 2026-07-03) put the ratio bluntly:
“Spawning is the easy 20%. The merge queue is the
80%.”[[18]](https://x.com/Forkbench_lab/status/2073119592306651168)

**Speculative / DAG queues.** Uber open-sourced SubmitQueue in
August 2026 (`https://github.com/uber/submitqueue/`). Conrad
Lotz (`@conradlotz`, 2026-08-10) described it as a
“speculative merge queue that rebases and validates multiple
changes in parallel against predicted future HEAD states” to
keep trunk green.[[19]](https://x.com/conradlotz/status/2086935690630058481) echantech
(`@echantech1`, 2026-05-30) confirmed Uber already had
“speculation + grouping diffs” in SubmitQueue.[[20]](https://x.com/echantech1/status/2060866716574568776)
`[INFERENCE]` GitHub’s native queue is still closer to a
serialized admission list; Uber’s design is the fairness
answer for monorepos: speculate N futures, group independent
diffs, fail only the conflicting subset. **Mergify was a
target of this sweep and no primary Mergify post or doc was
retrieved.** Do not fill that gap from memory.

**Nx Cloud / DTE.** Nx (`@NxDevTools`, 2026-08-10) simplified
agent config to a single `.nx/ci-config.yaml` with “inline
assignment rules” and “removes the ordering requirement in
stop-after,” blog:
`https://nx.dev/blog/ci-config-file-start-nx-agents`.[[21]](https://x.com/NxDevTools/status/2086815584155734307)
Juri Strumpflohner (`@juristr`, 2026-07-29): “My CI script
almost reads like a prompt. Run build,test,lint,e2e and the
machinery behind figures out how to distribute them in
parallel, what is cached already etc.” He also asked whether
the work was “delegated to Nx Agents already.”[[22]](https://x.com/juristr/status/2082570650032451912)
Nx (2026-08-05) opened resource-usage charts (CPU and memory
**per task** across a run) to every org, previously
enterprise-only.[[23]](https://x.com/NxDevTools/status/2085020784289099810) Anand Pant
(`@dimethylpant`, 2026-08-26) ranked “nx cloud and the
affected graph and being able to reliably only rebuild/test
what changes” above Depot/Blacksmith when GitHub itself is
partially down.[[24]](https://x.com/dimethylpant/status/2092440736880869430) Nx’s 2026-07-28
promo for Stalk Altan’s talk: “AI didn't break CI — it just
made the existing breakage obvious.”[[25]](https://x.com/NxDevTools/status/2082149090968965478)
`[INFERENCE]` Nx’s admission model is *task-graph DTE*:
assignment rules + stop-after + per-task resource charts, not
a PR merge queue. Fairness is “which task lands on which
agent,” not “which human’s PR is next.”

**Bazel RBE / remote cache.** Namespace (`@namespacelabs`,
2026-08-25 and 2026-08-19) now emits JSON invocation reports
for agents: “action queue times, action execution times,
cache hits and misses, worker assignments.” Explicitly so “your
agent can debug and fix performance regressions.”[[26]](https://x.com/namespacelabs/status/2092255677054132685)
Son Luong (`@sluongng`, BuildBuddy, 2026-08-21) noted Modular’s
public Mojo tree is Bazel + BuildBuddy
(`--remote_cache=grpcs://modular-public.buildbuddy.io`).
On 2026-08-27 he bet a competing remote-exec benchmark “would
not take 30 seconds to run 18 actions sequentially remotely”
on Bazel RBE given the same upload/download.[[27]](https://x.com/sluongng/status/2093007578284400716)
`@phenlix` (2026-08-14): “The performance comes from caching,
not execution”; cold Bazel pays hashing, cache writes, and
sandbox setup. Unauthenticated Bazel cache was called out as
a source-exfiltration footgun (`@Adev`, 2026-08-16).
Petr Glaser (`@BleedingDev`, 2026-08-25) told an agent-swarm
operator to look at Bazel/Nx: remote cache, remote builds,
dependency graph, “clean order.”[[28]](https://x.com/BleedingDev/status/2092186250715271454)
**No 2025–2026 post in this sweep described RBE *fairness*
(queue weights, tenant isolation, preemption) in enough
detail to quote a scheduler policy.** `[INFERENCE]` the live
artifact agents want from RBE is the *event log* (queue wait
vs execute vs cache), not a new fairness theory.

---

## 3. LLM agent fleets doing software verification (2025–2026)

The bottleneck has moved from “write the patch” to “share CI
and the merge valve.” Liatrio (`@liatrio`, 2026-08-25): AI
coding assistants “push merged PRs up 98%. PR size jumps
154%. Review time spikes 91%. Delivery: flat. The bottleneck
just moved from writing code to reviewing it.”[[29]](https://x.com/liatrio/status/2092328412018823361)
Nicholas Hyperion (`@nickhistgeek`, 2026-08-25): “Agents write
code, push commits, trigger CI, spin up more agents. Every
step multiplies the load.”[[30]](https://x.com/nickhistgeek/status/2092060120410657055)

**Scheduling pattern that is actually shipping:** one agent,
one worktree, one branch, one PR, plus a lifecycle worker that
routes CI/review/conflict events back to the causing session.
Buchi Reddy (`@buchireddy`, Levo, 2026-08-25) is the most
numeric primary source this sweep retrieved. Built on
`@aoagents`: every ticket gets its own agent / worktree /
branch / PR. A lifecycle worker polls sessions. “CI fails, the
agent gets the logs. Reviewer asks for changes, the agent gets
the comments. Merge conflict, the agent resolves it. Approved
and green, it merges itself.” Humans are pulled for judgment,
not message-ferrying. Last-30-day medians: **24 minutes**
ticket → open PR, **3 hours** PR-open → merged (reviewed, CI
green, on main; the two medians do not add). **91.4%** of
agent PRs merge; escalation **0.6%** (down from 3.6% a month
earlier); **99.4%** of sessions ran start-to-finish with no
human touch. Cost they track: **$84.55 per merged PR**, up
**41%** month-over-month because “sessions are re-reading way
too much context on every turn.” Autonomy and the quality bar
are “the same mechanism”: the loop only closes on green CI and
a real approval.[[31]](https://x.com/i/status/2092363872275505520)

**Wasted-work handling.** Matan Grinberg (`@matanSF`, Factory,
2026-01-21) listed CI-shaped waste: “No pre-commit hooks =
agent waits 10 min for CI instead of 5 sec”; undocumented env
vars make the agent guess-fail-guess; tribal Slack knowledge
means “agent can't verify its own work.” Conclusion: “codebases
with fast validation makes every agent more
effective.”[[32]](https://x.com/matanSF/status/2014039273721213256) Keelen (`@keelenai`,
2026-08-23): “agent cannot merge to main (PR only). Required
CI is a hard block. New tests must fail before the
implementation is applied. A second reader with no shared
context reviews the diff. Pause the run if any of that is
missing.”[[33]](https://x.com/keelenai/status/2091589882674393392) Manthan Gupta
(`@manthanguptaa`, 2026-03-17) is the counter-metric: 10
agents on 10 features looks productive and often yields
“60-70% unnecessary code” plus later refactor
hell.[[34]](https://x.com/manthanguptaa/status/2033791563781074958) Combined with Watts’
rebase waste and Madeactual’s “bad agent blocks only itself,”
the 2026 control surface is: **narrow worktrees, fail-closed
CI, merge queue isolation, cancel/reprioritize at the queue
not inside the LLM.** `[INFERENCE]` GitHub
`cancel-in-progress` concurrency is the cheap wasted-work
lever, but no post in this sweep quoted a fleet actually
tuning it; they talk merge queues and worktrees instead.

**Always-on agents inside one company.** Boris Cherny
(`@bcherny`, Claude Code) on 2026-08-13 posted a daily-routine
prompt that starts crash-fuzzing iOS/Android/desktop *real
apps* (no mocks), then “put up fix prs”; “each pr must run
`/verify` and post a repro and truth table.” He said those
PRs “tend to be pretty small and self contained, and quick to
review.” On Sonnet he would “spend a bit more time auditing
PRs and iterating on routines’ prompts then adding in checks
and guardrails.”[[35]](https://x.com/bcherny/status/2088022665017901167) On 2026-08-11:
“Worktrees can be rough when they pile up. I use a loop to
clean up stale worktrees.”[[36]](https://x.com/bcherny/status/2087024157196489117) On
2026-06-23 he described Slack-channel Claude that drafts PRs
and answers “What's the status on X?” / “Who owns this
service?” — company search engine, not just a coding
session.[[37]](https://x.com/bcherny/status/2069474688619958517) Nx’s 2026 conference
line matches the same fleet shape: John Lindquist on “swarms
of agents in parallel”; Kiet Ho (Superset) “how to run 100
agents in parallel without drowning in waste, using a Lean
Manufacturing framework.”[[38]](https://x.com/NxDevTools/status/2069465647009153365)
**Time-to-feedback that operators actually name:** seconds
(local hooks, Matan) vs ~10 min (CI) vs 24 min (ticket→PR,
Levo) vs 3 h (PR→main, Levo) vs “clogged merge queue during
an outage” (Warp/Linear). The merge valve, not the model, is
the P95.

---

## 4. Ontology / knowledge-graph-driven CI

**Direct answer:** this sweep did **not** find a shipping CI
product that *computes a pipeline from a reasoned domain
ontology* (OWL/SHACL/reasoner → workflow YAML). Searches for
ontology+CI, “semantic CI,” and “knowledge graph pipeline”
returned RAG/GraphRAG and code-orientation tools, not
admission schedulers.

**Closest live prior art is queryable *build graphs*, not
ontologies.**

1. **Turbo query as GraphQL over the task graph** (Shew /
Zona, §1). That is a schema you can ask “what is affected?”
not a domain reasoner. Shew’s agent recipe is literally
“dump `--schema`, then optimize.” That is the nearest
2026 artifact to “CI computed from a model.”

2. **Nx affected graph + DTE assignment rules** (§2). Altan’s
line — AI made existing CI breakage obvious — frames the
graph as the thing you *already had* and stopped
trusting. `[INFERENCE]` “affected” here is git+project-graph
reachability, not description-logic classification.

3. **Bazel action graph + agent-readable invocation reports**
(Namespace JSON: queue/execute/cache/worker). That is
semantic enough for an agent to *debug* CI, not to
*author* it from an ontology.

4. **Hermetic / target-graph build systems.** Geoffrey
Huntley (`@GeoffreyHuntley`, 2026-07-29) told 2026
developers to learn “build systems such as bazel/buck2
(recommended over bazel).”[[39]](https://x.com/GeoffreyHuntley/status/2082570434562937147)
Vladimir Minev (`@minevdev`, 2026-03-28): “Monorepo
management tools like Bazel or Buck2 will probably be
widely adopted soon for projects developed by
agents.”[[40]](https://x.com/minevdev/status/2038036125282124140) Depot
(`@depotdev`, 2026-06-26) is “powering @pantsbuild for all
of their CI” as a runner swap, not as ontology
compilation.[[41]](https://x.com/depotdev/status/2070597467150672159) These systems
*are* semantic in the build-system sense: a target graph,
hermetic actions, content-addressed cache. They are not
OWL.

5. **Repo-as-KG for agents, orthogonal to CI.** Graphify
(`github.com/Graphify-Labs/graphify`; mathieu
`@mathieu_brglt` 2026-08-26; several 2026 promo threads)
turns a repo into symbols/calls/imports plus docs, with
extracted-vs-inferred edge tags. Claimed 71.5× fewer
tokens vs raw files. That graph is for *orientation and
Q&A*, not for emitting GitHub Actions. Bevel’s
code-to-knowledge-graph
(`github.com/Bevel-Software/code-to-knowledge-graph`, Tom
Dörr 2026-07-21) is the same genre.[[42]](https://x.com/tom_doerr/status/2079636477462327606)

**What is missing, stated as a gap not a claim:** no retrieved
source showed a reasoner deciding “this PR touches
`Capability X` therefore run suite S, skip suite T, admit on
lane L.” Merge queues group by file overlap / predicted HEAD
(SubmitQueue). Turbo/Nx group by package affectedness. Bazel
groups by action keys. Those are operational graphs. An
*organizational* ontology (lane, capability, proof, flake
class) sitting *above* those graphs is, as of this sweep, a
research hole rather than a named competitor.

`[INFERENCE]` if beep-ci-operational-ontology is novel, the
insert point is not “replace Turbo/Nx/Bazel.” It is a layer
that *binds* those three graphs (affected packages, DTE
assignment, merge-queue speculation) to typed operational
entities, then answers the questions this sweep’s operators
are already asking in English: what is affected, who is
blocked, which agent’s work is waste, which lane is fair.

---

## Sources (retrieved; no fabricated URLs)

X / Twitter, 2025–2026 unless noted: Anthony Shew
`@anthonysheww`; Phil Zona `@philzona`; Anish Srinivasan
`@iamAnish`; Benjamin Woodruff `@_bgwoodruff`; Turborepo
`@turborepo` 2.6 announcement; Linear / Dima Zaytsev; zach
bai; Jarrod Watts; Arindam Majumder; KinLab; Madeactual;
Ólafur Páll Geirsson; Jacob Gold; Forkbench; Conrad Lotz;
echantech; Nx `@NxDevTools`; Juri Strumpflohner; Anand Pant;
Namespace; Son Luong; Petr Glaser; Buchi Reddy; Matan
Grinberg; Keelen; Manthan Gupta; Liatrio; Nicholas Hyperion;
Boris Cherny; Geoffrey Huntley; Vladimir Minev; Depot;
mathieu / Graphify threads; Tom Dörr.

Earlier in this same lane, not re-hydrated this continuation:
Nathan Wang `@nwjsmith` 2025-12-18 (`2001691300901740985`);
Alexander `@aheissenberger` 2026-08-14
(`1956008478675239302`); Shew 2026-06-25 affected-query
(`1937882371115082201`); Palmer remote-cache Action flags
(`2003188851804873175`); `@turbodotbuild` 2.5.6 / 2.5.8 /
2.8.3 changelog posts.

**Not retrieved:** Mergify primary docs; GitHub merge-queue
docs body; Turbo `hashOfExternalDependencies` vendor
semantics; Bazel RBE fairness policy; any OWL/reasoner →
pipeline compiler.
