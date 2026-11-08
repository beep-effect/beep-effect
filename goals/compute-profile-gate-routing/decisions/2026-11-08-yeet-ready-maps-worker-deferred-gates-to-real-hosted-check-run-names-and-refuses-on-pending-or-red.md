---
title: "yeet ready maps worker-deferred gates to real hosted check-run names and refuses on pending or red"
date: 2026-11-08
lane: "goals/compute-profile-gate-routing-p1"
reversal: "Drop gateHostedContextTable and the hostedChecks read in ReadyGate.ts; profile skips then behave like operator skips (named, never checked)."
---

The GateRouteId to hosted-context table sits next to GateRoute in GateRoute.schemas.ts. Names were verified with gh api against origin/main 0c1b780e564 and merged PR heads: cheap-gates and both catalog hooks map to Repo Sanity; lint-policy, check, docgen and coverage map to Heavy / Lint Policy, Heavy / Check, Heavy / Docgen and Heavy / Coverage Regression (the gates-and-proof table omits the Heavy prefix); fallow maps to Fallow Advisory Envelopes. The newest run per name decides, reusing mergeGateLatestRunPerName. A conclusion the merge gate counts green (success, skipped, neutral) accepts the gate. A missing or pending run refuses with wait for hosted <context>, and any other conclusion refuses naming the red. A failed check-run read refuses too, because an unread run is unknown, never green. Operator skips with any other reason keep today's behaviour.
