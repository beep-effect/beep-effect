# Auditor run-2 implementation report

## Outcome

Auditor run 2 is **IN PROGRESS** at the adversary-revision stage. The pinned
fleet corpus, observe pass, denotation pass, primary and blinded foundational
passes, synthesis pass, first adversary round, review-validity audit, and
steward sitting 1 are complete for the current round. The 80 demonstrated
attacks now drive proposal revision, while 20 invalid attacks are struck from
the re-review basis. Re-review, final dispositions, ratifications, the terminal
mechanical gate, and the unresolved-fraction calculation have not happened.
This report records the implementation and census at that boundary; final
numbers land only at run close.

## Engine and environment findings

The run is locked by
`explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml`
to run `orun-2026-09-03T02:46:18Z`, validator digest `c036e5316511`, contracts
digest `db5aefe804fe`, and one repository commit. Four launch findings changed
how the locked engine could execute. They are operational findings and pins,
not ontology results.

| Finding | Observed failure or gap | Run-2 handling and remaining caveat |
| --- | --- | --- |
| Sandbox `RLIMIT_NPROC` placement | The sandbox runner applied `prlimit --nproc=64` before Bubblewrap created its user namespace. Linux charged that limit against the invoking UID's host-wide task count, so a normally loaded desktop session exhausted the allowance before `bwrap` could clone. Bare namespace creation still worked, which isolated the fault to the outer per-UID limit rather than Bubblewrap itself. | The vendored runner at `.claude/skills/ontology-foundational-auditor/scripts/run_adapter_sandbox.sh` now executes Bubblewrap directly and wraps the adapter command with the `resource_limits` array inside the fresh namespace. Run 2 pins those fixed bytes. The upstream regression case still needs a realistic loaded-session smoke test. |
| Python 3.13 validator incompatibility | Validator v13's self-test is incompatible with Python 3.13's `pathlib` symlink-loop resolution behavior. This is an engine/runtime compatibility failure, not a corpus defect. | Every validator invocation is pinned to `uv --python 3.12` with PyYAML. That runtime passes all 156 validator families. The pin remains binding for this run; the validator or its runtime declaration still needs an upstream 3.13 resolution. |
| Archive scanning | Validator v13 scans YAML records under the ontology root by record-name prefix without exempting the run recipe's in-root archive location. Run-1 observations then appeared as live evidence under the run-2 manifest, carried seat trees produced 1,896 dangling references, and 31 prior ratifications referred to proposals outside the live run. | The run-1 observations, seat trees, and ratifications were moved, with their inner bytes unchanged, to `explorations/beep-ci-operational-ontology/ontology/extraction/s4/archives/beep-ci-ops/`. The relocation is documented in `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/runs/orun-2026-08-29T08:20:55Z.README.md`. The validator or rotation recipe still needs a supported archive shelter. |
| `CONFIG_EXTS` excludes `.ndjson` | Validator v13 cannot authenticate `config_key_value` facts directly against the admission, attempt, and verdict NDJSON files because `.ndjson` is absent from its configuration-extension set. The adapter could not repair that mismatch on its own. | The fleet ETL retained each redacted raw record as the fidelity copy and derived a sibling `.properties` projection. The journal adapter reads only those fixed projection families, whose pair grammar the validator accepts. The ontology is grounded through the projections; the raw files remain the custody and fidelity evidence. |

The sandbox failure is recorded in the final receipt of
`explorations/beep-ci-operational-ontology/research/OPPORTUNITIES.md`. The
preceding receipt also matters to the pin: a format sweep had changed a frozen
run-1 adapter while leaving its digest sidecar stale. Run 2 therefore treats
the manifest-pinned adapter bytes and independent gate comparison as evidence,
not ceremony.

## Corpus

`explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/run2-fleet/MANIFEST.yaml`
records a public fleet capture across 30 Beep checkouts. It inventories 794
redacted raw payloads, comprising 2 admission journals, 282 attempt journals,
and 510 verdict records. Each raw payload has one sibling properties
projection, for 1,588 payload files and 6,213 source events; the manifest is the
1,589th emitted file. Event totals count source records once and do not count
their derived projection stanzas again.

Admission redaction removes the top-level process identifier and process-start
members while preserving every other decoded key and value. Attempt and verdict
redaction changes string values only: it replaces fleet, operator-home, and
temporary-root prefixes with portable tokens and masks process identifiers.
Structural keys, booleans, nulls, and numbers remain unchanged. The manifest
records `PASS` for redaction comparison, projection comparison, host-path scan,
and secret scan. These are manifested ETL checks; they do not turn a projection
into the raw fidelity record.

The admission capture also preserves a split-brain root finding. The
session-scoped source at
`explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/run2-fleet/admission/session-tmp/journal.ndjson`
contains 2 events, while the system-scoped source at
`explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/run2-fleet/admission/system-tmp/journal.ndjson`
contains 24. The manifest keeps their provenance and source ordering separate.
Run 2 does not infer that they are one continuous admission journal or invent a
cross-root lifecycle join.

## What was built

| Artifact | Responsibility |
| --- | --- |
| `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/etl_fleet_corpus.py` | Captures the fleet's admission, attempt, and verdict records; applies the public redaction contract; writes deterministic properties projections; and emits the complete digest manifest. |
| `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/adapters/adapter-journal.py` | Standard-library-only SourceObservation adapter for the three properties families. Its behavior and run-2 rationale are recorded in `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/adapters/README.md`. |
| `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/po_transcriber_run2.py` | Deterministically transcribes exact parked evidence quotes and the three declared S7 prose sources into pinned ProseObservations. It splits explicit elisions, recovers the smallest bounded source window when recorded coordinates drift, reports corrections, and emits nothing for text it cannot locate. |
| Three narrow ProseObservations | `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/prose-observations/po-736ad92a1de7.yaml` captures the provisional ordering terms; `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/prose-observations/po-35a69c5bcbf7.yaml` captures the `ScheduleStep` and `ScheduleProposal` schema span; `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/prose-observations/po-d1f555913267.yaml` captures the later `SeatRequest` correction and `schedulesSeatRequest` rename. These hand captures ground the exact ordering-vocabulary claims rather than relying on a broad neighboring section. |

The journal adapter is intentionally kind-local and vocabulary-bounded.
Admission, attempt, and verdict files are each visited in lexicographic
repo-relative path order. A file emits one whole-file SourceObservation only
when it contributes at least one validator-representable key not previously
seen for that kind. The record contains the first occurrence of every such new
key; a file with no new key emits nothing. The resulting 20 SourceObservations
are therefore a vocabulary census over the full manifested corpus, not a claim
that only 20 corpus files were examined.

The adapter reads one exact 40-hex commit pin from the run manifest because the
no-network sandbox cannot resolve a worktree Git directory outside its
read-only repository bind. This is a constrained provenance handoff, not a
self-attestation: the independent gate checks every record's commit against
both the manifest pin and the repository checkout. The manifest pins the
single-file Python adapter directly. The v1.1 TypeScript queue separately calls
for embedding its engine digest in the pinned wrapper, but the launch ruling
correctly deferred TypeScript re-extraction from this run.

The transcriber produced 215 ProseObservations from the re-opened run-1 evidence
and declared S7 prose sources. Together with the 20 adapter observations, that
is the generated `235` side of the observe census. The three narrow ordering
captures above are the explicit `+3`; they are not hidden inside the generated
count.

## Stage arc so far

The full-run ruling and prior-run chain come from
`explorations/beep-ci-operational-ontology/research/auditor-run2-intake.md` and
the nine launch rulings in
`explorations/beep-ci-operational-ontology/DECISIONS.md`. All 149 unresolved
run-1 rows entered run 2 as re-opened inputs rather than verbatim re-parks;
their final dispositions remain open.

| Stage | Current census and adjudicated meaning |
| --- | --- |
| Observe | `235+3` observations: 20 adapter SourceObservations plus 215 transcribed ProseObservations, followed by 3 hand-captured ordering-vocabulary spans. The three additions are disclosed separately because they were selected manually. |
| Denotation | 121 denotation hypotheses were emitted from the journal, parked-evidence, and ordering batches. This is a hypothesis census, not a count of accepted ontology terms. |
| Foundational and blinded alternative | The primary pass produced 40 identity-card/foundational-analysis pairs. Synthesis split three of those paired chains into five additional proposal branches, giving the downstream `40+5` primary-chain census without pretending that 45 independent pairs were authored. The blinded seat produced 40 independently named `-alt` identity-card/foundational-analysis pairs and converged independently on the survivor set carried into synthesis. |
| Synthesis | 45 proposals were emitted. The five-chain expansion from 40 primary pairs is why proposal count and pair-file count differ. |
| Adversary round 1 | All 45 proposals received reviews: 36 `FAIL`, 4 `INDETERMINATE`, and 5 `PASS`. The adversary landed 100 attacks. A landed attack is only the adversary's claim at this point, not a validity ruling. |
| Validity audit and sitting 1 | `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/review-audit/validity-report.md` audited every landed attack without introducing new ones: 80 are demonstrated and 20 are invalid. The steward ratified that split across warrant necessity, DTO discriminator, and identity-card defect clusters in the 2026-09-03 sitting recorded in `explorations/beep-ci-operational-ontology/DECISIONS.md`. |
| Collapsed failures | The entire landed attack bases for `otp:pa-docgen-work-unit:001` and `otp:pa-turbo-task-specification:001` were invalid. Those two adversary `FAIL` verdicts collapse and retire at re-review. Every other `FAIL` or `INDETERMINATE` review retains at least one demonstrated attack, though some also contain struck attacks. |
| Current boundary | Proposal revision is applying the sitting-1 rulings. Re-review, final steward dispositions, ratifications, the total prior-row discharge accounting, and terminal validation remain open. |

The three repair clusters set a narrower revision contract. Warrant-necessity
revisions remove support edges that the decision CQs do not need and concede
helper classes supported only by implementation convenience. DTO revisions
keep recorded measurements and capacities as information objects, but remove
unsupported process, quality, issuance, custody, and cross-record identity
claims. Identity-card revisions repair grain and parent-identity conflicts,
consolidate the three co-denoting S7 contract proposals, and leave boundaries
without provenance explicitly unresolved. A concession means unsupported by
the current corpus, not false.

## Upstream skill follow-ups queued

The manifest pins the validator, contracts, prompts, adapter, competency
questions, and repository bytes for the active run. These follow-ups may repair
the next engine or the post-run packet, but they must not mutate the judging
contract beneath run 2.

| Follow-up | Current state | Required next action |
| --- | --- | --- |
| Supported archive shelter | Run 2 uses the relocation under `explorations/beep-ci-operational-ontology/ontology/extraction/s4/archives/beep-ci-ops/` to keep run-1 records outside the live scanner root. | Teach the validator to exclude a declared archive family, or change the rotation recipe to a supported shelter that the validator does not scan as live evidence. Preserve archived bytes and reference closure. |
| Sandbox resource-limit placement | The inside-namespace fix is already vendored and pinned through `.claude/skills/ontology-foundational-auditor/scripts/run_adapter_sandbox.sh`; run 2 is not waiting on another sandbox patch. | Keep the fix in the upstream skill and add a loaded-session regression smoke test so host-wide per-UID task counts cannot recreate the launch failure. |
| Python runtime declaration | The active run is pinned to Python 3.12, where all 156 validator families pass. | Either declare 3.12 as the supported validator runtime or make the symlink-loop self-test and path handling compatible with Python 3.13 before lifting the pin. Do not change the runtime mid-run. |
| CQ-020 terminology | The pinned suite at `explorations/beep-ci-operational-ontology/ontology/docs/competency-questions.yaml` still asks for `schedulesWorkUnit`, while the ratified identity split and S7 amendment require a schedule edge to `SeatRequest`, named `schedulesSeatRequest`. Sitting 1 correctly treated the stale CQ wording and the supported rename as separate facts. | Amend CQ-020 after run close to use the ratified `SeatRequest` wording. This is a post-run CQ amendment because the current suite digest is manifest-pinned; editing it now would change the questions after proposals and reviews had bound them. |

## Results

Run 2 closed 2026-09-03 as `orun-2026-09-03T02:46:18Z` with the gate reading
`ARTIFACTS VALID — GATE PASSED` (steward flags only).

- **Adversarial arc:** round 1 delivered 36 FAIL / 4 INDETERMINATE / 5 PASS.
  A validity audit judged the 100 landed attacks (80 demonstrated, 20 struck
  at sitting 1, two FAILs collapsing entirely). The revision wave and two
  further rounds converged to 21 PASS / 23 INDETERMINATE / 0 FAIL.
- **Ratifications:** 21 records, `rat-032`..`rat-052` — 15 clean accepts
  (including the three seat-dispute rulings: `dependsOn` with no relator,
  resolved `CachePosture` as a recorded value, `Agent` as an anti-rigid
  admission-owner role) and 6 flagged reuse mappings onto ratified
  evidence/plan/priority classes with identity provenance deferred to run 3.
- **Deferred/withdrawn:** 24 proposals removed per the run-1 close precedent
  with named run-3 evidence, including the whole provisional ordering cluster
  — `ScheduleStep` and its relations ratify together only after the CQ-020
  amendment, so no dangling ends entered the taxonomy.
- **Prior rows:** all 149 carried run-1 rows adjudicated at sitting 2 —
  94 supersession retirements, 52 wrapper retirements, 3 kept open with named
  corpus requirements. Nothing was silently re-parked.
- **Dispositions:** final index of 387 rows; unresolved fraction 56% of
  non-irrelevant live rows under the steward-ratified waiver (every park
  carries adjudicated run-3 evidence).
- **Rotation:** manifest and index archived at
  `runs/orun-2026-09-03T02:46:18Z.*` (run 3's `prior_index_sha256_12`
  `a207a106de68`); observations archived under
  `../archives/beep-ci-ops/` per the scanner-defect relocation.
