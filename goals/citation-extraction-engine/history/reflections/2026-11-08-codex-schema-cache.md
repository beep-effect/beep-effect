---
goal: citation-extraction-engine
agent: codex
date: 2026-11-08
trigger: on-demand
confidence: high
findings:
  - category: implementation-improvement
    confidence: high
    instruction: Hoist reusable schema construction to module scope so Effect can reuse its per-AST parser cache.
    explanation: Root lint reproduced 17 inline schema constructions in twelve citation files even though package lint and types passed.
  - category: tooling-friction
    confidence: high
    instruction: Include repository-wide lint evidence when package checks do not execute the same lint configuration as hosted policy checks.
    explanation: Package verification alone did not expose the existing no-inline-schema-compile rule; the root command immediately reproduced the hosted failure.
todos:
  - Preserve exact original assertions and directional schema transforms when changing schema allocation scope.
  - Continue exhaustive source accounting and full hosted qualification without weakening parity obligations.
---

# Reuse Effect parser caches

The source expressions and decode directions are unchanged. Module ownership
removes repeated AST construction and requires no replacement cache. Focused
replays qualify the source-reference refresh; hosted policy remains a separate
acceptance check. No completion accounting is promoted by lint-only remediation.
