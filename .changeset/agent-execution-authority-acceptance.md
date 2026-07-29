---
{}
---

No release: land the execution-authority acceptance suite and close the
`agent-execution-authority` packet.

`apps/professional-desktop/test/integration/execution-authority.pglite.test.ts` drives a
real MCP session over HTTP against a real PGlite-backed ledger and proves the three
properties the per-PR suites did not.

A poisoned read followed by a publish to a destination named *inside that tool's output* is
denied at egress, with the denial reason pinned on the ledger row.

The ledger holds no payload: a canary planted in the outbound publish body is absent from
the serialized rows, and — the assertion that actually carries the guarantee — the exact
physical column set of both tables is pinned from `information_schema.columns`. A nullable
`payload TEXT` column added to the migration would otherwise serialize as `payload: null`
and pass, since the existing descriptor test inspects the Drizzle projection rather than
the database.

The ledger's critical-path cost is bounded per path, in before/after deltas around the
dispatch: a tier-only dispatch writes 2 rows (decision, outcome), while an allowed publish
writes 4, because governed egress records and settles its own decision.

Also fixes a defect in the PR 6 egress boundary that this suite exposed: `GovernedEgress`
wrote its write-ahead decision but never settled it, so every *successful* publish sat
permanently in the derived "decided, outcome unknown" state that is supposed to signal a
crash or a failed outcome write. Authorization now returns the allowed decision's identity
and a sealed `completed`/`failed` outcome is appended when the POST settles. Denied
decisions still receive no outcome, and an outcome-write failure never converts a
successful POST into a failed one.

The composed fixture asserts on two decision chains, not one. The tier gate grants the
publish *operation* and the egress boundary refuses the *destination*, so the denial is
recorded in the egress boundary's own run — `Fetch` has no fiber and cannot read
`CurrentMcpCaller`, so the two chains correlate by time.

The MCP HTTP test harness moves to `test/integration/support/ontology-mcp-harness.ts` so
both suites share one server bootstrap.

Packet closeout: the README now carries a criterion-to-proof map covering every `SPEC.md`
acceptance criterion, and the closeout reflection lands with it.
