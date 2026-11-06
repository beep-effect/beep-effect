---
title: "Completion moves to a docs-only re-final PR because #2771 merged before merge-ready"
date: 2026-11-06
lane: "docs/research-library-ontology-closeout"
reversal: "Point completionGate and proposedCloseout back at #2771 if completion refresh later accepts its readiness evidence"
---

The orchestrator merged #2771 at 33bbb5ba32 while Heavy / Coverage Regression was red. The red was inherited cache and new-file coverage drift, fixed by 33bbb5ba32 and by #2778. #2771's until-ready monitor never recorded merge-ready, so goals completion refresh --readiness-job returned unsatisfied. Following the hold-ledger #2755 / effect-vitest-canon #2586 route, #2771 becomes a supporting PR, and this docs-only PR is the final PR, driven through final-check, ready and until-ready to merge-ready before it merges.
