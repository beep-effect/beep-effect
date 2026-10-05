# CI-Ops Ontology Pipeline Spec

Seeded 2026-10-01 from the exploration's
[`BRIEF.md`](../../explorations/beep-ci-operational-ontology/BRIEF.md) and
[`MAP.md`](../../explorations/beep-ci-operational-ontology/MAP.md). "Graduation Ruling n" is
Ruling n of the exploration's `DECISIONS.md` entry "2026-10-01 — graduation sitting (11
rulings, steward: Benjamin)". Older ruling numbers name their series (run-3, S7,
time-to-certainty).

## Objective

Operate the ratified CI operational ontology as a pipeline: project live admission and
wave-order data through the S7 engine, hold CQ regression green, ratify auditor run 4, and
state the fleet time-to-certainty verdict.

The single number is the fleet-aggregated P50/P95 time-to-certainty per verification
episode, tier-relative and epoch-relative, measured under
`explorations/beep-ci-operational-ontology/research/kpi-measurement-rules.md` v1.1. The done
bar is a stated verdict beside time-to-certainty's close economics with change events
tagged. Improvement is reported, not required, because the levers ship through
`goals/time-to-certainty` (graduation Ruling 3).

## Non-Goals

Carried from the brief's no-gos:

- Rewriting any frozen pin. `ontology/extraction/**` is byte-immutable; run-3 Rulings 22
  (unratified pins) and 23 (ratified pins) are the only repair routes.
- Re-running auditor runs 1–3, the §4b normalization, or the S5, S6 and S7 baselines. Run 4
  reads their indexes through the prior-index chain.
- S8: no IRI scheme, no OWL 2 RL formalization pass, no rules compilation, no formal T-Box
  pass and no `packages/ontology` incubation flow. These wait for the gated MAP candidate
  `ciops-iri-formalization` (graduation Ruling 2).
- A full OWL DL reasoner on the critical path (launch decision reasoning-stack).
- Any scheduler, lock or repo-cli integration of the projection. The deployed
  `QualityScheduler` stays the only admission writer (S7 §6, the time-to-certainty GOAL
  rule). Promotion of the lab is the gated MAP candidate `ciops-yeet-projection`
  (graduation Ruling 5).
- Proof-reuse enforcement, and any edit to `goals/time-to-certainty` tracked artifacts beyond
  dated receipts.
- Ratifying vocabulary outside an auditor run, and any CQ, seed or fixture edit inside run 4
  beyond the CQ-009 re-scope, its new must-fail fixture and the `orsd.md` §9 errata fold-in
  at the pin (graduation Ruling 9).
- Moving the ontology tree out of the exploration packet (graduation Ruling 7).
- A merge queue (ship-velocity E8 stays the flip condition).

## Source Hierarchy

1. The 2026-10-01 graduation sitting (exploration `DECISIONS.md`) and the rulings in
   [`research/decisions.md`](./research/decisions.md) from then on.
2. `AGENTS.md`, `CLAUDE.md`, and required skills (`ontology-foundational-auditor`,
   `effect-first-development`, `schema-first-development`).
3. The exploration's binding contracts under
   `explorations/beep-ci-operational-ontology/ontology/docs/` (S4–S7, `scope.md`, `orsd.md`)
   and `standards/architecture/15-lab-apps.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files, and the exploration's `BRIEF.md`,
   `MAP.md`, `research/SOURCES.md` and `research/auditor-run4-intake.md` by link.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `apps/labs/ciops/**` (`@beep/ciops`, the S7 engine). The lab stays `active`, owned by this
  goal (graduation Ruling 5).
- `explorations/beep-ci-operational-ontology/ontology/**` and
  `explorations/beep-ci-operational-ontology/research/scripts/**`, which stay in place; this
  goal owns them by back-link (graduation Ruling 7). New pins and runs append under new
  roots only.
- `explorations/beep-ci-operational-ontology/research/control-interventions.yaml` (change-event
  rows, graduation Ruling 6) and
  `explorations/beep-ci-operational-ontology/research/kpi-measurement-rules.md` (KPI law).
- `explorations/beep-ci-operational-ontology/ontology/docs/s7-projection-contract.md` §3.2 and
  §6: the S7-v2 seam amendment and the `PlanEpisodeInput` widening are W6's first deliverable
  (graduation Ruling 11).
- `.claude/skills/ontology-foundational-auditor/**`, only if the optional W2 seat launcher is
  chosen (graduation Ruling 4).
- `goals/ciops-ontology-pipeline/**`.

## Constraints

Carried from the brief's rabbit holes:

- **Two episode definitions.** This KPI opens at seat request, per (checkout, branch) and per
  tier; time-to-certainty's M1 is red-to-green per branch, cut at 24 h and uncut. The verdict
  states the mapping and never presents one as the other.
- **Run 4 gate.** The pin requires time-to-certainty C4.1 checked and post-#1321 pre-push
  facts in the fleet's owning-clone proof ledgers, read by a new ledger-capture generator
  (P1 Rulings 1–2, 2026-10-05, amending graduation Ruling 1's "both local stages" clause:
  the merged-preview stage has had no attempt since 2026-09-09). Without them the pin lane
  records the census and stops. Realization and copy legs stay flagged on C4.2, and the
  merged-preview issuance and custody legs stay flagged on the first post-#1321
  merged-preview fact (graduation Ruling 1; P1 Ruling 1).
- **Ledger population.** Only facts written inside a clone, or after #1321, survive in the
  owning clone. Shadow facts are issued, not realized; seats never read a would-reuse hit as
  a realized claim.
- **Owning-clone capture.** Resolve the owning clone the way time-to-certainty ruling 71
  does, without git; every fleet clone is an owning clone and is read once (P1 Ruling 2);
  never walk sibling lanes' `.beep/` trees; never leak run ids that encode host paths.
- **Seats.** Every auditor seat, the blinded alternative included, runs on Opus 5.5 in an
  independent context; blinding is by withheld inputs. The run-4 launch entry records the
  deviation from skill v15's `codex exec` recipe; Codex or Grok seats run only on an operator
  opt-in named there (graduation Ruling 4).
- **Tree-pinned citation replay.** New pins resolve each citation against the manifest's
  recorded `corpus_tree`; current-tree resolution is advisory, and frozen pins are never
  edited (graduation Ruling 8).
- **Change-event admission.** A row records a change to admission, ordering, gate selection
  or early stop, Turbo/cache task inputs, or lane assembly/sharding on any tier, plus
  hosted-runner capacity on the hosted tier (P0 Ruling 2, 2026-10-05, amending graduation
  Ruling 6's hosted clause); instrumentation-only and shadow-only changes are
  excluded. Rows stay seed data until run 4 ratifies `OperationalChangeEvent` and `landedAt`
  through a Queue-G intake row (graduation Ruling 6).
- **Tiers.** Merged preview is a sub-partition of `TierLocalFullProof` in KPI law v1.1; a
  fourth `AssuranceTier` member is a run-4 proposal, not a goal edit (graduation Ruling 10).
- **CQ-009.** It reads through the `scope.md` and `orsd.md` §9 errata (deployed exclusion
  moved to the checkout at #929) until the run-4 pin re-scopes it to same-checkout exclusion
  plus the legacy-origin drain with a new must-fail fixture (graduation Ruling 9). Binding on
  P2 (W5-W6), which may land before run 4: until P3's re-scope (W7), CQ-009 holds only under
  its pre-#929 temporal scope and is not a certainty gate over post-#929 admission state. A
  live-data CQ run before the run-4 pin evaluates CQ-009 on pre-#929 rows only or reports it
  as temporally out of scope, never as a pass or a failure over post-#929 rows (graduation
  Ruling 9; `scope.md` 2026-10-01 amendment).
- **Seat-request clock coverage.** v3 `admission-enqueued` rows exist only from #1025
  (2026-09-09); earlier windows fall back to attempt start, and each report names its clock.
- **Planner scope.** `planEpisode` orders existing lanes only. A new order literal or a
  reseed from live economics needs its own ruling (time-to-certainty rulings 76–77). Lane
  steps stay provisional in `ciops-prov:`, and `schedulesWorkUnit` stays unratified until
  run 4 (graduation Ruling 11).
- **Handoff decode.** The lab never imports repo-cli. `planEpisode` decodes only the subset
  of `gate-order-handoff/v1` it reads and pins the document's sha256, so shape drift fails
  loud (time-to-certainty ruling 78).
- **Run-PR size.** Merge readiness for the run-4 PR is checks, threads and GitHub
  mergeability; Greptile cannot score a run PR.
- **Public-repo residue.** Every new pin runs the residue scans (run-3 Rulings 11 and 22).
- **Stale ETL prose.** `kpi-measurement-rules.md` §5 still calls the admission-transition
  journal a candidate repo improvement; the v1.1 amendment (§6) supersedes that bullet, so
  the W8 ETL designs from the deployed journal and §6, not the §5 prose.
- **Effect v4 and schema first.** Lab code follows the effect-first and schema-first skills;
  validate Effect APIs (including `Graph`) against the Effect reference checkout.

## Acceptance Criteria

- [ ] The fleet-aggregated P50/P95 time-to-certainty per verification episode is computed
      under `kpi-measurement-rules.md` v1.1 (seat-request clock, tier partitions with merged
      preview as a sub-partition of `TierLocalFullProof`, cut and uncut with censored counts,
      starvation beside percentiles) over an operator-ratified post-baseline window; every
      `OperationalChangeEvent` in that window is tagged under adoption-qualified membership;
      and the verdict is stated beside `goals/time-to-certainty` `economics-close` M1 with the
      episode-definition mapping (improvement reported, not required).
- [ ] The CQ suite and the packet validators (base, `--s5`, `--s6`) are green on the final
      tree.
- [ ] The S7 projection is byte-deterministic (same input, byte-equal Turtle); differential
      replay passes on the frozen golden and reports first-choice agreement on the run-4
      Stage C pin; `planEpisode` consumes `gate-order-handoff/v1` by path and sha256. P2's
      live-projection certainty gate excludes CQ-009 over post-#929 rows until P3's
      re-scope (graduation Ruling 9).
- [ ] Auditor run 4 is ratified (gate PASSED, sittings scribed) or closed by a steward ruling
      that names why.
- [ ] The final PR is driven to Yeet merge-ready with the status flip and closeout reflection
      riding it.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

These are the manifest's `verificationCommands`, run from the repo root.

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/ciops-ontology-pipeline/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/ciops-ontology-pipeline/ops/manifest.json` | Passes |
| Goal tooling | `bun run beep goals doctor` | No findings for this packet |
| Exploration atlas | `bun run beep explore atlas --check` | Passes |
| Whitespace | `git diff --check -- goals/ciops-ontology-pipeline` | Passes |
| Reflection artifacts | `bun run beep lint reflection-artifacts` | Passes |
| Lab package | `bun run beep quality package-verify @beep/ciops` | Passes |
| Packet validator (base) | `cd explorations/beep-ci-operational-ontology && uv run --with pyyaml --with rdflib python research/scripts/validate_packet.py` | 0 errors |
| Packet validator (S5) | `cd explorations/beep-ci-operational-ontology && uv run --with pyyaml --with rdflib python research/scripts/validate_packet.py --s5` | 0 errors |
| Packet validator (S6) | `cd explorations/beep-ci-operational-ontology && uv run --with pyyaml --with rdflib --with pyshacl python research/scripts/validate_packet.py --s6` | 0 errors |
| CQ suite | `cd explorations/beep-ci-operational-ontology && uv run --with pyyaml --with rdflib --with pyoxigraph python research/scripts/run_cq_suite.py` | All CQs pass; must-fail fixtures fail |

## Stop Conditions

- A change would edit a frozen pin or any byte under
  `explorations/beep-ci-operational-ontology/ontology/extraction/**` outside an append under
  a new run or pin root.
- A step would re-run auditor runs 1–3, the §4b normalization, or the S5/S6/S7 baselines.
- A change would add a scheduler, lock, or repo-cli integration of the projection, or make
  `apps/labs/ciops` importable by repo-cli or product code.
- A change would edit `goals/time-to-certainty` tracked artifacts beyond a dated receipt, or
  would turn on proof reuse.
- S8 IRI-scheme, OWL 2 RL formalization, or rules-compilation work becomes necessary: stop
  and reopen the exploration at `decompose` for `ciops-iri-formalization`.
- A capture would place raw process identities, host paths, uids, hostnames, or session ids
  in the public tree (residue scan non-empty).
- Run 4 would launch without the graduation Ruling 1 gate holding, or with seats routed
  against graduation Ruling 4.
- Required source files are missing or materially contradictory, or the same blocker repeats
  after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Working tree outside `goals/` | `explorations/beep-ci-operational-ontology/{ontology,research/scripts}/**` | this goal | Graduation Ruling 7: 34 tracked files outside the packet name it, including the executable `goals/time-to-certainty/research/scripts/economics.py`. | A later ruling moves the tree. |
