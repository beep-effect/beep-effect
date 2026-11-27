---
title: StatelyInspector forwards xstate v6 inspection events by hand instead of the SDK inspect hook
date: 2026-11-26
reversal: Pass the Stately SDK's own inspect hook to actor.inspect and delete forwardInspection.
governs:
  - src/StatelyInspector.service.ts#forwardInspection
enforcedBy: []
---

`@xstate/effect` re-materializes the root actor reference on every pure step. The Stately SDK's own `inspect` hook reports each re-materialized reference as a duplicate session id, so the timeline splits one actor into many. `forwardInspection` maps `@xstate.actor` and event inspection records onto `inspector.actor`, `inspector.event`, `inspector.snapshot` and `inspector.stop` keyed by the stable `sessionId`.
Rejected: the SDK `inspect` hook, which produces the duplicate session ids above.
Accepted limit: transitional. Return to the SDK hook once it de-duplicates by `sessionId` across re-materialized references.
