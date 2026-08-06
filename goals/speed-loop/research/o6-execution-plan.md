# Opportunity 24 — owned-runners execution plan (2026-08-06)

Synthesis of workflow `wf_049a195e-c05` (6 agents: 3 grounding, 2 adversarial
challenges, 1 synthesizer), run the day the operator set owned AWS runners as
the next priority. This file turns `o6-owned-runners.md` into an ordered,
executable plan — and records the premise corrections the challenges forced.
It does NOT amend the grill record; the sequencing decision it recommends
reversing (grill #21, workstation-first) stays as written until the operator
rules on it.

## 1. Premise correction (measured live, ledger #90)

The motivating claim — "most PRs are blocked because no runners are
available" — is falsified by attempt-filtered measurement:

- `run_started_at` is rewritten on re-dispatch. Every "18-21 minute queue"
  data point from 2026-08-06 was a `run_attempt` 2-3 run during the GitHub
  Actions incident; every attempt-1 run showed 0s. The metric measured
  time-until-rerun, not runner wait.
- Job-level pickup on Blacksmith during the same incident: 19-67 seconds.
- The day's actual blockage ("Failed to resolve action download info", 5xx
  in "Set up job") is a call FROM the runner TO GitHub's control plane. A
  self-hosted runner long-polls the same API and downloads the same action
  tarballs — owned compute cannot prevent this class, and adds a JIT
  registration dependency on the same control plane.

What the steady-state data says blocks PRs instead (retained window
2026-08-01 → 2026-08-04 plus live 2026-08-06): 47% first-attempt PR run
success; 11 of 13 failed PR runs on 2026-08-06 failed in lane BODIES
(Lint Policy 7×/hour across six branches; Coverage Regression 22× in
window); 12/12 main push runs red on 2026-08-06. None of these move with
runner ownership. The one genuine capacity-shaped failure: the `Build` job
dying with runner-loss annotations 5/5 on main — fixable today by moving it
from the 4vcpu to the 8vcpu label (`check.yml`), no fleet required.

So the project's justification is compute COST and per-lane memory
right-sizing (o6 §2's economics, pending invoice verification), not queue
capacity and not outage resilience. The plan below is built on that honest
footing.

## 2. Adversarial verdicts

- **Security challenge: not-safe-as-planned** — for o6 as written AND for
  the ledger's 2026-08-04 risk downgrade (OPPORTUNITIES.md "Risk model
  (corrected 2026-08-04...)"). The downgrade's two premises fail against
  live state: the repo counts 472 contributors (inherited via better-auth
  history) plus 13 forks — not zero — and the live outside-collaborator
  approval setting is weaker than the one the downgrade assumes is on.
  Structural finding: under `pull_request`, GitHub executes the PR's own
  copy of the workflow YAML, so `runs-on`, `if:` trust gates, and job
  `permissions:` are PR-editable — trust routing cannot live in YAML at
  all. It must live in an out-of-repo scale-from-zero controller that
  independently verifies head-repo/actor before launching a VM. (Flagged
  as the design's one unverified premise: confirm experimentally before
  building on it.) Also established: repo/workflow-restricted runner
  groups are not available on the org's current GitHub plan (verified
  indirectly; re-check with `admin:org` scope), and the already-provisioned
  worker instance profile contradicts o6's own no-credentials gate — the
  worker design must drop the instance profile and use pre-signed URLs for
  cache access.
- **Value challenge: does not address the stated motivation** (see §1).
  Its cheaper-alternatives list is §5.

## 3. Phases

Each phase ships standalone value or a recorded decision. Phases 1-2 are
worth landing even if the fleet is never built.

1. **Workflow/settings hardening** (one PR, one revert). Move
   `pull-requests: write` off workflow scope in `check.yml` to the two jobs
   that use it (pr-size, security); explicit `contents: read` on the verify
   matrix and the other inheriting jobs; `persist-credentials: false` on
   checkouts that lack it; SHA-pin all third-party actions; align
   `storybook.yml`'s Turbo cache env with `check.yml`'s PR-event cache
   policy (PR jobs get local-only cache); guard the disk-cleanup steps so
   they can only ever run on ephemeral managed images; flip the repo
   settings for action allow-listing, SHA-pin enforcement, and
   outside-collaborator approval; add a `beep ci lint-workflows` gate so
   none of it regresses. Risk: SHA-pin misses can break required lanes —
   land as one PR and drill the revert first.
2. **Measurement baseline** (no compute change). Operator obtains the
   Blacksmith invoice (o6's cost gate is unscoreable without it; the
   ledger's ">$50/week" is unsourced — store the invoice under the private
   surface, never the public packet). Lane-timings collector gains
   `run_attempt`, attempt-1 pickup latency (filter applied in the
   collector — ledger #90), per-lane peak RSS (n≥10 per lane), setup and
   install seconds, and a managed-runner infra-success rate.
3. **Controller, image, trust boundary** (infrastructure only, zero PR
   code touches it). Out-of-repo scale-from-zero controller; JIT ephemeral
   one-job-one-VM registration; no instance profile on workers; red-team
   acceptance suite that must ALL fail from a guest: IMDS reachability,
   S3 cache write, VPC east-west/LAN/tailnet reach, teardown longer than
   5 minutes.
4. **Shadow job**. Non-required `Coverage Regression (owned pilot)` runs
   the exact Coverage command and SHA in parallel with the untouched
   required Blacksmith job; same-repo branches only; ≥20 paired same-SHA
   samples, medians and p95s; any security-gate failure aborts the project
   permanently (o6's own abort clause). Coverage is the right first lane:
   largest 8-vCPU demand row, ~11.5-minute p50, deliberately uncached body.
5. **Cutover** of the trusted Coverage row only, required-context NAME
   unchanged — the ruleset has no bypass actors, so a renamed context
   orphans permanently. Managed fallback stays one line away; a deliberate
   kill-switch drill is part of acceptance; next invoice must move within
   20% of the phase-4 projection or expansion stops.
6. **Workstation runner: DEFERRED, decision required.** Grill #21 routes
   #24 workstation-first on the strength of the 2026-08-04 downgrade; the
   security challenge invalidated the downgrade's premises (§2). The
   recommendation is to re-sequence EC2-first and amend the downgrade with
   the live-verified facts — but that reverses a recorded grill decision,
   so it is an operator call. Until then the two documents conflict and
   this file is the pointer that says so.

Blocking operator action for any pilot: mint the runner-registration
credential recorded as pending in `runner-secrets.md` — the sole missing
provisioned piece — noting §2's amendment that workers must NOT carry the
provisioned instance profile.

## 4. Honest "does not solve" list

- GitHub control-plane incidents (today's class) — same dependency, plus a
  new one.
- Queue latency — none exists at attempt-1 granularity (ledger #90).
- The multi-minute pickup delays that DO occur on main pushes — those are
  the repo's own concurrency serialization choice in `check.yml`, a policy
  decision, not capacity.
- Repo-code gate reds — identical command, identical tree, identical exit
  code on any hardware; this is the largest blocker class by far.
- Local-vs-hosted parity gaps (#46 lanes, #84 trees) and the
  merge-readiness miscount over non-required external checks.
- User-visible latency in any meaningful amount — lanes run concurrently,
  so erasing the setup floor improves makespan by under a minute (o6 says
  this itself).

## 5. Cheaper interventions that hit the measured pain first

All cheaper than any fleet phase; the synthesis names starving these as a
top project risk:

- Vendor or SHA-pin the five remote actions the CI depends on — the ONLY
  class that actually blocked PRs on 2026-08-06.
- One label: `Build` lane 4vcpu → 8vcpu (kills the 5/5 runner-loss deaths
  on main).
- Decide the main-push concurrency policy explicitly (source of the real
  420-666s pickup delays; currently an implicit serialization).
- Fix the steady-state gate reds (Lint Policy, Coverage Regression) — the
  only lever on the 47% first-attempt success rate.
- Pin the fast-check seed on Test Unit the way the Property lane already
  does.
- Cache `node_modules` in `setup-monorepo-ci` — most of the pre-baked-AMI
  win with no AMI.
- FlakeQuarantine fingerprint for whole-runner death: `conclusion:
  failure` with every remaining step `null`, detectable from the jobs API
  without log download (pairs with ledger #89's setup-5xx fingerprint).
- `beep ci required-checks`: print the live ruleset contexts and diff
  against workflow job names and yeet's merge-ready arithmetic.

## 6. Risks carried forward (top of the synthesis list)

- The pull_request-YAML trust premise is unverified experimentally.
- Every dollar figure is unverified, including the pass gate; the demand
  curve is a 2.9-day burst window.
- Likeliest phase-4 outcome is "security clean, cost ambiguous" — the
  pre-registered abort only works if honored without renegotiation.
- The cheap fixes in §5 getting starved by the fleet project.

Full workflow output (agent-level detail, all citations):
session scratchpad `owned-runners-plan-distilled.md` and task output
`w8ae2bsop.output`; journal at `wf_049a195e-c05/journal.jsonl`.
