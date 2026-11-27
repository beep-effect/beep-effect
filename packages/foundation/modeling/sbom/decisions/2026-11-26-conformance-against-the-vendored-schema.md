---
title: Emitter conformance is proven against the vendored CycloneDX 1.6 schema, with ajv as a dev-only dependency
date: 2026-11-26
reversal: Depend on @cyclonedx/cyclonedx-library for the model and its validation, or drop ajv and keep the derived subset alone.
governs:
  - test/conformance.test.ts#definition
  - test/support/cyclonedx.ts#cycloneDxViolations
enforcedBy: []
---

The package owns its emitter, so "the output is conformant" must be checkable.
The published schema is vendored under `fixtures/`: `conformance.test.ts` derives
its expectations from it (`required` arrays, `enum` members, property names) and
names each rule it checks; `conformance.ajv.test.ts` validates the same documents
against the whole schema through `ajv` and `ajv-formats`, devDependencies that
`src` never reaches and that add no runtime weight.

Rejected: `@cyclonedx/cyclonedx-library` (6.6 MB, seven optional peers, a second
SPDX engine), whose validation the emitter never needs at runtime; hand-written
expectations, which only check a copy of our own assumptions; ajv alone, which
reports violations without naming the rule each emitted field must meet.
