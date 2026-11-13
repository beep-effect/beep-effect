---
title: "Keep the per-request report-limit snapshots"
date: 2026-11-12
lane: "explore/citation-engine-install-and-worker-reuse"
reversal: "Remove the four captureCitationOperationPolicy calls."
---

They stop a caller mutating a returned report from altering the installed policy (the 2026-11-07 fix in `goals/citation-extraction-engine`). Owned values never leave the engine; what leaves is a fresh copy. They are excluded from the detach count. Source: `explorations/citation-engine-install-and-worker-reuse/research/design-review-2026-11-12.md`, finding 7.
