---
title: "P3: @beep/annotation exports its target-set schema and assembly-refusal kit, and the document view only as a type"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Make the target set and the refusal kit module-private and export the view schema with a schema-first exception, by a decision file"
---

Three surface calls the design did not settle, taken while writing commit 4.

- `AnnotationTargets` (the design's private `Targets`, a non-empty `CanonicalHashSet(OccurrenceId)`) is exported from `src/AnnotationId.ts`. It is the first element of the `annotation/v1` preimage there and the `targets` field of every content case in `src/Kind.ts`, so both modules read one schema, and the declared type of `AnnotationKind.case` names it.
- `DocumentAssemblyRefusal` is the exported `LiteralKit` of the three `DocumentAssemblyRefused` reasons, hoisted as `HandoffRefusal` is in section 4.2.
- `AnnotationDocumentView` is exported as a type over a module-private schema. A branded `S.Opaque` view would be nominal, so no caller-owned document would satisfy it. `standards/schema-first.inventory.jsonc` records that, the `AnyAnnotationKind` registry element type (schemas and a function, not data) and the internal `DocumentEnvelope` as exceptions with their reasons.

`mintAnnotationId(kinds)` compiles one JSON body encoder per kind when it is applied to a registry and takes the kind-independent `{ _tag, targets, body }` shape, so a generic caller such as the document codec needs no cast. `assemble` mints every key first, then refuses in a fixed order (`anchor-off-capture`, `target-without-anchor`, `reference-unresolved`), and repeated parts collapse to one row each. `encode` returns the canonical JSON value; its bytes are the RFC 8785 form, which `test/fixtures/canonical-document-v1.json` holds.
