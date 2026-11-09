# Decisions

<!--
Stage 2 log. Dated entries, newest first: Question / Answer / Rationale, with
rejected options named. Pre-seeded on 2026-11-09 with the rulings the operator
gave at the phase 1 closeout; the align round proper opens after phase 2 lands.
-->

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
