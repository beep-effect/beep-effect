---
title: "Restating leads are flagged by the JSDoc inventory ratchet, not oxlint informative-docs"
date: 2026-11-22
lane: "goals/jsdoc-lead-single-source-p0"
reversal: "Port leadRestates into packages/tooling/policy-pack/lint-rules/src/rules/docs.ts informative-docs and drop the restating-lead inventory rule."
---

The oxlint docs rules only cover packages/tooling/*/*/src, while restating leads sit in every package; the JSDoc inventory already scans every docgen package and its ratchet is a required check. The inventory gains a counted-only rule restating-lead (it never opens a package, so packagesNeedingRemediation cannot grow) whose baseline starts at the measured count and may only fall. Extending informative-docs would also need a @beep/repo-utils dependency in @beep/lint-rules, which moves bun.lock, a CI binary closure input frozen during the P5 cutover.
