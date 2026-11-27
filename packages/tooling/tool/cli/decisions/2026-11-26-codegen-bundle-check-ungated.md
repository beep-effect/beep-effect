---
title: the codegen lane checks the desktop migration bundle without affected gating
date: 2026-11-26
reversal: Affected-gate the bundle freshness step with the rest of the codegen lane.
governs:
  - src/commands/Ci/CiLane.ts#ciLaneStepsForTesting
enforcedBy: []
---

The desktop migration bundle is generated from packages/_internal/db-admin/drizzle, which the app has no dependency edge to, so the codegen lane runs that freshness check unaffected-gated and db-admin-only migration pull requests still prove bundle freshness.

Rejected: affected-gating the check, which skips it on db-admin-only migration changes.
