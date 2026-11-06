# Primary-source ledger

Research snapshot: 2026-11-03. This ledger preserves immutable source references
for the public synthesis. Each linked file below was checked to exist at its pin
when preparing publication. File references are evidence locations, not claims
that their tests were run. No upstream code is copied or vendored.

## Provenance and reuse boundary

- NVIDIA Auto Ontology: https://github.com/NVIDIA/auto-ontology at `6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0`.
  Inspected Python files carry Apache-2.0 SPDX headers. Reference-only use in this
  packet; any future port must verify the relevant file and dependency licenses.
- Beep: https://github.com/beep-effect/beep-effect at `8fe07d3eed947c146448d1e469af4bb06148c7c3`.
  First-party source inventory; no code copied into the research packet.
- Apache Ossie converter: https://github.com/apache/ossie at
  `ef91cb61092c60f4b918016a81cfdbe483e113bc`, as referenced by AO's dependency.
  License not independently verified for reuse here: reference only.
- Evaluation harness: https://github.com/NVIDIA/ontology-sql-eval.
  The reports inspected mutable web documentation. No immutable harness revision
  was retained, so its configuration findings are provisional and must be
  re-established at a pinned revision before a benchmark. License unverified:
  reference only. No published numeric improvement is adopted by this packet.

## Assessment method

Grok 4.7/xhigh completed a deep-research workflow with a Partial verdict. Claude
Opus 5.5/medium completed a five-researcher synthesis; child identity was reported
by its coordinator, not independently verified per child. These are provenance
limits, not quality scores. Their disagreements were resolved conservatively:
Beep's foundation alignment fold exists; its full stack includes a real desktop
MCP consumer; its law-practice KG must not be represented as wholly RDF-backed.
Kimi and Muse produced no assessments and are omitted, not counted as agreement.

## Representation and semantics

- [AO: `auto_ontology/dal/schema.py`](https://github.com/NVIDIA/auto-ontology/blob/6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0/auto_ontology/dal/schema.py) — Relational terms, attributes, association tables and human-set certification flags.
- [AO: `auto_ontology/semantic/term_extractor.py`](https://github.com/NVIDIA/auto-ontology/blob/6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0/auto_ontology/semantic/term_extractor.py) — Prompt bounds the generated relationships; hierarchy-like constants are not evidence of generated axioms.
- [Beep: `packages/foundation/modeling/rdf/src/Rdf.ts`](https://github.com/beep-effect/beep-effect/blob/8fe07d3eed947c146448d1e469af4bb06148c7c3/packages/foundation/modeling/rdf/src/Rdf.ts) — RDF terms and datasets; serialization equality must not be assumed to be graph isomorphism.
- [Beep: `packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts`](https://github.com/beep-effect/beep-effect/blob/8fe07d3eed947c146448d1e469af4bb06148c7c3/packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts) — Foundation concepts and SKOS alignment domain.
- [Beep: `packages/foundation/modeling/ontology/test/SemanticFoundation.test.ts`](https://github.com/beep-effect/beep-effect/blob/8fe07d3eed947c146448d1e469af4bb06148c7c3/packages/foundation/modeling/ontology/test/SemanticFoundation.test.ts) — Alignment/fold test assertions; read, not executed for this research.
- [Beep: `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts`](https://github.com/beep-effect/beep-effect/blob/8fe07d3eed947c146448d1e469af4bb06148c7c3/packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts) — Bounded structural inference implementation, not a full OWL reasoner.
- [Beep: `packages/ontology/domain/src/aggregates/Session/Session.values.ts`](https://github.com/beep-effect/beep-effect/blob/8fe07d3eed947c146448d1e469af4bb06148c7c3/packages/ontology/domain/src/aggregates/Session/Session.values.ts) — Named graph partitions.

## Governance and execution

- [AO: `auto_ontology/dal/terms.py`](https://github.com/NVIDIA/auto-ontology/blob/6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0/auto_ontology/dal/terms.py) — Zone-scoped certification rollup and term updates.
- [AO: `auto_ontology/dal/tests/test_terms.py`](https://github.com/NVIDIA/auto-ontology/blob/6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0/auto_ontology/dal/tests/test_terms.py) — Rollup assertions, including attributes hidden from a viewer.
- [AO: `auto_ontology/dal/tests/test_sql_attributes.py`](https://github.com/NVIDIA/auto-ontology/blob/6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0/auto_ontology/dal/tests/test_sql_attributes.py) — Assertions preserving certification across an expression rewrite; no passing-run claim.
- [AO: `auto_ontology/server/sql_attributes/service.py`](https://github.com/NVIDIA/auto-ontology/blob/6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0/auto_ontology/server/sql_attributes/service.py) — Expression-update path.
- [AO: `auto_ontology/retrieval/data_access/semantic_search.py`](https://github.com/NVIDIA/auto-ontology/blob/6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0/auto_ontology/retrieval/data_access/semantic_search.py) — Inspected semantic retrieval does not filter on certification; bounded path finding.
- [AO: `auto_ontology/retrieval/text_to_sql/agents/sql_parse_validation.py`](https://github.com/NVIDIA/auto-ontology/blob/6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0/auto_ontology/retrieval/text_to_sql/agents/sql_parse_validation.py) — Main parser and intent checks; read with execution and probe paths.
- [AO: `auto_ontology/retrieval/text_to_sql/agents/sql_execution.py`](https://github.com/NVIDIA/auto-ontology/blob/6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0/auto_ontology/retrieval/text_to_sql/agents/sql_execution.py) — Dispatch path; source reading does not establish database permissions.
- [AO: `auto_ontology/retrieval/text_to_sql/db_probe/executor.py`](https://github.com/NVIDIA/auto-ontology/blob/6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0/auto_ontology/retrieval/text_to_sql/db_probe/executor.py) — Separate helper-query probe policy.
- [AO: `auto_ontology/catalog/sql_parse.py`](https://github.com/NVIDIA/auto-ontology/blob/6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0/auto_ontology/catalog/sql_parse.py) — SQL parsing contract; locked parser behavior remains an experiment.

## Beep validation and consumers

- [Beep: `packages/foundation/capability/semantic-web/src/services/shacl-validation.ts`](https://github.com/beep-effect/beep-effect/blob/8fe07d3eed947c146448d1e469af4bb06148c7c3/packages/foundation/capability/semantic-web/src/services/shacl-validation.ts) — Declared bounded validation contract and optional full shapes dataset.
- [Beep: `packages/drivers/shacl/src/Shacl.validation.ts`](https://github.com/beep-effect/beep-effect/blob/8fe07d3eed947c146448d1e469af4bb06148c7c3/packages/drivers/shacl/src/Shacl.validation.ts) — External engine adapter used by the ontology workbench.
- [Beep: `packages/epistemic/server/src/ShaclValidation/BoundedShaclValidator.layer.ts`](https://github.com/beep-effect/beep-effect/blob/8fe07d3eed947c146448d1e469af4bb06148c7c3/packages/epistemic/server/src/ShaclValidation/BoundedShaclValidator.layer.ts) — Separate bounded validator serving epistemic admission.
- [Beep: `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts`](https://github.com/beep-effect/beep-effect/blob/8fe07d3eed947c146448d1e469af4bb06148c7c3/packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts) — Actual claim-gate shape and admission predicate.
- [Beep: `packages/ontology/use-cases/src/tools/OntologyToolkit.ts`](https://github.com/beep-effect/beep-effect/blob/8fe07d3eed947c146448d1e469af4bb06148c7c3/packages/ontology/use-cases/src/tools/OntologyToolkit.ts) — Read, mutation and publication toolkit contracts.
- [Beep: `apps/professional-desktop/server/OntologyMcpTransport.ts`](https://github.com/beep-effect/beep-effect/blob/8fe07d3eed947c146448d1e469af4bb06148c7c3/apps/professional-desktop/server/OntologyMcpTransport.ts) — Desktop MCP registration, transport and execution controls.
- [Beep: `packages/ontology/config/src/McpConfig.ts`](https://github.com/beep-effect/beep-effect/blob/8fe07d3eed947c146448d1e469af4bb06148c7c3/packages/ontology/config/src/McpConfig.ts) — Mutation registration default and configuration.
- [Beep: `packages/law-practice/server/src/Layer.ts`](https://github.com/beep-effect/beep-effect/blob/8fe07d3eed947c146448d1e469af4bb06148c7c3/packages/law-practice/server/src/Layer.ts) — Law-practice runtime composition; does not make the entire legal KG RDF-backed.

## Egress and evaluation

- [AO: `auto_ontology/semantic/visit_enter.py`](https://github.com/NVIDIA/auto-ontology/blob/6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0/auto_ontology/semantic/visit_enter.py) — Sampling and profiling paths; fake-data tracing is still required.
- [AO: `auto_ontology/semantic/embed.py`](https://github.com/NVIDIA/auto-ontology/blob/6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0/auto_ontology/semantic/embed.py) — Embedding input construction.
- [AO: `auto_ontology/dal/model_interchange.py`](https://github.com/NVIDIA/auto-ontology/blob/6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0/auto_ontology/dal/model_interchange.py) — Native export field selection before conversion.
- [AO: `auto_ontology/server/model_interchange/service.py`](https://github.com/NVIDIA/auto-ontology/blob/6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0/auto_ontology/server/model_interchange/service.py) — Conversion and single-table projection boundaries.
- [AO: `auto_ontology/retrieval/text_to_sql/numeric_types.py`](https://github.com/NVIDIA/auto-ontology/blob/6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0/auto_ontology/retrieval/text_to_sql/numeric_types.py) — Grader-oriented numeric handling; a confound to control, not proof of invalid results.
- [AO: `pyproject.toml`](https://github.com/NVIDIA/auto-ontology/blob/6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0/pyproject.toml) — Converter dependency pin.
- [AO: `uv.lock`](https://github.com/NVIDIA/auto-ontology/blob/6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0/uv.lock) — Locked dependencies for a reproducible future experiment.

The pinned [Ossie converter documentation](https://github.com/apache/ossie/blob/ef91cb61092c60f4b918016a81cfdbe483e113bc/converters/nvidia/README.md)
and [ontology projection](https://github.com/apache/ossie/blob/ef91cb61092c60f4b918016a81cfdbe483e113bc/converters/nvidia/src/ossie_nvidia_auto_ontology/ontology.py)
are supporting sources from the completed assessment. Converter behavior was not
executed. A native metadata extension cannot recover fields omitted before the
converter receives its input.

Deployment reachability, frontend edit behavior, tenant isolation and sample-value
egress remain hypotheses for isolated probes. The synthesis intentionally avoids
claiming a demonstrated exploit or a deployed production guarantee.
