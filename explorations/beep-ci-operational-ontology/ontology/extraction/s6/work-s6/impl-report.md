# S6 A-Box implementation report

## State handed to the steward

Implemented the ratified S6 contract on branch `ontology-s6-abox` at corpus commit
`3b27a0c17900a28578ec6a0d59dc70a2887c5bc9`. The tree is intentionally dirty for
review. No commit was made, and `apply_s6_dispositions.py --apply` was not run.

The implementation produced:

- `PREDICATES.yaml`: 83 registered predicates and a mechanical coverage row for each
  of the 25 committed CQ files.
- `POLICY.yaml`: 7 scheduler parameters, 4 admission weights, 2 priority members, and
  4 work-kind members extracted from the live TypeScript source. All 11 joined S4
  facts match; the drift table is empty.
- `CENSUS.yaml` and `graphs/census.ttl`: 138 `@beep/*` workspace packages and 804
  distinct workspace dependency edges in the provisional namespace.
- `snapshot/raw/journal.ndjson`, `snapshot/raw/MANIFEST.yaml`, and the timestamped
  snapshot and manifest graphs: 79 copied events, 41 admitted requests/grants, and a
  redacted-byte digest of `cf30b993a38d` at `2026-08-30T22:04:02.475Z`.
- `ABOX.yaml` and `graphs/abox.ttl`: one admission-policy individual, four work-kind
  individuals with weights, and two collision-qualified priority individuals.
- `shapes/closure.ttl`, `shapes/typing.ttl`, and `scripts/run_shacl.py`: closure
  structure, ratified typing, exact priority membership, policy datatypes, snapshot
  datatypes, and non-negative wait validation.
- An S6 gate in `validate_packet.py`, mechanical golden-leg handling in
  `run_cq_suite.py`, CQ leg metadata, and a check-first disposition projector.

Nine ratification references remain null by design: policy, four work kinds, two
priorities, census, and snapshot. The S6 gate reports these as one pending-sitting
warning. The seven fact-class rows and candidate seq-247 remain `deferred-s6` until
the refs are filled and the steward deliberately runs `--apply`.

## Judgment calls and honesty findings

### Ratified and provisional graph boundaries

- The census is a distinct open-world provisional graph. Workspace dependency edges
  are deduplicated across `dependencies`, `devDependencies`, and `peerDependencies`.
  It is parsed by the SHACL runner but excluded from ratified typing and negation.
- The snapshot-manifest companion uses a small `manifest:` provisional vocabulary.
  `closure.ttl` validates that graph. `typing.ttl` receives only `abox.ttl` and the
  snapshot graph, so provisional metadata cannot masquerade as ratified CI-ops data.
- `typing.ttl` targets subjects of all 16 ratified predicates, including `rdf:type`,
  and permits only the 18 S5-ratified class IRIs as types.
- Bare `ciops:publish` is used only for the AdmissionWorkKind member. Priority members
  are `ciops:AdmissionPriority-publish` and `ciops:AdmissionPriority-verify`; bare
  `ciops:verify` is absent.

### Snapshot projection

- Redaction removes compact-JSON members `pid` and `procStart` without reserializing
  adjacent data. Each transformed event is decoded and compared with the source event
  minus exactly those two fields; any other change hard-fails. The source journal is
  only read.
- The instant is derived from the maximum numeric `*Millis` field in the copied
  events. Request/grant output is sorted by admission time and nonce. Empty origin
  keys are counted but not asserted.
- `observedQueueWaitMs` is asserted on `SeatRequest`, matching the taxonomy domain.
  A negative wait hard-fails extraction.
- `admittedBy` was not asserted. TAXONOMY defines its direction as
  `WorkUnitSpecification -> SeatGrant`, while the journal yields `SeatRequest`
  individuals. Minting a request-to-grant edge would violate the ratified domain.
- `hasGrantState`, work kind, priority, `capacityAtAdmissionTokens`, and `activeTokens`
  are not asserted. State, kind, and priority are retained as manifest tallies;
  capacity and active-token values are absent from the journal. All six gaps are
  listed in `MANIFEST.yaml`.
- `hasGrantState` still has a closure declaration because the journal window is
  complete for its active/released tally. The manifest says explicitly that this is
  manifest-only completeness and not a ratified RDF assertion.

### Predicate and CQ mechanics

- The scanner recognizes direct QName predicates in triple heads and semicolon
  continuations, removes comments, `PREFIX`, and simple `VALUES` blocks, and
  normalizes Turtle/SPARQL `a` to `rdf:type`. It does not expand variable predicates,
  property paths, `SERVICE` clauses, or generated query text. Those limits are in the
  generated registry header.
- A parked-run-2 status is assigned only when a scanned predicate's exact local name
  is an S5 parked property candidate. Unmatched seed/CQ-only terms remain seed-only.
- Golden selection has no CQ allowlist. A CQ runs only when the generated registry
  marks its complete predicate set ratified and its existing non-vacuity antecedent
  succeeds over `abox.ttl + snapshot-*.ttl`.
- The contract's branch-cut expectation says CQ-010 should fail coverage. The live
  ratified surface makes that impossible: its three scanned predicates are
  `admittedBy`, `admissionChargeTokens`, and `capacityAtAdmissionTokens`, and all three
  are ratified TAXONOMY properties. The implementation therefore records CQ-010 as
  3/3 rather than falsifying registry status. Its golden antecedent is absent because
  no directionally valid `admittedBy` edge or capacity observation exists, so it is
  skipped. The result remains zero executed golden CQs.
- The golden store is still non-vacuous: its three hard-coded probes prove at least
  one `SeatRequest` with `enqueuedAt`, no negative or nonnumeric observed wait, and at
  least one non-empty `hasOriginKey`.

### Disposition projection

`apply_s6_dispositions.py` checks the exact candidate and seven fact-class transition
set in default mode. `--apply` refuses to write while the policy sitting reference is
null. If deliberately run after the sitting, it is the only S6 script that edits the
projected S4/S5 status files.

## CQ predicate coverage

Coverage is the number of mechanically scanned predicates whose registry status is
`ratified`. This table is run-2 re-proposal input.

| CQ | Ratified / scanned | Fully covered |
| --- | ---: | :---: |
| CQ-001 | 1 / 2 | no |
| CQ-002 | 1 / 5 | no |
| CQ-003 | 0 / 5 | no |
| CQ-004 | 0 / 2 | no |
| CQ-005 | 0 / 3 | no |
| CQ-006 | 0 / 5 | no |
| CQ-007 | 0 / 6 | no |
| CQ-008 | 1 / 3 | no |
| CQ-009 | 2 / 3 | no |
| CQ-010 | 3 / 3 | yes; antecedent absent |
| CQ-011 | 0 / 4 | no |
| CQ-012 | 0 / 7 | no |
| CQ-013 | 0 / 4 | no |
| CQ-014 | 0 / 4 | no |
| CQ-015 | 0 / 4 | no |
| CQ-016 | 1 / 2 | no |
| CQ-017 | 0 / 1 | no |
| CQ-019 | 1 / 6 | no |
| CQ-020 | 1 / 6 | no |
| CQ-021 | 3 / 6 | no |
| CQ-022 | 1 / 4 | no |
| CQ-023 | 2 / 5 | no |
| CQ-024 | 1 / 2 | no |
| CQ-025 | 1 / 6 | no |
| CQ-026 | 0 / 4 | no |

Aggregate result: 1/25 status-covered, 0/25 antecedent-populated, and 0/25 executed
on the golden store.

## Verification

The managed session could read but not lock the normal uv cache. I used a task-local,
offline cache assembled from already installed artifacts; no dependency was added to
the repository and no network fetch was used. The legacy validator imports `rdflib`
at module load even in default and S5 modes, so those two commands inherited the
already-cached `rdflib` and `pyparsing` archives through `PYTHONPATH`.

Environment used for the exact acceptance commands:

The public-repo rendering below replaces the absolute home-directory prefix with
`~`; the shell command is otherwise unchanged.

```sh
export UV_CACHE_DIR=/tmp/beep-s6-uv-subset
export UV_OFFLINE=1
export UV_PYTHON=/usr/bin/python3.14
export PYTHONPATH=~/.cache/uv/archive-v0/ycTSDtY9NyNqVDD0:~/.cache/uv/archive-v0/EBmnurdJTFAYTEfR
```

Commands and results, all run from the packet root:

1. `uv run --with pyyaml python ontology/extraction/s6/scripts/build_predicates.py`
   — exit 0; 83 predicates, 1/25 CQ predicate sets fully ratified.
2. `uv run --with pyyaml python ontology/extraction/s6/scripts/etl_policy.py`
   — exit 0; 7 parameters, 4 weights, 2 priorities, 4 work kinds, zero drift.
3. `uv run --with pyyaml python ontology/extraction/s6/scripts/etl_census.py`
   — exit 0; 138 packages and 804 distinct workspace edges.
4. `uv run --with pyyaml python ontology/extraction/s6/scripts/etl_snapshot.py`
   — exit 0; 79 events, 41 admissions, instant `2026-08-30T22:04:02.475Z`,
   redacted digest `cf30b993a38d`.
5. `uv run --with pyyaml,rdflib python ontology/extraction/s6/scripts/build_abox.py`
   — exit 0; 1 policy, 4 work kinds, 2 priorities; census digest `cc7f08231f65`,
   snapshot-manifest digest `0e80c9792e35`.
6. `uv run --with pyshacl,rdflib python ontology/extraction/s6/scripts/run_shacl.py`
   — exit 0; census parsed, five closure declarations matched exactly, and both
   closure and typing shapes conformed.
7. `uv run --with pyyaml python ontology/extraction/s6/scripts/apply_s6_dispositions.py`
   — exit 0 in default check mode; candidate seq-247 and seven facts reported as
   pending, policy ref pending, and no files changed.
8. `uv run --with pyyaml python research/scripts/validate_packet.py`
   — exit 0; 0 blockers and 0 warnings.
9. `uv run --with pyyaml python research/scripts/validate_packet.py --s5`
   — exit 0; 0 blockers and 0 warnings.
10. `uv run --with pyyaml,rdflib python research/scripts/validate_packet.py --s6`
    — exit 0; 0 blockers and 1 expected pending-sitting warning. Its SHACL subprocess
    ran and passed; registry 83, coverage rows 25, active golden legs 0, drift 0,
    pending refs 9.
11. `uv run --with pyoxigraph python research/scripts/run_cq_suite.py`
    — exit 0; all 25 seed tests and all 19 must-fail fixtures passed, the three golden
    probes passed, and zero golden CQs executed.

The five generators were then run a second time with the same environment. I compared
SHA-256 output for `PREDICATES.yaml`, `POLICY.yaml`, `CENSUS.yaml`, `ABOX.yaml`, both
stable graph files, both timestamped graph files, `MANIFEST.yaml`, and the redacted
journal. All ten files were byte-identical, and the repository's tracked `git diff`
content hash was unchanged across the second pass. The source-journal SHA-256 also
remained unchanged across both passes.

Additional audits:

- `git diff --check` — exit 0.
- `rg -n '"(pid|procStart)"' ontology/extraction/s6/snapshot/raw/journal.ndjson`
  — no matches.
- An in-memory `pyshacl` mutation harness rejected all four controls: an unratified
  `rdf:type`, a negative `observedQueueWaitMs`, an extra AdmissionPriorityClass
  member, and a closure declaration missing its source field.
- Protected S4/S5 generated surfaces, TAXONOMY, JOIN, LEDGER-DOCKET, CONSTRAINTS,
  seed Turtle, CQ query files, and the contract were not edited by this lane.

## Steward-review addendum (Fable, post-sitting 2)

Three corrections applied to this lane's output during review:

1. **Report placement** — moved from packet-root `work-s6/` to
   `ontology/extraction/s6/work-s6/` (the S5 `work-s5` precedent).
2. **Snapshot source pinning** — `etl_snapshot.py` now prefers the committed
   `snapshot/raw/journal.ndjson` over the live `/tmp` journal (which grows with
   every machine-wide admission and moved the instant once mid-implementation);
   `--refresh` deliberately re-captures. The capture-time source block in
   MANIFEST.yaml is carried forward verbatim on pinned reruns.
3. **Discharge semantics** — `apply_s6_dispositions.py --apply` no longer
   rewrites the historical S5 rulings (`deferred-s6` → `accepted-via` mutated
   the S5 sitting record and made the `--s5` gate demand an A-Box individual in
   the T-Box). The rulings stay `deferred-s6`; discharge is the
   `s6_ratification_ref` beside them plus accepted statuses on the S4 surfaces;
   the `--s6` residue check keys on undischarged rows.

The lane's honest contract correction (cq-010 passes predicate coverage and
fails only on the missing `capacityAtAdmissionTokens` antecedent) was adopted
into the contract. Ratified at S6 sitting 2 (DECISIONS.md); all four gates and
the CQ suite are green at 0 blockers post-discharge.
