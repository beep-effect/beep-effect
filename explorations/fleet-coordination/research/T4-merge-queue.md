# T4 — The competitor: make coordination mechanical, not social

**Deliverable for the fleet-coordination research. Track T4.**
Date: 2026-08-04. Repo state: `main` @ `63737c4abd`.

---

## 0. Bottom line up front

**Adopt the mechanical layer. It is cheaper, unignorable, and has no delivery
problem. But it does NOT solve the problem the operator described, and the
strongest honest version of this track has to say so.**

Three findings drive everything below:

1. **The repo already tests every PR against fresh `main`** — `actions/checkout`
   on a `pull_request` event checks out `refs/pull/N/merge`, i.e. PR head merged
   with the *current* base tip. Mode B is therefore already **detected**
   mechanically on every check run. What is missing is **ordering** and
   **merge-time enforcement**, not detection.
2. **The one guard that should catch Mode B locally has the wrong shape.**
   `yeet publish`'s `enforceBaseFreshness` blocks only when branch-changed paths
   **intersect** base-changed paths. Mode B is by definition **path-disjoint**
   (a lint rule in `biome.json` breaks a file you never touched). Mode B falls
   through to a `Console.error` warning. This is a one-afternoon fix and the
   highest value-per-effort item in the entire track.
3. **Speculative merge testing (Zuul / GitHub merge queue) makes `main`
   unbreakable, not your PR unbreakable.** The claim under test — *"a policy
   change ahead of you is already in your test base, so your in-flight PR won't
   break"* — is **half true and half false**, and the false half is the half the
   operator is actually paying for. Details in §3.

Verdict summary (full derivation in §6):

| | dissolved by mechanical means | irreducible |
|---|---|---|
| **Mode B** (base churn) | **~70%** | ~30% (advance notice of *intent*) |
| **Mode A** (duplicate work) | **~10–15%** | **~85–90%** (pre-PR claiming) |

---

## 1. Ground truth from this repo (measured, not assumed)

Everything in this section came out of the live checkout / live GitHub API, not
from the brief. **Two corrections to the situation brief.**

### 1.1 It is 17 required checks, not ~24

`gh api repos/beep-effect/beep-effect/rulesets/10240248`:

```
enforcement: active   conditions: ~DEFAULT_BRANCH
RULE deletion
RULE non_fast_forward
RULE pull_request  required_approving_review_count: 0
                   required_review_thread_resolution: false
                   allowed_merge_methods: [merge, squash, rebase]
RULE required_status_checks  strict_required_status_checks_policy: FALSE
   Lint · Lint Policy · Check · Test Unit · Test Integration · Docgen ·
   Codegen Drift · Repo Sanity · Coverage Regression · Knip · JSDoc Ratchet ·
   Commitlint · Secret Scanning · Security · SAST · Nix Shell ·
   Professional Desktop IPC Stdio
```

That is **17** required contexts. There is **no `merge_queue` rule**, and
**`strict = false`**.

`strict = false` is load-bearing and under-appreciated: **a PR that went green
against three-day-old `main` is allowed to merge today, untested against
anything that landed in between.** That is a wide-open Mode B hole at merge
time, and it is the single thing merge queue closes outright.

### 1.2 Real gauntlet wall-clock

`gh run list --workflow=check.yml` (last 12 runs, createdAt→updatedAt):

| event | conclusion | wall clock | branch |
|---|---|---|---|
| pull_request | success | 14.5 min | docs/candor-wedge-brief |
| pull_request | success | 14.3 min | knowledge-surface-p1-manifest… |
| pull_request | success | 11.8 min | knowledge-surface-p1-followup-554 |
| **push (main)** | cancelled | **46.5 min** | main |
| **push (main)** | failure | **21.2 min** | main |
| pull_request | success | 15.5 min | knowledge-surface-p1-manifest… |
| pull_request | success | 17.9 min | feat/pipeline-speed |
| pull_request | success | 15.4 min | codex/lexical-playground… |
| pull_request | failure | 18.8 min | feat/pipeline-speed |
| pull_request | success | 14.1 min | codex/lexical-playground… |

**PR gauntlet p50 ≈ 15 min, p90 ≈ 19 min. Push-to-`main` gauntlet 21–46 min.**

The gap matters enormously for the merge-queue model, and §2.4 explains why:
push runs lose `--affected` scoping. **A `merge_group` build, as the workflow is
written today, would behave like a push run — 21–46 min, not 15.**

### 1.3 Real merge rate

`git log --since="30 days ago" --first-parent main | wc -l` → **253 merges in 30
days**. Daily distribution is bursty: median ~11/day, peak **26/day**
(2026-07-11), several 18–24 days.

This is the denominator for every throughput claim below. **~8.4 merges/day
mean, 26/day peak.**

### 1.4 The Mode B hole is in `yeet`, and it is precisely shaped wrong

`packages/tooling/tool/cli/src/commands/Yeet/internal/PublishScope.ts:814-830`:

```ts
yield* Console.error(
  `[yeet] warning: branch is ${freshness.behindCount} commit(s) behind ${context.base} …`
);
if (A.isReadonlyArrayEmpty(freshness.overlappingPaths)) {
  return freshness;                    // <-- Mode B exits here, as a WARNING
}
…
return yield* failPublishScopeWithPacket(context, {
  message: `yeet publish refuses a stale base: files changed on this branch were
            also changed on ${context.base} since the merge-base, so the PR would
            conflict or silently regress them.`,
  subCategory: "stale-base",
});
```

`overlappingPaths` comes from `overlappingBasePaths(branchPaths, basePaths)` —
a **set intersection of changed file paths**.

- **Mode A collision** (two agents edit the same file) → paths overlap → **hard
  fail. Already covered.**
- **Mode B policy churn** (someone adds a `biome` rule, tightens a
  `turbo.json` task, makes a schema field required, adds a gate script) → your
  branch touched `packages/foo/src/Bar.ts`, theirs touched `biome.json` →
  **empty intersection → warning → publish proceeds.**

The guard is a *textual-conflict* guard wearing a *semantic-staleness* name.
Mode B is semantic interference across disjoint paths. **This is the exact
blind spot, in the exact tool every agent must pass through.** Fix in §5.1.

### 1.5 `check.yml` has no third event state

`grep -n "github.event_name" .github/workflows/check.yml` returns **~30 sites**,
every one of them a binary `pull_request` / `push` fork. `merge_group` is a
third state that none of them handles. The consequences are enumerated in §2.4.

One piece of good news, worth stating because it is the classic merge-queue
trap and this repo dodged it: **no *required* job is job-level gated on
`event_name`.** Only `pr-size` (`if: github.event_name == 'pull_request'`,
line 20) and `build` (`if: github.event_name == 'push'`, line 543) carry
job-level `if:`, and neither is in the required set. The `verify` matrix uses an
internal `lane-gate` + explicit **"Skip lane"** step so a skipped lane still
*reports* — which is precisely the pattern that avoids "Expected — Waiting for
status to be reported" limbo. Whoever built that already engineered for a queue
without knowing it.

---

## 2. Part 1 & 2 — the mechanisms

### 2.1 Zuul CI: the dependent pipeline manager

Zuul (OpenStack's gating system) is the reference implementation of speculative
merge testing. Mechanism, precisely:

**Gating premise.** *"The process of gating attempts to prevent changes that
introduce regressions from being merged. This keeps the mainline of development
open and working for all developers."*

**Speculative execution.** In a **dependent pipeline manager**, Zuul *"assumes
that all jobs will succeed and tests them in parallel accordingly. If they do
succeed, they can all be merged. However, if one fails, then changes that were
expecting it to succeed are re-tested without the failed change."*

**Testing against the future queue state.** For a queue A→B→C→D→E:

| item | what is actually built and tested |
|---|---|
| A | branch tip + A |
| B | branch tip + A + B |
| C | branch tip + A + B + C |
| E | branch tip + A + B + C + D + E |

*"each change applied to the tip of the branch exactly as it is going to be
merged."* **This is the mechanical answer to Mode B — literally: a policy change
ahead of you is in your test base.** Verified.

**Cascading reset.** If A,B pass and C,D,E fail: Zuul merges A and B, reports
**C's** failure and drops C. Because *"D was dependent on C, it is not clear
whether D's failure is the result of a defect in D or C"*, D and E are
**re-tested from scratch** against the new tip. Every reset discards in-flight
CI work — this is the tax.

**Window (TCP-style flow control).** `window` default **20**;
`window-floor` default **3**; `window-ceiling` default `null` (unlimited);
`window-increase-type` default `linear` with `window-increase-factor` **1**;
`window-decrease-type` default **`exponential`** with
`window-decrease-factor` **2**. Semantics: *"Each time a change successfully
merges, the window is increased by one. Each time a change fails, the window is
halved."* Additive-increase / multiplicative-decrease — congestion control for
merges. A flaky repo self-throttles to `window-floor` and stays there.

**Repo state freezing.** *"If a git repository is used by at least one job for a
queue item, then Zuul will freeze the repo state (i.e., branch heads and tags)
and use that same state for every job run for that queue item."* All 17 checks
for one queue item see byte-identical inputs — which the repo's own
`architecture-lab-proof-oracle` doctrine would appreciate.

**Cross-project deps.** `Depends-On:` footers serialize into queue order; if B
fails, A (which depends on B) is removed too.

### 2.2 GitHub merge queue, as of 2026

**Merge group formation.** FIFO. Adding a PR creates a temporary branch
`gh-readonly-queue/{base_branch}/…` containing *"the base branch code plus
changes from the PR and all preceding queued PRs."* **Same speculative
composition as Zuul.**

**The `merge_group` event.** Activity type `checks_requested`. `GITHUB_SHA` = the
merge group SHA, `GITHUB_REF` = the merge group ref. Payload carries
`github.event.merge_group.{head_sha, base_sha, head_ref, base_ref}`. It is
*"separate from the `pull_request` and `push` events"* — workflows must add the
trigger explicitly or *"status checks will not be triggered when you add a pull
request to a merge queue."* Third-party CI detects merge groups by watching
pushes to `gh-readonly-queue/*`.

**Ruleset configuration** (`merge_queue` rule parameters, available via the
Rulesets API):

| parameter | default | meaning |
|---|---|---|
| `grouping_strategy` | `ALLGREEN` | `ALLGREEN` = every PR's merge commit in the group must pass. `HEADGREEN` = only the head commit of the group must pass. |
| `max_entries_to_build` | **5** | how many queued entries request checks concurrently — **this is Zuul's `window`** |
| `max_entries_to_merge` | **5** | how many entries collapse into one merge to base |
| `min_entries_to_merge` | 1 | wait to accumulate this many before merging |
| `min_entries_to_merge_wait_minutes` | — | timeout on the above |
| `check_response_timeout_minutes` | **60** | how long to wait for CI before treating the entry as failed |
| `merge_method` | — | `MERGE` / `SQUASH` / `REBASE` |

Note the docs' own caveat: *"Merge limits do not combine `merge_group`
**builds**. Merge limits only affect merges to the base branch once one or more
`merge_group` has satisfied build checks."* So `max_entries_to_build` governs
speculative CI parallelism; `max_entries_to_merge` governs merge batching. They
are separate knobs and it is easy to conflate them.

**Failure handling.** On a merge group CI failure the queue *"automatically
removes"* the offending PR and regroups the remainder; the PR timeline records
the reason. Documented removal triggers, verbatim:
1. *"Configured CI service is reporting test failures for a merge group"*
2. *"Timed out awaiting a successful CI result based off the configured timeout
   setting"*
3. *"User requesting a removal via the API or merge queue interface"*
4. *"Branch protection failure that could not automatically be resolved"*

**Jump-to-front** causes *"a full rebuild of all in-progress pull requests, as
the reordering of the queue introduces a break in the commit graph."* An
operator who prioritizes a hotfix pays a full window reset.

**Known limitations / traps (2026):**
- Merge queue **cannot** be enabled with branch-protection patterns containing
  wildcards.
- Required-check names must **match exactly** between `pull_request` (gates
  queue *entry*) and `merge_group` (gates *merge eligibility*). Mismatch → the
  entry sits in "Expected — Waiting for status to be reported" until
  `check_response_timeout_minutes` expires (default **60 min**), then is
  ejected. Community reports describe entries that *"stay in the queue until it
  reaches timeout … requiring manual action to remove the entry and unblock
  other entries."*
- Merge-queue checks and PR checks are **coupled** under one ruleset; there is
  no clean native "merge-queue-only required check". The practical consequence
  is **every check runs twice** per PR (once on `pull_request`, once on
  `merge_group`) unless you gate the *body* on event — see §5.2, where this repo
  is unusually well-positioned.
- A known class of bug where the queue *"does not always wait for CI triggered
  by the `merge_group` event, and instead incorrectly considers the CI job
  triggered by the pull request event."* Treat with suspicion; verify
  empirically before trusting it as a gate.

### 2.3 Throughput model at this repo's real numbers

Inputs: **17 required checks**, ~20 jobs/run, PR gauntlet **15 min**, merge-group
gauntlet **21–46 min** (as-written; **15–19 min** if fixed per §5.2),
**8.4 merges/day mean / 26/day peak**, `max_entries_to_build = 5`.

**Worst case — fully serialized (`max_entries_to_build = 1`, unfixed workflow):**
- 1 merge per 21–46 min → **1.3–2.9 merges/hour** → over a 14-hour agent day,
  **18–40 merges/day**.
- Peak observed day was 26. **That is inside the failure band.** A fully
  serialized queue on the unfixed workflow is a real bottleneck on burst days.

**Default — `max_entries_to_build = 5`, unfixed workflow:**
- 5 speculative builds in flight; with residual failure probability `p` at
  queue-entry time, expected entries landing per cycle
  = `Σ_{k=1..5} (1-p)^k`.
- `p = 0.06` (flake-dominated; PRs enter already green on their own base)
  → **4.17 entries land per 5 builds** → ~1.2 builds per landed PR.
  Throughput ≈ 4.17 per 30 min ≈ **8.3/hour ≈ 116/day**. Huge headroom.
- `p = 0.17` (the raw observed PR failure rate — 2 reds in the last 12 runs)
  → **2.93 entries land per 5 builds** → ~1.7 builds per landed PR.
  Throughput ≈ **5.9/hour ≈ 82/day**. Still ample, but CI spend nearly doubles
  on top of the doubling from running checks twice.

**Verdict on throughput: NOT a bottleneck at 8.4/day mean, provided
`max_entries_to_build ≥ 3` and the `merge_group` event is properly handled.**
The bottleneck risk is entirely in the two failure modes below, not in raw
capacity.

**Bottleneck risk #1 — flake amplification.** The clearest statement of the
danger: *"A test that fails 5% of the time on a single PR run now has a 5%
chance of blowing up the entire queue on every cycle."* This repo has
**documented, named flake classes** in its own memory —
`ci-timeout-flake-class`, `ts2589-native-compiler-flake-class`,
`property-lane-run-floor`, `turbo-build-check-cache-race`. Across ~20 jobs, the
per-run flake probability is plausibly **above** 5%. Under `ALLGREEN`, one flake
at queue position 1 resets positions 2–5.

**Bottleneck risk #2 — availability coupling.** Today, when `main` is red, only
the agent who notices is blocked. With a merge queue, **a red queue blocks the
entire fleet.** That is arguably *correct* (it forces the fleet to converge on
one fix instead of thirteen), but it is a hard coupling the operator does not
have today and should choose deliberately.

### 2.4 What breaks in *this* workflow if you turn merge queue on

This is the honest price, enumerated from `check.yml`. **Adding
`merge_group: branches: [main]` is not a one-line change.**

**(a) Loss of `--affected` scoping — the throughput killer.**
Lines 206–207, 348–349:
```bash
if [[ "$GITHUB_EVENT_NAME" == "pull_request" ]]; then
  shape_args+=(--affected --base "origin/${GITHUB_BASE_REF:-main}")
fi
```
On `merge_group`, this branch is not taken, so every lane runs **full-repo**.
That is exactly why push-to-`main` runs measure 21–46 min against a PR median of
15. **Fix:** widen to `!= 'push'` and source the base from
`github.event.merge_group.base_sha`.

**(b) Commitlint silently degrades to `--last`.** Lines 599–609: the range
selector forks on `pull_request` (uses `github.event.pull_request.base.sha`) and
then on `github.event.before` (a *push*-only payload field). On `merge_group`
**both are absent**, so `mode=last` and commitlint lints **one commit** — the
tip of a merge group that may contain five PRs. The required check passes
vacuously.

**(c) Secret scanning silently degrades to the tip commit.** Lines 657–681:
`log_opts` defaults to `"-1"` and is only widened under `pull_request` or a
non-zero `github.event.before`. On `merge_group`, **gitleaks scans exactly one
commit**. Worse, the deliberate security hardening in that block — *"the
secret-scanning gate must NOT trust a PR-controlled scanner config"*, which
pins `.gitleaks.toml` / `.gitleaksignore` to the base — **is inside the
`pull_request` branch** and would not apply to merge-group scans. A required
security gate would weaken exactly where it matters most (the commit that
actually lands).

**These two are the most important findings in this section.** They are not
"merge queue is bad"; they are "merge queue adoption here has a real,
non-obvious, security-relevant remediation cost that must be paid before the
ruleset is flipped."

**(d) Turbo cache/env.** Lines 112–122 set `TURBO_TOKEN`/`TURBO_TEAM` only on
`push` and `TURBO_CACHE: 'local:rw'` only on `pull_request`. On `merge_group`
both are empty. Mitigating check of
`.github/actions/setup-monorepo-ci/action.yml:46-47` — the local turbo cache
restore fires `if inputs.cache-turbo == 'true' && (TURBO_TOKEN == '' ||
TURBO_TEAM == '')`, which **is** true on `merge_group`. So merge-group builds
are **not** fully cold; the cache key is per-`github.job` and would be shared
with PR runs. This is a smaller problem than it looks — but the env matrix
should still be made explicit rather than accidental.

**(e) `fallow-advisory` base resolution** (lines 382–392) falls through to
`base_ref="$BEFORE_SHA"` (empty on `merge_group`) and then `HEAD~1`. Advisory
only, not required — cosmetic.

**(f) Concurrency is already safe.** Line 11:
`cancel-in-progress: ${{ github.event_name == 'pull_request' }}` — merge-group
runs will not be cancelled by the concurrency group. Correct by accident, but
correct.

**Remediation estimate: ~30 conditional sites, ~1 focused day, plus one
verification cycle to confirm `merge_group` check names match and no entry
lands in "Expected" limbo.** Non-trivial, entirely tractable, and mostly
mechanical.

### 2.5 The commercial field: batch-failure bisection

A 13-agent fleet will produce frequent red batches, so bisection quality is the
differentiator.

| product | batching | failed-batch handling |
|---|---|---|
| **GitHub native** | `max_entries_to_build` / `max_entries_to_merge` (default 5 each); `grouping_strategy` `ALLGREEN`\|`HEADGREEN` | Ejects the offending PR, regroups the remainder; **cascade restart of all downstream entries**. Described as *"the single biggest source of frustration with merge queues."* No configurable bisection strategy. |
| **Mergify** | explicit batch size; **bisect-on-failure** | *"When batch [1,2,3,4] fails, the queue tests overlapping subsets in parallel — for example [1,2] and [1,2,3] — to isolate the culprit."* Ships a **Batch Bisection Statistics API** (2026-03-12) reporting bisection depth/frequency to tune batch size. Published sizing guidance: **<2% failure → batches of 5–10; 2–5% → 3–5; >5% → 2–3.** |
| **Aviator MergeQueue** | batching + parallel mode | Splits a failed batch into sub-groups rather than re-running each PR alone: *"if PR #1 fails, Aviator blocks PR #1 and requeues PRs #2–5 into two batches — #2–3 and #4–5."* Recursive until isolated. Monorepo-oriented. |
| **Trunk Merge Queue** | batching + **Optimistic Merging** + **Pending Failure Depth** | Moves a failed batch to *"a separate queue for bisection analysis, where the batch will be split in various ways and tested in isolation."* The Optimistic Merging + Pending Failure Depth combination is explicitly marketed as flake tolerance — the most directly relevant feature for this repo's documented flake classes. |
| **Graphite** | batching | **The only stack-aware merge queue.** Team plan $18/user/month. Not deprecated as of 2026. |

**Read for this operator:** at **one seat**, per-seat pricing is nearly free
(Graphite $18/mo; Mergify/Aviator/Trunk have free or small-team tiers). The
functional gap that actually matters is **flake tolerance**, where Trunk's
Optimistic Merging + Pending Failure Depth and Mergify's bisection statistics
are meaningfully ahead of GitHub native. **But** every third-party queue adds an
external service dependency and a second source of truth for merge policy —
against a brief that says the shared-local-directory baseline is free and
anything heavier must beat it on merits. GitHub native wins on *not adding a
vendor*, and its `HEADGREEN` + `max_entries_to_build` knobs are enough for
8.4 merges/day.

---

## 3. Part 3 — what speculative merge testing does NOT solve

This is the section that keeps the track honest.

### 3.1 The core claim, tested

> *"PRs are tested against the speculative future state of the queue, so a
> policy change ahead of you is already in your test base. This is the exact
> mechanical answer to 'your in-flight PR will break when mine lands.'"*

**First half: verified.** Zuul's build of item C is literally `tip + A + B + C`;
GitHub's `gh-readonly-queue` branch is literally base + all preceding entries +
yours. The policy change *is* in your test base.

**Second half: refuted.** Being tested against the future does not make you
*pass* it. Trace it through Zuul's own semantics:

- A adds a lint rule. B violates it (in a file A never touched).
- Zuul builds `tip + A + B`. **B fails.**
- Zuul *"reports C's failure, drops C, and re-tests D and E"* — substituting B:
  Zuul reports **B's** failure, drops **B** from the queue.
- **B's author must still edit B.** Same diagnosis. Same tokens. Same rework.

What changed is *where the failure is discovered* and *what it costs everyone
else*:

| | today (`strict=false`, no queue) | with merge queue |
|---|---|---|
| Does `main` break? | **Yes** — a stale-green PR can merge on top of a policy change | **No** — never |
| Does B's author do rework? | Yes | **Yes — identical** |
| When does B learn? | On its next check run (already tests the merge ref — see §1.1), or after merging and breaking `main` | On queue ejection |
| Does B's failure block others? | No | **Yes** — cascade reset of the window behind it |

**So merge queue converts a *correctness* problem into a *scheduling* problem.
It does not convert a *token-spend* problem into anything.** The operator's
Mode B pain is stated as *"every other agent's in-flight PR starts failing
checks for reasons unrelated to its own diff"* — and that pain is **unchanged**.
Merge queue prevents the *consequence* (broken `main`), not the *experience*
(your PR is red for reasons that are not your fault).

This is the strongest available argument for a coordination layer, and it comes
out of the competitor's own mechanism.

### 3.2 Mode A pre-PR is untouched — quantify the residual

Merge queue's earliest observation point is **PR entry into the queue**. Mode A
duplication happens strictly earlier:

```
main breaks
  │
  ├─ agent 3 notices ─── investigates ─── writes fix ─── local yeet verify ─── PR
  ├─ agent 7 notices ─── investigates ─── writes fix ─── local yeet verify ─── PR
  └─ agent 11 notices ── investigates ─── writes fix ─── local yeet verify ─── PR
                        └──────── ALL OF THIS IS ALREADY SPENT ────────┘
                                                                        ↑
                                                        merge queue's first look
```

Cost already sunk when the queue first sees anything:
- **N × investigation tokens** (read logs, bisect, locate root cause — usually
  the single largest chunk).
- **N × fix authoring.**
- **N × local `yeet verify`** — and repo memory records that the *local full
  proof is stricter than PR CI* (`yeet-full-proof-vs-ci-affected`), so this is
  tens of minutes of a 32-core workstation, ×N, contending with 12 other clones.
- **N × PR CI** at 15 min × ~20 jobs — with real Blacksmith spend (>$50/week
  already, per opportunities ledger #24).

What merge queue *does* recover: agent 7's and agent 11's entries either become
**empty after squash** against a group already containing agent 3's fix, or
**conflict and are cleanly ejected**. Nobody's PR breaks `main`, and the
operator does not have to reconcile them by hand. That is real but small — it is
the **last 10%** of a Mode A incident.

**Residual: merge queue recovers ~0% of Mode A token spend and ~100% of Mode A
merge safety.** Since the operator's stated pain is *"redundant token spend and
merge conflicts"*, and token spend dominates, **merge queue addresses roughly
the smaller half of the smaller term.**

### 3.3 Other things it does not solve

- **Advance notice.** A queue can only test the future once someone has
  *committed* to it. It cannot tell agent 7 that agent 3 is *about to* land a
  repo-wide lint rule. Only agent 3 knows that, and only before pushing.
- **Ordering intent.** FIFO is arrival order, not dependency order. A
  policy-change PR and the twelve PRs that need updating for it will interleave
  arbitrarily. Zuul has `Depends-On:` for this; **GitHub merge queue has no
  cross-PR dependency declaration at all.**
- **Deliberate batching.** "Land the lint rule at 2am when nothing is in
  flight" is a coordination decision no queue can make.
- **The delivery problem.** Nothing in a merge queue injects anything into a
  running agent's context. An ejected PR notification arrives only when the
  agent next polls GitHub — which, per the brief's hard constraint, **agents do
  not do**. `yeet monitor` is the existing polling loop, so this is partially
  covered, but only for the agent that is actively babysitting.

---

## 4. Part 4 — cheaper mechanical partial answers

### 4.1 Auto-rebase / auto-update-branch bots — **reject**

Options: `strict_required_status_checks_policy: true` (GitHub native), Kodiak's
`rebase_fast_forward`, `update-branch` Actions, Renovate-style rebasing.

**Does keeping every PR rebased on `main` dissolve Mode B without a queue?
No — and at 13 agents it is actively worse than doing nothing.**

The arithmetic: with `O` open PRs and `M` merges/day, auto-rebase triggers
`O × M` extra full gauntlets/day. At this repo's real numbers — call it
`O ≈ 8` in-flight PRs and `M = 8.4` mean / `26` peak — that is **67 extra
gauntlets/day mean, 208 on peak days**, at 15 min × ~20 jobs each. Against a
current spend of >$50/week that is a multi-hundred-percent CI cost increase for
zero additional correctness.

Worse, **it does not converge under burst.** Rebase PR-B onto main → a new merge
lands mid-run → PR-B is stale again → rebase again. The classic thundering herd.
This is the exact failure mode merge queues were invented to eliminate; GitHub's
own docs say merge queue *"provides the same benefits as 'Require branches to be
up to date before merging' … but does not require a pull request author to
update their pull request branch and wait for status checks to finish."*

**And here is the thing that makes it moot: this repo already has the benefit.**
`actions/checkout@v4` on a `pull_request` event checks out `refs/pull/N/merge` —
*"the merged result, not just the head branch alone."* **Every check run in this
repo is already effectively rebased onto current `main`.** The only thing
`strict=true` would add is *merge-time* freshness enforcement, and it would buy
that by paying the full thundering-herd tax.

**Verdict: do not enable `strict=true`. Do not install an auto-rebase bot.** If
merge-time freshness is wanted, merge queue provides it at a fraction of the CI
cost.

### 4.2 Stacked PRs — **orthogonal, low value here**

State of the art as of 2026: **GitHub shipped native stacked PRs to public
preview on 2026-07-30** via a `gh-stack` CLI extension (private preview
2026-04-13), free for every repository. Third-party: Graphite (only stack-aware
merge queue, $18/user/mo), `git-spice` (open source, `gs stack restack` keeps a
stack synced with trunk).

**Why it barely helps here.** Stacking solves *dependent work by one author*.
This fleet's topology is the opposite: **13 clones, 13 independent branches, 13
independent agents, mostly disjoint work.** Stacking has no cross-*agent*
semantics — two agents cannot stack on each other without one of them becoming
the other's base, which is exactly the coupling the fleet is trying to avoid.

**The one genuinely useful application:** a policy-change PR could be authored
*as a stack* — `[1] add the lint rule (disabled)` → `[2] fix packages A–F` →
`[3] enable the rule` — so the repo-wide flip lands atomically at the top of a
reviewed stack rather than as a surprise. That is a **Mode B authoring
discipline**, and it is worth codifying as a law. It requires no tooling
purchase; `git-spice` or native `gh-stack` would make it ergonomic.

**Verdict: not a coordination mechanism. Adopt as a Mode B *authoring pattern*
for policy changes, ~0 cost. Do not buy Graphite for this.**

### 4.3 Does `yeet` already cover most of Mode B? — **partially; and the gap is
sharp**

| Mode B sub-problem | already covered? | by what |
|---|---|---|
| Detect that new `main` breaks my PR | **Yes, fully** | PR checks run against `refs/pull/N/merge` — always merged with current `main` |
| Detect it *locally*, before burning 15 min of CI | **No** | `enforceBaseFreshness` warns but does not block on path-disjoint base movement (§1.4) |
| Prevent merging a stale-green PR onto changed `main` | **No** | `strict = false` in the live ruleset |
| Prevent `main` going red from interleaved merges | **No** | manual serialization protocol only (`goal-portfolio-driver/research/deep-research-2026-07-14.md`: *"Never arm multiple ordinary auto-merges"*) |
| Avoid the manual rebase → re-verify treadmill | **No** | OPPORTUNITIES.md #22 explicitly names *"tonight's 547→548→546 re-verify tax"* |

So: **detection is solved, everything downstream of detection is not.** The
discussion is not moot — but the *cheapest* fix is not a merge queue, it is
§5.1.

---

## 5. Recommended mechanical program, ordered by value per effort

### 5.1 P0 — Policy-surface staleness guard in `yeet` (one afternoon, $0)

Change `enforceBaseFreshness` from a path-**intersection** guard to a
path-intersection **∪ policy-surface** guard. When the branch is behind and the
base moved **any declared policy surface**, hard-fail regardless of overlap.

Policy surface (schema-first, as a `LiteralKit` domain, per repo law):
`biome.json*`, `.beep/**` laws, `turbo.json`, `tsconfig*.json`, `package.json`,
`bun.lock`, `.github/workflows/**`, `.github/actions/**`, `packages/tooling/**`,
`.gitleaks.toml`, any `**/schema/**` requiredness change, `knip.json`,
`docgen.json`, `.changeset/config.json`.

Why this is the best item in the track:
- It is the **only** intervention that moves Mode B discovery from *15 minutes
  of hosted CI* to *seconds of local `yeet`*, ×13 clones ×N/day.
- It has **no delivery problem**. Every agent already passes through
  `yeet publish`. A gate cannot be ignored the way a message board can.
- It costs nothing and depends on nothing.
- The remediation string is already written and correct:
  `git fetch origin && git rebase ${base}, re-run bun run beep yeet verify`.

Present it as a *distinct* `subCategory: "stale-policy-surface"` so
`yeet monitor` / verdict attribution can tell "your diff is wrong" from "the
world moved under you" — the repo already cares about this distinction
(`yeet-verdict-misattribution`, and CLAUDE.md's *"Attribute verification
failures before repairing"*).

### 5.2 P1 — Enable GitHub merge queue, but fix `check.yml` first (~1 day)

Order of operations matters; flipping the ruleset first strands entries in
60-minute limbo.

1. **Add the third event state.** Replace every
   `github.event_name == 'pull_request'` that guards *base resolution* or
   *affected scoping* with a `merge_group`-aware form:
   `BASE_SHA = pull_request.base.sha ?? merge_group.base_sha ?? github.event.before`.
   ~30 sites in `check.yml`.
2. **Fix commitlint (§2.4b) and gitleaks (§2.4c) ranges for `merge_group`
   explicitly** — including moving the base-pinned scanner-config hardening out
   of the `pull_request` branch. **Do not ship merge queue without this**; both
   are required security-relevant gates that would pass vacuously.
3. **Split lane cost by event.** This repo is unusually well set up for it:
   lane bodies already live in the CLI (`bun run beep ci lane <id>`) and the
   matrix already has a `lane-gate` + reporting "Skip lane" step. So:
   `pull_request` → **fast lanes, `--affected`** (fast feedback, cheap);
   `merge_group` → **full gauntlet** (the real gate). This turns the
   "everything runs twice" objection into a feature, and it is the single
   biggest lever on the doubled-CI-spend cost.
4. **Ruleset settings for a flaky 17-check monorepo:**
   `grouping_strategy: HEADGREEN` (not the `ALLGREEN` default — reduces
   flake amplification), `max_entries_to_build: 5`,
   `max_entries_to_merge: 3`, `check_response_timeout_minutes: 90`
   (≈2× the observed 46-min worst case), `merge_method: SQUASH` (matches
   current practice and the server-side commitlint constraint in CLAUDE.md).
5. **Pair with OPPORTUNITIES #23** (`gh run rerun --failed`) so a flaked merge
   group is re-run rather than ejecting the entry — the cheapest available
   substitute for Trunk's Optimistic Merging.
6. **Keep the `.beep`/law-pulse push channel.** Merge queue provides no
   in-context notification; ejection must surface through `yeet monitor`.

What this buys, concretely: kills `strict=false` staleness, kills interleaved-
merge `main` breakage (documented chronic problem), kills the 547→548→546
re-verify treadmill, and removes the "never arm multiple auto-merges" manual
protocol entirely.

What it costs: ~1 day of workflow surgery, roughly **1.2–1.7 merge-group builds
per landed PR** on top of PR runs (call it **+60–100% CI spend** after lane
splitting, more before), a fleet-wide availability coupling when the queue goes
red, and a new operational surface (queue limbo, ejection diagnosis) that agents
must be taught.

### 5.3 P2 — Policy changes land as stacks (0 cost, a law)

Codify: any repo-wide policy flip is authored as *add-disabled → migrate call
sites → enable*, and the enable step is the top of a stack. Native `gh-stack`
(public preview since 2026-07-30) or `git-spice` makes it ergonomic. This is
Mode B **prevention at the source** and is the only intervention in this track
that reduces the *rework* term rather than relocating it.

### 5.4 Explicitly rejected

- `strict_required_status_checks_policy: true` — thundering herd, §4.1.
- Auto-rebase/update-branch bots — same, worse.
- Third-party merge queue (Mergify/Aviator/Trunk/Graphite) — better flake
  handling, but adds a vendor and a second merge-policy source of truth for a
  single-seat operator at 8.4 merges/day. Revisit only if GitHub-native
  `HEADGREEN` + `rerun --failed` proves insufficient against the documented
  flake classes.

---

## 6. Verdict — the honest percentages

Metric: **wasted agent-hours + token spend**, not incident count.

### Mode B decomposition

| sub-mode | weight | dissolved mechanically | by what |
|---|---|---|---|
| **B1** `main` goes red from two green-on-stale-base PRs interleaving | 25% | **100%** | merge queue (speculative future-state testing) |
| **B2** in-flight PR must manually rebase + re-verify after unrelated base movement (the treadmill) | 40% | **~90%** | merge queue removes the manual loop entirely; §5.1 makes the residual instant and local |
| **B3** in-flight PR genuinely violates the new policy and must be *edited* | 35% | **~15%** | §5.1 moves discovery from 15-min CI to local seconds (cost reduction only); §5.3 prevents some at the source. **The rework itself is irreducible.** |

`0.25(1.00) + 0.40(0.90) + 0.35(0.15)` = **0.66**, rounded with the §5.1 local-
discovery saving across B2/B3 → **≈70% of Mode B dissolved by mechanical means.**

**The residual ~30% is B3's rework, and it is irreducible by any mechanism.**
Coordination cannot make the edit unnecessary — it can only (a) let the affected
agent *choose when* to absorb it, (b) let the policy author *batch* the fixups
into their own stack, (c) prevent thirteen simultaneous surprised diagnoses of
the same root cause. That is a **broadcast of intent**, and only the author has
the information. **No mechanism can synthesize it.**

### Mode A decomposition

| sub-mode | weight | dissolved mechanically |
|---|---|---|
| **A1** duplicated investigation + fix authoring + local `yeet verify` (token spend, ×N agents) | 70% | **0%** — all of it is spent before a PR exists |
| **A2** duplicated PR CI spend | 10% | **0%** — each PR still runs its own gauntlet |
| **A3** merge conflicts / reconciling competing PRs / `main` safety | 20% | **~90%** — the queue ejects or squash-empties the loser cleanly and `main` never breaks |

`0.70(0) + 0.10(0) + 0.20(0.90)` = **0.18**, discounted because A3's *operator
attention* is only partly recovered → **≈10–15% of Mode A dissolved by
mechanical means.**

**≈85–90% of Mode A is irreducible without a claim/intent layer.** The
information "I am currently fixing the `TS2589` regression on `main`" exists
only in one agent's head at a moment when no git object, no PR, and no CI run
reflects it. **There is no mechanical surface for it to live on.**

### Combined

Weighting Mode A and Mode B equally: **mechanical means dissolve ~40% of total
fleet-coordination pain.** The remaining ~60% is dominated by **Mode A pre-PR
claiming**, with a smaller irreducible **Mode B intent-broadcast** tail.

### The competitor's strongest closing argument

Even though mechanical means only reach ~40%, **do them first**, because:

1. **A gate cannot be ignored.** The brief's hard constraint is *delivery* — an
   agent only receives what is injected into its context. `yeet publish` and a
   merge queue both act on the *artifact*, not the agent, so they work whether
   or not the agent is paying attention. **They have no delivery problem at
   all.** A message board's entire risk surface is adoption; a gate's is zero.
2. **They are cheap and bounded.** §5.1 is an afternoon. §5.2 is a day. §5.3 is
   a law. No new services, no daemons, no cross-machine anything, no schema for
   inter-agent messages, no protocol to keep 13 heterogeneous sessions
   (Claude + Codex) agreeing on.
3. **They shrink and sharpen the coordination problem.** After §5.1–5.3, the
   residual is no longer *"build a message board"*. It is two much narrower
   things: **(i) a pre-PR intent/claim registry** (Mode A — which is exactly the
   shared-directory-plus-`flock` baseline the brief already grants as free), and
   **(ii) a one-line policy-change pre-announce** that a policy-change author
   emits from `yeet publish` when their diff touches the §5.1 policy surface —
   delivered through the *already proven* `law-pulse.sh` PostToolUse channel.

**That second point is the real deliverable of this track:** the mechanical
program does not compete with a coordination layer, it **specifies** it. Build
the gates, and what is left is ~40 lines of claim registry and a hook that
already exists — not a message board.

---

## 7. Sources

- [Zuul — Project Gating](https://zuul-ci.org/docs/zuul/latest/gating.html)
- [Zuul — Pipeline configuration (window attributes)](https://zuul-ci.org/docs/zuul/latest/config/pipeline.html)
- [GitHub Docs — Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
- [GitHub Docs — Events that trigger workflows (`merge_group`)](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [Tenki — GitHub Merge Queue in 2026: How It Works & Handling Flaky Required Status Checks](https://tenki.cloud/blog/github-merge-queue-setup)
- [GitHub Changelog — Repository Rules: configure merge queue rule](https://github.blog/changelog/2024-02-27-repository-rules-configure-merge-queue-rule-public-beta/)
- [terraform-provider-github PR #2380 — merge_queue ruleset parameters](https://github.com/integrations/terraform-provider-github/pull/2380/files)
- [GitHub community discussion #151100 — merge queue vs pull_request-triggered checks](https://github.com/orgs/community/discussions/151100)
- [GitHub community discussion #103114 — merge-queue-specific checks](https://github.com/orgs/community/discussions/103114)
- [Mergify — Batching in a Merge Queue](https://mergify.com/learn/merge-queue/batching)
- [Mergify — Batch Bisection Statistics API (2026-03-12)](https://docs.mergify.com/changelog/2026-03-12-batch-bisection-statistics-api/)
- [Mergify — State of Merge Queues 2026](https://mergify.com/reports/state-of-merge-queues-2026)
- [Aviator — Batching](https://docs.aviator.co/mergequeue/concepts/batching)
- [Aviator — Merge Queues for Large Monorepos](https://www.aviator.co/blog/merge-queues-for-large-monorepos/)
- [Trunk — Batching](https://docs.trunk.io/merge-queue/concepts-and-optimizations/batching)
- [Graphite — Merge Queue](https://graphite.com/docs/graphite-merge-queue)
- [GitHub Changelog — Stacked pull requests are now in public preview (2026-07-30)](https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview/)
- [InfoQ — GitHub Targets Large Merge Problem with Stacked PRs](https://www.infoq.com/news/2026/04/github-stacked-prs/)
- [git-spice](https://abhinav.github.io/git-spice/)
- [Kodiak — Configuration Reference](https://kodiakhq.com/docs/config-reference)
- [GitHub Docs — About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

**Repo evidence (live checkout, 2026-08-04):**
- `/home/elpresidank/YeeBois/projects/beep-effect5/.github/workflows/check.yml`
- `/home/elpresidank/YeeBois/projects/beep-effect5/.github/actions/setup-monorepo-ci/action.yml`
- `/home/elpresidank/YeeBois/projects/beep-effect5/packages/tooling/tool/cli/src/commands/Yeet/internal/PublishScope.ts`
- `/home/elpresidank/YeeBois/projects/beep-effect5/goals/speed-loop/research/OPPORTUNITIES.md` (#22, #23, #24)
- `/home/elpresidank/YeeBois/projects/beep-effect5/goals/goal-portfolio-driver/research/deep-research-2026-07-14.md`
- `gh api repos/beep-effect/beep-effect/rulesets/10240248`
- `gh run list --workflow=check.yml --limit 12`
- `git log --since="30 days ago" --first-parent main`
