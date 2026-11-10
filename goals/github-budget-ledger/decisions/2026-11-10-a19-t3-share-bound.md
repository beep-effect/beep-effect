---
title: "A19 T3 share: a one-off fleet aggregation, no shared state"
date: 2026-11-10
reversal: "Build a fleet-shared ledger through the gated sharing candidate."
---

The T3 share is bounded by a one-off aggregation of every fleet host's ledger report for the baseline window: T3 plus uncovered spend is at most the hub's `fleetUsed(graphql)` minus the hosts' estimated points and gh estimates. Known in-repo leaks are listed beside it. No state is shared between hosts.

Resolves SPEC ambiguity A19 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").
