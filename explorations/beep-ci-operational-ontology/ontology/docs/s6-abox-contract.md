# S6 contract — A-Box ratification & predicates

Binding contract for stage S6, ratified by the steward 2026-08-30 (DECISIONS.md,
S6 sitting 1 — two grill rounds, seven rulings). S6 runs BEFORE auditor run 2: the
A-Box lands against the ratified 38-term lattice; run 2 expands the T-Box on its own
corpus afterward. The stage delivers the runtime A-Box (the deferred policy
individual, the package census, the deployed LiteralKit enumerations, one golden
OperationalSnapshot), the predicate registry, and the closure-contract SHACL
enforcement shapes ruled to this stage at final grill.

## 1. Inputs (frozen at branch cut)

- `ontology/extraction/s5/TAXONOMY.yaml` — the ratified 38 terms (18 classes,
  7 properties, 9 literal-domain members, 4 named individuals). Byte-frozen: S6
  makes NO T-Box change.
- `ontology/extraction/s5/DISPOSITIONS.yaml` — the deferred-s6 surface: candidate
  seq-247 `YeetWeightedAdmissionV1` (individual of `AdmissionPolicy`, rat-017) and
  the seven policy-parameter fact classes (`capacityMaxTokens` 10, `slotSizeGib` 5,
  `reserveGib` 10, `hardFloorGib` 15, `heartbeatSeconds` 5, `publishAgingSeconds`
  120, `reviewFixClassCap` 3), plus the accepted `admissionTokenWeight` class
  (full-proof 3, merged-preview 5, review-fix 1, publish 1).
- `ontology/docs/closed-world.yaml` — the predicate closure contract (14
  declarations); S6 design law per the final-grill ruling.
- The live corpus at the S6 pin (the checkout commit recorded in `ABOX.yaml`):
  `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts`
  (`AdmissionWorkKind`, `AdmissionPriority`, `admissionTokenWeight`, the
  `SchedulerConfig` defaults), the workspace package manifests, and the
  `.beep/yeet/runs` journals/verdicts (golden-snapshot source).
- `ontology/tests/` — seed.ttl, the 25 generated CQ queries, cq-test-manifest.yaml,
  fixtures, must-fail (pyoxigraph engine).
- `research/kpi-measurement-rules.md` (episode-identity law) and
  `ontology/extraction/s5/CONSTRAINTS.yaml` (27 constraints; 4 waived to run 2).

## 2. Artifacts (all under `ontology/extraction/s6/`)

- `PREDICATES.yaml` — the predicate registry: one record per predicate any packet
  graph or CQ uses — `{predicate, status: ratified | seed-only | provisional |
  parked-run-2, term_ref, domain, range, closure (closed-world entry | open),
  used_by}`. Ratified status covers the 7 taxonomy properties, `rdf:type`,
  `admissionTokenWeight` (accepted fact-class ruling), and the seven policy
  parameters (ratified at the S6 sitting).
- `ABOX.yaml` — the human-diffable ratification surface, four sections: **policy**
  (YeetWeightedAdmissionV1 + its seven parameter facts — `publishAgingSeconds` is
  the deployed starvation aging carrier — and the four `admissionTokenWeight`
  edges), **enumerations** (deployed LiteralKit members the T-Box excluded:
  `AdmissionPriority` → `ciops:AdmissionPriority-publish`,
  `ciops:AdmissionPriority-verify`), **census** (count + generator digest; data in
  `CENSUS.yaml`), **snapshot** (instant, post-redaction source digests, counts).
  Every fact carries `{source: {file, line | command}, s4_fact | null, drift}`;
  every individual carries `{ratification: {mode: sitting | generator-digest,
  ref}}`.
- `CENSUS.yaml` + `graphs/census.ttl` — the @beep/* package census as a
  PROVISIONAL named graph: `ciops-prov:` namespace for the typing class and the
  dependency edge (the run-2 renaming obligation stays open), closure declared
  OPEN, excluded from negation and from ratified-typing shapes.
- `graphs/abox.ttl` (the ratified graph) and `graphs/snapshot-<instant>.ttl` (the
  golden OperationalSnapshot: SeatRequest/SeatGrant individuals from real journal
  bytes using only ratified predicates). `snapshot/raw/` holds the redacted source
  bytes (public repo: absolute paths → `~`, machine/session ids dropped) with a
  digest manifest.
- `shapes/closure.ttl` + `shapes/typing.ttl` — SHACL: closure-declaration
  validation before any negation is trusted, plus instance-of-ratified-class and
  parameter datatype/boundary-range conformance. Engine: `uv run --with pyshacl`.
- `scripts/` — deterministic, idempotent generators (`etl_policy.py`,
  `etl_census.py`, `etl_snapshot.py`, graph emission) plus
  `apply_s6_dispositions.py`, the sole writer that DISCHARGES the deferred-s6
  rows after ratification: the historical S5 rulings stay `deferred-s6`, each
  row gains an `s6_ratification_ref`, and the projected S4 statuses flip to
  accepted.

## 3. Loop

1. **Registry pass** — author `PREDICATES.yaml` from the taxonomy, the closure
   contract, the fact-class rulings, and a mechanical scan of every CQ query;
   every scanned predicate lands in exactly one status.
2. **ETL pass** — generators pin every fact to `{file, line | command}` at the S6
   pin. Divergence between a deferred S4 fact value and the live value is SURFACED
   as a drift row for a steward ruling, never silently re-extracted.
3. **Graph + shapes pass** — emit the three graphs; pyshacl conformance (both
   shape files) must PASS on `abox.ttl` + the snapshot graph.
4. **CQ pass** — golden legs bind MECHANICALLY, never by hand: a CQ runs against
   the golden store (abox + snapshot graphs) iff its full predicate set is
   `status: ratified` in the registry AND its non-vacuity antecedent holds
   there. The registry's coverage table quantifies the ratified-vs-CQ
   vocabulary gap (measured at implementation: cq-009 needs unratified
   `hasGrantState`; cq-010 is the sole coverage-passing CQ but its antecedent
   needs `capacityAtAdmissionTokens`, which the deployed
   `yeet-admission-journal/v1` never records; cq-023 needs unratified
   `governedBy`/`starvationBoundMs` and the parked `HardFloorException`) — the
   gap is surfaced as run-2 re-proposal input, never bridged with fabricated
   values or unratified assertions. Zero golden-legged CQs is an admissible,
   honest outcome; the golden store then proves itself through
   ratified-vocabulary ASK probes (non-empty SeatRequest population,
   non-negative waits) beside SHACL conformance. Suite exit 0.
5. **Sitting** — hybrid ratification: the policy individual, its facts, and the
   enumerations are presented individually; census and snapshot ratify as
   generator + output digest with steward spot-checks. Scribed in DECISIONS.md;
   `ABOX.yaml` carries the per-individual ratification refs (no rat- files —
   those are §4b engine artifacts).
6. **Projection** — `apply_s6_dispositions.py` discharges candidate seq-247 and
   the seven fact classes (refs beside the historical rulings, accepted
   statuses on the S4 surfaces); the gate re-runs green.

## 4. Gate (`validate_packet.py --s6`) — blockers

- Typing law: every `abox.ttl`/snapshot individual is `instance_of` a ratified
  class; no `ciops-prov:` term outside `census.ttl`.
- Predicate law: every predicate in every graph and every CQ is registered; the
  ratified graphs use only `status: ratified` predicates.
- IRI law: bare local names by default; a literal member whose bare name is taken
  is domain-qualified (`ciops:AdmissionPriority-publish`); bare `ciops:publish`
  stays reserved for the AdmissionWorkKind member (DECISIONS 4d).
- SHACL conformance on both shape files; a closure declaration exists for every
  predicate a golden-leg negation CQ filters over.
- Drift table empty, or every row carries a steward ruling ref.
- Post-projection: zero undischarged `deferred-s6` remains — every deferred
  ruling carries its `s6_ratification_ref` and no S4 status stays `deferred-s6`.
- CQ suite green on both legs; ETL idempotence (rerun → identical graph digests).

## 5. Non-goals

- No T-Box change: TAXONOMY.yaml stays 38 terms byte-identical; the census class
  stays provisional; VerificationLane placement waits for run 2.
- No auditor run 2 (journal/verdict corpus extension, adapter v1.1.0, the 163
  parked candidates, 76 parked ledger rows, 4 waived constraints).
- No durable telemetry ETL: the golden snapshot is one pinned instant, not a
  pipeline; the KPI probe stays v3.2 with its stated skips.
- No Effect-native code — `Tx*`/`Graph` modules are S7 (DECISIONS.md).
- No IRI doctrine ratification — S8 territory; S6 minting is provisional under
  the declared base.
- No edits to digest-locked §4b run evidence.
