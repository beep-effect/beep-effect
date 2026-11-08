---
goal: citation-extraction-engine
agent: codex
date: 2026-11-08
trigger: on-demand
confidence: high
findings:
  - category: implementation-improvement
    confidence: high
    instruction: Reuse the existing Effect Unicode, timing, text-budget and clock adapters for native representation work.
    explanation: Native repr needs its own source algorithm and frozen classification facts, but does not need another ownership, clock or allocation framework.
  - category: implementation-improvement
    confidence: high
    instruction: Pass the captured operation explicitly when composing helpers with a different default stage.
    explanation: Unicode defaults to cleaning while repr runs under the selected operation; the clock test exposed this mismatch before publication.
  - category: implementation-improvement
    confidence: high
    instruction: Read original native points before any display projection when escaping source strings.
    explanation: Literal high/low surrogate words and a single astral scalar can share a JS projection but have different Python repr results.
  - category: implementation-improvement
    confidence: high
    instruction: Reserve retained fragments, joined JS text and native output as separate generated representations.
    explanation: A single final-output charge would miss intermediate allocations even when the source input is small.
todos:
  - Compose the new primitive into builtin dump output and retain source field ordering, spans and context slicing.
  - Qualify retained token/extractor and arbitrary object/subclass representation protocols separately.
  - Finish native identities, exhaustive source/donor accounting, fidelity, safety/scaling and lifecycle acceptance.
---

# Native repr as a shared source primitive

The existing source debug utility exposed a concrete dependency gap. The new
implementation follows pinned CPython unicode_repr and uses immutable printability
facts from the same frozen runtime. No host Unicode property or JSON quoting
substitutes for source repr. The independent corpus uses native bytes and includes
surrogate words, scalar astral values, both quote choices and all property edges.

Clock and budget controls address composition behavior beyond output examples.
The first Clock test copied a service object and lost prototype methods; the test
now uses the existing complete clock adapter. It then exposed the helper's default
cleaning stage, which is now explicitly bound to the installed operation. Existing
safety errors report a consistent deadline regardless of which nested timer wins.

This primitive does not qualify the entire dump utility or general retained object
protocols. No canonical assertion or representation-law row is promoted by this
receipt. The goal remains active at the same 157 complete canonical events.
