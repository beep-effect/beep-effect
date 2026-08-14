# ship-velocity — execution plan

Order is by cycles-returned-per-unit-of-work. Items execute until finished; no calendar
estimates. Each item lands as its own PR (or small PR series) through yeet; the packet manifest
phase flips ride the final PR of each phase.

## P0 — Ratify and baseline (this PR + immediate follow-ups)

- Land this packet; record operator decisions: C2 (PR remote reads / CSF-014), E2 (INDEX
  end-state), E6 (path-filtered required checks) — all pre-approved 2026-08-13 in principle,
  each gets a dated decision note when its implementation PR opens.
- ~~Baseline metrics snapshot (SPEC §Metrics) from existing artifacts: c1-raw-failures.txt,
  merge-commit counts, current monitor latency budget~~ — done 2026-08-14:
  `research/metrics-baseline.md` freezes all five metric baselines + re-measurement protocol.
- ~~Land the two in-flight branches that already implement backlog items~~ — done: #698
  (coverage scoping, `286a2be63b`) and #702 (runners-bake, `ddc8a873b1`) merged 2026-08-13/14.
  Verify closure only; do not restart either.

## P1 — Instant wins

- B1 same-argv lanes (`beep ci lane` from yeet).
- E1 publish refuses hand-staged INDEX + regenerates from manifests.
- C1 local remote-cache read path + checkout env template.
- A7 monitor hardening quick items (`yeet reply` exit code, cursor persistence, registration
  backoff).

## P2 — Backpressure engine

- A1 `yeet monitor --watch` transition stream + failure capsules + remediation dispatch.
- A2 hook-mutex + ACK inbox (Claude deny / Codex inject / Grok tail adapters).
- A3 can't-leave-the-scene (Stop-hook veto + yeet poison-pill + waives).
- A5 package-scoped gates (skill instructions + script gap fill + create-package templates).
- A6 merge-ready v2.

## P3 — Full parity

- B2 coverage in local proof (#698 landed — build on its scoping).
- B3 missing cheap lanes; B7 docgen predicate into CLI.
- B4 `--ci-parity` merged-tree pre-publish tier + PR-posture env.
- B6 test-file typecheck preflight.
- B8 parity ledger live; B5 proof reuse in shadow → active.

## P4 — Concurrency + cache proof

- D1 weighted admission leases; D2 adaptive concurrency; D3 hardening + RSS telemetry.
- A4 dead-owner takeover (needs D1 leases).
- C3 warm capability; C4 correctness inputs; C5 hit-rate dashboard + key de-fragmentation.
- C2 PR remote reads (post decision).

## P5 — Hot-file endgame + close

- E3 derived-only auto-heal + merge-driver tripwires.
- E2 INDEX end-state PR; E4 ATLAS generator; E5 contention families.
- E6 path-filtered required checks.
- E7 stacked-PRs spike + decision record.
- E8 merge-queue re-evaluation against recorded flip condition.
- Metrics closeout: SPEC §Metrics targets met over a representative week; reflection; status
  flip in the same PR.
