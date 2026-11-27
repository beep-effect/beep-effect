---
title: Candor coverage reports the first unmet check as a reason instead of raising
date: 2026-11-26
reversal: Let coverageReason fail with the resolver or anchor error, and report every failing check in dispositionReason.
governs:
  - src/CandorPolicy/CandorPolicy.service.ts#coverageReason
  - src/CandorPolicy/CandorPolicy.service.ts#dispositionReason
enforcedBy: []
---

Every failure path of `coverageReason` returns an `UncoveredReason`: a source that will not resolve is `source-unresolved` and an anchor that will not re-verify is `anchor-unverified`. `dispositionReason` returns the first unmet check in reading order: is there a judgment at all, does it still stand, did a human make it, did that human record a Rule 56 decision.
Reason: a raised failure lets a caller skip the check and promote anyway; a gap reported as a reason blocks promotion and says why.
Rejected: raising resolver and anchor failures, and listing every failing check at once.
