# Round 2 Seat E — repair-regression attack (queries)

## Findings

- [BLOCKER] `CQ-004` — the repaired touched-package `BIND` does not see the outer `?touched`, so the query returns an unbound row instead of the touched package and a `non_empty` check falsely passes. The offending nested arm is `{ BIND(?touched AS ?pkg) } UNION { ?pkg ciops:dependsOnTransitive ?touched . }`. Minimal A-Box:
  ```turtle
  @prefix ciops: <https://oip.law/ontology/ci-ops#> .
  ciops:cs ciops:touchesPackage ciops:pkg .
  ```
  Oxigraph 0.5.9 transcript:
  ```text
  CQ004 touched-only: ["UNBOUND"]
  CQ004 plus-dependent: ["UNBOUND","https://oip.law/ontology/ci-ops#dep"]
  ```
  SPARQL evaluates that nested UNION arm without the preceding group's solution mapping; the failed `BIND` leaves `?pkg` unbound, then the outer join restores only `?touched`. Repeat the `touchesPackage` pattern inside the direct arm or otherwise bind `?pkg` before testing `non_empty`.
- [BLOCKER] `CQ-006` — an invalidated proof still discharges an obligation. The suppressing pattern checks only `dischargesObligation`, `provesTree`, and `validInEpoch`; it omits CQ-005's `FILTER NOT EXISTS { ?event ciops:invalidates ?proof }`. Counterexample A-Box:
  ```turtle
  @prefix ciops: <https://oip.law/ontology/ci-ops#> .
  ciops:TierCiMergeGreen ciops:requiresLane ciops:LaneA .
  ciops:proof-old ciops:dischargesObligation ciops:LaneA ; ciops:provesTree ciops:tree-example ; ciops:validInEpoch ciops:epoch-example .
  ciops:event ciops:invalidates ciops:proof-old .
  ```
  Exact-query Oxigraph transcript: `invalidated proof, CQ005 valid proofs: []`; `invalidated proof, CQ006 missing lanes: []`. CQ-006 should return `LaneA`. Restrict its inner proof match to proofs that CQ-005 considers valid.
- [BLOCKER] `CQ-012` — the repaired share query silently removes a partially observed episode from every numerator and the denominator, so one missing component biases all shares. The mandatory chain `?ep ciops:lockWaitMs ?lock ; ... ciops:ciWaitMs ?ci ; ciops:timeToCertaintyMs ?total` admits only complete episodes. With one complete 100 ms episode `(lock,exec,repair,ci)=(10,40,20,30)` and a second 100 ms episode `(90,0,10,missing)`, Oxigraph reports:
  ```text
  CQ012 with ep2 missing ciWaitMs: {"lockShare":"0.1","execShare":"0.4","repairShare":"0.2","ciShare":"0.3","grandTotalMs":"100"}
  CQ012 after adding ep2 ciWaitMs=0: {"lockShare":"0.5","execShare":"0.2","repairShare":"0.15","ciShare":"0.15","grandTotalMs":"200"}
  ```
  This is not the recorded zero-row completeness issue: a populated graph returns plausible but wrong statistics. Either make the ETL completeness contract executable before this query, or count the window population separately and fail when any component is absent.
- [BLOCKER] `CQ-012` / `expected_result: non_empty` — a zero denominator still yields one aggregate row, with every requested share unbound, so the repaired test can green without an answer. The query has no `HAVING (SUM(?total) > 0)` or boundness assertion. Oxigraph transcript for one fully populated all-zero episode: `CQ012 all-zero row: {"grandTotalMs":"0"}`. A row-count-only `non_empty` oracle accepts it even though `?lockShare`, `?execShare`, `?repairShare`, and `?ciShare` are absent.
- [BLOCKER] parameter-binding convention / `CQ-002,004,005,006,011,012,014,015` — the header permits replacing a block's "rows" with the caller's individuals but neither limits the harness to one row nor makes batched answers separable. Seven SELECTs omit at least one input key; `CQ-012` aggregates across all window rows without grouping and double-counts episodes in overlapping windows; `CQ-015` reduces every proof-checkout row to one existential Boolean. Executable counterexamples:
  ```text
  CQ012 two overlapping binding rows: {"lockShare":"0.333333333333333333","grand":"300"}
  CQ015 [true,false] batch: true false pair alone: false
  ```
  The CQ-012 graph had two 100 ms episodes, one 100% lock in the full-month window and one 0% lock in both the full-month and late-month windows; correct per-window answers are `0.5` and `0`, not the merged `1/3`. In CQ-015, one transferable pair masks one non-transferable pair. State a one-row-only contract and enforce it, or project/group by every input tuple and replace batched `ASK` with keyed SELECT results.
- [WARN] suite header / `CQ-011,012` date filters — the convention says the harness supplies "actual individuals," but these two parameters are typed literals. A plain RDF string timestamp is not comparable to `xsd:dateTime`; the FILTER raises an expression error and silently drops that solution. This undercounts a mixed graph while `non_empty` stays green, and CQ-012 stays non-empty even when every timestamp is mistyped. Oxigraph evidence: `CQ011 typed+plain events: ["typed"]`; `CQ011 plain-only events: []`. Specify RDF terms with preserved datatypes and add a datatype-validation fixture/gate.
- [BLOCKER] `CQ-013` — the repair cannot reveal a delayed signature with no surfacing lane because `surfacedByLane`, lane cost, and `p50Ms` are mandatory outer joins. A graph with `sig-no-lane attributedDelayMs 999` plus a lower-delay, fully linked signature returns only the latter; Oxigraph returned two tied cheapest rows for `sig-tie` at delay `100` and no row for `sig-no-lane`. Thus the first clause, "Which failure signatures most delay certainty," silently excludes the strongest coverage hole while `non_empty` passes. No CQ-013 note records a totality precondition. Use `OPTIONAL` plus an explicit missing-lane result, or add an executable totality constraint.
- [BLOCKER] `CQ-015` / generated oracle — `expected_result: boolean` checks only the result type, not the expected value, so every legal ASK implementation passes. The authority's `sample_answer` says `transferable: true`, but `regen_cq_artifacts.py:38-44,59-64` emits neither that value nor a negative fixture into the `.sparql` header or manifest. Exact-query transcript: `CQ015 empty seed: false boolean`; `CQ015 matching seed: true boolean`. Replace `boolean` with an expected Boolean value per fixture, and exercise both a transferable and non-transferable pair.
- [BLOCKER] `regen_cq_artifacts.py:27-48,57-64` — the generator performs destructive writes with no schema, enum, or ID/path-uniqueness preflight. A priority typo such as `must-have` silently removes that CQ from `testable`, then the stale-file loop deletes its test. IDs `CQ-019` and `CQ-019-amended` both reduce through `c["id"].split("-")[1]` to `cq-019.sparql`; the latter overwrites the former while the manifest emits two entries pointing at one file. A checker that derives expectations from the same loaded YAML can self-certify both losses. Validate the complete authority and unique output paths, render in memory, then replace artifacts only after every check passes.
- [WARN] `regen_cq_artifacts.py:38-44` — a valid multiline `natural_language` corrupts generated SPARQL because only its first line receives `# `. In-memory simulation produced `# CQ-777: First line\nSELECT * WHERE { ?s ?p ?o }\n# Expected: ...`; the continuation becomes a live query before the real query. Current NL values are single-line, so this is a generator regression risk, not current drift. Prefix every physical header line or reject newlines during preflight.

## Attacks that failed (repairs held)

- All 18 generated queries parse under the installed Oxigraph 0.5.9 engine; a coherent seed produced the declared result shape for every test (`001:1, 002:1, 003:1, 004:2, 005:1, 006:2, 007:1, 008:1, 009:0, 010:0, 011:1, 012:1, 013:1, 014:1, 015:true, 016:1, 017:3, 019:0`), so no other `non_empty` CQ is inherently unsatisfiable.
- The three `zero_rows` tests are falsifiable: minimal violation A-Boxes produced 2 rows for CQ-009 and 1 each for CQ-010 and CQ-019.
- CQ-006's negation is correlated to the outer `?lane`, `?tree`, and `?epoch`: an other-tree proof for lane A did not suppress A, while a matching proof for lane B suppressed only B. The separate invalidated-proof hole remains a finding.
- CQ-013's strict `<` implements a set-valued argmin correctly: both lanes tied at the minimum p50 survived and the higher-cost lane did not.
- CQ-017's UNION is symmetric: CI-only and local-only lanes returned with the correct `?onlyIn`, while a common lane was omitted.
- CQ-019's unconstrained `?subject` matches "anything — proof or schedule"; an untyped subject carrying `scopedByComputation` is intentionally caught, and a class constraint would open a loophole.
- Marker confusion did not reproduce: the suite has nine VALUES blocks, exactly the eight parameterized CQs carry one `# harness binds`, and CQ-008 is the sole unmarked, non-leading fixed-domain block.
- Exact in-memory regeneration matched all 18 query files, the manifest, and the traceability matrix byte-for-byte; current IDs/files are unique, no stale test exists, and no current YAML anchor or multiline NL triggers the generator findings.
- Prefix shadowing did not reproduce in current artifacts: every generated query has exactly one live `ciops:` declaration and all 18 use `https://oip.law/ontology/ci-ops#`.
- Omitting CQ notes from standalone headers did not establish content drift: the YAML declares itself authoritative and every current query body is byte-faithful.
- A plain-string-only CQ-011 window returns zero rows, so its `non_empty` oracle goes red; the false-green aggregate form is specific to CQ-012, while CQ-011's remaining risk is mixed-graph undercounting.
