---
title: "Batch migration, then proposedCloseout leaves the schema"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Revert the migration commit and restore the proposedCloseout field in Goals.schemas.ts."
---

Operator ruling 2026-11-12. The change PR re-runs hosted-only refresh over the 8 packets carrying `proposedCloseout` and the 9 at `completion-gate-unknown`. Proposals whose final has merged and verifies are adopted in that PR; unknowns that verify flip to verified. `proposedCloseout` is then removed from the schema; a proposal whose final has not merged is rewritten to the new shape.
