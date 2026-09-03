# time-to-certainty — execution plan

Order is by evidence-returned-per-unit-of-work. No calendar estimates. Every item lands as a
focused PR through Yeet unless the operator bundles a phase. Packet phase flips ride the same PR as
their implementation truth. Heavy lanes run on Codex (Sol, high effort); web research on Grok; the
orchestrator owns schemas, contracts, and judgment.

## P0 — Measure and ratify — COMPLETE 2026-09-03

- [x] A1 economics report — done 2026-09-03 (Codex measurement lane): `research/economics.md`,
      `research/economics.json` (2,115 input receipts), `research/scripts/economics.py`.
- [x] G1 prior art — done 2026-09-03 (Grok research lane): `research/g1-prior-art.md`, eight
      ranked design ideas; ideas 1, 3, 4, 6 adopted into SPEC C1/C3/D1/B5.
- [x] A2 baseline freeze — ratified 2026-09-03 (decisions.md ruling 8): `research/baseline.md`
      (M1 P50 43.3 min / P95 3.95 h; M2 8.4 min P50; M3 hosted-only 1.264; M4 unmeasurable; M5 327 of
      3,069 starts unfinished); close-out re-runs the same script row by row.
- [x] C1 schema grill — rounds 1–3 done 2026-09-03, ten rulings in `research/decisions.md`
      (script-lane migration order settled by ruling 10: coverage, then tsgo tests, policy, labs).
      Still open, deferred by design: the machine-wide ledger as a P3 candidate and the second
      enforced pair (pre-push to merged preview) once env profiles are proven in the key.

## P1 — Journal facts, then hygiene — IN PROGRESS (independent small PRs, Codex lanes in sibling worktrees)

- [ ] A5 journal facts: every attempt row carries the tree fingerprint and tier; the pre-push and
      merged-preview wrappers journal each inner lane (id, tier, start, end, duration, input digest
      when known); attempt starts that never finish and lease or submitter deaths become terminal
      rows. Prerequisite for M3, M4, M5 and for the C4 shadow report (economics section G).
- [ ] B1 package verification through the Turbo graph (upstream builds) or automatic
      environment-only attribution when no package source differs from base.
- [ ] A4 ack ledger accepts reasons; resolution kinds distinguish fix, wontfix, environment-only.
- [ ] B2 semantic-delta exempts git-ref-shaped spans (or lints the rule before the proof).
- [x] B4 remote-read plan resolves only its four references; whole-file env health reported
      separately with the failing variable named — done 2026-09-03 (PR #953 merged as 484e24c2e9:
      the secret resolver receives only the cache quad, unrelated references cannot block remote
      reads, the quad still fails closed, and the health probe names failing variables only).
- [ ] B3 cheap precise gates first, wave fails immediately; ordering seeded from A1.
- [ ] B5 detached durable proof jobs in their own systemd user scope with inbox completion.
- [ ] B6 lease and submitter death journaled as admission events.

## P2 — Proof reuse

- [ ] C1 ProofFact schema + migration from `YeetLaneProofState` (schema PR, no behavior change).
- [ ] C2 ProofLedger Context.Service (record / lookup / expire) over an append-only NDJSON ledger.
- [~] C3 declared inputs per script lane; Turbo lanes adopt the task hash; undeclared lanes report
      as non-reusable. Coverage done 2026-09-03 (PR #952 merged as 1ef10a6906: package-owned
      inputs replace the default glob, `cache: false` kept, a docs-only edit leaves the hash
      stable, `tasks[].hash` in `.turbo/runs/<run-id>.json` is the ledger's input digest). Next in
      ruling-10 order with the blockers the C3 lane recorded: tsgo tests (the script scans
      apps/infra/packages, writes synthetic tsconfigs, and aggregates serially; package ownership
      and identical failure rendering must survive), lint-policy (heterogeneous sublanes with
      root-wide inputs; one union glob would recreate a whole-tree hash), labs (three task-hash
      sets rather than one declared action; must keep the PR path gate and zero-labs-is-green).
- [ ] C4 shadow mode with a disagreement report; enforcement between pre-push and merged preview
      only after zero disagreements over a ratified sample; hosted reuse recorded as a separate
      decision.
- [ ] C5 must-fail fixtures: changed package, epoch change, cross-profile reuse.

## P3 — Ordering handoff

- [ ] D1 pre-push wave ordered by (cost, red probability, precision) from A1; inputs handed to the
      ontology packet's planner seam with a receipt.

## P4 — Close

- [ ] A3 yeet economics surface prints the report at closeout.
- [ ] A1 re-run at close; M1–M5 compared with the P0 baseline.
- [ ] Closeout reflection, status flip, final PR to Yeet merge-ready; merge subject cites the
      packet slug.
