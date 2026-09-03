# Auditor run 2 — intake docket

Assembled 2026-09-02, after the S7 lane closed (PR #936 merged as `9f8751ec9b`, follow-up
PR #940 merged as `1cdce452ae`). This docket enumerates every item queued for the second
`ontology-foundational-auditor` run with its committed source, plus the engine deltas that
change run mechanics relative to run 1. S5/S6/S7 are complete; nothing here re-opens them.

## Prior-run chain (validator-enforced)

Run 2 is `first_run: false`. The manifest must set
`prior_index: runs/orun-2026-08-29T08:20:55Z.index.yaml` (under
`ontology/extraction/s4/beep-ci-ops/`) with `prior_index_sha256_12` computed from those file
bytes. The run-manifest schema requires every unresolved prior row to be RE-OPENED (verbatim
re-parking is rejected) or retired via `carried_from_prior` rows in the new index.

- Run 1 closed with a ratified unresolved-fraction waiver: 149 rows of CQ
  measurement/episode vocabulary parked pending journal/verdict corpus ingestion
  (DECISIONS.md, 2026-08-29 ratification sitting; the rows auto-ruled `parked-run-2`
  during S5). Discharging them requires the corpus extension below.

## Queue by source

### S5 parked surface

Sources: `ontology/extraction/s4/CANDIDATES.yaml`, `ontology/extraction/s4/LEDGER.yaml`,
`ontology/extraction/s5/TAXONOMY.yaml`; counts per `ops/manifest.json` openQuestions.

- 163 parked-run-2 candidates (CANDIDATES.yaml statuses projected by
  `apply_s5_dispositions`).
- 76 parked ledger rows (LEDGER.yaml).
- 4 waived constraints with per-waiver discharge notes in TAXONOMY.yaml
  `waived_constraints`/`waiver_reasons`: `con:admission-scheduler-I04`
  (publishAgingSeconds/starvationBoundMs measurement vocabulary), `con:literalkits-I04`
  (matrix-row denotation leg), `con:literalkits-I19` (mode-to-surface members),
  `con:yeet-internals-I01` (YeetProofTier/AssuranceTierId mapping).
- VerificationLane placement obligation: S5 sitting 4 flagged lane placements pending a
  VerificationLane ruling at run 2 (DECISIONS.md).

### S6 vocabulary/telemetry gaps

Source: `vocabulary_gaps` in `ontology/extraction/s6/snapshot/raw/MANIFEST.yaml`.

Six predicates the A-Box could not assert, each a run-2 proposal or corpus item:

1. `hasGrantState` — unratified vocabulary; tallies retained manifest-only.
2. `hasWorkKind` — unratified request predicate.
3. `hasPriorityClass` — unratified request predicate.
4. `capacityAtAdmissionTokens` — yeet-admission-journal/v1 records no capacity at admission.
5. `activeTokens` — journal records no active token totals.
6. `admittedBy` — ratified direction (WorkUnitSpecification → SeatGrant) is unusable from
   journal bytes, which yield SeatRequest individuals only.

Also run-2 re-proposal input: the CQ predicate-coverage table in
`ontology/extraction/s6/work-s6/impl-report.md` (coverage 1/25 fully-covered CQs;
registry in `ontology/extraction/s6/PREDICATES.yaml`).

### S7 additions

Sources: `ontology/docs/s7-projection-contract.md` (ruling 2),
`ontology/extraction/s7/work-s7/impl-report.md`, `research/s7-replay-evidence.md`.

- Re-proposal of the provisional ordering vocabulary as ratified terms: predicates
  `hasCurrentProposal`, `hasStep`, `hasScope`, `schedulesSeatRequest`, `stepIndex` and
  class `ScheduleStep` (all currently `ciops-prov:`). `schedulesSeatRequest` REPLACES
  ruling 2's original `schedulesWorkUnit` spelling — the journal carries no
  work-unit-specification identity, the same finding class as `admittedBy` (PR #936
  amendment record in the S7 impl-report).
- Censorship finding: **lease death is unjournaled.** The deployed reaper drops dead
  admission state via process liveness without writing a release event; replay evidence
  (phantom grant `1813f29f`, one inferred eviction at event 66) in
  `research/s7-replay-evidence.md`.

### Corpus and adapter extension

Source: `ontology/extraction/s4/beep-ci-ops/adapters/README.md`.

- Journal/verdict corpus ingestion — the precondition for discharging the 149 parked
  measurement/episode rows and grounding the S6 telemetry gaps.
- Adapter v1.1.0 queue as recorded in the adapters README (pairing mirror, engine-digest
  embedding, and the other run-2 notes it lists).

## Engine deltas since run 1 (change run mechanics)

Run 1 executed a mid-hardening engine snapshot (validator `6aec64cde23f`, contracts
`e1338e75966c`, vendored at
`ontology/extraction/s4/beep-ci-ops/runs/history/orun-2026-08-29T08:20:55Z.engine/`).
Run 2 executes the repo-vendored skill at `.claude/skills/ontology-foundational-auditor/`
(the only authoritative copy; the user-scope install was retired when PR #880 vendored the
skill at project scope, and the repo's `.agents/skills` symlink serves Codex seats directly).

1. **Validator v13** (`scripts/validate_artifacts.py`, sha256_12 `c036e5316511` at the
   time of writing — recompute at the run pin). The v8→v13 hardening arc is recorded in
   the skill's REVIEW-HISTORY.md.
2. **Sandboxed adapter execution** (PR #902): repository-resident adapter copies are
   never executed. Adapters are authored in a fresh user-owned 0700 directory outside the
   repository and run via
   `.claude/skills/ontology-foundational-auditor/scripts/run_adapter_sandbox.sh`
   (bubblewrap: no network, read-only repo bind, scrubbed environment; prlimit resource
   bounds; system `python3`). Only after golden self-check and observe both succeed is the
   byte-identical snapshot installed under the ontology's `adapters/` as provenance, with
   `script_sha256_12` pinned from the trusted bytes.
3. **Adapters must be Python-stdlib-only.** The sandbox provides no package environment
   (no uv, no pyyaml). Run-1 v1.0.0 adapters import `yaml` and would fail in-sandbox —
   v1.1.0 must emit records via the standard library. This is now the binding constraint
   on the adapter v1.1.0 rewrite, on top of the README queue.
4. **Adversary repair channel**: proposed fixes go in the review's own
   `revision_requests` list (new field in `templates/review-disposition.yaml`) — never
   into the target proposal's bytes, which would stale the bound `target_sha256`.
5. **Blinded-alternative id namespace**: the alternative seat mints `-alt`-suffixed slugs
   (`ic:<slug>-alt:<nnn>` / `fa:<slug>-alt:<nnn>`); duplicate-id checks are global across
   seats and the primary seat's ids are invisible to it.
6. **Prompt digests changed** (`prompts/ontoclean-adversary.md`,
   `prompts/alternative-model.md`): manifest `prompt_sha256_12` values must be pinned from
   the repo bytes at the run pin, not carried from run 1.

## Not in scope

- S8 IRI scheme (deferred per the standing pipeline; the `ciops-prov:` namespace
  re-proposal rides this run, the IRI scheme itself does not).
- Any change to S5/S6/S7 outputs, the frozen S6 evidence bytes, or run-1's rotated
  artifacts — all are read-only inputs here.
