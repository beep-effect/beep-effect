---
title: Component licenses take their CycloneDX shape from @beep/spdx
date: 2026-11-26
reversal: Emit every license as a `license.id` entry, or classify identifiers and expressions with a local regex.
governs:
  - src/SbomDocument.ts#licensesJson
enforcedBy: []
---

A manifest's `license` is an SPDX expression field (`MIT`, `MIT OR Apache-2.0`
and `UNLICENSED` are all legal), and CycloneDX 1.6 renders the three kinds
differently: `license.id` is constrained to the SPDX identifier enumeration, an
expression goes in a one-element `{ expression }` tuple, anything else is a
named license. The tuple is exclusive, so only a lone license can use it.
`@beep/spdx` (`License.isKnownId`, `isValidExpression`) decides which is which.

Rejected: every value as `license.id`, a document that looks right and validates
wrong; a local regex, a second SPDX engine beside the kit's one.
