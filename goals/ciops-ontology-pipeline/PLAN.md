# CI-Ops Ontology Pipeline Plan

## Status

Status: `pending`. Graduated 2026-10-01; P0 not started. Workstreams W1–W9 come from the
exploration's [`MAP.md`](../../explorations/beep-ci-operational-ontology/MAP.md), and each
row's capability cites are in its Capability Check. "Graduation Ruling n" is Ruling n of the
exploration's 2026-10-01 graduation sitting.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Inheritance and change events (W1); optional seat launcher (W2) | pending | Carry SOURCES forward and backfill the change-event ledger. W2 runs only if chosen. | `research/SOURCES.md` §4 refreshed against HEAD; every post-iv-870 lever under the admission criterion is a row; W2 landed or recorded as not chosen. |
| P1 Stage C capture and proof-ledger capture (W3-W4) | pending | Pin `run4-fleet` and the owning-clone ledger through two new sibling generators. | Both pins committed with tree-pinned citation replay passing and residue scans zero; or the ledger census recorded and the pin lane stopped (graduation Ruling 1). |
| P2 Projection on live data and planEpisode body (W5-W6) | pending | Replay the pin's admission chains and give the planner seam a body. | S7 §3.2/§6 amended first; agreement report printed beside 41-of-41; lab tests and `package-verify @beep/ciops` green. |
| P3 Auditor run 4 (W7) | pending | One frozen run on the run-3 choreography. | Gate PASSED and sittings scribed, or a steward ruling closing the run with its reason. |
| P4 KPI reading and verdict (W8-W9) | pending | Lab-side ETL to the v1.1 law, then the stated verdict and the S9 statement. | Verdict document beside `economics-close.json` M1 with the episode-definition mapping. |
| P5 Yeet: PR to mergeable | pending | Drive each slice PR, and the final PR, to Yeet merge-ready. | Required checks green; zero unresolved review threads. |
| P6 Close | pending | Closeout reflection and status flip on the final PR. | Reflection lints green; manifest, README and PLAN agree. |

## Workstreams

### P0 — Inheritance and change events

- [ ] **W1 SOURCES carry.** Keep [`research/SOURCES.md`](./research/SOURCES.md) pointing at
      the exploration ledger as primary, and re-verify its §4 table against HEAD before the
      first slice PR.
- [ ] **W1 change-event backfill** (graduation Ruling 6). Apply the admission criterion
      first: a row records a change to admission, ordering, gate selection or early stop,
      Turbo/cache task inputs, or lane assembly/sharding on the local tiers, plus
      hosted-runner capacity on the hosted tier; instrumentation-only and shadow-only changes
      are excluded. Then commit a reproducible lever query (`git log --since=2026-08-27T19:52Z`
      over the scheduler, admission, Turbo/cache, lane-assembly and hosted-runner paths, with
      `gh pr view <n> --json mergedAt,mergeCommit` for each landing instant) and write every
      qualifying post-iv-870 lever as an observational `OperationalChangeEvent` row under
      adoption-qualified membership. iv-929 and iv-1006 were written by the graduation PR;
      rows stay seed data until run 4.
- [ ] **W2 seat launcher (optional;** graduation Ruling 4). Skill v16 with a model-agnostic
      seat launcher, its own self-test family and new pinned digests. If not chosen, record
      that here; run-4 seats then run on Opus 5.5 by launch-entry deviation from v15.

### P1 — Stage C capture

- [ ] **W3 `run4-fleet` pin.** A NEW sibling generator on the run3b ETL mechanics with
      tree-pinned citation replay (graduation Ruling 8): citations resolve against the
      manifest's recorded `corpus_tree`, current-tree resolution is advisory, synthetic labels
      are retained, `corpus_tree`/`corpus_base` are recorded, residue is zero. Read the
      2026-10-01 admission-journal snapshot as a Queue D input beside the live re-census.
- [ ] **W4 proof-ledger capture.** A NEW sibling generator that reads ledger contents from
      the owning clone (`proofLedgerPathForCheckout`, time-to-certainty ruling 71): facts and
      shadow rows, `originKey` mapped to corpus-local tokens, run and attempt ids kept as join
      keys, run-3 Ruling 11 surrogates, run-3 Ruling 22 residue scan. Gate: C4.1 checked and
      post-#1321 facts from both local stages; otherwise record the census and stop
      (graduation Ruling 1).

### P2 — Projection on live data

- [ ] **W6 first deliverable: the S7-v2 seam** (graduation Ruling 11). Amend
      `s7-projection-contract.md` §3.2 and §6, and widen `PlanEpisodeInput` to carry the
      handoff path and sha256, with a lane-step proposal as the success type. Design first,
      then code.
- [ ] **W5 live differential replay.** Replay the `run4-fleet` admission chains through
      `replayAdmissionJournal` and report first-choice agreement beside the frozen golden's
      41-of-41; byte-determinism kept.
- [ ] **W6 `planEpisode` body.** Read `gate-order-handoff/v1` by path and sha256, build the
      lane DAG in canonical insertion order with `Graph` from `effect`, fail with
      `CyclicPlanError` on cycles, and add 32 lane steps to the `ScheduleProposal` A-Box in
      `ciops-prov:` as provisional terms. `schedulesWorkUnit` stays unratified. Tests:
      byte-determinism, totality, the cyclic-input must-fail, and the 32-lane handoff
      fixture pinned by sha256. Then run amended CQ-020 over the emitted Turtle with
      `apps/labs/ciops/scripts/check-emission-cq.py`.

### P3 — Auditor run 4

- [ ] **W7 run 4.** Pin commit, pushed evidence tag, detached worktree, Opus 5.5 seats in
      independent contexts (graduation Ruling 4), gate before the adversary, sittings,
      scribe, run-3 rotation, one PR. Queues A–F from the docket, re-verified at the pin;
      Queue F adopts tree-pinned replay (graduation Ruling 8); a Queue-G intake row brings
      `OperationalChangeEvent` and `landedAt` to ratification (graduation Ruling 6); CQ-009
      is re-scoped with a new must-fail fixture (graduation Ruling 9); a fourth
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
step. W5 + W6 ship as one projection PR and may land before run 4. W7 needs W3, W4 (and W2
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
