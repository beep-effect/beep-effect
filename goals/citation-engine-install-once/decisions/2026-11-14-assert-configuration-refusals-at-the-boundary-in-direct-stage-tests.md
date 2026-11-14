---
title: "Assert configuration refusals at the boundary in direct-stage tests"
date: 2026-11-14
lane: "perf/citation-owned-configuration"
reversal: "Restore the stage-level configuration decode and the old direct-stage assertions together."
---

Direct-stage tests install a stage below the boundary, so they need owned configuration. One fixture helper, ownCitationTestConfiguration, mints it through the real ownCitationConfiguration (the brand constructor stays private), and installCitationOwnedTestStage adapts a stage installer so existing fixtures keep passing fixture configuration. Tests that asserted a stage refusing a malformed configuration now give the adapter the stage's own closed failure, so the same assertion now holds at the boundary; tests that asserted a malformed policy or runtime refusal assert it through refuseCitationTestConfigurations on CitationEngineLimits and CitationNativeProcessRuntime. Refusals that remain stage guards (fixed-pattern authentication, duplicate edition ids, bindings mismatch) are still asserted against the installed stage with owned configuration. No refusal test was deleted.
