# Run-3 pin lane B — docket (intake docket, Ruling-14/16 consistency edits)

Written 2026-09-09 by the orchestrator (Fable). You are a Codex implementation lane in the
checkout `beep-effect8-s5` on branch `ontology-run3` (off main `85cc86d1f3`). A sibling lane
(lane A, `run3-pin-engine-brief.md`) is concurrently relocating run-2 trees under
`ontology/extraction/s4/` and adding adapter/transcriber files there. Do not touch anything under
`ontology/extraction/` or `.claude/`. Read every historical artifact through `git show HEAD:<path>`
so lane A's moves cannot race you. Do not run `git add`, `git commit`, `git stash`,
`git checkout --`, or `git switch`; leave the tree dirty and list every touched path in your
report. The orchestrator stages by name and commits.

Paths are relative to `explorations/beep-ci-operational-ontology/`. `ONT` =
`ontology/extraction/s4/beep-ci-ops`.

## Read first (in this order; do not re-litigate any ruling)

1. `DECISIONS.md` sections: "auditor run-2 launch grill", "run-2 sitting 1..3", "run-3 corpora
   design grill" (Rulings 1–16; Rulings 4, 6, 7, 14, 15, 16 drive this lane), "Stage B capture
   grill" (17–21; Ruling 17 re-parks issuance custody to run 4), "post-merge residue ruling",
   "ratified-pin repair ruling", "auditor run-3 launch" (last entry).
2. `research/auditor-run2-intake.md` — the docket format to mirror section by section.
3. `ONT/runs/orun-2026-09-03T02:46:18Z.index.yaml` (387 rows: 68 `unresolved` with
   `needed_evidence`, 44 `mapped`, 7 `proposed`, 268 `irrelevant`) and the 21 ratifications
   `ONT/governance/ratifications/rat-032..rat-052.yaml` (read via `git show HEAD:`; lane A moves
   them to the archive shelter).
4. `ONT/work/sittings/ratification-docket.{md,yaml}` and `carried-rows-docket.md` (via
   `git show HEAD:`), `ONT/work-run2/impl-report.md` "Results".
5. `research/run3-corpora-design-brief.md`, `research/run3-lanes/emission-v2-report.md` (§1 term
   table; hasScopeTag literal replaces hasScope; no object-property hasScope/Scope emitted),
   `research/run3-lanes/handoff-2026-09-09.md`.
6. `ontology/docs/competency-questions.yaml` (CQ-019, CQ-020), `ontology/docs/traceability-matrix.csv`,
   `ontology/tests/cq-019.sparql`, `ontology/tests/cq-020.sparql`, `ontology/tests/fixtures/seed.ttl`,
   and the packet `README.md` for how the CQ suite and must-fail fixtures are executed.

## Laws

- Public repo: no host paths, home directories, user ids, hostnames, session ids.
- The CQ suite and seed are docket inputs that the run manifest pins at the pin commit; edit them
  ONLY as Rulings 14 and 16 authorize (below). Any other CQ, seed, or contract change is out of
  scope; if you believe one is required, report it as a blocker.
- Friction receipts go to `research/OPPORTUNITIES.md` at the moment they happen (redacted).
- `bun` is at `~/.local/share/mise/installs/bun/1.4.2/bin`; Python via
  `UV_CACHE_DIR=~/.cache/beep/uv-cache uv run --offline --python 3.12 --with pyyaml python`.

## Deliverable 1 — `research/auditor-run3-intake.md`

Mirror the run-2 docket's structure: title, prior-run chain (validator-enforced:
`prior_index runs/orun-2026-09-03T02:46:18Z.index.yaml`, `prior_index_sha256_12 a207a106de68`,
`first_run: false`), queue by source, engine deltas since run 2, not in scope. Contents:

- **Queue A — ordering cluster (ratifies together or re-parks together).** Every provisional
  `ciops-prov:` term the emission-v2 report emits: `ScheduleStep`, `hasStep`, `stepIndex`
  (0-based per Ruling 14), `schedulesSeatRequest`, `hasScopeTag`, `VerificationEpisode`,
  `hasCurrentProposal`, `AdmissionProjectionSpecification`, `hasProjectionSpecification`,
  `policyDigest`, `journalPrefixDigest`, `scheduledUnitRef`, `defersSeatRequest`, plus the
  `ciops-prov:` namespace re-proposal (Ruling 15). Name the evidence each grounds in: the
  emission fixture, the Turtle emission sites, the S7 contract, the three run-2 ordering
  captures (all transcribed by lane A). Cite the sitting-3 Ruling 1 deferral rows from the
  index (`hasStep`, `stepIndex` and the CQ-020-amendment-gated concessions).
- **Queue B — flagged provenance items rat-047..rat-052.** For each ratification, quote its
  flagged deferral verbatim from the record, and assign it to the run-3 corpus that bears it
  (`run3-checkout-identity`, `run3-fleet` v3 rows, `run3b-fleet`, `run3b-synthetic`) or mark it
  RE-PARKED TO RUN 4 when it is an issuance-custody item under Ruling 17 (proof-ledger issuance
  has no lane writer until time-to-certainty C4).
- **Queue C — the 68 unresolved index rows.** Cluster by `needed_evidence` into: (i) rows the
  run-3 corpora discharge (C1 fleet checkout identity → bindings pin; C2/C3 grant contention and
  the lease lifecycle → v3 rows + synthetic scenario; the promoted riders `pa-failure-signature`
  and `pa-cache-plan-resolution` → verdict projections); (ii) rows gated on the CQ-020 amendment
  (now landed, #963) → Queue A; (iii) the Ruling-6 re-parked families (about 13 families, ~25
  rows) that stay parked with their named evidence — list them by family with row counts; (iv)
  anything else, with a one-line reason. Every row id must appear exactly once. Give totals.
- **Queue D — legacy-term dispositions (Ruling 16).** `schedulesWorkUnit` stays the CQ-019 arm-3
  historical carrier, unratified and unrewritten. The object-property `hasScope`/`Scope` pair:
  state whether run-3 fixtures exercise arm 2 (the emission-v2 fixture emits only the
  `hasScopeTag` literal) and therefore whether the pair parks with the no-punning record.
- **Non-triggers and carry-forwards.** TS adapter v1.1.0 non-trigger (Ruling 7); proof-ledger
  issuance → run 4; S8 IRI scheme deferred (Ruling 15); the `corpus_tree`/`corpus_base`
  convention for S6 POLICY; seats per the launch entry.
- **Engine deltas since run 2.** Validator v14 (list the field amendments from
  `.claude/skills/ontology-foundational-auditor/REVIEW-HISTORY.md` "Field amendments" and the
  v14 docstring), the sibling archive shelter now formalized, Python runtime pin (lane A
  reports the self-test result; write "per lane A report" if it is not yet available), the
  corpora conventions (`corpus_commit`/`corpus_tree`/`corpus_base`, `ownerRef`/`ownerRefVariant`
  custody surrogate, `security_resanitization` records) that seats must read as capture
  provenance, not domain vocabulary.
- **Not in scope.** Mirror run 2's list, updated.

## Deliverable 2 — Ruling 14 edits

- `ontology/tests/fixtures/seed.ttl`: `stepIndex` values become 0-based (the deployed emission
  is the evidence; ORDER BY is unaffected). Adjust only the ordinal literals and any fixture
  comment that states the base.
- `ontology/docs/competency-questions.yaml` CQ-020: fix the sample answer to 0-based ordinals.
  Do not change the question text, the SPARQL, `required_properties`, or the notes beyond the
  minimal wording that states the base.
- If a must-fail fixture or the CQ-020 SPARQL asserts 1-based ordinals, fix the assertion the
  same way and say so.

## Deliverable 3 — Ruling 16 consistency item (CQ-019)

Align three artifacts that currently disagree: CQ-019's `required_properties`, the traceability
matrix row(s) for CQ-019, and the arm predicates the CQ-019 query text actually uses (both the
YAML `sparql` block and `ontology/tests/cq-019.sparql`). The historical arm-3 carrier
`schedulesWorkUnit` stays as the carrier; the fix is alignment of the declared property list and
the matrix to the predicates in the query, not a rewrite of the arms. Record before/after in the
report.

## Proofs

- Run the CQ suite the way the packet README documents (seed + all `cq-*.sparql`; the must-fail
  fixtures must still fail). Capture the exact command and verdict; if the runner needs the
  oxigraph driver, use the repo's script, never an ad-hoc reimplementation.
- Residue scan (grep for `/home/`, `elpresidank`, hostnames, uids) over touched files.
- Typos check on touched files if `bun run beep` exposes one.

## Report

Write `research/run3-lanes/run3-pin-docket-report.md`: docket totals per queue, the before/after
of Deliverables 2–3, the CQ-suite command and verdict, blockers, and a final `### Files` list of
every created or edited path.
