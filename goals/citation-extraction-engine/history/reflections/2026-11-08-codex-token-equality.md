---
goal: citation-extraction-engine
agent: codex
date: 2026-11-08
trigger: on-demand
confidence: high
findings:
  - category: implementation-improvement
    confidence: high
    instruction: Derive builtin equality from the original comparison fields rather than reusing merge compatibility.
    explanation: Source dataclass equality ignores groups and compares data, while merge deliberately does the reverse; the independent corpus preserves both distinctions.
  - category: implementation-improvement
    confidence: high
    instruction: Reuse immutable edition value classes and Effect collection combinators for ordered tuple comparisons.
    explanation: Equal edition objects can have different local IDs, and neither hash equality nor set deduplication preserves tuple order or multiplicity.
  - category: implementation-improvement
    confidence: high
    instruction: Compare canonical native storage before any display projection.
    explanation: Literal surrogate pairs and scalar astral values can display identically but remain different source strings.
todos:
  - Implement remaining retained token hashing, inherited UserString, external mutation and dynamic callback protocols.
  - Complete remaining source workflows, exhaustive accounting, fidelity, identity/deployment, safety/scaling and lifecycle acceptance.
---

# Original builtin token value equality

The new primitive uses the existing owner and synchronization, with no separate
identity, equality or collection framework. Independent original dataclass operators
supply expected values; metadata describing comparison fields never configures the
target implementation. The native corpus and real merge histories qualify this
bounded built-in behavior without claiming a complete retained object runtime.
No canonical event or universal law is promoted by this increment.
