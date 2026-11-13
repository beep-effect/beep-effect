---
title: "Run standalone skill ports and parity tests with Bun"
date: 2026-11-13
reversal: "Revert this lane commit to restore the Python skills and their commands"
---

This lane ports only the Python in the four assigned skills. No existing TypeScript skill-script test precedent was found. Use bun:test, strict standalone TypeScript checking, and root node_modules without a workspace build. Preserve the validator checks through a direct TypeScript lowering with a local data-semantics namespace in the same digest-locked file; no Python interpreter or source evaluator remains. Retain all 103 original self-test assertions and replay recorded Python output digests for normal, gate, and repository-fidelity runs on the existing beep-ci-ops extraction tree. Its existing violations are parity evidence, not a green ontology acceptance. Harness plan output and original synthetic host classifiers are replayed offline.

The YAML boundary also replays 25 scalar results from the original loader. Preserve integer versus
float identity, the original exponent and sexagesimal grammars, Python whitespace and Unicode
ordering, rejection of unsupported tags and merge keys, and shared/cyclic alias identity. Authority
UTF-8 decoding remains strict. These details feed the validator's existing exact-type guards;
coercing a YAML float such as `1.0` into a JavaScript integer would weaken those guards.
