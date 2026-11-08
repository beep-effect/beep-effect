---
goal: citation-extraction-engine
agent: codex
date: 2026-11-08
trigger: on-demand
confidence: high
findings:
  - category: implementation-improvement
    confidence: high
    instruction: Pass the captured operation explicitly to helpers and normalize shared safety failures through the existing timing adapter.
    explanation: Court lookup captured operation timing but hardcoded extraction in several nested failures; a regression reproduced incorrect labels before the fix.
  - category: implementation-improvement
    confidence: high
    instruction: Test installation authority against later replacement of both Clock and operation.
    explanation: All four stage controls now retain their installed labels and deadlines while the caller supplies a nonfiring Clock and extraction context.
  - category: implementation-improvement
    confidence: high
    instruction: Distinguish a dependency corpus requalification from a fresh complete public-workflow replay.
    explanation: The changed lookup primitive passes all 17156 source observations; the prior complete court workflow remains an explicitly dated historical receipt.
todos:
  - Audit other nested helpers for consistent installed-operation diagnostics without weakening limits.
  - Complete remaining source workflows, retained protocols, fidelity, safety/scaling and lifecycle acceptance.
---

# Capture operation authority throughout court normalization

The correction composes existing Effect timing, catchTag, Unicode and allocation
services. It changes safety attribution and helper stage selection while preserving
the default effective minimum deadline and success algorithm. No generic ownership
infrastructure is introduced. The complete source lookup corpus and meaningful
caller-replacement controls pass; whole-engine timing qualification remains open.
