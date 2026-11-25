---
title: "P4 checkpoint: L4 claims are content-complete in the lane"
date: 2026-11-23
kind: checkpoint
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Reopen P4 by reverting the lane commits from 2ced3e0a632 onward; the stored-format readers keep old bytes readable either way."
---

P4 rows 0 to 9 are committed on goals/text-knowledge-stack-rebuild-p4-claims (row 6 2ced3e0a632, row 7 960b792a314, row 8 97b2de8a43b, plus fix 35406cb973f for a row-5 entity-kit-freeze defect). Every PLAN P4 exit has a test or a record: L4-1 to L4-7 are green in packages/foundation/modeling/epistemics/test; OfficeActionReview.signals, Extractor.signals, DocketReview.unavailable-document-text, NanopubAdapter and ClaimGate.two-claims-one-occurrence exist; research/status-census.md records the eight status sites; EvidenceSpan and makeClaimEnvelope/ClaimVersion are deleted and their stored rows read through frozen private readers; the L4 design sketch and its generators left ops/design. Row 10 refreshes catalogs and coverage registrations; the PR is opened only by the owning lane.
