# ship-velocity — execution plan

Order is by cycles-returned-per-unit-of-work. Items execute until finished; no calendar
estimates. Items normally land as focused PRs through Yeet; the operator-authorized 2026-08-27
closeout bundles the remaining P2-P5 backlog into one PR. Packet phase flips ride the same PR as
their implementation truth.

## P0 — Ratify and baseline — COMPLETE 2026-08-17

- ~~Land this packet; record operator decisions: C2 (PR remote reads / CSF-014), E2 (INDEX
  end-state), E6 (path-filtered required checks)~~ — packet landed 2026-08-13 as #709. The three
  decision notes are deliberately deferred to their implementation PRs (C2 in P4, E2/E6 in P5),
  and the manifest stop condition now names all three explicitly (E2 was missing from it until
  the #747 review wave caught the gap), so none of those changes can proceed without its recorded
  note. Nothing further is owed by P0.
- ~~Baseline metrics snapshot (SPEC §Metrics) from existing artifacts: c1-raw-failures.txt,
  merge-commit counts, current monitor latency budget~~ — done 2026-08-14:
  `research/metrics-baseline.md` freezes all five metric baselines + re-measurement protocol.
- ~~Land the two in-flight branches that already implement backlog items~~ — done: #698
  (coverage scoping, `286a2be63b`) and #702 (runners-bake, `ddc8a873b1`) merged 2026-08-13/14.
  Verify closure only; do not restart either.

## P1 — Instant wins — COMPLETE 2026-08-17

Shipped as four PRs: #737 (B1), #736 (E1), #738 (A7), #743 (C1). Three of the four needed a
review-fix wave; the receipts those waves produced are in `research/OPPORTUNITIES.md` and drove
the C5 metric correction and the new C7 item below.

- ~~B1 same-argv lanes (`beep ci lane` from yeet)~~ — done 2026-08-16: the pre-push collector's
  Lint, Lint Policy, Check, Test Unit, and Test Integration lanes dispatch the hosted
  `beep ci lane` argv from the shared builder in `Ci/CiLane.ts`, so local and hosted cannot drift.
  Env posture stays local (B4 owns PR-posture env).
- ~~E1 publish refuses hand-staged INDEX + regenerates from manifests.~~ Done 2026-08-16
  (`PortfolioIndexGuard.ts`; renders the projection after the staged-only stash and refuses a
  hand-staged copy that disagrees). P5 E2 subsequently made the projection local and ignored, so
  publish now refuses every staged copy and never stages the generated file.
- ~~C1 local remote-cache read path + checkout env template.~~ Done 2026-08-16 (schema-first
  `resolveTurboCachePlan` honors a complete remote-read quad and fails closed otherwise;
  `op run` env for reference-backed Turbo steps; `scripts/enable-turbo-remote-reads.sh` +
  `standards/turbo-remote-cache.md` + `.env.example`).
- ~~A7 monitor hardening quick items (`yeet reply` exit code, cursor persistence, registration
  backoff).~~ Done 2026-08-16 (reply exits non-zero on any `failed` outcome; comment cursors
  persist through a versioned `monitor-comments.json`; comment-poll failures degrade without
  cancelling the check watch; bounded post-push check-registration backoff. Correction
  2026-08-17: the lane success-exit hang was **not** closed by the `run_lane` process-group reap
  in #718 — it recurred with #718 active (Lint Policy job 95354812245); see the ledger receipt
  and the capture-seam fix in #748.)

## P2 — Backpressure engine — COMPLETE 2026-08-27

- ~~A1 `yeet monitor --watch` transition stream + failure capsules + remediation dispatch.~~
  Done 2026-08-17 across three PRs: #749 (`gh pr checks --watch --fail-fast` in the publish
  monitor), #751 (typed `yeet-watch/v1` NDJSON transition stream), and the capsule/dispatch PR
  (failure capsules derived from the failing check's own record into
  `.beep/inbox/failures.ndjson` — `yeet-inbox/v1`, the row shape A2's adapters consume — plus
  the `yeet-dispatch/v1` wave record: first red for a head opens the repair session, later reds
  queue with headSha+lane dedup, re-run reds drop as duplicates, a push supersedes the wave).
  Acceptance holds: capsules land on the observing poll tick (≤ one 10s interval, inside the
  15s p95), and three reds on one head produce one session record with three queued capsules.
  Live session attach/spawn is deliberately not part of A1: attaching consumes the inbox via
  A2's hook adapters, and spawn-when-owner-busy needs A4's leases.
- ~~A2 hook-mutex + ACK inbox (Claude deny / Codex inject / Grok tail adapters).~~ Complete:
  typed inbox/ACK porcelain is consumed by the shared hook adapter, Claude and Codex hooks, and
  the Grok tail command; P0 one-shot incident mode permits repair work and re-arms for unrelated
  work until an attributed ACK or waive exists.
- ~~A3 can't-leave-the-scene (Stop-hook veto + yeet poison-pill + waives).~~ Complete: Stop and
  quality/publish boundaries enforce the poison pill while repair-scoped work stays available;
  expiring attributed waives and green reruns clear it.
- ~~A5 package-scoped gates (skill instructions + script gap fill + create-package templates).~~
  Complete: package audits report failures into the shared inbox and generated packages carry the
  full scoped scripts.
- ~~A6 merge-ready v2.~~ Complete: readiness is current-head, live-required-check, review-thread,
  review-decision, draft/open, mergeability, and merge-state aware; optional reds do not block.

## P3 — Full parity — COMPLETE 2026-08-27

- B9 deterministic coverage runtime — done 2026-08-24: `coverageEnvironment()` spreads the
  pull-request Turbo posture and `readTurboCacheEnvironment` is pure; prerequisite of B2/B4
  (a local coverage run that mints floors hosted cannot reach is worse than none).
- B10 dependents in pull-request coverage scope — done 2026-08-24: the planner follows
  workspace-internal dependency edges to coverage-bearing dependents (test-only changes stay
  scoped) and wide selections run through the weighted shard executor; closes the
  "green PR, red main" inheritance class (#780 → #783).
- B11 scoped remediation + row-only baseline scoping — done 2026-08-25: the ratchet prints
  the exact `--filter … --write-baseline` command for the regressed packages, a baseline edit
  that only touches package rows measures those packages instead of the full workspace, and
  `standards/**/*.md` is coverage-inert.
- ~~B2 coverage in local proof.~~ The full local proof runs the affected, origin/main-pinned
  coverage lane; goals-only changes remain inert.
- ~~B3 missing cheap lanes; B7 docgen predicate into CLI.~~ Codegen Drift, range commitlint,
  Desktop IPC, base-pinned gitleaks, and the shared none/affected/full docgen decision now run
  through the same CLI plans locally and remotely.
- ~~B4 `--ci-parity` merged-tree pre-publish tier + PR-posture env.~~ Normal publish exercises
  affected lanes in the merged preview under the hosted pull-request posture.
- ~~B6 test-file typecheck preflight.~~ Touched package tests join the cheap preflight.
- ~~B8 parity ledger live; B5 proof reuse in shadow → active.~~ The versioned parity ledger is
  live; current-head lane proof reuse graduated through shadow comparison and now fails closed on
  any key/input/environment mismatch.

## P4 — Concurrency + cache proof — COMPLETE 2026-08-27

- ~~D1 weighted admission leases~~ — landed in PR #870 on 2026-08-27. Its
  `internal/repo-run/QualityScheduler.{schemas.,}ts` implementation is the single machine-wide
  admission authority; this closeout extends its proof orchestration instead of retaining the
  superseded parallel `Yeet/internal/Admission.ts` implementation. Full proofs containing the
  merged-preview parity lane reserve the five-token merged-preview weight, and verdict receipts
  record per-step peak RSS.
- ~~D2 adaptive concurrency; D3 hardening + RSS telemetry.~~ Check uses the measured-safe
  workstation profile while the scheduler controls heavyweight proof concurrency. Scheduler
  leases retain starttime-fenced reaping, heartbeat, memory-floor, and quarantine behavior from
  PR #870; Yeet adds per-step peak-RSS receipts for later cap decisions.
- ~~A4 dead-owner takeover (needs D1 leases).~~ Superseded by the operator's PR #921 on
  2026-08-30. The earlier watcher, 240-second stale threshold, and 270-second detection bound are
  retained as historical implementation evidence. Current `main` intentionally removes the
  published-PR lease, watcher, automatic takeover, and mutation fence while retaining P0 inbox
  context and the hard Stop/SubagentStop gate. A dead harness can no longer strand a checkout
  behind an ownership lease; no automatic under-five-minute fixer claim remains.
- ~~C2 PR remote reads (post decision).~~ The recorded decision permits read-only cache access on
  same-repository pull requests; forks stay local-only.
- ~~C3 warm capability; C4 correctness inputs; C5 hit-rate dashboard + key de-fragmentation; C6
  reference resolvability.~~ Exact-main warming, a recovery workflow, cold/warm probes,
  correctness inputs, first-touch dashboard accounting, key de-fragmentation, and a cached
  once-per-process 1Password-reference probe are implemented. See `research/cache-proof.md`.

## P5 — Hot-file endgame + close — COMPLETE 2026-09-02

- ~~E2 INDEX end-state; E3 derived-only auto-heal + merge-driver tripwires; E4 ATLAS generator;
  E5 contention families.~~ INDEX is an ignored manifest projection. ATLAS is an ignored D3
  projection: event-fold authority after stream opt-in, explicit manifest-adoption authority before
  it, with the same projector owning README Stage/Status regions. Projection checks fail on
  underivable state, README drift, and extra Atlas content. Merge drivers remain allowlisted to
  tracked derived paths; staged ignored projections and non-derived policy files fail closed, and
  only intersecting contention families serialize publication.
- ~~E6 path-filtered required checks.~~ Goals-only pull requests register the same required
  contexts but safely skip heavyweight implementation work; the operator decision and security
  boundaries are pinned in code and tests.
- ~~E7 stacked-PRs spike + decision record.~~ Live draft PRs #859 and #860 proved GitHub's stack
  graph and independent required-check registration. The trial was closed and cleaned up; stack
  publication remains a documented manual preview until Yeet has multi-head proof/lease semantics.
  See `research/stacked-pr-trial.md`.
- ~~E8 merge-queue re-evaluation against recorded flip condition.~~ The last-14-day terminal
  non-cancelled main-push success rate is 65.4%, below the 80% gate, and workflows have no
  `merge_group` coverage. Queue stays off; strict required checks stay false. See
  `research/merge-queue-evaluation.md`.
- ~~Metrics observation and packet closeout.~~ Complete 2026-09-02. The operator-authorized event
  volume, backpressure, parity, concurrency, and hot-file receipts remain satisfied. Digest-only
  evidence retracted the cache mirror-drift hypothesis: the checkouts held a stale February
  reference while the infra-vault item still matched SSM. The helper's explicit replacement mode
  repaired 27 ignored quads. In the six-root frozen sample, the main checkout and four siblings
  observed eight first-touch remote hits each, one GET-200 root was authenticated-cold on a
  different revision and lockfile, and zero roots were `auth-failed`. One remote-hit root used a
  separately labelled cache-only canary because an unrelated reference failed its exact all-file
  wrapper before HTTP. PR #937 remains an incomplete historical follow-up. The
  successor final-evidence PR on branch goals/ship-velocity-cache-auth-evidence carries this
  receipt, the lifecycle flip, and the closeout reflection and must reach Yeet `merge-ready: yes`
  before merge; see `research/metrics-closeout.md` and `research/cache-proof.md`.
