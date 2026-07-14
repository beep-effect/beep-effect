# Decisions

## 2026-07-14 — Net-new foundation packages — LOCKED

**Question:** Which net-new foundation packages from the harvest are worth
creating rather than deferring or rejecting?

**Answer:** `foundation/capability/llm-governance` is **DEMAND-GATED** until
two real LLM consumers require congruent admission and budget semantics. Retry
consolidation additionally requires a second consumer matching the existing
`ExecutionPlan` shape. A circuit breaker requires a measured failure that
survives limiting, retry, workflow recovery, and monitoring.
`foundation/capability/embeddings` is **DEMAND-GATED** until
retrieval-local-encoder, vector projection, or another named consumer needs two
providers or reusable batching. Every vector must carry provider, model,
dimension, task, and revision identity; the upstream dimension-unsafe fallback
is rejected. The embeddings candidate was missing from the canonical open
question ledger and is dispositioned here so it is not silently lost.

**Rationale:** Real consumers must prove a coherent shared contract before a
foundation package is created. Existing drivers, `@beep/api-transport`, and the
Effect v4 workflow work already own much of the adjacent behavior.

**Rejected options:** A generic `cas-cache` package is **REJECTED** because it
has no coherent contract: extraction caching belongs to file-processing,
embedding cache to a future embedding capability, object CAS to its driver,
and semantic CAS to its owning slice, each only on demand. Workflow as a new
foundation package is **REJECTED**, superseded by
`goals/effect-v4-workflow-engine-spike` and the `drivers/workflow` adapter. The
Effect v3 findings are checklist provenance, not implementation authority.

## 2026-07-14 — Ontology and RDF feedback — LOCKED

**Question:** Which findings should feed back into `@beep/ontology`,
`@beep/rdf`, or the ontology slice?

**Answer:** The live packages are authoritative. **ADAPT selectively**:

- cycle-safe hierarchy lookup — semantic-foundation, gated on M2;
- ontology-to-LangExtract compiler bridge with collision-safe label mapping
  and mention-evidence preservation — future professional-runtime LangExtract
  vertical backlog, reference only;
- quad-to-triple pure helper — unowned small reference;
- verified standard OWL restriction/cardinality terms using the existing
  `makeNamedNode` pattern — gated on real ontology/shape use under the
  semantic-foundation SPEC;
- saved-path reversible grammar — ontology-slice reference; do not reopen the
  completed ontology-agent-surface;
- bounded SHACL telemetry — outside ontology/RDF; semantic-foundation P4 only
  if that gate fires.

**Rationale:** These are narrow deltas that preserve the ownership and stronger
contracts of the live packages. They remain discoverable without making the
harvest an alternate architecture authority.

**Rejected options:** The upstream weak-branded RDF term system, mega
vocabulary object, and combined content-hash/semantic-identity/storage-address
model are **REJECTED**.

## 2026-07-14 — Verification-gate waiver — LOCKED

**Question:** Can the packet park when the promised Codex review gate never
landed and two inventory lanes produced no reports?

**Answer:** **WAIVED** for this zero-goal park. Nothing may be ported from this
harvest without item-level re-verification and exact source and notice
attribution at implementation time.

**Rationale:** Six of eight inventory reports landed; `repository-patterns`
and `docs-rationale` did not. This dossier is a source-code harvest, not a
verified documentation-rationale harvest. Parking records the incomplete proof
surface without converting it into implementation authority.

**Rejected options:** Treating the absent review gate as passed, claiming
coverage for the two missing lanes, or allowing packet-level verification to
authorize a future port are **REJECTED**.

## 2026-07-14 — Backlog ownership policy — LOCKED

**Question:** Should routed findings widen active or completed goal specs?

**Answer:** No. Every routed item remains a **REFERENCE** inside this parked
packet. Owners may discover the item through these decision cross-links when
its stated demand gate fires.

**Rationale:** The campaign produced provenance and routing hints, not approved
implementation scope. Keeping references here preserves goal ownership and
prevents a harvest from silently reopening completed work.

**Rejected options:** Editing active or completed goal specs, creating backlog
goals without evidence, or treating a named owner as a present commitment are
**REJECTED**.

## 2026-07-14 — Park at align-complete — LOCKED

**Question:** What is the correct terminal disposition for this exploration?

**Answer:** **PARKED** at align-complete with zero goals.

**Rationale:** The harvest is complete, its candidates and references are
dispositioned, and align-complete is the designed end state. Zero goals is the
correct outcome; future work begins only when a recorded gate fires and the
item is re-verified.

**Rejected options:** Advancing through shape/decompose to manufacture goal
packets, leaving the packet falsely active, or killing and discarding its
reference value are **REJECTED**.
