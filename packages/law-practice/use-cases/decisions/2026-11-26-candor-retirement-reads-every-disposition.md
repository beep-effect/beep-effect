---
title: Candor retirement is derived from every recorded disposition before the binding filter
date: 2026-11-26
reversal: Compute retiredDispositionIds from the dispositions already filtered to the head's eventId and textDigest in dispositionReason.
governs:
  - src/CandorPolicy/CandorPolicy.service.ts#retiredDispositionIds
  - src/CandorPolicy/CandorPolicy.service.ts#effectiveDispositions
  - src/CandorPolicy/CandorPolicy.service.ts#dispositionReason
enforcedBy: []
---

`dispositionReason` derives the retired disposition ids from the whole recorded set, then filters to the dispositions bound to the head observation. A disposition is effective only when its lifecycle is active and no other record retires it: a `superseded` or `withdrawn` record drops its own coverage, and an appended superseding record drops the coverage of the record it names.
Reason: a superseding record may carry a different `disposes` binding than the record it retires. Filtering first would drop the retiring row before its `supersedes` reference is read and leave a retired judgment looking effective, a fail-open hole in a gate that must fail closed.
Rejected: deriving retirement from the bound subset only, and treating an active lifecycle alone as effective.
