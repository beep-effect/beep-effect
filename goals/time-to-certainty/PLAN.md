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

- [~] A5 journal facts — landed 2026-09-03 (PR #964 merged as 58e063757b, under rulings 11–16),
      partial until A5b closes the four gaps review found after the merge:
      attempt rows carry the resolved head, tree fingerprint, tier, stage and env profile (C1
      vocabulary); the pre-push and merged-preview wrappers journal each inner lane through a
      durable report file; abnormal ends (interrupt, queued-submitter death, lease eviction) are
      `attempt-terminated` rows with a reason while normal completions keep `attempt-finished`;
      dead tickets and leases are claimed atomically before their event is journaled; writers
      preserve unknown journal rows and the eviction variant ships under a versioned protocol the
      CI-ops lab folds as a release; the economics loader accepts both terminal tags.
- [ ] A5b journal-facts completion (review of PR #964 on the docs PR #976): (1) gate eviction-row
      emission behind an explicit protocol switch that stays off until the unknown-row preservation
      release has rolled out to every live checkout, because a v1 writer's locked rewrite still
      drops v2 rows (ruling 14); (2) scheduler-owned termination rows carry the attempt's resolved
      head, tree fingerprint, tier, stage and env profile, and compaction keeps start/terminal pairs
      together so a minimal terminal row never survives its start; (3) stale-start reconciliation
      closes starts whose owning process (pid plus start time) is dead with no admission owner,
      covering SIGKILL and host death in repair, monitor and closeout modes; (4) the wrapper persists
      each inner-lane result as it completes (append-only), so an interrupted wrapper keeps the lanes
      that already finished. A5 is complete when all four land.
- [ ] B1 package verification through the Turbo graph (upstream builds) or automatic
      environment-only attribution when no package source differs from base.
- [x] A4 ack ledger contract — done 2026-09-03 (PR #966 merged as fe70e27f55): the P0 reminder and
      the ack command agree, and the resolution vocabulary carries the environment-only kind.
- [x] B2 semantic-delta git refs — done 2026-09-03 (PR #965 merged as 23f3e34499): spans naming an
      existing local or remote ref (both `<name>` and `<remote>/<name>` spellings) are no longer
      classified as broken tracked paths; the ref census parser is tested.
- [x] B4 remote-read plan resolves only its four references; whole-file env health reported
      separately with the failing variable named — done 2026-09-03 (PR #953 merged as 484e24c2e9:
      the secret resolver receives only the cache quad, unrelated references cannot block remote
      reads, the quad still fails closed, and the health probe names failing variables only).
- [ ] B3 cheap precise gates first, wave fails immediately; ordering seeded from A1.
- [ ] B5 detached durable proof jobs in their own systemd user scope with inbox completion.
- [~] B6 lease and submitter death journaled as admission events — landed in PR #964
      (`admission-lease-evicted` and `admission-ticket-evicted` rows, claimed atomically); complete
      when A5b gates their emission behind the preservation rollout.

## P2 — Proof reuse

- [x] C1 ProofFact schema — done 2026-09-03 (PR #954 merged as 3e46822475): ProofEnvProfile, ProofStage,
      ProofOutcome, ProofInputSource, ProofEpoch, ProofInputDigest, ProofProvenance, ProofFact,
      ProofMissReason, hit/miss decisions, fact/shadow ledger rows. The `YeetLaneProofState`
      migration is tracked as C4a below.
- [x] C2 ProofLedger Context.Service — done 2026-09-03 (PR #954): record / recordShadow / lookup /
      expire / disagreements over an append-only per-checkout NDJSON ledger with a tolerant reader,
      key derivation and epoch collection, identity-field verification on lookup, undeclared-input
      facts never reused; not yet wired into any lane.
- [~] C3 declared inputs per script lane; Turbo lanes adopt the task hash; undeclared lanes report
      as non-reusable.
  - [x] Coverage — done 2026-09-03 (PR #952 merged as 1ef10a6906: package-owned inputs replace the
        default glob, `cache: false` kept, a docs-only edit leaves the hash stable, and
        `tasks[].hash` in `.turbo/runs/<run-id>.json` is the ledger's input digest).
  - [x] Tsgo tests — done 2026-09-03 (PR #989: package-owned tasks retain the apps/infra/packages
        scan and synthetic tsconfigs, Turbo runs them serially with `cache: false`, the aggregate
        consumes versioned results with its prior rendering and exit semantics, and the run-summary
        `tasks[].hash` is the ledger input).
  - [ ] Lint-policy — heterogeneous sublanes have root-wide inputs; one union glob would recreate a
        whole-tree hash.
  - [ ] Labs — three task-hash sets rather than one declared action; must keep the PR path gate and
        zero-labs-is-green.
- [ ] C4a retire both legacy proof stores with receipts, never migrate them: (1) `YeetLaneProofState`
      rows nested in `YeetRunState` and written to each run's `state.json` by `writeVerifiedState`
      in `ProofState.ts`; (2) `LaneProofRecord` rows (`yeet-lane-proofs/v2`) in
      `.beep/yeet/lane-proofs.json`, owned by `Quality/internal/LaneProofReuse.ts`. Neither carries a
      per-lane input digest, env profile, epoch, duration, or run/attempt/origin provenance, so a
      ProofFact built from them would attribute an old result to inputs it may never have run
      against and could later become a reuse hit. Retirement means: the ProofLedger is the only
      store shadow wiring reads; legacy readers keep working until C4 lands, then are removed with
      a retirement receipt in `research/OPPORTUNITIES.md`; ProofFacts come only from lane runs
      recorded after A5 journal facts exist. Deferred from C1 (PR #954); owed before C4.
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
