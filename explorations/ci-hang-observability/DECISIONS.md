# Decisions

<!-- Align-stage grilling log. Dated Question / Answer / Rationale entries,
rejected options included. -->

## 2026-08-23 — Round 1 (fix posture, observability scope, failure policy)

### Q: Which fix posture ships first?

- **Answer:** Watchdog + Bun 1.4.0 canary together. Ship the per-step
  watchdog/timeout in the CLI now; run Bun 1.4.0 on a shadow/canary lane in
  parallel; the `bun run`-wrapper drop for policy steps rides along as a
  cheap third change.
- **Rationale:** the lane must survive a spinning child regardless of
  whether bun#27766 survives Bun 1.4 — the watchdog bounds the class, the
  bump and wrapper drop shrink the trigger surface, and each recurrence
  under the watchdog yields forensics instead of a 50-minute hang.
- **Rejected:** watchdog-only (leaves the known-fixed 1.4 spin family in
  place longer than necessary); bump-first (leaves the class unbounded if
  #27766 survives 1.4, which its canary-era repro suggests); wrapper-drop
  first (highest information-per-risk as an experiment but does not bound
  the hang).

### Q: What observability scope is authorized?

- **Answer:** In-job forensics only — structured step-lifecycle events
  (spawn pid / exit / EOF split) plus a watchdog-triggered
  `/proc` + `ps` + `gdb -batch` dump uploaded as a job artifact. No hosted
  observability infrastructure.
- **Rationale:** the runners are ephemeral one-job VMs; forensics captured
  at the moment of wedge are worth more than any dashboard, and the seams
  already exist in StepExec/runStepGroup. Hosted cost: none; retention
  follows the GitHub artifact/log window.
- **Rejected:** CW agent on the fleet AMI (closes the memory-metrics gap
  but touches AMI bake and adds per-instance cost for a question the dump
  answers better); OTel/LGTM export (durable querying, but new plumbing
  from ephemeral runners and a retention story to own); do-nothing
  (repeats the month of blind incidents).

### Q: What does a firing per-step watchdog do on a hosted run?

- **Answer:** Dump, kill, retry once. Capture the forensic dump, group-kill
  the step, retry it once; fail the lane only if the retry also fails.
- **Rationale:** victim steps are deterministic-input and passed in ~87
  neighboring runs — a hang is near-certainly the runtime defect, not the
  diff. Retry-once converts a 50-minute hang into roughly a +2-minute lane
  while still collecting evidence on every occurrence.
- **Rejected:** observe-only first (maximally cautious but keeps burning
  50-minute timeouts); dump-and-fail-fast (cleanest signal discipline but
  costs a manual rerun per ~2% occurrence with no masking risk to justify
  it, given the determinism argument).

## 2026-08-23 — Round 2 (coverage, repro harness, next stage)

### Q: Where does the watchdog apply?

- **Answer:** Every captured step group — wire it at the
  `runStepGroup`/`collectResolvedStepOutput` seam so all captured
  policy/quality steps in all lanes get the same bound and forensics.
- **Rationale:** the class is runtime-level, not victim- or lane-level
  (docgen before #748, native-runtime after).
- **Rejected:** lint-policy-only scoping (smaller diff, uneven protection).

### Q: Repro harness or CI forensics?

- **Answer:** Rely on CI forensics; no workstation harness in this arc.
- **Rationale:** two synthetic hammers (ours 0/41, bun#34069's reporter
  0/40) already failed to reproduce; at ~2%/lane a naturally-captured dump
  is expected within days of the watchdog shipping.
- **Rejected:** harness-in-parallel (optional but not worth the time),
  harness-first (blocks the fix on a load-sensitive race).

### Q: Packet next step?

- **Answer:** Proceed to shape now; draft BRIEF.md in this session.
- **Rejected:** pausing after align.

### Settled by stated default (no objection)

- Hosted observability cost ceiling: moot under in-job-only scope ($0).
- Forensic dump retention: GitHub default artifact/log retention (~90 days).
