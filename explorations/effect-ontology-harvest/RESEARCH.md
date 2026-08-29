# Research

## 2026-07-14 — Harvest synthesis

This packet mined the MIT-licensed `effect-ontology@c148102d` Effect v3
`packages/@core-v2` source as harvest-not-port material and compared it with
the live Effect v4 beep packages. The pinned corpus, notices, and item-level
citations are in [`research/SOURCES.md`](./research/SOURCES.md).

### Coverage

The planned eight lanes covered LLM governance, content-addressing/storage,
workflow/cluster/streaming, domain models/RDF/identity, prompting/agent
extraction, runtime/telemetry, repository patterns, and documentation
rationale. Six reports landed:

- [`llm-governance.md`](./research/llm-governance.md)
- [`content-addressing-storage.md`](./research/content-addressing-storage.md)
- [`workflow-cluster-streaming.md`](./research/workflow-cluster-streaming.md)
- [`domain-models-rdf-identity.md`](./research/domain-models-rdf-identity.md)
- [`prompting-agent-extraction.md`](./research/prompting-agent-extraction.md)
- [`runtime-telemetry.md`](./research/runtime-telemetry.md)

The `repository-patterns` and `docs-rationale` lanes produced no reports. The
promised Codex review gate also did not land. Coverage for those lanes is not
claimed; this is a source-code harvest, not a verified documentation-rationale
harvest.

### Candidate dispositions

- **LLM governance — DEMAND-GATED:** create
  `foundation/capability/llm-governance` only after two real LLM consumers need
  congruent admission/budget semantics. Retry consolidation needs a second
  matching `ExecutionPlan` consumer; a breaker needs a measured failure that
  survives the existing limiting/retry/recovery/monitoring stack. Depth:
  [`llm-governance.md`](./research/llm-governance.md).
- **Generic CAS/cache — REJECTED:** extraction, embedding, object, and semantic
  caching have different owners and contracts; route each to its capability,
  driver, or slice only on demand. Depth:
  [`content-addressing-storage.md`](./research/content-addressing-storage.md).
- **Workflow foundation — REJECTED:** the Effect v4 workflow spike and
  `drivers/workflow` adapter supersede it. The v3 findings remain checklist
  provenance only. Depth:
  [`workflow-cluster-streaming.md`](./research/workflow-cluster-streaming.md).
- **Embeddings capability — DEMAND-GATED:** require a named consumer needing
  two providers or reusable batching. Vector identity must include provider,
  model, dimension, task, and revision; dimension-unsafe fallback is rejected.
  This candidate was absent from the canonical open-question ledger and is
  explicitly retained here. Depth:
  [`prompting-agent-extraction.md`](./research/prompting-agent-extraction.md)
  and [`runtime-telemetry.md`](./research/runtime-telemetry.md).
- **Ontology/RDF feedback — SELECTIVE ADAPT:** retain cycle-safe hierarchy
  lookup, an ontology-to-LangExtract bridge with collision-safe labels and
  mention evidence, a quad-to-triple helper, verified OWL restriction terms,
  reversible saved-path grammar, and bounded SHACL telemetry under the owners
  and gates recorded in [`DECISIONS.md`](./DECISIONS.md). Reject the weak RDF
  brands, mega vocabulary object, and combined content/semantic/storage
  identity model. Depth:
  [`domain-models-rdf-identity.md`](./research/domain-models-rdf-identity.md),
  [`prompting-agent-extraction.md`](./research/prompting-agent-extraction.md),
  and [`content-addressing-storage.md`](./research/content-addressing-storage.md).

### Binding constraint

All routed items are references inside this parked packet, not active backlog
or goal scope. Nothing may be ported without item-level re-verification and
exact source/notice attribution at implementation time.
