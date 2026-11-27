---
title: lane steps state their own scope, environment and member choice instead of inheriting them
date: 2026-11-26
reversal: Inherit Turbo's TUI and ambient op:// values, affected-gate the codegen bundle check and discover ecosystem members.
governs:
  - src/commands/Ci/CiLane.ts#ciLaneStepsForTesting
  - src/commands/Ci/CiLane.ts#runCiLaneSteps
enforcedBy: []
---

Lane bodies that shell out to Turbo get the same env hygiene the root quality runner applies: no interactive TUI, which can leave a killed run's terminal in mouse-capture mode, and no unresolved `op://` token or team references leaking through as literal values on a workstation. The desktop migration bundle is generated from packages/_internal/db-admin/drizzle, which the app has no dependency edge to, so the codegen lane runs that check unaffected-gated and db-admin-only migration pull requests still prove bundle freshness. The ecosystem lane targets its first member, effect-drizzle, explicitly; member discovery is generalized only when a second member exists. The check lane's census step runs after a green Turbo run, because it needs the declarations that run builds and a tree that type-checks, and a red census fails the lane like any other task. It defers a stale compiler stamp, which is Repo Sanity's red, and `--row-packages` narrows the gate to the rows whose packages the run's Turbo selection checked. That selection is replayed as a JSON dry run with the lane's `--affected` and `--filter` shape: without a lane `--filter` the row packages are the positive filters, at most one task per row package; a lane `--filter` is used as given, because Turbo unions positive filters and the row filters would widen it; and `--only` leaves the dependency builds out.

Rejected: inherited environment (stuck terminals, literal op:// values); affected-gating the bundle check (misses db-admin-only changes).
