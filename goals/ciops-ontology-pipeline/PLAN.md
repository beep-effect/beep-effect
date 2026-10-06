# CI-Ops Ontology Pipeline Plan

## Status

Status: `in-progress`. Graduated 2026-10-01; P0 complete 2026-10-05 (W1 landed, W2 declined; P0 Rulings 1–7 in
[`research/decisions.md`](./research/decisions.md)); P1 complete 2026-10-06 (W3 `run4-fleet` and W4 `run4-ledger`
pinned under P1 Rulings 1–8); P2 complete 2026-10-06 (W6 seam, `planEpisode` body and W5 live replay, one projection PR; P2 Rulings 1–10). Next: P3 auditor run 4 (W7). Workstreams W1–W9 come from the
exploration's [`MAP.md`](../../explorations/beep-ci-operational-ontology/MAP.md), and each
row's capability cites are in its Capability Check. "Graduation Ruling n" is Ruling n of the
exploration's 2026-10-01 graduation sitting.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Inheritance and change events (W1); optional seat launcher (W2) | complete | Carry SOURCES forward and backfill the change-event ledger. W2 runs only if chosen. | `research/SOURCES.md` §4 refreshed against HEAD; every post-iv-870 lever under the admission criterion is a row; W2 landed or recorded as not chosen. |
| P1 Stage C capture and proof-ledger capture (W3-W4) | complete | Pin `run4-fleet` and the owning-clone ledger through two new sibling generators. | Both pins committed with tree-pinned citation replay passing and residue scans zero; or the ledger census recorded and the pin lane stopped (graduation Ruling 1). |
| P2 Projection on live data and planEpisode body (W5-W6) | complete | Replay the pin's admission chains and give the planner seam a body. | S7 §3.2/§6 amended first; agreement report printed beside 41-of-41; lab tests and `package-verify @beep/ciops` green; CQ-009 excluded from the live-projection certainty gate over post-#929 rows until P3's re-scope (graduation Ruling 9). |
| P3 Auditor run 4 (W7) | pending | One frozen run on the run-3 choreography. | Gate PASSED and sittings scribed, or a steward ruling closing the run with its reason. |
| P4 KPI reading and verdict (W8-W9) | pending | Lab-side ETL to the v1.1 law, then the stated verdict and the S9 statement. | Verdict document beside `economics-close.json` M1 with the episode-definition mapping. |
| P5 Yeet: PR to mergeable | pending | Drive each slice PR, and the final PR, to Yeet merge-ready. | Required checks green; zero unresolved review threads. |
| P6 Close | pending | Closeout reflection and status flip on the final PR. | Reflection lints green; manifest, README and PLAN agree. |

## Workstreams

### P0 — Inheritance and change events

- [x] **W1 SOURCES carry.** Done 2026-10-05: [`research/SOURCES.md`](./research/SOURCES.md) §4
      re-verified against `8b7392fe00` (two drifted cites and one moved cite corrected, one new
      correction bullet; the §5 gate-order digest note records the #1380 move for W6).
- [x] **W1 change-event backfill** (graduation Ruling 6, amended by P0 Ruling 2). Done
      2026-10-05: the reproducible query
      [`research/scripts/w1_lever_query.sh`](./research/scripts/w1_lever_query.sh) (four path
      families widened by P0 Rulings 5 and 7, plus the package-scripts probe from the PR #1424
      review) censused 197 PRs since the iv-870 instant; four classify-and-refute passes and P0
      Rulings 2–7 admitted 39 new `OperationalChangeEvent`
      rows into `control-interventions.yaml` (42 rows with iv-870, iv-929 and iv-1006), each
      under adoption-qualified membership; protocol, census, verdicts and the exclusions appendix
      are in [`research/w1-lever-query.md`](./research/w1-lever-query.md). Rows stay seed data
      until run 4.
- [x] **W2 seat launcher (optional;** graduation Ruling 4). Skill v16 with a model-agnostic
      seat launcher, its own self-test family and new pinned digests. **Not chosen** (P0
      Ruling 1, 2026-10-05, [`research/decisions.md`](./research/decisions.md)): run-4 seats
      run on Opus 5.5 by launch-entry deviation from v15; no v16 launcher, no new digests.

### P1 — Stage C capture

- [x] **W3 `run4-fleet` pin.** Done 2026-10-06: `etl_run4_fleet_corpus.py` pinned
      `corpus/run4-fleet/` (937 files, 11,179 events; 260 checkouts under the public-origin
      filter; the canonical admission root with quarantine as one payload; the Queue D projection
      read by path and sha256 with 0 reconciliation conflicts; citations tree-pinned against
      `origin/main` `26269bb0ec`), verified by its own replay, a corruption proof and gitleaks under
      main's config; lane report `research/run4-lanes/stage-c-w3-report.md` in the exploration.
      As specified: a NEW sibling generator on the run3b ETL mechanics with
      tree-pinned citation replay (graduation Ruling 8): citations resolve against the
      manifest's recorded `corpus_tree`, current-tree resolution is advisory, synthetic labels
      are retained, `corpus_tree`/`corpus_base` are recorded, residue is zero. Read the
      committed redacted projection of the 2026-10-01 admission-journal snapshot
      (`journal.redacted.ndjson`) by path and its `SHA256SUMS.txt` digest as a Queue D input
      beside the live re-census, after `research/scripts/redact_journal_snapshot.py --check`
      passes; a missing or mismatched projection fails Queue D closed (no fallback to the
      `run3b-fleet` pin).
- [x] **W4 proof-ledger capture.** Done 2026-10-06: `etl_run4_proof_ledger.py` pinned
      `corpus/run4-ledger/` (9 owning-clone ledgers, 8,082 rows, 4,041 pairs, 0 torn; gate holds
      with 3,628 post-cut pre-push facts and the merged-preview stage dormant; 125 hits as
      hypothetical would-reuse edges), same proofs; lane report
      `research/run4-lanes/stage-c-w4-report.md`. As specified: a NEW sibling generator that reads ledger contents from
      the owning clone (`proofLedgerPathForCheckout`, time-to-certainty ruling 71): facts and
      shadow rows, `originKey` mapped to corpus-local tokens, run and attempt ids kept as join
      keys, run-3 Ruling 11 surrogates, run-3 Ruling 22 residue scan. Gate: C4.1 checked and
      post-#1321 pre-push facts in the fleet's owning-clone ledgers (graduation Ruling 1 as
      amended by P1 Rulings 1–2; the merged-preview legs stay flagged on the first post-#1321
      merged-preview fact); otherwise record the census and stop.

### P2 — Projection on live data

- [x] **W6 first deliverable: the S7-v2 seam** (graduation Ruling 11). Done 2026-10-06: CT §8
      supersedes the §3.2 bullet and §6 first bullet; `PlanEpisodeInput` widened; lane-plan schemas
      landed in the seam commit with the stub still failing (P2 Ruling 1). As specified: amend
      `s7-projection-contract.md` §3.2 and §6, and widen `PlanEpisodeInput` to carry the
      handoff path and sha256, with a lane-step proposal as the success type. Design first,
      then code.
- [x] **W5 live differential replay.** Done 2026-10-06: `evidence:s7-live` replays the pinned canonical
      journal (689 rows, surrogate custody) with the window skip rule and reports first-choice agreement
      197 of 200 beside the golden's 41 of 41, three disagreements attributed to the #929 same-checkout
      skip, CQ-009 out of scope (0 of 689 rows precede #929); evidence in
      `research/s7-live-replay-evidence.md`; lane report `p2-w5-report.md` in the exploration's
      `research/run4-lanes/`. As specified: replay the `run4-fleet` admission chains through
      `replayAdmissionJournal` and report first-choice agreement beside the frozen golden's
      41-of-41; byte-determinism kept. Until W7 re-scopes CQ-009, it is not a certainty gate
      over these post-#929 rows: evaluate it on pre-#929 rows only or report it as
      temporally out of scope, never as a pass or a failure (graduation Ruling 9; SPEC
      "CQ-009"). Prerequisite recorded 2026-10-05 (P1 orchestrator note m): the lab's v3
      admission decoders must accept run-3 Ruling 11 surrogate rows (`ownerRef`, no `pid` or
      `procStart`; `checkoutRef` in the snapshot projection), and ring-trimmed released-only
      chains are skipped, not failed, using the per-root window boundaries the `run4-fleet`
      manifest records.
- [x] **W6 `planEpisode` body.** Done 2026-10-06: `LanePlan.ts` + `planEpisode`/`emitLanePlan`; 33 lane
      steps from the pinned handoff, 32 precedence edges, golden `lane-plan-v1.ttl`, the CQ-020 sibling
      `check-lane-plan-cq.py` PASS; lane report `p2-w6-report.md`. As specified: read `gate-order-handoff/v1` by path and sha256, build the
      lane DAG in canonical insertion order with `Graph` from `effect`, fail with
      `CyclicPlanError` on cycles, and emit the pinned handoff's lane steps (33 at
      `705f3e75…`; P2 Ruling 2 amends the earlier "32") as a `LanePlanProposal` A-Box in
      `ciops-prov:` with a disjoint provisional vocabulary (P2 Ruling 3). `schedulesWorkUnit`
      stays unratified. Tests: byte-determinism, totality, the cyclic-input must-fail, and the
      handoff fixture pinned by sha256. Then run amended CQ-020 over the emitted Turtle with
      `apps/labs/ciops/scripts/check-emission-cq.py` and its lane-plan sibling (P2 Ruling 7).

### P3 — Auditor run 4

- [ ] **W7 run 4.** Pin commit, pushed evidence tag, detached worktree, Opus 5.5 seats in
      independent contexts (graduation Ruling 4), gate before the adversary, sittings,
      scribe, run-3 rotation, one PR. Queues A–F from the docket, re-verified at the pin;
      Queue F adopts tree-pinned replay (graduation Ruling 8); a Queue-G intake row brings
      `OperationalChangeEvent` and `landedAt` to ratification (graduation Ruling 6); CQ-009
      is re-scoped with a new must-fail fixture (graduation Ruling 9), which lifts W5's
      CQ-009 exclusion over post-#929 rows; a fourth
      `AssuranceTier` member for merged preview is proposed (graduation Ruling 10).

### P4 — KPI reading and verdict

- [ ] **W8 KPI ETL.** Lab-side only: a module in `apps/labs/ciops` once S7 §6 is amended by
      ruling, or its own lab. Seat-request clock from v3 `admission-enqueued`; tier
      partitions with merged preview as a sub-partition of `TierLocalFullProof`; cut and
      uncut reports with censored counts; starvation beside percentiles; change-event
      partitions.
- [ ] **W9 verdict.** Fleet P50/P95 for a ratified post-baseline window beside
      `economics-close.json` M1 with the episode-definition mapping; improvement reported,
      not required (graduation Ruling 3); the S9 statement of projected versus deployed route.

## Sequencing

W1 precedes any KPI reading. W3 + W4 ship as one capture PR and are the first irreversible
step. W5 + W6 ship as one projection PR and may land before run 4, with CQ-009 out of their
certainty gate over post-#929 rows until W7's re-scope. W7 needs W3, W4 (and W2
if chosen) and the graduation Ruling 1 gate. W8 → W9 is the verdict PR, which carries the
status flip and the closeout reflection.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- New rulings land in [`research/decisions.md`](./research/decisions.md).
- Record friction receipts in the exploration's `research/OPPORTUNITIES.md` at the moment
  they happen, redacted for a public repo.
- Sub-agents follow the AGENTS.md volume pools.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/ciops-ontology-pipeline/GOAL.md)" -le 4000
jq . goals/ciops-ontology-pipeline/ops/manifest.json
bun run beep goals doctor
bun run beep explore atlas --check
git diff --check -- goals/ciops-ontology-pipeline
bun run beep lint reflection-artifacts
bun run beep quality package-verify @beep/ciops
(cd explorations/beep-ci-operational-ontology && uv run --with pyyaml --with rdflib python research/scripts/validate_packet.py)
(cd explorations/beep-ci-operational-ontology && uv run --with pyyaml --with rdflib python research/scripts/validate_packet.py --s5)
(cd explorations/beep-ci-operational-ontology && uv run --with pyyaml --with rdflib --with pyshacl python research/scripts/validate_packet.py --s6)
(cd explorations/beep-ci-operational-ontology && uv run --with pyyaml --with rdflib --with pyoxigraph python research/scripts/run_cq_suite.py)
```
