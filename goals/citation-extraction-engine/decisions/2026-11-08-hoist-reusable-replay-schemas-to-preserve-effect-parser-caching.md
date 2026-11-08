---
title: "Hoist reusable replay schemas to preserve Effect parser caching"
date: 2026-11-08
kind: checkpoint
reversal: "Supersede if schema construction becomes dependent on invocation data."
---

Root lint reproduced seventeen no-inline-schema-compile sites missed by package-only checks. Move identical schemas to module bindings, preserving decode directions, inputs, expected values, assertions and deadlines. Rerun affected finite proofs before refreshing references; no completion event is promoted. See history/evidence/2026-11-08-cached-schema-fixtures.md.
