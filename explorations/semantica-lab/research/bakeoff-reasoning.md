# Reasoning bake-off: wrapped-engine baseline

*Candidate screen (B1): this file is slate + probe order, not a family verdict. Current law: `../DECISIONS.md` "Current law" table. The canary is C0-C2 (G1), not the winner line below.*

Scope: wrapped engines only. The NET-NEW proof-ledger spike is excluded from scoring under A6.
Scores are evidence ranges, not forecasts. `UNKNOWN` never earns points.

## Required entailment suites

`gold/v1` is not present yet, so case counts within the contract's approximately 20 mixed cases
remain `UNKNOWN`. Each suite must compare both conclusions and independently replayable proof DAGs.

| ID | Required suite | Gold assertion |
| --- | --- | --- |
| R1 | RDFS closure | `subClassOf` and `subPropertyOf` transitivity, type and super-property propagation, domain/range typing; exact derived quads plus rule-and-premise proof [L1]. |
| R2 | SKOS hierarchy queries | Exact answers for asserted and transitive broader/narrower paths over the seeded ontology; each answer carries the traversed statement chain [L1]. |
| R3 | Datalog | Positive recursive Horn/fixpoint cases from the mixed approximately 20-case set; exact relation tuples, declared fragment, bound result, and proof per tuple [L1]. |
| R4 | Production rules | Remaining mixed cases cover multi-pattern joins, chained fact production, update/retraction, and bounded cycles; exact conclusion/activation plus premise proof [L1, L4]. |

Mapping codes describe semantic reach before gates: `F` direct fit, `P` translation or a restricted
fragment, `-` no fit. A mapping is not proof of soundness; no candidate has run `gold/v1`.

| Candidate | R1 | R2 | R3 | R4 | Mapping evidence |
| --- | --- | --- | --- | --- | --- |
| eyereasoner / EYE WASM | P | P | P | P | N3 forward/backward rules, RDFJS quads, closure output, and proof output; every suite needs a safe N3 Horn translation [W1, W2]. |
| N3.js Reasoner | P | P | P | P | Repeated BGP Horn rules only; no built-ins or backward chaining [L5, W3]. |
| shacl-engine | - | - | - | - | SHACL Core/SPARQL validation only; Advanced Features are unchecked [W4]. |
| rdf-validate-shacl | - | - | - | - | SHACL validation only; SHACL-SPARQL is explicitly unsupported [W5]. |
| Trealla WASM Prolog | P | P | P | P | ISO Prolog can host translations, but no RDF/Datalog/Rete contract is supplied [W6, W7]. |
| SWI WASM | P | P | P | P | General Prolog; every suite needs a controlled program and adapter [W8, W9]. |
| Ascent | P | P | F | P | Compiled Rust Datalog reaches a fixed point and supports stratified negation, timeout generation, and WASM [W10, W11]. |
| Datafrog | P | P | F | P | Host-authored monotone semi-naive relations reach a fixed point; there is no rule language [W12, W13]. |
| ontology bounded reasoner | P | - | - | - | Live source implements subclass/subproperty closure, type/property propagation, and domain/range only [L2]. |
| v3 `rete` | - | - | P | F | EAV alpha/join/memory propagation, updates, retractions, and rule-produced facts pass 46 tests [L4]. |

## Gate table

G1 envelope; G2 license; G3 releasable/vendorable; G4 no success-shaped degradation; G5 resource
ceilings; G6 security; G7 determinism; G8 semantic floor. `PASS` may name a binding configuration.

| Candidate | G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EYE WASM | PASS: Node/browser WASM runs in Bun [W1] | PASS: MIT [Census, W1] | PASS: release bundles, pinned EYE image, unit and memory lanes [W1, W14] | UNKNOWN: package failure/degraded behavior was not exercised against the typed boundary [W1, W2] | UNKNOWN: bundle is about 1.4 MB gzip, but cold start, p95, W1 RSS, and disk were not measured; docs warn stacks can reach 1 GB [W1, W2] | PASS: require `--restricted`, local virtual files, and host byte/time caps; restricted mode disables network/file built-ins [W2] | UNKNOWN: pinning is available, but byte-stable proof replay was not measured [W1] | PASS: normal output includes proof explanations and `--proof` consumes proof lemmas [W2] |
| N3.js | PASS: installed JS runs in Bun [L5] | PASS: MIT [Census, L5] | PASS: installed 2.2.11 has source, tests, and 100% coverage thresholds [L5] | PASS: budget overflow throws while leaving an explicitly incomplete store [L5] | UNKNOWN: local import 0.02 s/27,136 KB RSS and package 920 KB; gold p95/W1 unknown [M1] | PASS: in-memory engine with `maxDerivations` and `maxPremiseDepth` [L5] | UNKNOWN: replay/order was not measured [L5] | FAIL: public result is the mutated store; source records no rule/premise derivation [L5] |
| shacl-engine | PASS: installed JS runs in Bun [L3] | PASS: MIT [Census, W4] | PASS: npm 1.1.2 and active source [Census] | PASS: current driver maps failures to typed errors, never conformance success [L3] | FAIL: a six-quad violating fixture still timed out at 20 s versus p95 <100 ms; conforming sibling passed [M1, L3] | UNKNOWN: no work/time cap is documented and the violating path hung [W4, M1] | UNKNOWN: validation report replay/order was not measured [W4] | FAIL: debug traversal/coverage is not an InferenceEvent premise proof, and AF rules are absent [W4] |
| rdf-validate-shacl | PASS: browser-capable JS [W5] | PASS: MIT [Census] | PASS: active source and releasable package [Census, W5] | PASS: returns explicit conformance/results/RDF report [W5] | UNKNOWN: no target-machine artifact, RSS, cold, or p95 measurement [W5] | PASS: pass bounded RDFJS datasets, omit `importGraph`, and use `maxErrors`; parsing/fetch stays outside [W5] | UNKNOWN: report replay/order was not measured [W5] | FAIL: validation results name shape/focus/path but contain no inferred conclusion or premise proof; no SPARQL/AF [W5] |
| Trealla WASM | PASS: WASI plus JS API [W6, W7] | PASS: MIT [W6] | PASS: C99 build/test and vendorable source [W6] | UNKNOWN: JS error/degraded-state contract was not exercised [W7] | UNKNOWN: artifact, cold, RSS, p95, and W1 are unmeasured [W7] | FAIL: JS build preloads `http_consult`/`http_fetch`; no sandbox mode is documented [W7] | UNKNOWN: controlled-program replay was not measured [W6] | FAIL: `--trace` is an execution trace, not a stable rule/premise proof object [W6] |
| SWI WASM | PASS: official WASM runs in browser/Node [W8, W9] | UNKNOWN: core is BSD-2, but bundled package licenses depend on configuration and require `license/0` audit [W9] | PASS: current source and npm WASM releases are buildable [W9] | UNKNOWN: raw query failures still need the typed Effect boundary [W8] | UNKNOWN: WASM data/artifact, cold, RSS, p95, and W1 are unmeasured [W8] | FAIL: official WASM/Tinker is documented without sandbox restrictions and exposes JS access [W8, W9] | UNKNOWN: rule/proof replay was not measured [W8] | FAIL: tracer plus inference limits do not expose a checkable derivation DAG; a meta-interpreter would be new adapter logic [W15] |
| Ascent | PASS: recorded Rust-crate exception or `wasm-bindgen` build [W10] | PASS: MIT [W10] | PASS: crate 0.8.0 is 120.59 KB source and vendorable [W11] | PASS: fixed-point relations or explicit `run_timeout`, not fallback values [W10] | UNKNOWN: compiled artifact, cold, RSS, p95, and W1 are unmeasured [W10] | PASS: rules are compiled, inputs stay typed, and generated timeout bounds execution [W10] | UNKNOWN: serial/canonical output replay was not measured; parallel mode exists [W10] | FAIL: API returns final relations only; proof relations would be a new program convention [W10] |
| Datafrog | PASS: recorded Rust-crate exception or compiled local binary [W12] | PASS: Apache-2.0/MIT [W12] | PASS: releasable 2.0.1 source exposes no operator-managed runtime [W12] | PASS: host loop returns explicit completed relations [W12] | UNKNOWN: compiled artifact, cold, RSS, p95, and W1 are unmeasured [W12] | PASS: fixed host-authored operators have no parser/network; host must cap input/loop [W12] | PASS: `Tuple: Ord`, deduped stable/recent lifecycle, and serial completion support canonical output [W13] | FAIL: `complete()` exposes tuples, not rule/premise derivations [W13] |
| ontology bounded reasoner | PASS: current Effect service runs in Bun [L2] | PASS: repo Apache-2.0 [L2] | PASS: live source plus focused regression [L2, M1] | PASS: drift is explicit and forces full recompute; no substitute facts [L2] | UNKNOWN: import 1.46 s/213,828 KB RSS and focused run 1.36 s; gold p95/W1 unknown [M1] | PASS: fixed RDF operations, no network, default 64-change drift cap [L2] | PASS: signatures and inferred quads are sorted before return [L2] | FAIL: result has module/quads but no rule id, premise refs, or explanation DAG [L2] |
| v3 `rete` | PASS: TypeScript fits Bun after the priced v3 to v4 port [L4] | PASS: MIT [L4] | PASS: own source is vendorable; live run is 46/0 [L4, M1] | PASS: recursion overflow throws rather than returning success [L4] | UNKNOWN: live suite 6.82 s/361,076 KB RSS and source+tests 464 KB; gold p95/W1 unknown [M1] | PASS: fixed EAV API, no network, explicit recursion limit [L4] | FAIL: API accepts promises but the synchronous fire loop does not await actions [L4] | FAIL: audit records fact/rule/fire edges, not conclusion-premise proof DAGs [L4] |

## Scores

Only EYE has no known hard-gate failure. Its score is conditional because G4, G5, and G7 remain
`UNKNOWN`; it is not adoption authorization. All `FAIL` rows are unscored under rubric section 1.

| Candidate | Task quality /40 | Operational fit /25 | Integration + migration /20 | Sustainability /15 | Total /100 |
| --- | --- | --- | --- | --- | --- |
| EYE WASM | **12-34**: gold soundness **UNKNOWN 0-16**; declared N3 forward/backward reach **4-6**; limited-answer/linear-select bounds **2-4**; no incremental API **0-1**; proof output/input **6-7** [W1, W2] | **4-14**: 1.4 MB gzip supports artifact points; cold, RSS, p95, W1, and installed bytes are UNKNOWN; documented stack risk caps the range [W1, W2] | **10-16**: Promise API and RDFJS quads fit Bun, but capturing proof mode and decoding N3 proof into branded `InferenceEvent` is unbuilt [W1, L1] | **11-14**: MIT, release bundles, pinned EYE image, unit/memory/benchmark lanes; issue latency and bus factor UNKNOWN [W1, W14] | **37-78**, the bucket sum; midpoint 57.5 is used only for sensitivity. |

## Verdict (historical screen; superseded by B1)

**pick-one, conditional: EYE WASM.** It is the wrapped baseline for R1-R4 because it alone combines
RDFJS/Bun placement, restricted execution, N3 rule reach, and exported proof explanations. Ascent
is runner-up for R3, but gate 8 parks it. v3 `rete` is the R4 salvage oracle, not a baseline engine.
Do not bundle either into M1 until it emits independently checkable `InferenceEvent` proofs.

Before adoption, one probe must pin eye-js/EYE by hash and run `gold/v1` in `--restricted` mode,
without `--nope`, under an outer Effect timeout. It must record cold start, peak RSS, artifact and
installed bytes, p95, W1 time/disk, two byte-identical proof replays, and a network-denial test.
The probe also needs explicit parse, runtime, and forced-timeout failures decoded as typed states.
Any failure-contract, budget, or replay miss changes the family verdict to **park**; weights cannot compensate.

**Sensitivity.** Yes among gate-eligible candidates: +/-5 points in any bucket cannot promote a
hard-gate failure, so EYE remains the only front-runner. This is not robustness against its own
UNKNOWN gates. If G4, G5, or G7 fails, there is no winner.

**Baseline the NET-NEW ablation must beat.** Wrap EYE behind one Effect service; translate R1-R4 to
a pinned, side-effect-free N3 Horn profile; canonicalize conclusions; decode EYE's N3 explanation
to `InferenceEvent`; verify every proof independently against input statement ids and rule hashes.
The spike must match EYE's gold conclusions and proof acceptance, then improve delta-update cost
over EYE's full rerun while passing the three frozen probes: canonical proof-node hashes, a
hash-bound certificate with typed truncation, and evidence-batch to Rete to `InferenceEvent` [L1].

## Park list

- **N3.js:** good Bun/RDF fit and explicit budgets, but no derivation API fails gate 8.
- **shacl-engine:** optional validator only; the local violating fixture also fails gate 5 at 20 s.
- **rdf-validate-shacl:** optional Core validator, not a required entailment engine and no proof DAG.
- **Trealla WASM:** broad Prolog reach cannot offset network-capable built-ins and trace-only evidence.
- **SWI WASM:** mature Prolog, but bundled-license audit, unrestricted WASM, and proof DAG are unresolved.
- **Ascent:** strongest Datalog runner-up; re-enter only with an engine-bound proof relation prototype.
- **Datafrog:** compact fixed-point kernel, but host-authored rules and tuple-only output miss gate 8.
- **Ontology bounded reasoner:** retain as RDFS regression/oracle; current result schema fails gate 8.
- **v3 `rete`:** retain topology and 46-test oracle; unawaited actions and absent proofs fail gates 7/8.

## Parked-SOTA appendix

Informal scores do not override gates. They show the best parked option for each missing suite beside
the winner; all gold-quality ranges still include `UNKNOWN`.

| Candidate | Task quality /40 | Operational fit /25 | Integration + migration /20 | Sustainability /15 | Informal total |
| --- | --- | --- | --- | --- | --- |
| EYE WASM, winner | **12-34** [W1, W2] | **4-14** [W1, W2] | **10-16** [W1, L1] | **11-14** [W1, W14] | **37-78** |
| Ascent, R3 parked-SOTA | **14-29**: fixed point, negation, timeout; gold UNKNOWN and proof 0 [W10] | **10-20**: 120.59 KB source; binary/RSS/cold UNKNOWN [W11] | **4-9**: Rust exception, compiled macro rules, new proof bridge [W10] | **9-12**: MIT, 0.8.0, 160 commits, wasm tests; cadence depth UNKNOWN [W10, W11] | **37-70** |
| v3 `rete`, R4 parked-SOTA | **13-27**: 46/0 covers joins/update/retract/cycles; gold/proofs absent [L4, M1] | **12-18**: 464 KB source+tests and 361 MB test RSS; p95/W1 UNKNOWN [M1] | **4-9**: selective v3 to v4 port and proof schema required [L4] | **5-8**: owned/vendorable with test oracle, but archived and unused [L4] | **34-62** |

## Sources appendix

- **L1:** `criteria-rubric.md` sections 0-4; `workload-contract.md` lines 5-62; `shared-schema.md` lines 5-50; `adhd-reasoning.md` lines 74-132; `../DECISIONS.md` A6-A8.
- **Census:** `docs-url-census.md`, Reasoning table and Flags. Used for fetch-verified repo/license/release claims.
- **L2:** `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:337-365,440-605,636-721,784-847`; `packages/ontology/use-cases/test/Session.test.ts:275-403`; `packages/ontology/server/test/OntoauthorMatCompetency.test.ts:55-76`.
- **L3:** `packages/drivers/shacl/src/Shacl.validation.ts:101-173,226-311,401-453`; `packages/drivers/shacl/test/ShaclEngineValidation.test.ts:54-82`.
- **L4:** `grounding-v3-logos.md`; `~/YeeBois/projects/beep-effect-logos/packages/common/rete/src/network/{audit.ts,types.ts,fire-rules/fire-rules.ts}`; its `test/rete/` and `test/lib/`.
- **L5:** `bun.lock:6764`; `node_modules/n3/README.md:432-473`; `node_modules/n3/src/N3Reasoner.js:16-231`; `node_modules/n3/package.json`.
- **M1:** local 2026-08-24 measurements: `/usr/bin/time` imports; focused ontology and SHACL Bun tests; v3 Rete `bun test`; `du -sh`; N3 Horn smoke test. Raw results are summarized in the cited cells.
- **W1:** [eye-js README/API](https://github.com/eyereasoner/eye-js) and [package manifest](https://github.com/eyereasoner/eye-js/blob/main/package.json).
- **W2:** [EYE command-line contract](https://github.com/eyereasoner/eye/blob/master/documentation/command_line.md).
- **W3:** [N3.js documentation and repository](https://github.com/rdfjs/N3.js/).
- **W4:** [shacl-engine repository and capability matrix](https://github.com/rdf-ext/shacl-engine).
- **W5:** [rdf-validate-shacl package README](https://github.com/zazuko/rdf-validate-shacl/blob/master/packages/shacl/README.md).
- **W6/W7:** [Trealla core](https://github.com/trealla-prolog/trealla) and [Trealla JS/WASM](https://github.com/guregu/trealla-js).
- **W8/W9:** [SWI WASM manual](https://www.swi-prolog.org/pldoc/man?section=wasm-version) and [SWI source/WASM notice](https://github.com/SWI-Prolog/swipl-devel).
- **W10/W11:** [Ascent source and features](https://github.com/s-arash/ascent) and [crate release metadata](https://docs.rs/crate/ascent/latest).
- **W12/W13:** [Datafrog source](https://github.com/rust-lang/datafrog) and [Variable lifecycle/API](https://docs.rs/datafrog/latest/datafrog/struct.Variable.html).
- **W14/W15:** [eye-js manifest test/release lanes](https://github.com/eyereasoner/eye-js/blob/main/package.json) and [SWI inference-limit contract](https://www.swi-prolog.org/pldoc/man?predicate=call_with_inference_limit%2F3).
