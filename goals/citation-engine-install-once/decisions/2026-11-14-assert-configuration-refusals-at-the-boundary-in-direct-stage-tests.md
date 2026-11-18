---
title: "Assert configuration refusals at the boundary in direct-stage tests"
date: 2026-11-14
lane: "perf/citation-owned-configuration"
reversal: "Restore the stage-level configuration decode and the old direct-stage assertions together."
---

Direct-stage tests install a stage below the boundary, so they need owned configuration. One fixture helper, ownCitationTestConfiguration, mints it through the real ownCitationConfiguration (the brand constructor stays private), and installCitationOwnedTestStage adapts a stage installer so existing fixtures keep passing fixture configuration. Correction (review round 4): this decision said tests that asserted a stage refusing a malformed configuration "now hold the same assertion at the boundary". They did not. The adapter's `invalid` thunk and `refuseCitationTestConfiguration(s)` returned the failure the test itself supplied, so each such assertion only proved that a bare schema rejects the value. The thunks and the refuse helpers are removed, and the adapter now dies on a fixture that does not decode. The real boundary refusals are asserted where callers meet them: CitationEngineLive, the default engine and the extractor (decision "Delete the tautological configuration refusal tests and test the real boundaries"). Refusals that remain stage guards (fixed-pattern authentication, duplicate edition ids, bindings mismatch) are still asserted against the installed stage with owned configuration. Pure schema-decode refusal tests were deleted in round 4.
