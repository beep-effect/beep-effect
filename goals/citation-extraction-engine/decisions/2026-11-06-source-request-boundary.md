---
title: "Verify raw source components through the existing resolver"
date: 2026-11-06
kind: checkpoint
lane: "feat/citation-diff-kernel"
pullRequest: 2737
reversal: "Revert the source adapter/shared mode ownership and replay wiring; retain original source proofs and every full-goal requirement."
---

Server-only source/options components share builtin/container/role schemas with private implementation. The adapter reuses SourceTextResolver and the public provenance verifier, snapshots before resolver work, preflights sizes and preserves ignored shortcut getters. Connected replay now issues input proofs through that production boundary. Single-source scope is explicit; complete dual-source/retained-input dispatch, reports, ports and service/Layer remain open. Corrected hosted JSDoc/docgen missing-since failures by separating tags, without baseline changes. See history/evidence/2026-11-06-source-request-boundary.md.
