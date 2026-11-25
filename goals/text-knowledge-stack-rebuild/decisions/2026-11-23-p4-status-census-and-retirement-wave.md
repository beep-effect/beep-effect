---
title: "P4: status census keeps distinct coordinates and retires envelope in one wave"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Restore a retired facet only with its chapter-11 census and migrated consumers, never by an alias."
---

research/status-census.md names all eight P0 sites with current consumer references. ReviewState, ClaimDispositionStatus, ClaimEvidenceReviewStatus and shared/domain ClaimLifecycle are distinct owner coordinates. ClaimGateResult is the structural verdict coordinate; StructuralVerdict is its duplicate and is removed. ReviewTag is derived from ReviewState. ReviewerDisposition is the reviewer signal value. SQL disposition literals and CHECK remain unchanged. Party, Kb and Holds all migrate in the same commit that deletes makeClaimEnvelope/ClaimVersion, including derived ports, policies, ids, projections, tests and CLI rendering. EvidenceSpan deletion likewise includes all its consumers. Remaining L4 design imports, generators, export and opsScripts registration move or disappear together. No standards exception inventory grows; all new src files are planned at 100 percent coverage.
