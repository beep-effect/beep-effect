# 00 -- No-Escape Theorem: Architectural Constraints

This standard applies the stated No-Escape claim to memory systems with the
Semantic Proximity Property (SPP) as they scale. Keep those assumptions when
using the forgetting and false-recall claims below; they are not an
unconditional verdict on every memory architecture.

This document records the repository's account of the cited work and translates
it into architectural rules. It is not an independent verification of the proof
or a test of this checkout's memory behavior.

---

## The Theorem

**Claim.** Any memory system that retrieves by conceptual relatedness (the
Semantic Proximity Property, SPP) will, as it scales:

1. **Forget** stored information via interference-driven power-law decay.
2. **Falsely recall** information it never stored via associative lures.

No parameter tuning, dimensionality increase, or architectural cleverness
within the SPP class eliminates either failure mode. They are geometric
consequences of the embedding space itself.

## The Logical Chain

1. SPP requires related items to be stored closer together.
2. Rate-distortion optimality forces effective dimensionality to ~10--50,
   regardless of nominal dimensionality. Even 4096-dim embeddings converge to
   d_eff ~10--15.
3. Low effective dimensionality guarantees retrieval neighborhoods always
   contain competitor mass.
4. As memory grows, retention for any item decays to zero.
5. False recall from associative lures cannot be rejected by threshold tuning
   without also rejecting true items.

## Architecture Categories

Numerical values below and in the mitigation table are reported case outcomes,
not scope-independent guarantees for every architecture in a category. In
particular, a zero false-recall result in an explicit list-checking setup does
not establish that every reasoning overlay eliminates false recall. Whether
that setup uses a verifier outside the stated theorem class requires separate
evidence.

### Category 1 -- Pure Geometric (Vector DB, Graph Memory)

- Power-law forgetting: b=0.440 (vector), b=0.478 (graph).
- DRM false recall: FA=0.583 (vector), FA=0.208 (graph).
- No architectural workaround exists. The geometry IS the behavior.

### Category 2 -- Reasoning Overlay (LLM Attention, Parametric Memory)

- Can reject lures via explicit list-checking (FA=0.000).
- Converts graceful degradation into catastrophic phase transitions.
- Perfect accuracy up to ~100--120 competitors, then near-total collapse.
- Qwen2.5-7B accuracy drops from 1.000 to 0.113 as semantic neighbor density
  increases.

### Category 3 -- Abandon SPP (BM25/Keyword)

- b=0.000, FA=0.000. Complete immunity.
- Semantic retrieval agreement: 15.5%.
- It escaped interference by escaping usefulness.

## Tested Mitigations

| Mitigation | Interference Reduction | Cost |
|---|---|---|
| Increase nominal dimensionality | None. d_eff unchanged. | Wasted compute |
| BM25 keyword retrieval | Total (b=0.000) | Semantic agreement drops to 15.5% |
| Orthogonalization (Gram-Schmidt) | Total | NN accuracy drops to 0.0% |
| Memory compression (clustering) | Partial (b=0.163 at 2,500 clusters) | Accuracy drops to 92.8% |

## Escape Routes (Outside Theorem Class)

Three paths exist outside the theorem's scope:

1. **Exact episodic records** -- verbatim storage, no semantic proximity.
2. **External symbolic verifiers** -- check retrieved content against
   non-semantic records.
3. **Hybrid routing** -- combine semantic (generalizable but degrading) with
   non-semantic (robust but rigid).

> "Combining them does not violate the No-Escape Theorem; it builds a routing
> layer between a system that forgets and a system that cannot generalise."

---

## What This Means for This Project

### Three-Tier Certainty Model Maps to Escape Routes

| Project Tier | Certainty | Theorem Status | Rationale |
|---|---|---|---|
| Layer 1: AST-derived facts (ts-morph) | 1.0 | OUTSIDE theorem class | Exact symbolic record. Deterministic. No semantic proximity. |
| Layer 2: Type-checker derived | 0.85--0.95 | OUTSIDE theorem class | Symbolic verification. Compiler guarantees. |
| Layer 3: LLM-inferred | 0.6--0.85 | INSIDE theorem class | Semantic. Will degrade with scale. |

Layers 1 and 2 are escape routes. Layer 3 is not.

### Binding Constraints

**C1. Deterministic layers are the foundation.**
Maximize what can be derived from AST and type-checker before reaching for LLM
inference. Layers 1 and 2 do not degrade. Layer 3 does.

**C2. Semantic layers require interference management.**
Consolidation, compression, pruning, and temporal windowing are not
optimizations. They are requirements. Without them, Layer 3 retention decays
to zero as memory grows. Requiring management does not promise that it
eliminates the stated scaling limit; the table above describes compression as
partial mitigation.

**C3. Never treat semantic retrieval as a source of truth.**
Always verify against deterministic layers when possible. Semantic retrieval is
a suggestion engine, not a fact store.

**C4. Expect phase transitions in reasoning-augmented retrieval.**
Monitor competitor density. Design circuit breakers around the ~120 competitor
threshold. Reasoning overlays do not degrade gracefully; they collapse.

**C5. Compression is the most practical lever.**
Target clustering-based compression for semantic layers. The paper's best
Pareto point: 2,500 clusters, b=0.163, 92.8% accuracy.

**C6. False recall is more fundamental than forgetting.**
It requires no boundary conditions and holds even in noiseless, competitor-free
systems. Treat it as a first-class failure mode. Every retrieval from Layer 3
must be treated as potentially fabricated.

### Key Quotes

> "Any architecture that simultaneously eliminates interference-driven
> forgetting and associative false recall must either abandon semantic
> continuity and kernel-threshold retrieval, add an external symbolic verifier
> or exact episodic record, or send the semantic effective rank to infinity."
> "Scale alone is not sufficient. The same geometry that enables semantic
> generalisation also creates representational crowding."
> "The gap between 'inevitable' and 'catastrophic' is where engineering
> contributes: optimising noise parameters, managing competitor density through
> intelligent caching, and designing consolidation strategies that navigate the
> compression-fidelity frontier."

---

## Citation

Barman, S. R., Starenky, A., Bodnar, S., Narasimhan, N., & Gopinath, A.
(2026). The Price of Meaning: Why Every Semantic Memory System Forgets.
arXiv:2603.27116. Sentra & MIT.
