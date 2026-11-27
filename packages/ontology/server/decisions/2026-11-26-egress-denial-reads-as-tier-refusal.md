---
title: A governed egress denial is flattened into the tier-gate refusal; other transport failures stay distinct
date: 2026-11-26
reversal: Map every HttpClientError in publicationFailure to OntologyToolExecutionError, or import the refusal guidance from the tier-gate slice.
governs:
  - src/tools/OntologyToolHandlers.ts#publicationFailure
  - src/tools/OntologyToolHandlers.ts#egressRefusalGuidance
  - src/tools/OntologyToolHandlers.ts#publishProvenance
enforcedBy: []
---

The egress boundary rejects with `EgressDenied`, which `HttpClient` surfaces as a `TransportError` carrying it as the cause. `publicationFailure` turns only that case into `OntologyTierGateRefusal` with `egressRefusalGuidance`; every other transport failure stays an `OntologyToolExecutionError`.
The guidance is byte-identical to what `gatedMutation` produces from a refused dispatch, so a destination denial and an operation denial look the same to the agent, and naming no destination keeps an agent from mapping the allowlist by probing.
The string is restated, not imported: the gate lives in another slice and slices do not import each other. The composition-root test in the app, which sees both sides, keeps them in sync.
Rejected: a distinct denial error, which leaks the allowlist; flattening every transport failure, which hides real outages from operators; importing the gate's guidance across slices.
