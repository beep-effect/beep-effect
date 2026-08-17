# ship-velocity — full backlog specification

Mission: agents ship correct code faster. Shrink "something went wrong" → "the owning agent is
actively fixing it" toward zero, make local green near-guarantee remote green, and stop the PR
queue from blocking while multiple agents work in parallel checkouts.

Evidence base (see `research/`): 79 failed required-job attempts across 35 PRs in 4 days
(Coverage Regression 21, Check 18, Lint Policy 11, Test Integration 7 — top-3 = 63%, all local
blind-spot/shape-divergence classes); 134 merge-main-into-branch commits across 66 branches in
22 days; `goals/INDEX.md` contested by 18 branches. CI infra flakiness is fixed (operator
confirmation 2026-08-13); failures are real signal.

Operator rulings (2026-08-13): all workstreams approved. A-track re-scoped from fail-fast-exit
to accumulate-and-remediate. B-track target raised to full required-context parity. C-track adds
explicit warm capability. E-track adds a stacked-PRs leverage spike. No calendar estimates —
items execute in order until finished.

---

## Workstream A — Backpressure engine

The monitor does not exit on first red; it **accumulates failures and dispatches remediation
immediately** while remaining checks continue. Delivery to a busy or absent agent is solved with
harness hooks and machine-local state, not notifications someone might read.

- **A1 Streaming accumulate + remediate.** Replace the blocking `gh pr checks --watch` step
  (`Yeet/internal/Planner.ts:486-498` plans it without `--fail-fast`; without it a T0 red is
  withheld until the last pending lane — p95 tails 20-30 min) with a `yeet monitor --watch`
  transition stream: typed `YeetWatchEvent` NDJSON (check-failed/check-passed/comment-opened/
  thread-opened/mergeability-changed/head-changed...), conditional REST/ETag polling, one line
  per state transition. Each `check-failed` event immediately: (1) appends a failure capsule to
  the owning checkout's inbox, (2) triggers the remediation dispatch policy — first red for a
  head starts a repair session (in the owning checkout, or a spun-up worktree when the owner is
  busy); subsequent reds for the same head append to that session's queue (dedup by
  headSha+lane). One accumulated fix commit per wave, not one push per lane. A new push
  supersedes the prior wave. Acceptance: synthetic first-red reaches the inbox in <15s p95;
  three reds on one head produce one repair session with three queued capsules.
- **A2 Hook-mutex + ACK inbox** (ADHD survivor 1; `research/adhd-ideation.md` §deepen1). Writers
  (watch, local lane runner, collision detector) append typed NDJSON rows to
  `<checkout>/.beep/inbox/`; hot path is stat+read of local git-ignored files only. Claude
  PreToolUse denies the next tool on unacked P0 rows with the capsule as the deny reason;
  SessionStart/UserPromptSubmit splice unread rows as "fix this now" and consume them; Codex
  adapter injects at next tool boundary; Grok tails via Monitor. ACK = explicit receipt file
  (fix SHA | wontfix+reason | thread URL). Severity-gated: P0 (required red, sibling collision)
  denies; P1 (review thread) injects; P2 (base drift) SessionStart-only. The P0 denial is a
  one-shot interruption, not a standing wall: the first denied boundary flips the session into
  failure-scoped incident mode in which diagnostic, edit, test, and repair tools are all
  permitted (the capsule keeps being re-presented as context); denial re-arms only for attempts
  to start unrelated new work while the row is unacked. ACK (or waive) exits incident mode —
  the mutex can never deadlock the fix it exists to cause.
- **A3 Can't-leave-the-scene** (ADHD survivor 2; `research/adhd-ideation.md` §deepen2). Stop hook
  refuses session end while the session's published PR has unacked failures (refusal carries the
  capsule + fix command). Yeet poison-pill: after a local shard fails or a required check goes
  red, starting unrelated new work in that checkout refuses — but repair-scoped commit/publish
  addressing the failure is always permitted (it is the canonical yeet path to clearing a hosted
  red) and transfers the pill to the resulting head. The pill clears when the failing local
  shard re-runs green, when the repaired head's hosted check reports green, or via an
  attributed, expiring waive `(shard, reason, actor, expiry)`. Scoped to
  the 16 required contexts + named local shards only. SessionStart inheritance: a fresh session
  in a poisoned checkout receives the capsule immediately — spawning a new session is not an
  escape hatch.
- **A4 Dead-owner takeover + warm fixer** (ADHD survivor 3; `research/adhd-ideation.md` §deepen3).
  Publish writes a PR lease (session id, pid+starttime, freshness); hooks refresh it. A machine
  watcher treats "stale freshness AND unacked failure AND pid dead/frozen" as dead-owner:
  CAS-steals the lease, prefers headless resume of the owner, else spawns an incident-mode fixer
  on a fresh worktree with the accumulated capsules as first prompt. Zombie fence: PreToolUse
  denies mutating tools when the session no longer holds the lease. Load-bearing risk =
  false-dead detection (long compile, YubiKey wait): deadline must be generous and the CAS+fence
  correct before enabling auto-steal.
- **A5 Package-scoped gates for sub-agents.** Packages already carry the full scoped battery
  (`audit` = build+check+test+integration+lint; `beep:check:tests` typechecks test files).
  (1) Skills/agent instructions: any sub-agent that touches a package runs that package's
  `audit` (or the targeted subset) immediately after its edit, before handing back — failures
  land in the same inbox as A2 rows. (2) Fill script gaps (scoped policy-lint/docgen probes
  where cheap). (3) `create-package` templates emit the complete script set for every new
  package. Acceptance: a sub-agent introducing a type error in one package sees the failure in
  its own turn, not at root verify.
- **A6 Truthful merge-ready v2.** Readiness requires PR OPEN, not draft, current-head closeout,
  live required checks green, zero unresolved threads, `mergeable`, acceptable mergeStateStatus,
  review decision; required-vs-optional check split so an optional red cannot block. Each
  criterion flip is a watch event. (`research/c2-yeet-monitor-backpressure.md` §5.)
- **A7 Monitor hardening.** `yeet reply` must exit nonzero when any reply/resolve fails
  (today per-draft failures exit 0); comment cursors persist (no missed comment at startup);
  a transient comment-poll error must not cancel check watching; bounded post-push
  check-registration backoff (zero-checks-yet ≠ terminal-empty).

## Workstream B — Local green ⇒ remote green (full parity)

Target: local verify green ⇒ all 16 required contexts green, first push. Exclusions are
explicit: Greptile, Vercel, and PR Size are non-required; the Security context's
dependency-review sub-gate is `required: true, replay: "none"` — hosted-only by design (GitHub
dependency graph + license policy), so it sits outside the hard local-guarantee metric and is
covered instead by a cheap local predictor (dependency-diff shape + license screen of lockfile
changes, advisory only). Infra flakiness is fixed, so every remaining red is a parity defect to
be closed, not tolerated.

- **B1 Same argv.** Yeet lanes invoke `beep ci lane <id>` (Check, Test Unit/Integration, Lint,
  Lint Policy) instead of cousin root commands. (`research/c3-local-remote-parity.md` §4.)
- **B2 Coverage locally.** `beep ci lane coverage --affected --base origin/main` in the full
  proof, ratchet baseline pinned from `origin/main` (never the branch's own copy). #698 (PR
  scoping + weighted shards) landed 2026-08-13 as `286a2be63b` — build on it. Skip for
  `goals/**`-only diffs.
- **B3 Missing cheap lanes.** Codegen Drift, PR-range commitlint (`--from <base-sha>`),
  path-gated Desktop IPC, base-pinned gitleaks config/ignore + pinned container digest.
- **B4 `--ci-parity` pre-publish tier.** Materialize the existing merged preview
  (`MergedPreview.ts`), frozen install, run `beep ci local --affected` there under PR-posture
  env (blank DB secrets → Testcontainers, `TURBO_CACHE=local:rw`, exact per-lane concurrency,
  pinned Bun/Node). Normal publish runs it; `--merged` auto-escalates on (behind && policy-
  surface overlap) instead of defaulting.
- **B5 Per-lane proof reuse.** Persisted lane `commandHash` values become reusable proofs keyed
  on (command, inputs, merged tree SHA, base SHA, env profile); shadow mode until parity
  evidence, then active. Kills the 1,022s-mean full-proof rerun after small review fixes.
- **B6 Test-file typecheck preflight.** Touched-package src+test tsgo entrypoint in the cheap
  preflight (closes "package green, hosted Check red on test files").
- **B7 Docgen decision parity.** Move the workflow's none/affected/full predicate into the CLI
  and call the exact resulting lane locally; delete the YAML duplicate.
- **B8 Parity ledger.** Every local↔remote divergence that still occurs is recorded as a defect
  with the lane, cause class, and fix — the ledger trending to zero is the workstream's proof.

## Workstream C — Turbo cache: readers, warmth, proof

- **C1 Local read path.** Per-checkout env quad (`TURBO_API`, read-only `TURBO_TOKEN` via
  1Password ref, `TURBO_TEAM`, `TURBO_CACHE=local:rw,remote:r`); CLI honors complete remote-read
  config instead of force-injecting `--cache=local:rw` (`Quality/Tasks.ts:481-489`); op-run env
  for all Turbo steps; fail closed to local-only. Template applied to every `../beep-effect*`
  checkout. `.env.example` + operator doc updated.
- **C2 PR remote reads.** Reopen the #696/CSF-014 decision explicitly: same-repo PRs get
  `remote:r` (the Lambda authorizer was built for untrusted reads; fork PRs stay local-only) —
  or a funded Actions-cache fallback seed if the security ruling stands. Operator sign-off
  recorded here before the workflow change.
- **C3 Warm capability.** (1) Verify main-push warming actually PUTs and later HITs (it runs
  full graphs with `remote:rw` on every merge). (2) `beep cache warm`: operator-invoked
  recovery/backfill — clean exact `origin/main`, pinned toolchain, ephemeral env, `--summarize`
  receipts; plus a `cache-warm` workflow for post-purge/quiet-period recovery (30-day lifecycle).
  No standing workstation write credential.
- **C4 Correctness before key-tuning.** Add `vitest.setup.ts` to test-family inputs (stale-hit
  hazard today); cold/warm restoration probes; keep lockfile-triggered `TURBO_FORCE`.
- **C5 Hit-rate proof.** Ingest `.turbo/runs/*.json` + Lambda logs into a small dashboard:
  eligible-remote-hit rate, forced/disabled excluded, p50/p95 lane wall time by cache mode.
  Then de-fragment keys (stop hashing per-clone `.env*` globally, localize story globs) with
  before/after probes. Prior audit: 24% hits, 93.6% of misses in all-miss (cold/forced) groups.
- **C6 op-run reference resolvability.** C1 leaves the degrade-to-local-only contract unmet for
  one case: `op run` fails hard when any `op://` reference in scope cannot be resolved, while
  `canUseLocalEnv` probes only `op whoami` — session alive, references unverified. A stale
  reference anywhere in `.env` therefore fails the lane instead of degrading it. Pre-existing
  (the root build step has carried `useLocalEnv` all along), but C1 widens it from one step to
  every cacheable Turbo step in an `op://`-configured checkout. Fix: probe reference
  resolvability before wrapping, cache the verdict per run (not per step — the probe is a
  subprocess), and fall back to an unwrapped local-only spawn on failure. Deferred out of C1
  deliberately: it changes shared `canUseLocalEnv` semantics that B1 also touches, and its
  caching deserves its own review. Cannot affect a checkout whose credentials are literal.

## Workstream D — Concurrency: install the gate the profile describes

- **D1 Machine-wide weighted admission.** `${XDG_RUNTIME_DIR}/beep/admit/` leases (schema:
  pid + /proc starttime, kind, weightTokens, measured hotPaths); 5 GiB tokens, capacity
  `min(10, floor((MemAvailable−10)/5))`, hard floor 15 GiB free. Weights are in the same token
  units as capacity (1 token ≈ 5 GiB): review-fix 1 (×3), full-proof 3 (≈16 GiB),
  merged-preview 5 (≈24 GiB), publish 1 — at 8-token capacity two full proofs fit, two
  merged-previews correctly don't. Waiters queue with visible progress; publish
  priority with 2-minute aging; per-checkout quality-lock retained. Evidence: post-#668 Check
  peaks 11.0 GiB c1 / 15.6 GiB c2; Lint nested shards 30-45 GiB — the current true peak.
- **D2 Adaptive lane concurrency.** Solo Check c3, contended c2 (the only measured-safe pair);
  SQL integration stays c1; lint inner shards unchanged pending remeasure; never blanket c8.
- **D3 Watermarks, heartbeats, scoped reaping.** MemAvailable/PSI admission checks; heartbeat
  leases; reap only on pid-dead or starttime mismatch; process-group TERM→KILL, never pkill;
  per-lane peak-RSS into verdict artifacts before any cap raise.

## Workstream E — Hot files, queue, and PR mechanics

- **E1 Publish refuses hot derived paths.** `yeet publish` regenerates `goals/INDEX.md` from
  manifests at the last second and refuses hand-staged copies; standards chore-PR policy
  enforced at publish time.
- **E2 INDEX end-state.** Default: untrack (`.gitignore` + generate on read; repair/SessionStart
  write it; CI proves generation succeeds). Fallback if GitHub browsability is ruled
  non-negotiable: keep tracked, regenerate only in the synthetic merged tree. Decision recorded
  before the deletion PR.
- **E3 Derived-only auto-heal.** Conflicts confined to pure projections regenerate instead of
  surfacing: INDEX, `fallow.boundaries.generated.jsonc`, tsconfig-sync family, desktop
  `Migrations.gen.ts`. Never baselines (regeneration = accepting debt), never
  `schema-first.inventory.jsonc`, allowlists, `bun.lock`, ATLAS, source. `.gitattributes`
  `merge=regenerate` as fail-loud tripwire; driver installed by bootstrap, verified in CI.
- **E4 ATLAS generator.** Implement packet-system-redesign D6 (generate wholesale from
  exploration manifests), then apply the E2 rule to it. Until then ATLAS edits are serialized
  (single-owner pass), not merge-driven.
- **E5 Contention families in admission.** goal-portfolio, exploration-atlas,
  workspace-topology (`package.json`/`bun.lock`/root tsconfigs), quality-policy
  (`standards/*`), quality-cli (`Quality/Tasks.ts`+test); reuse fleet-mirror
  `buildContestedIndex`; serialize only intersecting publishes, FIFO with visible waits.
- **E6 Path-filtered required checks.** `goals/**`-only (later `explorations/**`-only) PRs skip
  the heavy suite via the existing skip-success pattern so required contexts still report.
  Packet flips stop costing 17 checks and a Coverage tail.
- **E7 Stacked PRs spike.** Evaluate GitHub's stacked pull requests (`gh stack` CLI extension):
  merge/retarget mechanics, required-check behavior per layer, whether dependent work (code PR +
  packet-docs PR, or chained slices) can replace merge-main-into-branch churn; if viable,
  integrate as `yeet publish --stack`. Deliverable: a decision record with a live trial on a
  two-layer stack.
- **E8 Merge queue re-evaluation gate.** Not now: no `merge_group` event in check.yml (9
  event_name branches), required-context drift 16-vs-17, ~39 EC2 job-min/suite per entry, flip
  condition (main full-gauntlet ≥80%/14d) measured at 19%. If merge-time drift persists after
  B4: flip `strict_required_status_checks_policy` first. Revisit queue (batch-2, merge-group-
  compatible) only against the recorded flip condition.

## Explicitly rejected (with reasons, from research)

- Webhook tunnel as primary transport — ~20s gain over conditional polling on one workstation,
  new public ingress/secret/failure domain. Trigger to revisit: polling telemetry shows rate
  pressure. (`research/g2-design-ideas.md` §A.)
- cgroup-freezing non-owner agents — breaks MCP servers/timeouts, deadlock risk.
- Global mutex relaxation via blanket turbo c8 — memory-infeasible (`research/c5`).
- `merge=union` for any current hotspot — none qualify (`research/c6` §3).
- Fleet-watchdog as a GitHub required check — local liveness must not gate merges.
- Claim registry on derived files — fleet-mirror D1 stands; delete the file instead.

## Metrics (packet-level proof)

1. `github_observed_at → agent_actively_fixing_at` p50/p95 (checks, threads), from watch events
   + inbox ACK timestamps. Target: p95 < 60s attached, < 5 min unattached (via takeover).
2. Required-check failures per merged PR and % failures with a local parity lane (baselines
   frozen in `research/metrics-baseline.md`: 73 required-lane failures / 66 merged PRs ≈ 1.11;
   top-3 lanes = 68.5% catchable-but-uncaught). Target: parity ledger → 0 recurring.
3. Merge-main-into-branch commits per week (baseline ~42/wk) and hot-file conflict incidents.
4. Concurrent verify throughput + queue-wait p95 under D1; zero OOM incidents.
5. Remote-cache eligible hit rate local + CI; verify wall-time p50 cold/warm.
