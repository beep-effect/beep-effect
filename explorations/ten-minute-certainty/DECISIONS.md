# Decisions

<!--
Stage 2 log. Dated entries, newest first: Question / Answer / Rationale, with
rejected options named. Pre-seeded on 2026-11-09 with the rulings the operator
gave at the phase 1 closeout; the align round proper opens after phase 2 lands.
-->

## 2026-11-09 — align round 4 (frontier closed)

### D19. Appetite

- **Question.** The synthesis names six candidate goal packets and three PRs ready to open. How much of
  the program runs?
- **Answer.** The whole program, sequenced: graduate all six packets (certainty-scorecard,
  route-soundness-repair, main-verdict-every-commit, heavy-pool-diet, hosted-setup-tax,
  local-proof-under-ten) in the critic's dependency order (measurement first, soundness before any
  narrowing, job-removing before job-adding, main verdicts only with their throughput layout), and open
  the three ready PRs (ROUT-03, TURB-01, MEAS-01) under the first two packets.
- **Rationale.** The levers are independent enough for separate acceptance but share one scorecard and one
  soundness floor. Rejected: first three PRs only (no owner for the rest); scorecard and soundness only
  (defers the compute and local work the audit was asked for).

### D18. Fleet economics

- **Question.** `yeet economics` reads only live local checkouts; 85% of merged branches since 10-25 have
  no surviving attempt journal, T3 lanes and fleet hosts are invisible, rows carry no seat or host.
- **Answer.** Retain journals outside the reaped residue root on retire (PERIL-11), register T3 lanes
  through one `roots.json` row, read fleet hosts over the existing SSH routes read-only, and add optional
  seat and host fields to attempt rows. Raw journals stay out of the public repository.
- **Rationale.** Every local target claim is censored to the workstation's surviving checkouts until this
  lands. Rejected: local retention only (fleet p95 stays unmeasured); leave as is.

### D17. Merged preview

- **Question.** `yeet verify --merged` (merged-preview lease, weight 5) has had no grant since early
  October and left 1,505 quarantined lease files, yet it is the only merged-tree proof.
- **Answer.** Supported, marked dormant. Keep the capability and its admission kind, document the dormancy,
  archive the quarantine residue (PERIL-10), retire nothing.
- **Rationale.** Zero grants does not make a distinct proof dead code; removing it is a capability decision
  the audit does not own. Rejected: retire it.

## 2026-11-09 — align round 3

### D16. Readiness monitors and the shared REST budget

- **Question.** Detached readiness monitors poll every 30 s even in states only a push can change (257
  monitors on 105 PRs since 11-02; several per PR); the shared REST token has already aborted a census.
- **Answer.** State-aware cadence: back off to 2 to 5 minutes in push-blocked and window-only states with
  a wake on a local ref change; one live monitor per PR per checkout, reused on `monitor --detach`; agents
  budget the shared REST token across monitors, the nightly scorecard and corpus capture (PERIL-02,
  PERIL-03, and a budgeting rule in the yeet skill).
- **Rationale.** Notice lag stays bounded by the idle interval; CPU, memory and REST load per monitor
  fall. Rejected: keep 30 s (load unchanged); back off without a budgeting rule (census aborts recur).

### D15. Advisory coverage inside publish (push-first D1/D2 amendment)

- **Question.** The cheapest fix for the original complaint is an advisory ratchet on directly touched
  packages at publish (median 4 s, p90 23 s). Push-first D2 rejects detached advisory proofs.
- **Answer.** Allowed as a bounded in-publish advisory run: direct owners only, the two long poles
  excluded, a hard time cap of about 60 s, Node 22.23.4, the merge-base three-document judge, labelled
  rows, admitted through the scheduler, never a receipt and never blocking the push (COVE-01). Lands only
  after the Node 22 pin (COVE-03) and the bare-coverage self-judge fix (COVE-02).
- **Rationale.** The run is inside publish, not detached, so D2's objection (a detached proof burning
  capacity beside hosted CI) does not apply; it stays advisory because local false reds (contention,
  runtime drift) must not block publishing. Rejected: keep D2 as is (reds keep arriving 15 to 40 min after
  push); make it blocking (both seats called for advisory first). Record the amendment beside push-first
  D1-D12 when the lever lands.

### D14. The R2 cache pause and cache-reuse levers

- **Question.** Does the 2026-11-08 R2 pause (workstation writer and qualification program suspended)
  bind TURB-05, TURB-10 and YEET-05?
- **Answer.** Binding: the three levers land as shadow receipts and attribution only; no reuse decision is
  enforced and no cache-policy re-record is requested until the pause lifts.
- **Rationale.** The six-gate operational finish line stays intact. Rejected: local-only enforcement (the
  pause's reasoning covers reuse trust, not only the remote writer); lifting the pause for this program
  (the 11-08 ruling asked for a later resume).

### D13. time-to-certainty's open seams

- **Question.** `goals/time-to-certainty` is paused but owns ProofLedger C4.2 enforcement (bar READY),
  the WaveOrder re-seed and the gate-order fixtures.
- **Answer.** Re-home them into the local-proof goal this exploration graduates into; time-to-certainty
  stays paused with a pointer, and its rulings 76 to 83 are carried as constraints.
- **Rationale.** One active packet owns the seams and their rulings. Rejected: un-pause time-to-certainty
  (its 200-attempt sample rule is hard to accumulate under push-first); leave parked (the READY bar goes
  unused and the stale 2026-09-03 seed stays in force).

## 2026-11-09 — align round 2

### D12. Review-window re-arm

- **Question.** The 20-minute review window re-arms on every push; it bound the merge in 11 of 30 recent
  merged PRs, and in 5 of 30 the final push was a clean merge of `origin/main` that changed none of the
  PR's own lines.
- **Answer.** A push whose patch-id against the base is unchanged (a clean merge of main) keeps the window
  anchor; a conflict resolution that touches PR lines still re-arms. Window length unchanged (PERIL-09).
- **Rationale.** The window exists to let reviewers see the PR's own changes; a diff-preserving merge adds
  none. This amends the mergeable definition in the Quality Operator laws and needs the amendment carried
  into AGENTS.md with the fixture (clean merge keeps, conflict touching PR lines re-arms). Rejected:
  keep re-arming (measured 12 to 20 min after the last check on bound PRs); shorten the window (assurance loss).

### D11. Heavy / Lint Policy and heavy-pool capacity

- **Question.** Lint Policy runs 12 min on the cap-2 heavy pool and is about 60% of heavy occupancy per
  PR run; moving it to a standard hosted runner is refuted (32 to 36 GiB peaks against 16 GB). Even after
  the diet, peak heavy demand stays near supply.
- **Answer.** Keep it on the heavy pool, run the diet (LINT-01 noResolve, LINT-05 drop the duplicate JSDoc
  chain, LINT-02 knowledge doctor abreast, LINT-04 PR C algorithms), order required heavy lanes first, and
  defer the capacity decision until the nightly scorecard shows the post-diet heavy-queue p95.
- **Rationale.** About 25% less heavy occupancy per run with no spend. Capacity is money and goes to the
  operator only with a measured residual. Rejected: open the capacity decision now (unmeasured); stop Yeet
  waiting on Lint Policy (a policy red would no longer hold merges).

### D10. Property Laws

- **Question.** Property Laws is non-required but Yeet waits on it; one repo-cli sweep (577 to 911 s)
  replays whole files that hold a single property. The file split saves about 4 to 6 runner-min per run;
  sharding costs +6 to +10 runner-min per run for about 3.4 min off the mergeable tail.
- **Answer.** File split first with a census tripwire (TEST-01); shard only if Property Laws p95 stays
  over 10 minutes afterwards. D5 keeps mergeable contexts outside the target, so sharding is a latency
  choice at a compute cost, not a target lever.
- **Rationale.** Rejected: shard now (compute for a tail-only latency gain); stop Yeet waiting on Property
  Laws (a property red would no longer hold merges).

### D9. Canonical corpus replay cadence

- **Question.** Test Integration replays the canonical citation corpus at the real 30 s extractDeadline on
  every PR (16 partitions after #3005). Full replay per PR, or smoke per PR plus full on main or nightly?
- **Answer.** Full replay on every PR. Revisit smoke-plus-main only after D7 brings main verdicts to at
  least 95%.
- **Rationale.** The replay is the only production-deadline witness and caught #3007's first heavy red.
  With a 13% main verdict rate a nightly or main replay would not reliably run. Ruling 5 forbids
  proof-depth reduction presented as efficiency. TEST-03 stays dropped.

## 2026-11-09 — align round 1 (after the ranked plan, research/phase2/PLAN.md)

### D8. The #2999 docs-only widening

- **Question.** #2999 made every file under `goals/<slug>/` docs-only for hosted CI, but executed consumers
  live there (eyecite and law-practice tests read a `goals/` frozen fixture; citation ops `.py`/`.mjs`
  scripts run from `goals/`), and since #2935 the knowledge gates run on no hosted lane for docs-only PRs
  (two confirmed escapes: run 39753415111 and #2909, fixed by #2919). Repair how?
- **Answer.** Targeted narrowing: a generated census of every `goals/` path a test reads, spawns or imports
  keeps those paths on the code route (ROUT-03), plus a small hosted docs-policy job that runs knowledge and
  packet policy on docs/goals-only PRs (ROUT-02). Full rollback to the pre-#2999 regex if the census PR
  cannot land within a week.
- **Rationale.** Closes the confirmed missed-red paths while keeping the docs-only savings on real prose
  PRs. Rejected: full rollback now (loses the savings for every packet PR); keep as is (nothing can be
  admitted on top of an unsound selector).

### D7. A hosted verdict for every main commit

- **Question.** 13% of main commits get a completed verdict; 27 of 60 recent main runs were cancelled by
  hand mid-run (the AGENTS.md runner-freeing law licenses it) and the per-ref concurrency group drops
  pending SHAs. How is a verdict for every commit delivered and paid for?
- **Answer.** Staged: amend AGENTS.md now to forbid cancelling `refs/heads/main` runs (verdict rate to
  about 55 to 65%), land a throughput layout for main pushes, then per-SHA concurrency groups (at least
  95% of non-docs SHAs). Replay merge timestamps against the hosted job ceiling and the heavy pool before
  per-SHA groups land.
- **Rationale.** Per-SHA full profile now would cost about 20 to 36k runner-min/day and put about 62 jobs
  per run against a roughly 60-job ceiling, regressing PR p95 in merge bursts. Coalesced verdicts weaken
  per-commit attribution and would need a separate ruling that they satisfy "every commit"; kept as a
  fallback only if the queue replay shows PR p95 regressing by more than a minute.

### D6. Coverage Regression's status

- **Question.** Heavy / Coverage Regression is not a required context but gates Yeet mergeable; its
  push-to-verdict is p50 29 min (it waits on the slowest Test Unit shard) and its job name is conditional.
- **Answer.** Status quo (non-required, still gating mergeable) plus the fixed-context-name slice (COVE-08)
  now. Revisit making it required once the nightly scorecard shows coverage-verdict p95 under 10 minutes.
- **Rationale.** Required now would put a 29-minute verdict on the required path and block merges on
  inherited coverage reds. Dropping the gate lets floor regressions reach a main that mostly gets no
  verdict. Both seats rejected dropping it.

### D5. What the 10-minute target counts

- **Question.** Per the D2 ruling the target is p95 push-to-every-required-context-green on PR runs. Does
  it count the non-required contexts Yeet waits on for mergeable, and over which heads?
- **Answer.** The 15 ruleset contexts only; code heads reported separately from docs heads; red, held and
  api-partial heads count as not attained; time to Yeet-mergeable (Lint Policy, Property Laws, Coverage
  Regression, Fallow) is reported beside it, never inside it.
- **Rationale.** A green-only p95 can be gamed by turning slow passes red, and pooled docs heads (p95 about
  4 min) flatter the number. Including the mergeable contexts would make Property Laws sharding (+6 to
  +10 runner-min per run) and a heavy-pool capacity decision target-critical before their cheaper
  alternatives have landed. Rejected: include mergeable contexts; green-only pooled heads.

## 2026-11-09 — phase 1 closeout rulings

### D4. Where does the audit live?

- **Question.** Two earlier efficiency plans (lint, test/coverage) lived only in session scratchpads and
  were nearly re-derived from scratch. Where do this audit's outputs live?
- **Answer.** A new exploration packet: this one. Phase 1 becomes `research/phase1/`; phase 2 findings go
  under `research/`; levers graduate to `goals/` packets.
- **Rationale.** In-repo provenance survives sessions and is reviewable. Rejected: attaching to
  `goals/ci-lane-economics/research/` (its charter is the 20-minute job, and the audit's scope is wider);
  scratchpad only (the failure mode this fixes).

### D3. Scheduler direction

- **Question.** The token scheduler is idle 73% of the retained window, only `yeet` takes leases (one lease
  per whole tier), and final-check, package-verify and ad-hoc coverage run unadmitted. Extend it, replace it
  with a checker agent, or leave it?
- **Answer.** Extend the existing `QualityScheduler`: the admission unit becomes a lane or package, weights
  come from measured peaks, and the currently unadmitted work is admitted in small units. No new queue and
  no "checker agent".
- **Rationale.** `goals/time-to-certainty/SPEC.md` rejects a second scheduler or lock ("admission exists and
  was proven; change what runs, not who may run"). The operator's recollection of queue hogging maps to the
  retired August 2026 per-origin lock, not to the token scheduler; "agents killing processes" maps to the
  2026-10-31 pkill incident. Rejected: a checker agent or single scheduling service (a second authority);
  leaving admission alone (the deepest memory dip on 2026-11-09 happened with one admitted lease, so
  unadmitted work is the exposure).

### D2. What "under 10 minutes" measures

- **Question.** Per-job wall, run wall including main's pending time, push to required-context verdict, or
  push to mergeable (which includes the 20-minute review window by rule)? Do non-required gates that gate
  Yeet's mergeable count?
- **Answer.** On pull-request runs: p95 time from push to every REQUIRED context green under 10 minutes,
  reported beside total runner-minutes per run. Plus: every main commit gets a hosted verdict. Local `yeet
  verify` and `yeet publish` under 10 minutes.
- **Rationale.** Latency and compute are separate objectives; the #3007 layout lowered the slowest Unit
  job (1,108 to 650 s) while raising Unit job-minutes (151 to 202) and job count (40 to 56), so a per-job
  target alone cannot prove savings. Main runs serialize and 12 of 15 were cancelled on 2026-11-09, so a
  per-job target would hide that most merged commits get no verdict. Rejected: per-job wall only; push to
  mergeable (would require changing the review window); counting non-required contexts in the gate (their
  status is itself an open question, see the manifest).

### D1. Launch phase 2 now

- **Question.** Launch the per-area audit, run measurement lanes first, or grill the surface first?
- **Answer.** Launch phase 2 now: one Opus 5.5 auditor and one GPT-6 Astra (high) auditor per area, same
  brief, independent; then an adversarial refute pass and a ranked plan with PR-sized slices and an
  admission gate per lever. In-flight PRs #3005, #3007 and #3014 are out of scope and assumed merged.
- **Rationale.** The surface inventory is evidence-backed enough to brief auditors; measurements the
  auditors need are allowed inside the brief (bounded, single-package, read-only otherwise). Rejected:
  measurement lanes first (delays the lever work the operator asked for); grilling the surface first (the
  two independent maps already agree on it).
